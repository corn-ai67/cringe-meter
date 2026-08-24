/**
 * CRINGE METER — Authoritative Server Leaderboard Store
 * Manages player ranking data, deterministic sorting, weekly boundaries, and live match updates.
 */

class LeaderboardStore {
  constructor() {
    this.currentWeekId = this.computeWeekId();
    this.players = new Map();
    this.initSeedData();
  }

  computeWeekId() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  initSeedData() {
    const seedPlayers = [
      {
        userId: "user_giggle_99",
        displayName: "GiggleGod_99",
        avatar: "🤡",
        rankTitle: "DIAMOND II",
        level: 28,
        xp: 12850,
        wins: 143,
        losses: 2,
        winRate: 98.6,
        currentStreak: 24,
        bestStreak: 34,
        weeklyWins: 42,
        weeklyScore: 4200,
        totalScore: 12850,
        isVip: true,
        title: "ABSOLUTELY SHAMELESS"
      },
      {
        userId: "user_stoneface_x",
        displayName: "StoneFace_X",
        avatar: "💀",
        rankTitle: "DIAMOND I",
        level: 25,
        xp: 11920,
        wins: 129,
        losses: 6,
        winRate: 95.5,
        currentStreak: 18,
        bestStreak: 29,
        weeklyWins: 38,
        weeklyScore: 3800,
        totalScore: 11920,
        isVip: true,
        title: "STONE COLD KILLER"
      },
      {
        userId: "user_cringedemon",
        displayName: "CringeDemon",
        avatar: "😈",
        rankTitle: "PLATINUM I",
        level: 22,
        xp: 10800,
        wins: 117,
        losses: 9,
        winRate: 92.8,
        currentStreak: 27,
        bestStreak: 31,
        weeklyWins: 35,
        weeklyScore: 3500,
        totalScore: 10800,
        isVip: false,
        title: "UNBREAKABLE"
      },
      {
        userId: "user_voidpoker",
        displayName: "VoidPoker",
        avatar: "👽",
        rankTitle: "PLATINUM II",
        level: 20,
        xp: 9450,
        wins: 98,
        losses: 12,
        winRate: 89.1,
        currentStreak: 12,
        bestStreak: 22,
        weeklyWins: 29,
        weeklyScore: 2900,
        totalScore: 9450,
        isVip: false,
        title: "POKER SPECIALIST"
      },
      {
        userId: "user_memeoverlord",
        displayName: "MemeOverlord_99",
        avatar: "🤖",
        rankTitle: "GOLD I",
        level: 18,
        xp: 8200,
        wins: 84,
        losses: 14,
        winRate: 85.7,
        currentStreak: 15,
        bestStreak: 19,
        weeklyWins: 26,
        weeklyScore: 2600,
        totalScore: 8200,
        isVip: true,
        title: "TIKTOK MENACE"
      },
      {
        userId: "user_pokerqueen",
        displayName: "PokerQueen",
        avatar: "👑",
        rankTitle: "GOLD II",
        level: 16,
        xp: 7350,
        wins: 72,
        losses: 15,
        winRate: 82.8,
        currentStreak: 9,
        bestStreak: 16,
        weeklyWins: 21,
        weeklyScore: 2100,
        totalScore: 7350,
        isVip: false,
        title: "ZERO REACTION"
      },
      {
        userId: "user_deadpan",
        displayName: "DeadpanDave",
        avatar: "🗿",
        rankTitle: "SILVER I",
        level: 14,
        xp: 6100,
        wins: 58,
        losses: 16,
        winRate: 78.4,
        currentStreak: 11,
        bestStreak: 14,
        weeklyWins: 18,
        weeklyScore: 1800,
        totalScore: 6100,
        isVip: false,
        title: "SPECTRE OF CRINGE"
      },
      {
        userId: "user_laughinggas",
        displayName: "LaughingGas",
        avatar: "🤪",
        rankTitle: "SILVER II",
        level: 12,
        xp: 4900,
        wins: 45,
        losses: 18,
        winRate: 71.4,
        currentStreak: 6,
        bestStreak: 11,
        weeklyWins: 15,
        weeklyScore: 1500,
        totalScore: 4900,
        isVip: false,
        title: "CRINGE ACOLYTE"
      }
    ];

    seedPlayers.forEach(p => this.players.set(p.userId, p));
  }

  checkWeeklyReset() {
    const current = this.computeWeekId();
    if (current !== this.currentWeekId) {
      console.log(`[LEADERBOARD] Weekly reset from ${this.currentWeekId} to ${current}`);
      this.currentWeekId = current;
      this.players.forEach(p => {
        p.weeklyWins = 0;
        p.weeklyScore = 0;
      });
    }
  }

