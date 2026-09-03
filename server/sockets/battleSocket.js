/**
 * CRINGE METER — Real-Time Multiplayer Socket.IO Controller
 * Handles 1v1 matchmaking queue, live battle state synchronization,
 * room lifecycle, and authoritative round completion.
 */

const matchmaking = require('../matchmaking');
const gameRooms = require('../gameRooms');
const { generateLiveKitToken } = require('../livekit');
const matchService = require('../services/matchService');
const reportService = require('../services/reportService');
const blockService = require('../services/blockService');
const { LIVEKIT_URL } = require('../config/constants');

/**
 * Pairs players in queue, creates 1v1 game rooms, and issues LiveKit WebRTC tokens.
 */
async function attemptMatchmaking(io) {
  const match = matchmaking.findMatch();
  if (!match) return;

  const { playerA, playerB } = match;
  console.log(`[MATCHMAKING] Paired ${playerA.displayName} (${playerA.socketId}) with ${playerB.displayName} (${playerB.socketId})`);

  const room = gameRooms.createRoom(playerA, playerB);
  const livekitRoomName = `cringe_room_${room.sessionId}`;

  try {
    const identityA = `${playerA.userId || 'guest'}_${playerA.socketId.substring(0, 6)}`;
    const identityB = `${playerB.userId || 'guest'}_${playerB.socketId.substring(0, 6)}`;

    const [tokenA, tokenB] = await Promise.all([
      generateLiveKitToken(livekitRoomName, identityA, playerA.displayName),
      generateLiveKitToken(livekitRoomName, identityB, playerB.displayName)
    ]);

    // Send match details to Player A (Performer)
    io.to(playerA.socketId).emit('match_found', {
      sessionId: room.sessionId,
      role: 'PERFORMER',
      opponent: {
        userId: playerB.userId,
        displayName: playerB.displayName,
        avatar: playerB.avatar,
        level: playerB.level || 1,
        title: playerB.title || 'CRINGER'
      },
      cringePrompt: room.currentPrompt,
      livekit: {
        url: LIVEKIT_URL,
        roomName: livekitRoomName,
        token: tokenA.token || tokenA
      }
    });

    // Send match details to Player B (Defender)
    io.to(playerB.socketId).emit('match_found', {
      sessionId: room.sessionId,
      role: 'DEFENDER',
      opponent: {
        userId: playerA.userId,
        displayName: playerA.displayName,
        avatar: playerA.avatar,
        level: playerA.level || 1,
        title: playerA.title || 'CRINGER'
      },
      cringePrompt: room.currentPrompt,
      livekit: {
        url: LIVEKIT_URL,
        roomName: livekitRoomName,
        token: tokenB.token || tokenB
      }
    });

    console.log(`[MATCHMAKING] Dispatched match_found to room ${room.sessionId}`);
  } catch (err) {
    console.error("[MATCHMAKING] LiveKit token generation error:", err);
  }
}

/**
 * Registers all Socket.IO multiplayer events
 */
