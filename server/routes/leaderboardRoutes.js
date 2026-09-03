/**
 * CRINGE METER — Leaderboard & Match Outcome Routes
 */

const express = require('express');
const router = express.Router();
const leaderboardService = require('../services/leaderboardService');
const matchService = require('../services/matchService');

// Global / Weekly Leaderboard
router.get('/api/leaderboard', async (req, res) => {
  const type = req.query.type || 'global';
  const limit = parseInt(req.query.limit, 10) || 50;
  const search = req.query.search || '';
  const result = await leaderboardService.getLeaderboard(type, limit, search);
  res.json({ success: true, ...result });
});

// Player Rank in Leaderboard
router.get('/api/leaderboard/me', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Missing userId' });
  }
  const result = await leaderboardService.getPlayerRank(userId);
  res.json({ success: true, ...result });
});

// Record Match Result
router.post(['/api/leaderboard/record-match', '/api/matches/complete'], async (req, res) => {
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

  // Broadcast real-time leaderboard update via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.emit('leaderboard_updated', { type: 'match_finished' });
  }

  res.json(result);
});

module.exports = router;
