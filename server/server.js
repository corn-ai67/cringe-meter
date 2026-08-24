/**
 * CRINGE METER — Authoritative Online Server (Supabase PostgreSQL Integrated)
 * Express + Socket.IO Server for 1v1 Matchmaking, Game State Sync, LiveKit WebRTC Token Issuance,
 * Real-time Leaderboards, and Supabase Cloud Storage.
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const matchmaking = require('./matchmaking');
const gameRooms = require('./gameRooms');
const { generateLiveKitToken } = require('./livekit');

// Supabase PostgreSQL Cloud Services
const { isConfigured: isDbConfigured, testConnection: testDbConnection } = require('./services/supabase');
const userService = require('./services/userService');
const matchService = require('./services/matchService');
const leaderboardService = require('./services/leaderboardService');
const subscriptionService = require('./services/subscriptionService');
const subscriberService = require('./services/subscriberService');
const reportService = require('./services/reportService');
const blockService = require('./services/blockService');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// Dedicated Terms & Safety Rules Page Route
app.get(['/terms', '/terms.html', '/safety', '/rules'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'terms.html'));
});

// Terms Configuration & Acceptance API
app.get('/api/config/terms', (req, res) => {
  res.json({
    version: '1.0',
    lastUpdated: '2026-08-24',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@cringemeter.io',
    minAge: 18,
    fullTermsUrl: '/terms'
  });
});

app.post('/api/terms/accept', async (req, res) => {
  const { userId, termsVersion } = req.body;
  res.json({
    success: true,
    termsVersion: termsVersion || '1.0',
    acceptedAt: new Date().toISOString()
  });
});

// ====================================================================
// 1. HEALTH & SYSTEM CHECK ENDPOINTS
// ====================================================================
app.get('/api/health', async (req, res) => {
  const dbStatus = await testDbConnection();
  res.json({
    status: 'ONLINE',
    service: 'CRINGE METER Server',
    database: dbStatus.status,
    databaseMessage: dbStatus.message,
    queueLength: matchmaking.getQueueLength(),
    activeRooms: gameRooms.rooms.size
  });
});

// ====================================================================
// 2. USER & AUTH ENDPOINTS
// ====================================================================
app.post('/api/auth/login', async (req, res) => {
  const { email, username, internalUserId, profile } = req.body;
  const result = await userService.authenticateOrRegister({
    email,
    username,
    internalUserId,
    profile: profile || {}
  });
  res.json(result);
});

app.get('/api/users/me', async (req, res) => {
  const userId = req.query.userId;
  const email = req.query.email;
  if (!userId && !email) return res.status(400).json({ success: false, message: 'Missing userId or email' });

  if (userId) {
    const user = await userService.getUserById(userId);
    if (user) {
      return res.json({ success: true, user });
    }
  }

  const result = await userService.authenticateOrRegister({ email, internalUserId: userId });
  res.json(result);
});

app.post('/api/users/sync', async (req, res) => {
  const { userId, profile } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
  const updated = await userService.updateProfile(userId, profile || {});
  res.json({ success: true, user: updated });
});

// ====================================================================
// 3. VIP SUBSCRIPTION STATUS ENDPOINTS
// ====================================================================
app.get('/api/subscription/status/:userId', async (req, res) => {
  const userId = req.params.userId;
  const status = await subscriptionService.getSubscriptionStatus(userId);
  res.json(status);
});

// ====================================================================
// 4. SUPABASE POSTGRESQL LEADERBOARD ENDPOINTS
// ====================================================================
app.get('/api/leaderboard', async (req, res) => {
  const type = req.query.type || 'global';
  const limit = parseInt(req.query.limit, 10) || 50;
  const search = req.query.search || '';
  const result = await leaderboardService.getLeaderboard(type, limit, search);
  res.json({ success: true, ...result });
});

app.get('/api/leaderboard/me', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
  const result = await leaderboardService.getPlayerRank(userId);
  res.json({ success: true, ...result });
});

// ====================================================================
// 5. MATCH OUTCOME RECORDING ENDPOINT
// ====================================================================
app.post(['/api/leaderboard/record-match', '/api/matches/complete'], async (req, res) => {
  const { sessionId, winner, loser, mode, winnerScore, loserScore } = req.body;
  const matchSessionId = sessionId || `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const result = await matchService.recordMatchResult(
    matchSessionId,
    winner,
    loser,
    mode || 'dont_laugh',
    winnerScore || 150,
    loserScore || 40
  );
  if (io) io.emit('leaderboard_updated', { type: 'match_finished' });
  res.json(result);
});

// ====================================================================
// 6. EMAIL MARKETING SUBSCRIBERS ENDPOINTS
// ====================================================================
app.post('/api/subscribers', async (req, res) => {
  const { email, displayName, userId, source } = req.body;
  const result = await subscriberService.addSubscriber(email, displayName, userId, source);
  res.json(result);
});

app.get('/api/subscribers/unsubscribe', async (req, res) => {
  const token = req.query.token;
  const result = await subscriberService.unsubscribe(token);
  res.json(result);
});

// ====================================================================
// 7. SAFETY REPORTS & BLOCKS ENDPOINTS
// ====================================================================
app.post('/api/reports', async (req, res) => {
  const result = await reportService.addReport(req.body);
  res.json(result);
});

app.post('/api/blocks', async (req, res) => {
  const { blockerId, blockedId } = req.body;
  const result = await blockService.blockUser(blockerId, blockedId);
  res.json(result);
});

// ====================================================================
// 8. SOCKET.IO MULTIPLAYER & REAL-TIME EVENT HANDLING
// ====================================================================
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
    console.log(`[SOCKET] find_match from ${socket.id} (${playerData?.displayName})`);
    matchmaking.addToQueue(playerData, socket.id);
    socket.emit('matchmaking_status', { status: 'SEARCHING' });
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

  // 4. PLAYER BROKE / LAUGHED (Record verified result to Supabase)
  socket.on('player_laughed', async (data) => {
    const room = gameRooms.getRoomBySocketId(socket.id);
    if (room) {
      const isPerformer = (socket.id === room.performerSocketId);
      const winnerId = isPerformer ? room.reactorId : room.performerId;
      const loserId = isPerformer ? room.performerId : room.reactorId;
      const winnerObj = (winnerId === room.playerA.userId) ? room.playerA : room.playerB;
      const loserObj = (loserId === room.playerA.userId) ? room.playerA : room.playerB;

      // Authoritatively persist match to Supabase
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

  // 5. NEXT MATCH (SKIP STRANGER)
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

  // 7. REPORT USER (Persists to Supabase)
  socket.on('report_user', async (reportData) => {
    await reportService.addReport({
      ...reportData,
      reporterInternalId: reportData?.reporterUserId,
      reportedInternalId: reportData?.targetUserId
    });
    socket.emit('report_acknowledged', { success: true });
  });

  // 8. BLOCK USER (Persists to Supabase)
  socket.on('block_user', async (data) => {
    if (data && data.targetUserId && data.userId) {
      await blockService.blockUser(data.userId, data.targetUserId);
    }
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

// ====================================================================
// 9. MATCHMAKING PAIRING LOGIC & LIVEKIT TOKEN ISSUANCE
// ====================================================================
async function attemptMatchmaking() {
  const match = matchmaking.findMatch();
  if (!match) return;

  const { playerA, playerB } = match;
  console.log(`[MATCHMAKING] Paired ${playerA.displayName} (${playerA.socketId}) with ${playerB.displayName} (${playerB.socketId})`);

  const room = gameRooms.createRoom(playerA, playerB);
  const livekitRoomName = `cringe_room_${room.sessionId}`;

  try {
    const [tokenA, tokenB] = await Promise.all([
      generateLiveKitToken(livekitRoomName, playerA.userId, playerA.displayName),
      generateLiveKitToken(livekitRoomName, playerB.userId, playerB.displayName)
    ]);

    const livekitUrl = process.env.LIVEKIT_URL || 'wss://cringe-meter-gbi9jmfs.livekit.cloud';

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
        url: livekitUrl,
        roomName: livekitRoomName,
        token: tokenA
      }
    });

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
        url: livekitUrl,
        roomName: livekitRoomName,
        token: tokenB
      }
    });

    console.log(`[MATCHMAKING] Sent match_found & LiveKit credentials to room ${room.sessionId}`);
  } catch (err) {
    console.error("[MATCHMAKING] LiveKit token generation error:", err);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("==================================================");
  console.log(`⚡ CRINGE METER Server running on http://localhost:${PORT}`);
  console.log("==================================================");
});