function setupBattleSockets(io) {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // 1. Join matchmaking queue
    socket.on('find_match', (playerData) => {
      console.log(`[SOCKET] find_match from ${socket.id} (${playerData?.displayName})`);
      matchmaking.addToQueue(playerData, socket.id);
      socket.emit('matchmaking_status', { status: 'SEARCHING' });
      attemptMatchmaking(io);
    });

    // 2. Cancel matchmaking queue
    socket.on('cancel_match', () => {
      console.log(`[SOCKET] cancel_match from ${socket.id}`);
      matchmaking.removeFromQueue(socket.id);
      socket.emit('matchmaking_status', { status: 'IDLE' });
    });

    // 3. Shuffle prompt
    socket.on('shuffle_prompt', (data) => {
      const room = gameRooms.getRoomBySocketId(socket.id);
      if (room) {
        const updatedRoom = gameRooms.shufflePrompt(room.sessionId, data ? data.customPrompt : null);
        if (updatedRoom) {
          const payload = {
            prompt: updatedRoom.currentPrompt,
            isCustom: updatedRoom.isCustomPrompt
          };
          io.to(updatedRoom.playerA.socketId).emit('prompt_updated', payload);
          io.to(updatedRoom.playerB.socketId).emit('prompt_updated', payload);
        }
      }
    });

    // 4. Player laughed / broke (Authoritative win/loss resolution)
    socket.on('player_laughed', async () => {
      const room = gameRooms.getRoomBySocketId(socket.id);
      if (room && room.status !== 'FINISHED') {
        room.status = 'FINISHED';
        const isPerformer = (socket.id === room.performerSocketId);
        const winnerId = isPerformer ? room.reactorId : room.performerId;
        const loserId = isPerformer ? room.performerId : room.reactorId;
        const winnerObj = (winnerId === room.playerA.userId) ? room.playerA : room.playerB;
        const loserObj = (loserId === room.playerA.userId) ? room.playerA : room.playerB;

        // Persist verified match outcome
        await matchService.recordMatchResult(room.sessionId, winnerObj, loserObj, 'dont_laugh', 150, 40);
        io.emit('leaderboard_updated', { type: 'round_finished' });

        const resultPayload = {
          sessionId: room.sessionId,
          reason: isPerformer ? 'PERFORMER_LAUGHED' : 'DEFENDER_LAUGHED',
          winnerUserId: winnerId,
          loserSocketId: socket.id
        };

        io.to(room.playerA.socketId).emit('round_result', resultPayload);
        io.to(room.playerB.socketId).emit('round_result', resultPayload);
      }
    });

    // 5. Next match (Skip current stranger)
    socket.on('next_match', (playerData) => {
      console.log(`[SOCKET] next_match pressed by ${socket.id}`);
      const leftInfo = gameRooms.handlePlayerLeave(socket.id);
      if (leftInfo && leftInfo.otherPlayer) {
        io.to(leftInfo.otherPlayer.socketId).emit('stranger_disconnected', {
          reason: 'STRANGER_NEXT'
        });
      }

      matchmaking.addToQueue(playerData, socket.id);
      socket.emit('matchmaking_status', { status: 'SEARCHING' });
      attemptMatchmaking(io);
    });

    // 6. Leave match
    socket.on('leave_match', () => {
      console.log(`[SOCKET] leave_match from ${socket.id}`);
      matchmaking.removeFromQueue(socket.id);
      const leftInfo = gameRooms.handlePlayerLeave(socket.id);
      if (leftInfo && leftInfo.otherPlayer) {
        io.to(leftInfo.otherPlayer.socketId).emit('stranger_disconnected', {
          reason: 'STRANGER_LEFT'
        });
      }
      socket.emit('matchmaking_status', { status: 'IDLE' });
    });

    // 7. Safety report
    socket.on('report_user', async (reportData) => {
      await reportService.addReport({
        ...reportData,
        reporterInternalId: reportData?.reporterUserId,
        reportedInternalId: reportData?.targetUserId
      });
      socket.emit('report_acknowledged', { success: true });
    });

    // 8. Block user
    socket.on('block_user', async (data) => {
      if (data && data.targetUserId && data.userId) {
        await blockService.blockUser(data.userId, data.targetUserId);
      }
      socket.emit('block_acknowledged', { success: true });
    });

    // 9. Disconnect cleanup
    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
      matchmaking.removeFromQueue(socket.id);
      const leftInfo = gameRooms.handlePlayerLeave(socket.id);
      if (leftInfo && leftInfo.otherPlayer) {
        io.to(leftInfo.otherPlayer.socketId).emit('stranger_disconnected', {
          reason: 'STRANGER_DISCONNECTED'
        });
      }
    });
  });
}

module.exports = {
  setupBattleSockets,
  attemptMatchmaking
};
