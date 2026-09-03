/**
 * CRINGE METER — System & Health Routes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { testConnection: testDbConnection } = require('../services/supabase');
const matchmaking = require('../matchmaking');
const gameRooms = require('../gameRooms');
const { SUPPORT_EMAIL, TERMS_VERSION, MIN_AGE } = require('../config/constants');

// Health Check
router.get('/api/health', async (req, res) => {
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

// Terms & Safety Rules Static Page
router.get(['/terms', '/terms.html', '/safety', '/rules'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'terms.html'));
});

// Terms Configuration
router.get('/api/config/terms', (req, res) => {
  res.json({
    version: TERMS_VERSION,
    lastUpdated: '2026-08-24',
    supportEmail: SUPPORT_EMAIL,
    minAge: MIN_AGE,
    fullTermsUrl: '/terms'
  });
});

// Terms Acceptance
router.post('/api/terms/accept', async (req, res) => {
  const { termsVersion } = req.body;
  res.json({
    success: true,
    termsVersion: termsVersion || TERMS_VERSION,
    acceptedAt: new Date().toISOString()
  });
});

module.exports = router;
