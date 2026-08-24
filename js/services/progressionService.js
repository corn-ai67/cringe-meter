/**
 * CRINGE METER — Centralized Progression & Rank Calculation Service
 * Single authoritative formula for converting Total XP -> Level, Next Level XP, and Competitive Rank.
 */

(function(window) {
  'use strict';

  class ProgressionService {
    /**
     * Calculate Level, in-level XP progress, next-level XP requirement, and competitive Rank
     * @param {number} totalXp - Cumulative lifetime XP from Supabase player_stats
     * @returns {{ totalXp: number, level: number, currentLevelXp: number, xpForNextLevel: number, rankTitle: string }}
     */
    getPlayerProgress(totalXp) {
      const xp = Math.max(0, parseInt(totalXp, 10) || 0);

      // Level progression curve
      let level = 1;
      let xpRemaining = xp;
      let xpNeededForNext = 1000;

      while (xpRemaining >= xpNeededForNext) {
        xpRemaining -= xpNeededForNext;
        level += 1;
        xpNeededForNext = 1000 + (level - 1) * 500;
      }

      // Competitive Ranks
      let rank = "Unranked";
      if (xp >= 35000) rank = "CRINGE GOD";
      else if (xp >= 29000) rank = "Diamond II";
      else if (xp >= 24500) rank = "Diamond I";
      else if (xp >= 20500) rank = "Platinum III";
      else if (xp >= 17000) rank = "Platinum II";
      else if (xp >= 14000) rank = "Platinum I";
      else if (xp >= 11500) rank = "Gold III";
      else if (xp >= 9250) rank = "Gold II";
      else if (xp >= 7250) rank = "Gold I";
      else if (xp >= 5500) rank = "Silver III";
      else if (xp >= 4000) rank = "Silver II";
      else if (xp >= 2750) rank = "Silver I";
      else if (xp >= 1750) rank = "Bronze III";
      else if (xp >= 1000) rank = "Bronze II";
      else if (xp >= 500) rank = "Bronze I";
      else rank = "Unranked";

      return {
        totalXp: xp,
        level: level,
        currentLevelXp: xpRemaining,
        xpForNextLevel: xpNeededForNext,
        rankTitle: rank
      };
    }
  }

  window.ProgressionService = ProgressionService;
  window.progressionService = new ProgressionService();
})(typeof window !== 'undefined' ? window : global);
