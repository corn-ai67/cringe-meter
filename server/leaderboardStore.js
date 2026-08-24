/**
 * CRINGE METER — Authoritative Server Leaderboard Store
 * Manages persistent real player ranking data, deterministic sorting, weekly boundaries,
 * and verified live match updates.
 */

const fs = require('fs');
const path = require('path');

// Optional developer flag: MUST remain false in production
const USE_DEV_LEADERBOARD_DATA = false;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');

class LeaderboardStore {
  constructor() {
    this.currentWeekId = this.computeWeekId();
    this.players = new Map();
    this.ensureDataDir();
    this.loadFromDisk();
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn("[LEADERBOARD] Could not create data directory:", e.message);
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.players)) {
          this.currentWeekId = data.weekId || this.computeWeekId();
          this.players.clear();
          data.players.forEach(p => {
            // Only load real players with actual battle activity
            const totalBattles = (p.wins || 0) + (p.losses || 0);
            if (totalBattles > 0 || (p.totalBattles && p.totalBattles > 0)) {
              this.players.set(p.userId, p);
            }
          });
          console.log(`[LEADERBOARD] Loaded ${this.players.size} real player records from disk.`);
          return;
        }
      }
    } catch (e) {
      console.warn("[LEADERBOARD] Error reading leaderboard data file, starting clean:", e.message);
    }

    // Start with 0 real players
    this.players.clear();
    this.saveToDisk();
  }

  saveToDisk() {
    try {
      this.ensureDataDir();
      const payload = {
        weekId: this.currentWeekId,
        updatedAt: new Date().toISOString(),
        players: Array.from(this.players.values())
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      console.warn("[LEADERBOARD] Could not persist leaderboard data to disk:", e.message);
    }
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

  checkWeeklyReset() {
    const current = this.computeWeekId();
    if (current !== this.currentWeekId) {
      console.log(`[LEADERBOARD] Weekly boundary reached. Resetting week from ${this.currentWeekId} to ${current}`);
      this.currentWeekId = current;
      this.players.forEach(p => {
        p.weeklyWins = 0;
        p.weeklyScore = 0;
      });
      this.saveToDisk();
    }
  }

  getLeaderboard(type = 'global', limit = 50, search = '') {
    this.checkWeeklyReset();
    
    // Only rank players who have completed at least one battle
    let list = Array.from(this.players.values()).filter(p => {
      const battles = (p.wins || 0) + (p.losses || 0) || (p.totalBattles || 0);
      return battles > 0;
    });

    // Filter by search query if provided
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => (p.displayName || '').toLowerCase().includes(q));
    }

    // Deterministic Sorting
    if (type === 'streaks') {
      list.sort((a, b) => {
        if ((b.currentStreak || 0) !== (a.currentStreak || 0)) return (b.currentStreak || 0) - (a.currentStreak || 0);
        if ((b.bestStreak || 0) !== (a.bestStreak || 0)) return (b.bestStreak || 0) - (a.bestStreak || 0);
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
    } else if (type === 'weekly') {
      list.sort((a, b) => {
        if ((b.weeklyScore || 0) !== (a.weeklyScore || 0)) return (b.weeklyScore || 0) - (a.weeklyScore || 0);
        if ((b.weeklyWins || 0) !== (a.weeklyWins || 0)) return (b.weeklyWins || 0) - (a.weeklyWins || 0);
        if ((b.winRate || 0) !== (a.winRate || 0)) return (b.winRate || 0) - (a.winRate || 0);
        if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
    } else {
      // Global top (default)
      list.sort((a, b) => {
        if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        if ((b.winRate || 0) !== (a.winRate || 0)) return (b.winRate || 0) - (a.winRate || 0);
        return (a.displayName || '').localeCompare(b.displayName || '');
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

    const player = this.players.get(userId);
    const battles = (player.wins || 0) + (player.losses || 0) || (player.totalBattles || 0);
    if (battles === 0) {
      return { userId, ranks: { global: null, streaks: null, weekly: null }, player };
    }

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
      player
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
        totalBattles: 0,
        winRate: 0,
        currentStreak: 0,
        bestStreak: 0,
        weeklyWins: 0,
        weeklyScore: 0,
        totalScore: 0,
        isVip: !!winnerData.isVip,
        title: winnerData.title || "GUEST FIGHTER"
      };

      winner.wins = (winner.wins || 0) + 1;
      winner.totalBattles = (winner.wins || 0) + (winner.losses || 0);
      winner.weeklyWins = (winner.weeklyWins || 0) + 1;
      winner.currentStreak = (winner.currentStreak || 0) + 1;
      if (winner.currentStreak > (winner.bestStreak || 0)) {
        winner.bestStreak = winner.currentStreak;
      }
      winner.totalScore = (winner.totalScore || 0) + 150;
      winner.weeklyScore = (winner.weeklyScore || 0) + 150;
      winner.xp = (winner.xp || 0) + 150;
      winner.winRate = winner.totalBattles > 0 ?
        Math.round((winner.wins / winner.totalBattles) * 1000) / 10 : 0;

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
        totalBattles: 0,
        winRate: 0,
        currentStreak: 0,
        bestStreak: 0,
        weeklyWins: 0,
        weeklyScore: 0,
        totalScore: 0,
        isVip: !!loserData.isVip,
        title: loserData.title || "GUEST FIGHTER"
      };

      loser.losses = (loser.losses || 0) + 1;
      loser.totalBattles = (loser.wins || 0) + (loser.losses || 0);
      loser.currentStreak = 0;
      loser.totalScore = (loser.totalScore || 0) + 40;
      loser.weeklyScore = (loser.weeklyScore || 0) + 40;
      loser.xp = (loser.xp || 0) + 40;
      loser.winRate = loser.totalBattles > 0 ?
        Math.round(((loser.wins || 0) / loser.totalBattles) * 1000) / 10 : 0;

      if (loserData.isVip !== undefined) loser.isVip = loserData.isVip;
      if (loserData.displayName) loser.displayName = loserData.displayName;
      if (loserData.avatar) loser.avatar = loserData.avatar;
      if (loserData.rankTitle) loser.rankTitle = loserData.rankTitle;

      this.players.set(loser.userId, loser);
    }

    this.saveToDisk();
    return { success: true };
  }

  upsertPlayer(playerData) {
    if (!playerData || !playerData.userId) return null;
    const existing = this.players.get(playerData.userId) || {};
    const wins = playerData.wins !== undefined ? playerData.wins : (existing.wins || 0);
    const losses = playerData.losses !== undefined ? playerData.losses : (existing.losses || 0);
    const totalBattles = wins + losses;

    const merged = {
      ...existing,
      ...playerData,
      wins,
      losses,
      totalBattles,
      totalScore: playerData.xp !== undefined ? playerData.xp : (existing.totalScore || 0),
      currentStreak: playerData.streak !== undefined ? playerData.streak : (existing.currentStreak || 0),
      bestStreak: playerData.bestStreak !== undefined ? playerData.bestStreak : (existing.bestStreak || 0),
      weeklyScore: playerData.weeklyScore !== undefined ? playerData.weeklyScore : (existing.weeklyScore || 0),
      weeklyWins: playerData.weeklyWins !== undefined ? playerData.weeklyWins : (existing.weeklyWins || 0),
      winRate: totalBattles > 0 ? Math.round((wins / totalBattles) * 1000) / 10 : 0
    };

    if (totalBattles > 0) {
      this.players.set(playerData.userId, merged);
      this.saveToDisk();
    }
    return merged;
  }

  clearAllData() {
    this.players.clear();
    this.saveToDisk();
    console.log("[LEADERBOARD] Reset all leaderboard data to 0 players.");
  }
}

module.exports = new LeaderboardStore();
