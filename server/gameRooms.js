/**
 * CRINGE METER — Authoritative 1v1 Game Session & State Manager
 */

const ONLINE_PROMPTS = [
  "Pitch an invisible bucket of air to your opponent using an ultra-dramatic French accent.",
  "Deliver a solemn eulogy for a melted ice cream cone using maximum internet slang.",
  "Try to convince your opponent that you are an undercover time traveler who lost their time machine key.",
  "Sing a heavy-metal opera song about stubbing your toe on a coffee table.",
  "Perform an intense 15-second dramatic whisper explaining why your left sock feels lonely.",
  "Synergize a paradigm shift in your opponent's emotional posture using corporate buzzwords.",
  "Deliver a formal LinkedIn update performance announcing your promotion to Chief Vibe Officer."
];

class GameRoomManager {
  constructor() {
    this.rooms = new Map(); // sessionId -> roomObject
    this.playerToRoom = new Map(); // socketId -> sessionId
  }

  createRoom(playerA, playerB) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const roomName = `cringe_room_${sessionId}`;

    // Randomize initial performer
    const isAPerformer = Math.random() > 0.5;
    const performer = isAPerformer ? playerA : playerB;
    const reactor = isAPerformer ? playerB : playerA;

    const initialPrompt = ONLINE_PROMPTS[Math.floor(Math.random() * ONLINE_PROMPTS.length)];

    const room = {
      sessionId,
      roomName,
      playerA,
      playerB,
      roundNumber: 1,
      performerId: performer.userId,
      performerSocketId: performer.socketId,
      reactorId: reactor.userId,
      reactorSocketId: reactor.socketId,
      currentPrompt: initialPrompt,
      isCustomPrompt: false,
      roundDurationSec: 10,
      roundTimeLeft: 10,
      status: 'MATCH_FOUND',
      timerInterval: null
    };

    this.rooms.set(sessionId, room);
    this.playerToRoom.set(playerA.socketId, sessionId);
    this.playerToRoom.set(playerB.socketId, sessionId);

    console.log(`[ROOM] Created 1v1 Room ${sessionId} (${playerA.displayName} vs ${playerB.displayName})`);
    return room;
  }

  getRoomBySessionId(sessionId) {
    return this.rooms.get(sessionId);
  }

  getRoomBySocketId(socketId) {
    const sessionId = this.playerToRoom.get(socketId);
    if (sessionId) return this.rooms.get(sessionId);
    return null;
  }

  shufflePrompt(sessionId, customPromptText = null) {
    const room = this.rooms.get(sessionId);
    if (!room) return null;

    if (customPromptText && customPromptText.trim()) {
      room.currentPrompt = customPromptText.trim();
      room.isCustomPrompt = true;
    } else {
      let nextPrompt = room.currentPrompt;
      while (nextPrompt === room.currentPrompt && ONLINE_PROMPTS.length > 1) {
        nextPrompt = ONLINE_PROMPTS[Math.floor(Math.random() * ONLINE_PROMPTS.length)];
      }
      room.currentPrompt = nextPrompt;
      room.isCustomPrompt = false;
    }

    return room;
  }

  swapRoles(sessionId) {
    const room = this.rooms.get(sessionId);
    if (!room) return null;

    room.roundNumber += 1;
    const tempPerfId = room.performerId;
    const tempPerfSocket = room.performerSocketId;

    room.performerId = room.reactorId;
    room.performerSocketId = room.reactorSocketId;

    room.reactorId = tempPerfId;
    room.reactorSocketId = tempPerfSocket;

    room.currentPrompt = ONLINE_PROMPTS[Math.floor(Math.random() * ONLINE_PROMPTS.length)];
    room.isCustomPrompt = false;
    room.roundTimeLeft = room.roundDurationSec;

    console.log(`[ROOM] Session ${sessionId} swapped roles for Round ${room.roundNumber}`);
    return room;
  }

  removeRoom(sessionId) {
    const room = this.rooms.get(sessionId);
    if (room) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      this.playerToRoom.delete(room.playerA.socketId);
      this.playerToRoom.delete(room.playerB.socketId);
      this.rooms.delete(sessionId);
      console.log(`[ROOM] Removed session ${sessionId}`);
    }
  }

  handlePlayerLeave(socketId) {
    const sessionId = this.playerToRoom.get(socketId);
    if (!sessionId) return null;

    const room = this.rooms.get(sessionId);
    if (!room) return null;

    const otherPlayer = (room.playerA.socketId === socketId) ? room.playerB : room.playerA;
    this.removeRoom(sessionId);

    return { sessionId, leaverSocketId: socketId, otherPlayer };
  }
}

module.exports = new GameRoomManager();
