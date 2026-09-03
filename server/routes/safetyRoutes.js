/**
 * CRINGE METER — Safety Reports & Moderation Routes
 */

const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const blockService = require('../services/blockService');

// Submit safety report
router.post('/api/reports', async (req, res) => {
  const result = await reportService.addReport(req.body);
  res.json(result);
});

// Block user
router.post('/api/blocks', async (req, res) => {
  const { blockerId, blockedId } = req.body;
  const result = await blockService.blockUser(blockerId, blockedId);
  res.json(result);
});

module.exports = router;
