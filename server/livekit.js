/**
 * CRINGE METER — LiveKit Token Generation Module
 * Generates short-lived WebRTC room access tokens for 1v1 online sessions.
 */

const { AccessToken } = require('livekit-server-sdk');

async function generateLiveKitToken(roomName, participantIdentity, participantName) {
  const apiKey = process.env.LIVEKIT_API_KEY || 'APIWzNPgyrfrxYr';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'fvSTUgwsEcOpFicFH6PP6EoJbt5WfInWlKolrdombdt';
  const livekitUrl = process.env.LIVEKIT_URL || 'wss://cringe-meter-gbi9jmfs.livekit.cloud';

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

    // In livekit-server-sdk v2+, toJwt() returns a Promise
    const token = await at.toJwt();
    console.log(`[LIVEKIT] Generated valid JWT token for ${participantName} (${participantIdentity}) in room ${roomName}`);
    return {
      token,
      url: livekitUrl,
      roomName,
      identity: participantIdentity
    };
  } catch (err) {
    console.warn("[LIVEKIT] Token generation error:", err.message);
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
