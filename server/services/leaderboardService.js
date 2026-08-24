/**
 * CRINGE METER — Leaderboard Service (Supabase PostgreSQL)
 * Fetches real player rankings directly from Supabase player_stats and users tables.
 */

const { supabase, isConfigured } = require('./supabase');

class LeaderboardService {
  computeWeekId() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }

  async getLeaderboard(type = 'global', limit = 50, search = '') {
    const weekId = this.computeWeekId();

    if (!isConfigured() || !supabase) {
      return {
        type,
        weekId,
        totalCount: 0,
        players: []
      };
    }

    try {
      // Query users joined with player_stats and active VIP subscriptions
      let query = supabase
        .from('users')
        .select(`
          id,
          internal_user_id,
          display_name,
          avatar_emoji,
          avatar_url,
          rank_title,
          custom_title,
          player_stats!inner (
            coins,
            xp,
            level,
            wins,
            losses,
            total_battles,
            current_streak,
            best_streak,
            total_score,
            weekly_wins,
            weekly_score
          ),
          subscriptions (
            status
          )
        `)
        .gt('player_stats.total_battles', 0);

      // Search filter
      if (search && search.trim()) {
        query = query.ilike('display_name', `%${search.trim()}%`);
      }

      // Order query
      if (type === 'streaks') {
        query = query
          .order('current_streak', { referencedTable: 'player_stats', ascending: false })
          .order('best_streak', { referencedTable: 'player_stats', ascending: false })
          .order('wins', { referencedTable: 'player_stats', ascending: false });
      } else if (type === 'weekly') {
        query = query
          .order('weekly_score', { referencedTable: 'player_stats', ascending: false })
          .order('weekly_wins', { referencedTable: 'player_stats', ascending: false });
      } else {
        // global (default)
        query = query
          .order('total_score', { referencedTable: 'player_stats', ascending: false })
          .order('wins', { referencedTable: 'player_stats', ascending: false });
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        console.error("[LEADERBOARD SERVICE] Supabase query error:", error.message);
        return { type, weekId, totalCount: 0, players: [] };
      }

      const formattedPlayers = (data || []).map((row, index) => {
        const stats = Array.isArray(row.player_stats) ? row.player_stats[0] : row.player_stats;
        const subs = Array.isArray(row.subscriptions) ? row.subscriptions : [];
        const isVip = subs.some(s => s.status === 'active');
        const wins = stats?.wins || 0;
        const totalBattles = stats?.total_battles || (wins + (stats?.losses || 0));
        const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 1000) / 10 : 0;

        return {
          rank: index + 1,
          userId: row.internal_user_id,
          displayName: row.display_name,
          avatar: row.avatar_emoji || '👤',
          avatarPhoto: row.avatar_url || null,
          rankTitle: row.rank_title || 'Unranked',
          level: stats?.level || 1,
          xp: stats?.xp || 0,
          wins: wins,
          losses: stats?.losses || 0,
          totalBattles: totalBattles,
          winRate: winRate,
          currentStreak: stats?.current_streak || 0,
          bestStreak: stats?.best_streak || 0,
          weeklyWins: stats?.weekly_wins || 0,
          weeklyScore: stats?.weekly_score || 0,
          totalScore: stats?.total_score || (stats?.xp || 0),
          isVip: isVip,
          title: row.custom_title || 'GUEST FIGHTER'
        };
      });

      return {
        type,
        weekId,
        totalCount: formattedPlayers.length,
        players: formattedPlayers
      };
    } catch (err) {
      console.error("[LEADERBOARD SERVICE] Unexpected error:", err.message);
      return { type, weekId, totalCount: 0, players: [] };
    }
  }

  async getPlayerRank(internalUserId) {
    if (!isConfigured() || !supabase || !internalUserId) {
      return { userId: internalUserId, ranks: { global: null, streaks: null, weekly: null } };
    }

    try {
      const globalList = await this.getLeaderboard('global', 1000);
      const streaksList = await this.getLeaderboard('streaks', 1000);
      const weeklyList = await this.getLeaderboard('weekly', 1000);

      const globalRank = (globalList.players || []).findIndex(p => p.userId === internalUserId) + 1;
      const streaksRank = (streaksList.players || []).findIndex(p => p.userId === internalUserId) + 1;
      const weeklyRank = (weeklyList.players || []).findIndex(p => p.userId === internalUserId) + 1;

      return {
        userId: internalUserId,
        ranks: {
          global: globalRank > 0 ? globalRank : null,
          streaks: streaksRank > 0 ? streaksRank : null,
          weekly: weeklyRank > 0 ? weeklyRank : null
        }
      };
    } catch (e) {
      console.error("[LEADERBOARD SERVICE] Error getting user rank:", e.message);
      return { userId: internalUserId, ranks: { global: null, streaks: null, weekly: null } };
    }
  }
}

module.exports = new LeaderboardService();
