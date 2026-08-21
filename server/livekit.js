/**
 * CRINGE METER — LiveKit Token Generation Module
 * Generates short-lived WebRTC room access tokens for 1v1 online sessions.
 */

const { AccessToken } = require('livekit-server-sdk');

function generateLiveKitToken(roomName, participantIdentity, participantName) {
  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
  const livekitUrl = process.env.LIVEKIT_URL || 'wss://cringe-meter-dev.livekit.cloud';

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName || participantIdentity,
      ttl: '2h'
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = at.toJwt();
    return {
      token,
      url: livekitUrl,
      roomName,
      identity: participantIdentity
    };
  } catch (err) {
    console.warn("LiveKit token generation error:", err.message);
    return {
      token: `mock_token_${Date.now()}`,
      url: livekitUrl,
      roomName,
      identity: participantIdentity,
      isMock: true
    };
  }
}

module.exports = {
  generateLiveKitToken
};
