/**
 * CRINGE METER — Authoritative Online Server
 * Express + Socket.IO Server for 1v1 Matchmaking, Game State Sync, LiveKit WebRTC Token Issuance, and Safety Reporting.
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const matchmaking = require('./matchmaking');
const gameRooms = require('./gameRooms');
const { generateLiveKitToken } = require('./livekit');
const safetyManager = require('./reports');
const leaderboardStore = require('./leaderboardStore');

const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'CRINGE METER Server',
    queueLength: matchmaking.getQueueLength(),
    activeRooms: gameRooms.rooms.size
  });
});

// Reports endpoint
app.post('/api/reports', (req, res) => {
  const report = safetyManager.addReport(req.body);
  res.json({ success: true, report });
});

// Subscription status endpoint
app.get('/api/subscription/status/:userId', (req, res) => {
  const userId = req.params.userId;
  res.json({
    userId,
    planId: 'cringe_vip_monthly_599',
    priceUsd: 5.99,
    isVip: false,
    vipStatus: 'FREE',
    vipExpiresAt: null
  });
});

// Leaderboard endpoints
app.get('/api/leaderboard', (req, res) => {
  const type = req.query.type || 'global';
  const limit = parseInt(req.query.limit, 10) || 50;
  const search = req.query.search || '';
  const result = leaderboardStore.getLeaderboard(type, limit, search);
  res.json({ success: true, ...result });
});

app.get('/api/leaderboard/me', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
  const result = leaderboardStore.getPlayerRank(userId);
  res.json({ success: true, ...result });
});

app.post('/api/leaderboard/record-match', (req, res) => {
  const { winner, loser } = req.body;
  leaderboardStore.recordMatchResult(winner, loser);
  if (io) io.emit('leaderboard_updated', { type: 'match_finished' });
  res.json({ success: true });
});

app.post('/api/leaderboard/sync-player', (req, res) => {
  const player = leaderboardStore.upsertPlayer(req.body);
  if (io) io.emit('leaderboard_updated', { type: 'player_synced' });
  res.json({ success: true, player });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // 1. FIND MATCH REQUEST
  socket.on('find_match', (playerData) => {
    console.log(`[SOCKET] find_match from ${socket.id} (${playerData.displayName})`);
    
    // Add to matchmaking queue
    matchmaking.addToQueue(playerData, socket.id);
    socket.emit('matchmaking_status', { status: 'SEARCHING' });

    // Attempt to pair
    attemptMatchmaking();
  });

  // 2. CANCEL MATCHMAKING
  socket.on('cancel_match', () => {
    console.log(`[SOCKET] cancel_match from ${socket.id}`);
    matchmaking.removeFromQueue(socket.id);
    socket.emit('matchmaking_status', { status: 'IDLE' });
  });

  // 3. SHUFFLE PROMPT
  socket.on('shuffle_prompt', (data) => {
    const room = gameRooms.getRoomBySocketId(socket.id);
    if (room) {
      const updatedRoom = gameRooms.shufflePrompt(room.sessionId, data ? data.customPrompt : null);
      if (updatedRoom) {
        io.to(updatedRoom.playerA.socketId).emit('prompt_updated', {
          prompt: updatedRoom.currentPrompt,
          isCustom: updatedRoom.isCustomPrompt
        });
        io.to(updatedRoom.playerB.socketId).emit('prompt_updated', {
          prompt: updatedRoom.currentPrompt,
          isCustom: updatedRoom.isCustomPrompt
        });
      }
    }
  });

  // 4. PLAYER BROKE / LAUGHED
  socket.on('player_laughed', (data) => {
    const room = gameRooms.getRoomBySocketId(socket.id);
    if (room) {
      const isPerformer = (socket.id === room.performerSocketId);
      const winnerId = isPerformer ? room.reactorId : room.performerId;
      const loserId = isPerformer ? room.performerId : room.reactorId;
      const winnerObj = (winnerId === room.playerA.userId) ? room.playerA : room.playerB;
      const loserObj = (loserId === room.playerA.userId) ? room.playerA : room.playerB;

      leaderboardStore.recordMatchResult(winnerObj, loserObj);
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

  // 5. NEXT MATCH (SKIP STRANGER)
  socket.on('next_match', (playerData) => {
    console.log(`[SOCKET] next_match pressed by ${socket.id}`);
    
    // Clean up current room if in one
    const leftInfo = gameRooms.handlePlayerLeave(socket.id);
    if (leftInfo && leftInfo.otherPlayer) {
      io.to(leftInfo.otherPlayer.socketId).emit('stranger_disconnected', {
        reason: 'STRANGER_NEXT'
      });
    }

    // Immediately re-queue the player
    matchmaking.addToQueue(playerData, socket.id);
    socket.emit('matchmaking_status', { status: 'SEARCHING' });

    attemptMatchmaking();
  });

  // 6. LEAVE MATCH
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

  // 7. REPORT USER
  socket.on('report_user', (reportData) => {
    safetyManager.addReport({
      ...reportData,
      reporterSocketId: socket.id
    });
    socket.emit('report_acknowledged', { success: true });
  });

  // 8. BLOCK USER
  socket.on('block_user', (data) => {
    if (data && data.targetUserId && data.userId) {
      safetyManager.blockUser(data.userId, data.targetUserId);
    }
    
    // Trigger NEXT logic
    socket.emit('block_acknowledged', { success: true });
  });

  // 9. DISCONNECT
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

// Matchmaker runner
async function attemptMatchmaking() {
  const match = matchmaking.findPair();
  if (match) {
    const { playerA, playerB } = match;
    const room = gameRooms.createRoom(playerA, playerB);

    // Generate LiveKit tokens for both players (async JWT)
    const tokenA = await generateLiveKitToken(room.roomName, playerA.userId, playerA.displayName);
    const tokenB = await generateLiveKitToken(room.roomName, playerB.userId, playerB.displayName);

    const matchPayloadA = {
      sessionId: room.sessionId,
      roomName: room.roomName,
      opponent: playerB,
      role: (playerA.userId === room.performerId) ? 'PERFORMER' : 'DEFENDER',
      cringePrompt: room.currentPrompt,
      livekit: tokenA
    };

    const matchPayloadB = {
      sessionId: room.sessionId,
      roomName: room.roomName,
      opponent: playerA,
      role: (playerB.userId === room.performerId) ? 'PERFORMER' : 'DEFENDER',
      cringePrompt: room.currentPrompt,
      livekit: tokenB
    };

    io.to(playerA.socketId).emit('match_found', matchPayloadA);
    io.to(playerB.socketId).emit('match_found', matchPayloadB);

    console.log(`[MATCHMAKING] Emitted match_found with LiveKit tokens to ${playerA.displayName} and ${playerB.displayName}`);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`⚡ CRINGE METER Server running on http://localhost:${PORT}`);
  console.log(`==================================================`);
});
