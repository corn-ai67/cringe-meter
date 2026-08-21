/**
 * CRINGE METER — Local Facial Reaction Analyzer Engine
 * Architecture hook for client-side local facial analysis.
 */

class ReactionAnalyzer {
  constructor() {
    this.analyzing = false;
    this.scoreCallbacks = [];
    this.currentScore = 12;
  }

  start(videoElement) {
    this.analyzing = true;
    console.log("[ANALYZER] Local reaction analyzer initialized (DEVELOPMENT MOCK).");
  }

  stop() {
    this.analyzing = false;
  }

  onScore(cb) {
    this.scoreCallbacks.push(cb);
  }

  triggerScore(val) {
    this.currentScore = Math.max(0, Math.min(100, val));
    this.scoreCallbacks.forEach(cb => cb(this.currentScore));
  }
}

window.reactionAnalyzer = new ReactionAnalyzer();