  getLeaderboard(type = 'global', limit = 50, search = '') {
    this.checkWeeklyReset();
    let list = Array.from(this.players.values());

    // Filter by search query if provided
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.displayName.toLowerCase().includes(q));
    }

    // Deterministic Sorting
    if (type === 'streaks') {
      list.sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.displayName.localeCompare(b.displayName);
      });
    } else if (type === 'weekly') {
      list.sort((a, b) => {
        if (b.weeklyScore !== a.weeklyScore) return b.weeklyScore - a.weeklyScore;
        if (b.weeklyWins !== a.weeklyWins) return b.weeklyWins - a.weeklyWins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.displayName.localeCompare(b.displayName);
      });
    } else {
      // global top (default)
      list.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return a.displayName.localeCompare(b.displayName);
      });
    }

    const totalCount = list.length;
    const paginated = list.slice(0, limit).map((p, index) => ({
      rank: index + 1,
      ...p
    }));

    return {
      type,
      weekId: this.currentWeekId,
      totalCount,
      players: paginated
    };
  }

  getPlayerRank(userId) {
    this.checkWeeklyReset();
    if (!this.players.has(userId)) return null;

    const globalSorted = this.getLeaderboard('global', 1000).players;
    const streaksSorted = this.getLeaderboard('streaks', 1000).players;
    const weeklySorted = this.getLeaderboard('weekly', 1000).players;

    const globalRank = globalSorted.findIndex(p => p.userId === userId) + 1;
    const streaksRank = streaksSorted.findIndex(p => p.userId === userId) + 1;
    const weeklyRank = weeklySorted.findIndex(p => p.userId === userId) + 1;

    return {
      userId,
      ranks: {
        global: globalRank > 0 ? globalRank : null,
        streaks: streaksRank > 0 ? streaksRank : null,
        weekly: weeklyRank > 0 ? weeklyRank : null
      },
      player: this.players.get(userId)
    };
  }

  recordMatchResult(winnerData, loserData) {
    this.checkWeeklyReset();

    if (winnerData && winnerData.userId) {
      const winner = this.players.get(winnerData.userId) || {
        userId: winnerData.userId,
        displayName: winnerData.displayName || "Anonymous",
        avatar: winnerData.avatar || "👤",
        rankTitle: winnerData.rankTitle || "Unranked",
        level: winnerData.level || 1,
        xp: 0,
        wins: 0,
        losses: 0,
        winRate: 100,
        currentStreak: 0,
        bestStreak: 0,
        weeklyWins: 0,
        weeklyScore: 0,
        totalScore: 0,
        isVip: !!winnerData.isVip,
        title: winnerData.title || "GUEST FIGHTER"
      };

      winner.wins += 1;
      winner.weeklyWins += 1;
      winner.currentStreak += 1;
      if (winner.currentStreak > winner.bestStreak) {
        winner.bestStreak = winner.currentStreak;
      }
      winner.totalScore += 150;
      winner.weeklyScore += 150;
      winner.xp += 150;
      winner.winRate = Math.round((winner.wins / (winner.wins + winner.losses)) * 1000) / 10;
      if (winnerData.isVip !== undefined) winner.isVip = winnerData.isVip;
      if (winnerData.displayName) winner.displayName = winnerData.displayName;
      if (winnerData.avatar) winner.avatar = winnerData.avatar;
      if (winnerData.rankTitle) winner.rankTitle = winnerData.rankTitle;

      this.players.set(winner.userId, winner);
    }

    if (loserData && loserData.userId) {
      const loser = this.players.get(loserData.userId) || {
        userId: loserData.userId,
        displayName: loserData.displayName || "Anonymous",
        avatar: loserData.avatar || "👤",
        rankTitle: loserData.rankTitle || "Unranked",
        level: loserData.level || 1,
        xp: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        currentStreak: 0,
        bestStreak: 0,
        weeklyWins: 0,
        weeklyScore: 0,
        totalScore: 0,
        isVip: !!loserData.isVip,
        title: loserData.title || "GUEST FIGHTER"
      };

      loser.losses += 1;
      loser.currentStreak = 0;
      loser.totalScore += 40;
      loser.weeklyScore += 40;
      loser.xp += 40;
      loser.winRate = Math.round((loser.wins / (loser.wins + loser.losses)) * 1000) / 10;
      if (loserData.isVip !== undefined) loser.isVip = loserData.isVip;
      if (loserData.displayName) loser.displayName = loserData.displayName;
      if (loserData.avatar) loser.avatar = loserData.avatar;
      if (loserData.rankTitle) loser.rankTitle = loserData.rankTitle;

      this.players.set(loser.userId, loser);
    }

    return { success: true };
  }

  upsertPlayer(playerData) {
    if (!playerData || !playerData.userId) return null;
    const existing = this.players.get(playerData.userId) || {};
    const merged = {
      ...existing,
      ...playerData,
      totalScore: playerData.xp !== undefined ? playerData.xp : (existing.totalScore || 0),
      wins: playerData.wins !== undefined ? playerData.wins : (existing.wins || 0),
      losses: playerData.losses !== undefined ? playerData.losses : (existing.losses || 0),
      currentStreak: playerData.streak !== undefined ? playerData.streak : (existing.currentStreak || 0),
      bestStreak: playerData.bestStreak !== undefined ? playerData.bestStreak : (existing.bestStreak || 0),
      weeklyScore: playerData.weeklyScore !== undefined ? playerData.weeklyScore : (existing.weeklyScore || 0),
      weeklyWins: playerData.weeklyWins !== undefined ? playerData.weeklyWins : (existing.weeklyWins || 0),
      winRate: (playerData.wins !== undefined && playerData.losses !== undefined && (playerData.wins + playerData.losses > 0)) ?
        Math.round((playerData.wins / (playerData.wins + playerData.losses)) * 1000) / 10 : (existing.winRate || 0)
    };
    this.players.set(playerData.userId, merged);
    return merged;
  }
}

module.exports = new LeaderboardStore();
