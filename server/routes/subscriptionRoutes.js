/**
 * CRINGE METER — VIP Subscription Routes
 */

const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscriptionService');

// Get VIP subscription status by user ID
router.get('/api/subscription/status/:userId', async (req, res) => {
  const userId = req.params.userId;
  const status = await subscriptionService.getSubscriptionStatus(userId);
  res.json(status);
});

module.exports = router;
