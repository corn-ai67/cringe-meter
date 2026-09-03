/**
 * CRINGE METER — Backend Configuration & Constants
 */

module.exports = {
  PORT: process.env.PORT || 3000,
  LIVEKIT_URL: process.env.LIVEKIT_URL || 'wss://cringe-meter-gbi9jmfs.livekit.cloud',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@cringemeter.io',
  TERMS_VERSION: '1.0',
  MIN_AGE: 18,

  ONLINE_PROMPTS: [
    "Pitch an invisible bucket of air to your opponent using an ultra-dramatic French accent.",
    "Deliver a solemn eulogy for a melted ice cream cone using maximum internet slang.",
    "Try to convince your opponent that you are an undercover time traveler who lost their time machine key.",
    "Sing a heavy-metal opera song about stubbing your toe on a coffee table.",
    "Perform an intense 15-second dramatic whisper explaining why your left sock feels lonely.",
    "Synergize a paradigm shift in your opponent's emotional posture using corporate buzzwords.",
    "Deliver a formal LinkedIn update performance announcing your promotion to Chief Vibe Officer."
  ]
};
