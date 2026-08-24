/**
 * CRINGE METER — Match Service (Supabase PostgreSQL)
 * Authoritatively records completed 1v1 battle outcomes and increments player stats.
 */

const { supabase, isConfigured } = require('./supabase');
const userService = require('./userService');

class MatchService {
  async recordMatchResult(sessionId, winnerData, loserData, mode = 'dont_laugh', winnerScore = 150, loserScore = 40) {
    if (!sessionId) {
      return { success: false, message: 'Missing sessionId' };
    }

    if (!isConfigured() || !supabase) {
      console.warn("[MATCH SERVICE] Supabase not configured. Match not persisted to cloud.");
      return { success: true, savedToCloud: false };
    }

    try {
      // 1. Ensure both Winner & Loser user records exist in Supabase
      if (winnerData && winnerData.userId) {
        await userService.getOrCreateUser(winnerData.userId, winnerData);
      }
      if (loserData && loserData.userId) {
        await userService.getOrCreateUser(loserData.userId, loserData);
      }

      const winnerInternalId = winnerData ? winnerData.userId : null;
      const loserInternalId = loserData ? loserData.userId : null;

      // 2. Call the atomic RPC stored procedure
      const { data, error } = await supabase.rpc('record_match_outcome_rpc', {
        p_session_id: sessionId,
        p_winner_internal_id: winnerInternalId,
        p_loser_internal_id: loserInternalId,
        p_mode: mode,
        p_winner_earned_score: winnerScore,
        p_loser_earned_score: loserScore
      });

      if (error) {
        console.error("[MATCH SERVICE] RPC record_match_outcome_rpc error:", error.message);
        // Fallback: Direct table operations if RPC fails
        return await this.fallbackDirectRecord(sessionId, winnerInternalId, loserInternalId, mode, winnerScore, loserScore);
      }

      return {
        success: true,
        savedToCloud: true,
        data
      };
    } catch (err) {
      console.error("[MATCH SERVICE] Error recording match result:", err.message);
      return { success: false, error: err.message };
    }
  }

  async fallbackDirectRecord(sessionId, winnerInternalId, loserInternalId, mode, winnerScore, loserScore) {
    try {
      // Check existing match
      const { data: existing } = await supabase.from('matches').select('id').eq('session_id', sessionId).maybeSingle();
      if (existing) {
        return { success: true, duplicate: true };
      }

      // Look up user IDs
      const { data: winner } = winnerInternalId ? await supabase.from('users').select('id').eq('internal_user_id', winnerInternalId).maybeSingle() : { data: null };
      const { data: loser } = loserInternalId ? await supabase.from('users').select('id').eq('internal_user_id', loserInternalId).maybeSingle() : { data: null };

      // Insert Match
      await supabase.from('matches').insert({
        session_id: sessionId,
        player_a_id: winner ? winner.id : null,
        player_b_id: loser ? loser.id : null,
        winner_id: winner ? winner.id : null,
        loser_id: loser ? loser.id : null,
        mode: mode,
        status: 'completed'
      });

      // Update winner stats
      if (winner) {
        const { data: currentStats } = await supabase.from('player_stats').select('*').eq('user_id', winner.id).maybeSingle();
        if (currentStats) {
          const newStreak = (currentStats.current_streak || 0) + 1;
          const bestStreak = Math.max(currentStats.best_streak || 0, newStreak);
          await supabase.from('player_stats').update({
            wins: (currentStats.wins || 0) + 1,
            total_battles: (currentStats.total_battles || 0) + 1,
            current_streak: newStreak,
            best_streak: bestStreak,
            total_score: (currentStats.total_score || 0) + winnerScore,
            weekly_wins: (currentStats.weekly_wins || 0) + 1,
            weekly_score: (currentStats.weekly_score || 0) + winnerScore,
            xp: (currentStats.xp || 0) + winnerScore
          }).eq('user_id', winner.id);
        }
      }

      // Update loser stats
      if (loser) {
        const { data: currentStats } = await supabase.from('player_stats').select('*').eq('user_id', loser.id).maybeSingle();
        if (currentStats) {
          await supabase.from('player_stats').update({
            losses: (currentStats.losses || 0) + 1,
            total_battles: (currentStats.total_battles || 0) + 1,
            current_streak: 0,
            total_score: (currentStats.total_score || 0) + loserScore,
            weekly_score: (currentStats.weekly_score || 0) + loserScore,
            xp: (currentStats.xp || 0) + loserScore
          }).eq('user_id', loser.id);
        }
      }

      return { success: true, savedToCloud: true };
    } catch (e) {
      console.error("[MATCH SERVICE] Fallback direct record failed:", e.message);
      return { success: false, error: e.message };
    }
  }
}

module.exports = new MatchService();
