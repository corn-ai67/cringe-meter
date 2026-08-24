/**
 * CRINGE METER — Core Game Engine
 * Manages player profile, matchmaking queue, game state, rewards, and leaderboard data.
 */

const OPPONENT_POOL = [
  { name: "ShadowGiggle_X", level: 16, avatar: "🤖", title: "Cringe Overlord" },
  { name: "StoneFace_Pro", level: 22, avatar: "🗿", title: "Unbreakable" },
  { name: "Gigachad_99", level: 19, avatar: "😎", title: "Zero Reaction" },
  { name: "NoSmilesAllowed", level: 11, avatar: "😐", title: "Poker Specialist" },
  { name: "ViralBreakout", level: 25, avatar: "🔥", title: "TikTok Menace" }
];

class GameEngine {
  constructor() {
    this.player = {
      isSignedIn: false,
      isVip: false,
      vipPlan: null,
      vipExpiresAt: null,
      name: "Anonymous",
      avatar: "👤",
      avatarPhoto: null,
      rank: "Unranked",
      level: 1,
      xp: 0,
      xpNext: 1000,
      coins: 0,
      streak: 0,
      bestStreak: 0,
      totalMatches: 0,
      peopleBroken: 0,
      winRate: 0,
      title: "GUEST FIGHTER",
      theme: "magenta",
      taunt: "YOU BROKE THEM 💀"
    };

    this.loadPlayerData();

    this.activeMode = new window.DontLaughMode();
    this.activeMode.init(this);

    this.currentMatch = null;
    this.timerInterval = null;
    this.simulatedOpponentInterval = null;
    this.uiCallbacks = {};
    this.roomCode = null;
    this.isRoomHost = false;
  }

  loadPlayerData() {
    try {
      const saved = localStorage.getItem('cringe_meter_player_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.player = { ...this.player, ...parsed };
        if (!this.player.isSignedIn && (!this.player.name || this.player.name === 'HyperCringe_99')) {
          this.player.name = "Anonymous";
          this.player.avatar = "👤";
        }

        // Subscription Title Fallback Safety Check
        if (window.subscriptionService && !window.subscriptionService.hasVipAccess(this.player)) {
          if (window.subscriptionService.isVipTitle(this.player.title)) {
            this.player.title = this.player.isSignedIn ? "ABSOLUTELY SHAMELESS" : "GUEST FIGHTER";
          }
        }
      } else {
        // If not signed in by default
        this.player.name = "Anonymous";
        this.player.avatar = "👤";
        this.player.isSignedIn = false;
        this.player.isVip = false;
        this.player.vipPlan = null;
        this.player.vipExpiresAt = null;
      }
    } catch (e) {
      console.warn("Could not load player data:", e);
    }
  }

  signIn(name = "HyperCringe_99") {
    this.player.isSignedIn = true;
    this.player.name = name;
    if (this.player.avatar === "👤") {
      this.player.avatar = "🤡";
    }
    if (this.player.title === "GUEST FIGHTER") {
      this.player.title = "ABSOLUTELY SHAMELESS";
    }
    this.savePlayerData();
    if (this.uiCallbacks.onStatsUpdated) {
      this.uiCallbacks.onStatsUpdated(this.player);
    }
  }

  signOut() {
    this.player.isSignedIn = false;
    this.player.name = "Anonymous";
    this.player.avatar = "👤";
    this.player.rank = "Unranked";
    this.player.level = 1;
    this.player.xp = 0;
    this.player.coins = 0;
    this.player.streak = 0;
    this.player.bestStreak = 0;
    this.player.totalMatches = 0;
    this.player.peopleBroken = 0;
    this.player.winRate = 0;
    this.player.title = "GUEST FIGHTER";
    this.savePlayerData();
    if (this.uiCallbacks.onStatsUpdated) {
      this.uiCallbacks.onStatsUpdated(this.player);
    }
  }

  savePlayerData() {
    try {
      localStorage.setItem('cringe_meter_player_data', JSON.stringify(this.player));
    } catch (e) {
      console.warn("Could not save player data:", e);
    }
  }

  registerCallbacks(callbacks) {
    this.uiCallbacks = callbacks;
  }

  getPlayerStats() {
    return this.player;
  }

  setAvatar(newAvatar) {
    this.player.avatar = newAvatar;
    this.player.avatarPhoto = null;
    this.savePlayerData();
    if (this.uiCallbacks.onPlayerUpdated) {
      this.uiCallbacks.onPlayerUpdated(this.player);
    }
  }

