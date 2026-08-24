/**
 * CRINGE METER — User Service (Supabase PostgreSQL)
 * Handles authentic user identity, profiles, and initial stats creation.
 */

const { supabase, isConfigured } = require('./supabase');

class UserService {
  mapDatabaseUser(userRow, statsRow = null, subRows = []) {
    if (!userRow) return null;
    const stats = statsRow || (Array.isArray(userRow.player_stats) ? userRow.player_stats[0] : userRow.player_stats) || {};
    const subs = subRows.length > 0 ? subRows : (Array.isArray(userRow.subscriptions) ? userRow.subscriptions : []);
    const isVip = subs.some(s => s.status === 'active');

    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const totalBattles = stats.total_battles !== undefined ? stats.total_battles : (wins + losses);
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 1000) / 10 : 0;

    return {
      id: userRow.id,
      internalUserId: userRow.internal_user_id,
      email: userRow.email,
      displayName: userRow.display_name || "Anonymous",
      avatar: userRow.avatar_emoji || "👤",
      avatarPhoto: userRow.avatar_url || null,
      rankTitle: userRow.rank_title || "Unranked",
      title: userRow.custom_title || "GUEST FIGHTER",
      theme: userRow.theme || "magenta",
      taunt: userRow.victory_taunt || "YOU BROKE THEM 💀",
      createdAt: userRow.created_at,
      coins: stats.coins || 0,
      xp: stats.xp || 0,
      level: stats.level || 1,
      wins: wins,
      losses: losses,
      totalBattles: totalBattles,
      winRate: winRate,
      currentStreak: stats.current_streak || 0,
      bestStreak: stats.best_streak || 0,
      totalScore: stats.total_score || (stats.xp || 0),
      weeklyWins: stats.weekly_wins || 0,
      weeklyScore: stats.weekly_score || 0,
      isVip: isVip
    };
  }

  async authenticateOrRegister({ email = null, username = null, internalUserId = null, profile = {} }) {
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanUsername = username ? username.trim() : (cleanEmail ? cleanEmail.split('@')[0] : "Anonymous");

    if (!isConfigured() || !supabase) {
      const fallbackId = internalUserId || `cm_${Date.now()}`;
      return {
        success: true,
        isNew: false,
        user: {
          id: fallbackId,
          internalUserId: fallbackId,
          email: cleanEmail,
          displayName: cleanUsername,
          avatar: profile.avatar || "🤡",
          rankTitle: "Unranked",
          title: "GUEST FIGHTER",
          theme: "magenta",
          taunt: "YOU BROKE THEM 💀",
          coins: 0, xp: 0, level: 1, wins: 0, losses: 0, totalBattles: 0, winRate: 0,
          currentStreak: 0, bestStreak: 0, isVip: false
        }
      };
    }

    try {
      // 1. Try finding existing user by Email first (authoritative identity)
      let existingUser = null;
      if (cleanEmail) {
        const { data, error } = await supabase
          .from('users')
          .select('*, player_stats(*), subscriptions(*)')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (data) existingUser = data;
      }

      // 2. If not found by email, try finding by internalUserId
      if (!existingUser && internalUserId) {
        const { data, error } = await supabase
          .from('users')
          .select('*, player_stats(*), subscriptions(*)')
          .eq('internal_user_id', internalUserId)
          .maybeSingle();

        if (data) existingUser = data;
      }

      // 3. Existing User Found: update display name if provided and return
      if (existingUser) {
        // If username was given and differs, update it
        if (cleanUsername && cleanUsername !== 'Anonymous' && cleanUsername !== existingUser.display_name) {
          const { data: updated } = await supabase
            .from('users')
            .update({ display_name: cleanUsername })
            .eq('id', existingUser.id)
            .select('*, player_stats(*), subscriptions(*)')
            .single();

          if (updated) existingUser = updated;
        }

        return {
          success: true,
          isNew: false,
          user: this.mapDatabaseUser(existingUser)
        };
      }

      // 4. New User Registration: create record in Supabase
      const newInternalId = internalUserId || `cm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newUserPayload = {
        internal_user_id: newInternalId,
        email: cleanEmail,
        display_name: cleanUsername || "Anonymous",
        avatar_emoji: profile.avatar || "🤡",
        avatar_url: profile.avatarPhoto || null,
        rank_title: profile.rankTitle || "Unranked",
        custom_title: profile.title || "GUEST FIGHTER",
        theme: profile.theme || "magenta",
        victory_taunt: profile.taunt || "YOU BROKE THEM 💀"
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

      // 5. Initialize brand-new player_stats record with 0s
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

      return {
        success: true,
        isNew: true,
        user: this.mapDatabaseUser(createdUser, createdStats || defaultStats, [])
      };
    } catch (err) {
      console.error("[USER SERVICE] Unexpected error in authenticateOrRegister:", err.message);
      return { success: false, error: err.message };
    }
  }

  async getUserById(internalUserId) {
    if (!internalUserId) return null;
    if (!isConfigured() || !supabase) return null;

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*, player_stats(*), subscriptions(*)')
        .eq('internal_user_id', internalUserId)
        .maybeSingle();

      if (error || !user) return null;
      return this.mapDatabaseUser(user);
    } catch (e) {
      console.error("[USER SERVICE] Error in getUserById:", e.message);
      return null;
    }
  }

  async getOrCreateUser(internalUserId, profileData = {}) {
    const res = await this.authenticateOrRegister({
      internalUserId,
      email: profileData.email,
      username: profileData.displayName,
      profile: profileData
    });
    return {
      user: res.user,
      stats: res.user
    };
  }

  async updateProfile(internalUserId, profileData) {
    if (!isConfigured() || !supabase) return null;

    try {
      const updatePayload = {};
      if (profileData.displayName !== undefined) updatePayload.display_name = profileData.displayName;
      if (profileData.email !== undefined) updatePayload.email = profileData.email;
      if (profileData.avatar !== undefined) updatePayload.avatar_emoji = profileData.avatar;
      if (profileData.avatarUrl !== undefined || profileData.avatarPhoto !== undefined) {
        updatePayload.avatar_url = profileData.avatarUrl || profileData.avatarPhoto;
      }
      if (profileData.rankTitle !== undefined) updatePayload.rank_title = profileData.rankTitle;
      if (profileData.title !== undefined) updatePayload.custom_title = profileData.title;
      if (profileData.theme !== undefined) updatePayload.theme = profileData.theme;
      if (profileData.taunt !== undefined) updatePayload.victory_taunt = profileData.taunt;

      const { data, error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('internal_user_id', internalUserId)
        .select('*, player_stats(*), subscriptions(*)')
        .maybeSingle();

      if (error) {
        console.error("[USER SERVICE] Error updating user profile:", error.message);
      }
      return this.mapDatabaseUser(data);
    } catch (err) {
      console.error("[USER SERVICE] Unexpected error in updateProfile:", err.message);
      return null;
    }
  }
}

module.exports = new UserService();
