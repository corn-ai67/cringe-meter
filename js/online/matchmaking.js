/**
 * CRINGE METER — Socket.IO Matchmaking Client Module
 */

class OnlineMatchmakingClient {
  constructor() {
    this.socket = null;
    this.status = 'IDLE'; // IDLE, SEARCHING, CONNECTING, CONNECTED
    this.callbacks = {};
  }

  init() {
    if (this.socket) return;

    // Detect server URL: support HTTPS tunnels, direct mobile LAN, and local dev
    let serverUrl;
    if (window.location.port === '8080') {
      serverUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    } else if (window.location.origin && window.location.origin !== 'null' && window.location.protocol.startsWith('http')) {
      serverUrl = window.location.origin;
    } else {
      const serverHost = window.location.hostname || 'localhost';
      serverUrl = `http://${serverHost}:3000`;
    }

    if (window.io) {
      this.socket = window.io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000
      });

      this.setupSocketListeners();
    } else {
      console.warn("Socket.IO client library not loaded.");
    }
  }

  registerCallbacks(cbObj) {
    this.callbacks = { ...this.callbacks, ...cbObj };
  }

  setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log("[NET] Socket connected to backend:", this.socket.id);
    });

    this.socket.on('matchmaking_status', (data) => {
      this.status = data.status;
      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange(data.status);
      }
    });

    this.socket.on('match_found', (matchData) => {
      console.log("[NET] Match found:", matchData);
      this.status = 'CONNECTED';
      if (this.callbacks.onMatchFound) {
        this.callbacks.onMatchFound(matchData);
      }
    });

    this.socket.on('prompt_updated', (data) => {
      if (this.callbacks.onPromptUpdated) {
        this.callbacks.onPromptUpdated(data);
      }
    });

    this.socket.on('round_result', (data) => {
      if (this.callbacks.onRoundResult) {
        this.callbacks.onRoundResult(data);
      }
    });

    this.socket.on('stranger_disconnected', (data) => {
      console.log("[NET] Stranger disconnected:", data);
      if (this.callbacks.onStrangerDisconnected) {
        this.callbacks.onStrangerDisconnected(data);
      }
    });

    this.socket.on('disconnect', () => {
      console.warn("[NET] Socket disconnected.");
      this.status = 'IDLE';
      if (this.callbacks.onStatusChange) {
        this.callbacks.onStatusChange('IDLE');
      }
    });
  }

  findMatch() {
    this.init();
    const identity = window.onlineState ? window.onlineState.getUserIdentity() : {};
    this.status = 'SEARCHING';
    if (this.socket) {
      this.socket.emit('find_match', identity);
    }
  }

  cancelMatch() {
    if (this.socket) {
      this.socket.emit('cancel_match');
    }
    this.status = 'IDLE';
  }

  nextMatch() {
    this.init();
    const identity = window.onlineState ? window.onlineState.getUserIdentity() : {};
    this.status = 'SEARCHING';
    if (this.socket) {
      this.socket.emit('next_match', identity);
    }
  }

  leaveMatch() {
    if (this.socket) {
      this.socket.emit('leave_match');
    }
    this.status = 'IDLE';
  }

  shufflePrompt(customPromptText = null) {
    if (this.socket) {
      this.socket.emit('shuffle_prompt', { customPrompt: customPromptText });
    }
  }

  triggerLaughed() {
    if (this.socket) {
      this.socket.emit('player_laughed', {});
    }
  }

  reportUser(reportedUserId, sessionId, reason) {
    if (this.socket) {
      const identity = window.onlineState ? window.onlineState.getUserIdentity() : {};
      this.socket.emit('report_user', {
        reporterId: identity.userId,
        reportedUserId,
        sessionId,
        reason
      });
    }
  }

  blockUser(targetUserId) {
    if (this.socket) {
      const identity = window.onlineState ? window.onlineState.getUserIdentity() : {};
      if (window.onlineState) window.onlineState.blockUser(targetUserId);
      this.socket.emit('block_user', {
        userId: identity.userId,
        targetUserId
      });
    }
  }
}

window.onlineMatchmaker = new OnlineMatchmakingClient();
