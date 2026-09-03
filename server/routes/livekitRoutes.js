/**
 * CRINGE METER — LiveKit WebRTC Token Issuance Route
 */

const express = require('express');
const router = express.Router();
const { generateLiveKitToken } = require('../livekit');

// Generate LiveKit WebRTC access token for 1v1 rooms
router.post('/api/livekit/token', async (req, res) => {
  const { roomName, participantIdentity, participantName } = req.body;
  if (!roomName || !participantIdentity) {
    return res.status(400).json({ success: false, message: 'Missing roomName or participantIdentity' });
  }

  try {
    const tokenData = await generateLiveKitToken(roomName, participantIdentity, participantName);
    res.json({ success: true, ...tokenData });
  } catch (err) {
    console.error("[LIVEKIT] Error generating token:", err);
    res.status(500).json({ success: false, message: 'Failed to generate WebRTC token' });
  }
});

module.exports = router;
