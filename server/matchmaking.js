/**
 * CRINGE METER — Server Matchmaking Queue Engine
 * Handles stranger queueing, pairing, anti-duplicate checks, and disconnect cleanups.
 */

const blockService = require('./services/blockService');

class MatchmakingQueue {
  constructor() {
    this.queue = []; // Array of user entry objects: { socketId, userId, displayName, avatar, rankTitle }
  }

  addToQueue(playerData, socketId) {
    // Remove any previous queue entry for this specific socket
    this.removeFromQueue(socketId);

    const entry = {
      socketId,
      userId: playerData.userId || `cm_guest_${socketId.substring(0, 6)}`,
      displayName: playerData.displayName || 'Stranger',
      avatar: playerData.avatar || '🤡',
      rankTitle: playerData.rankTitle || 'Unbreakable',
      joinedAt: Date.now()
    };

    this.queue.push(entry);
    console.log(`[MATCHMAKING] Queued socket: ${entry.displayName} (${entry.userId} - ${entry.socketId}). Queue size: ${this.queue.length}`);
    return entry;
  }

  removeFromQueue(socketId) {
    const initialLen = this.queue.length;
    this.queue = this.queue.filter(item => item.socketId !== socketId);
    if (this.queue.length !== initialLen) {
      console.log(`[MATCHMAKING] Removed socket from queue: ${socketId}. Queue size: ${this.queue.length}`);
    }
  }

  findPair() {
    if (this.queue.length < 2) return null;

    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const playerA = this.queue[i];
        const playerB = this.queue[j];

        // Ensure distinct active socket connections and not blocked
        if (playerA.socketId !== playerB.socketId && !blockService.isBlockedSync(playerA.userId, playerB.userId)) {
          // Remove both from queue
          this.queue.splice(j, 1);
          this.queue.splice(i, 1);

          console.log(`[MATCHMAKING] Matched: ${playerA.displayName} (${playerA.socketId}) ↔ ${playerB.displayName} (${playerB.socketId})`);
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
