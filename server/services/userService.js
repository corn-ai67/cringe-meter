/**
 * CRINGE METER — User Service (Supabase PostgreSQL)
 * Handles authentic user identity, profiles, and initial stats creation.
 */

const { supabase, isConfigured } = require('./supabase');

class UserService {
  async getOrCreateUser(internalUserId, profileData = {}) {
    if (!isConfigured() || !supabase) {
      return {
        user: {
          internal_user_id: internalUserId,
          display_name: profileData.displayName || "Anonymous",
          avatar_emoji: profileData.avatar || "👤",
          rank_title: profileData.rankTitle || "Unranked",
          custom_title: profileData.title || "GUEST FIGHTER",
          theme: profileData.theme || "magenta",
          victory_taunt: profileData.taunt || "YOU BROKE THEM 💀"
        },
        stats: {
          coins: 0, xp: 0, level: 1, wins: 0, losses: 0,
          total_battles: 0, current_streak: 0, best_streak: 0,
          total_score: 0, weekly_wins: 0, weekly_score: 0
        }
      };
    }

    try {
      // 1. Check if user already exists
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*, player_stats(*)')
        .eq('internal_user_id', internalUserId)
        .maybeSingle();

      if (findError) {
        console.error("[USER SERVICE] Error fetching user:", findError.message);
      }

      if (existingUser) {
        return {
          user: existingUser,
          stats: existingUser.player_stats || {}
        };
      }

      // 2. Insert new user record
      const newUserPayload = {
        internal_user_id: internalUserId,
        email: profileData.email || null,
        display_name: profileData.displayName || "Anonymous",
        avatar_emoji: profileData.avatar || "👤",
        avatar_url: profileData.avatarUrl || null,
        rank_title: profileData.rankTitle || "Unranked",
        custom_title: profileData.title || "GUEST FIGHTER",
        theme: profileData.theme || "magenta",
        victory_taunt: profileData.taunt || "YOU BROKE THEM 💀"
      };

      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert(newUserPayload)
        .select()
        .single();

      if (createError) {
        console.error("[USER SERVICE] Error creating user:", createError.message);
        throw createError;
      }

      // 3. Initialize default player_stats record
      const defaultStats = {
        user_id: createdUser.id,
        coins: 0,
        xp: 0,
        level: 1,
        wins: 0,
        losses: 0,
        total_battles: 0,
        current_streak: 0,
        best_streak: 0,
        total_score: 0,
        weekly_wins: 0,
        weekly_score: 0
      };

      const { data: createdStats, error: statsError } = await supabase
        .from('player_stats')
        .insert(defaultStats)
        .select()
        .single();

      if (statsError) {
        console.error("[USER SERVICE] Error creating player stats:", statsError.message);
      }

      return {
        user: createdUser,
        stats: createdStats || defaultStats
      };
    } catch (err) {
      console.error("[USER SERVICE] Unexpected error in getOrCreateUser:", err.message);
      return null;
    }
  }

  async updateProfile(internalUserId, profileData) {
    if (!isConfigured() || !supabase) return null;

    try {
      const updatePayload = {};
      if (profileData.displayName !== undefined) updatePayload.display_name = profileData.displayName;
      if (profileData.email !== undefined) updatePayload.email = profileData.email;
      if (profileData.avatar !== undefined) updatePayload.avatar_emoji = profileData.avatar;
      if (profileData.avatarUrl !== undefined) updatePayload.avatar_url = profileData.avatarUrl;
      if (profileData.rankTitle !== undefined) updatePayload.rank_title = profileData.rankTitle;
      if (profileData.title !== undefined) updatePayload.custom_title = profileData.title;
      if (profileData.theme !== undefined) updatePayload.theme = profileData.theme;
      if (profileData.taunt !== undefined) updatePayload.victory_taunt = profileData.taunt;

      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('internal_user_id', internalUserId)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[USER SERVICE] Error updating user profile:", error.message);
      }
      return data;
    } catch (err) {
      console.error("[USER SERVICE] Unexpected error in updateProfile:", err.message);
      return null;
    }
  }
}

module.exports = new UserService();
