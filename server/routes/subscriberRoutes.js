/**
 * CRINGE METER — Newsletter & Subscriber Routes
 */

const express = require('express');
const router = express.Router();
const subscriberService = require('../services/subscriberService');

// Subscribe email
router.post('/api/subscribers', async (req, res) => {
  const { email, displayName, userId, source } = req.body;
  const result = await subscriberService.addSubscriber(email, displayName, userId, source);
  res.json(result);
});

// Unsubscribe via token
router.get('/api/subscribers/unsubscribe', async (req, res) => {
  const token = req.query.token;
  const result = await subscriberService.unsubscribe(token);
  res.json(result);
});

module.exports = router;
