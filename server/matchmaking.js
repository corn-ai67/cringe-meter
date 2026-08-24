/**
 * CRINGE METER — Server Matchmaking Queue Engine
 * Handles stranger queueing, pairing, anti-duplicate checks, and disconnect cleanups.
 */

const safetyManager = require('./reports');

class MatchmakingQueue {
  constructor() {
    this.queue = []; // Array of user entry objects: { socketId, userId, displayName, avatar, rankTitle }
  }

  addToQueue(playerData, socketId) {
    // Remove any existing entry for this socketId or userId
    this.removeFromQueue(socketId, playerData.userId);

    const entry = {
      socketId,
      userId: playerData.userId,
      displayName: playerData.displayName || 'Stranger',
      avatar: playerData.avatar || '🤡',
      rankTitle: playerData.rankTitle || 'Unbreakable',
      joinedAt: Date.now()
    };

    this.queue.push(entry);
    console.log(`[MATCHMAKING] Queued user: ${entry.displayName} (${entry.userId}). Queue size: ${this.queue.length}`);
    return entry;
  }

  removeFromQueue(socketId, userId = null) {
    const initialLen = this.queue.length;
    this.queue = this.queue.filter(item => {
      if (item.socketId === socketId) return false;
      if (userId && item.userId === userId) return false;
      return true;
    });
    if (this.queue.length !== initialLen) {
      console.log(`[MATCHMAKING] Removed user from queue. Queue size: ${this.queue.length}`);
    }
  }

  findPair() {
    if (this.queue.length < 2) return null;

    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const playerA = this.queue[i];
        const playerB = this.queue[j];

        // Ensure different users and not blocked
        if (playerA.userId !== playerB.userId && !safetyManager.isBlocked(playerA.userId, playerB.userId)) {
          // Remove both from queue
          this.queue.splice(j, 1);
          this.queue.splice(i, 1);

          console.log(`[MATCHMAKING] Matched: ${playerA.displayName} ↔ ${playerB.displayName}`);
          return { playerA, playerB };
        }
      }
    }

    return null;
  }

  findMatch() {
    return this.findPair();
  }

  getQueueLength() {
    return this.queue.length;
  }
}

module.exports = new MatchmakingQueue();
