/**
 * CRINGE METER — User Block Service (Supabase PostgreSQL)
 * Stores user-to-user blocking relationships in Supabase.
 */

const { supabase, isConfigured } = require('./supabase');
const userService = require('./userService');

class BlockService {
  async blockUser(blockerInternalId, blockedInternalId) {
    if (!blockerInternalId || !blockedInternalId) return { success: false };

    if (!isConfigured() || !supabase) {
      return { success: true, savedToCloud: false };
    }

    try {
      const { user: blocker } = await userService.getOrCreateUser(blockerInternalId);
      const { user: blocked } = await userService.getOrCreateUser(blockedInternalId);

      if (!blocker || !blocked) return { success: false };

      const { data, error } = await supabase
        .from('blocks')
        .upsert({
          blocker_id: blocker.id,
          blocked_user_id: blocked.id
        }, { onConflict: 'blocker_id,blocked_user_id' })
        .select();

      if (error) throw error;
      return { success: true, savedToCloud: true, block: data };
    } catch (e) {
      console.error("[BLOCK SERVICE] Error blocking user:", e.message);
      return { success: false, error: e.message };
    }
  }

  async isBlocked(userAInternalId, userBInternalId) {
    if (!isConfigured() || !supabase || !userAInternalId || !userBInternalId) {
      return false;
    }

    try {
      const { data: userA } = await supabase.from('users').select('id').eq('internal_user_id', userAInternalId).maybeSingle();
      const { data: userB } = await supabase.from('users').select('id').eq('internal_user_id', userBInternalId).maybeSingle();

      if (!userA || !userB) return false;

      const { data: blocks } = await supabase
        .from('blocks')
        .select('id')
        .or(`and(blocker_id.eq.${userA.id},blocked_user_id.eq.${userB.id}),and(blocker_id.eq.${userB.id},blocked_user_id.eq.${userA.id})`);

      return Array.isArray(blocks) && blocks.length > 0;
    } catch (e) {
      console.error("[BLOCK SERVICE] Error checking block:", e.message);
      return false;
    }
  }
}

module.exports = new BlockService();