  setAvatarPhoto(photoBase64) {
    this.player.avatarPhoto = photoBase64;
    this.savePlayerData();
    if (this.uiCallbacks.onPlayerUpdated) {
      this.uiCallbacks.onPlayerUpdated(this.player);
    }
  }

  updateProfile(newData) {
    if (newData.name !== undefined) this.player.name = newData.name.trim() || this.player.name;
    if (newData.title !== undefined) {
      const newTitle = newData.title.trim();
      if (window.subscriptionService && window.subscriptionService.isVipTitle(newTitle)) {
        if (window.subscriptionService.hasVipAccess(this.player)) {
          this.player.title = newTitle;
        } else {
          console.warn("VIP exclusive title requires active CRINGE VIP subscription.");
        }
      } else {
        this.player.title = newTitle || this.player.title;
      }
    }
    if (newData.avatar !== undefined) this.player.avatar = newData.avatar;
    if (newData.avatarPhoto !== undefined) this.player.avatarPhoto = newData.avatarPhoto;
    if (newData.theme !== undefined) this.player.theme = newData.theme;
    if (newData.taunt !== undefined) this.player.taunt = newData.taunt;

    this.savePlayerData();
    if (this.uiCallbacks.onPlayerUpdated) {
      this.uiCallbacks.onPlayerUpdated(this.player);
    }
  }

  resetPlayerData() {
    localStorage.removeItem('cringe_meter_player_data');
    localStorage.removeItem('cringe_meter_custom_prompts');
    location.reload();
  }

  // MATCHMAKING SIMULATOR (LOCAL PLAY)
  startMatchmaking() {
    if (window.soundEngine) window.soundEngine.playClick();
    
    const opp = OPPONENT_POOL[Math.floor(Math.random() * OPPONENT_POOL.length)];
    const isPerformer = Math.random() > 0.5;
    const playerRole = isPerformer ? 'PERFORMER' : 'DEFENDER';

    this.currentMatch = {
      opponent: opp,
      role: playerRole,
      cringePrompt: window.cringePromptService.getRandomPrompt()
    };

    return this.currentMatch;
  }

  startBattle() {
    if (!this.currentMatch) return;

    this.activeMode.start(this.currentMatch.role, this.currentMatch.opponent);

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.activeMode.tick();
    }, 1000);

    this.startSimulatedOpponentReaction();
  }

  startSimulatedOpponentReaction() {
    if (this.simulatedOpponentInterval) clearInterval(this.simulatedOpponentInterval);

    let oppBreakChance = 0.05;

    this.simulatedOpponentInterval = setInterval(() => {
      if (!this.activeMode.matchActive) return;

      if (this.currentMatch.role === 'PERFORMER') {
        oppBreakChance += 0.015;
        if (Math.random() < oppBreakChance) {
          this.triggerMatchEnd('OPPONENT_LAUGHED');
        }
      }
    }, 1500);
  }

  updateBattleHUD(timeLeft, cringeLevel) {
    if (this.uiCallbacks.onBattleTick) {
      this.uiCallbacks.onBattleTick(timeLeft, cringeLevel);
    }
  }

  triggerMatchEnd(reason) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.simulatedOpponentInterval) clearInterval(this.simulatedOpponentInterval);
    this.activeMode.end(reason);
  }

  handleBattleResults(results) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.simulatedOpponentInterval) clearInterval(this.simulatedOpponentInterval);

    const isVip = window.subscriptionService ? window.subscriptionService.hasVipAccess(this.player) : false;
    const coinMultiplier = window.subscriptionService ? window.subscriptionService.getCoinMultiplier(this.player) : 1;
    const baseWinCoins = 50;
    const earnedCoins = isVip ? (baseWinCoins * coinMultiplier) : baseWinCoins;

    if (results.isWinner) {
      this.player.xp += 150;
      this.player.coins += earnedCoins;
      this.player.streak += 1;
      if (this.player.streak > this.player.bestStreak) {
        this.player.bestStreak = this.player.streak;
      }
      if (this.currentMatch && this.currentMatch.role === 'PERFORMER') {
        this.player.peopleBroken += 1;
      }
    } else {
      this.player.xp += 40;
      this.player.streak = 0;
    }
    this.player.totalMatches += 1;
    this.savePlayerData();

    // Attach earnedCoins & isVip info to results for UI display
    results.earnedCoins = results.isWinner ? earnedCoins : 0;
    results.isVip = isVip;

    if (this.uiCallbacks.onMatchEnd) {
      this.uiCallbacks.onMatchEnd(results, this.player);
    }
  }

  getLeaderboard() {
    return [];
  }
}

window.gameEngine = new GameEngine();
