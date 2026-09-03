/**
 * CRINGE METER — Authentication & User Profile Routes
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');

// Login / Register
router.post('/api/auth/login', async (req, res) => {
  const { email, username, internalUserId, profile } = req.body;
  const result = await userService.authenticateOrRegister({
    email,
    username,
    internalUserId,
    profile: profile || {}
  });
  res.json(result);
});

// Current User Profile
router.get('/api/users/me', async (req, res) => {
  const userId = req.query.userId;
  const email = req.query.email;
  if (!userId && !email) {
    return res.status(400).json({ success: false, message: 'Missing userId or email' });
  }

  if (userId) {
    const user = await userService.getUserById(userId);
    if (user) {
      return res.json({ success: true, user });
    }
  }

  const result = await userService.authenticateOrRegister({ email, internalUserId: userId });
  res.json(result);
});

// Profile Sync
router.post('/api/users/sync', async (req, res) => {
  const { userId, profile } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Missing userId' });
  }
  const updated = await userService.updateProfile(userId, profile || {});
  res.json({ success: true, user: updated });
});

module.exports = router;
