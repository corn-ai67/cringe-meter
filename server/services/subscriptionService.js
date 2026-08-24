/**
 * CRINGE METER — VIP Subscription Service (Supabase PostgreSQL)
 * Authoritatively manages VIP status, expiration dates, and payment provider records.
 */

const { supabase, isConfigured } = require('./supabase');
const userService = require('./userService');

class SubscriptionService {
  async getSubscriptionStatus(internalUserId) {
    if (!isConfigured() || !supabase || !internalUserId) {
      return {
        userId: internalUserId,
        planId: 'cringe_vip_monthly_599',
        priceUsd: 5.99,
        isVip: false,
        vipStatus: 'FREE',
        vipExpiresAt: null
      };
    }

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, subscriptions(*)')
        .eq('internal_user_id', internalUserId)
        .maybeSingle();

      if (!user) {
        return {
          userId: internalUserId,
          planId: 'cringe_vip_monthly_599',
          priceUsd: 5.99,
          isVip: false,
          vipStatus: 'FREE',
          vipExpiresAt: null
        };
      }

      const activeSub = (user.subscriptions || []).find(s => s.status === 'active');
      const isVip = !!activeSub;

      return {
        userId: internalUserId,
        planId: activeSub?.plan || 'cringe_vip_monthly_599',
        priceUsd: 5.99,
        isVip,
        vipStatus: isVip ? 'VIP_ACTIVE' : 'FREE',
        vipExpiresAt: activeSub?.current_period_end || null
      };
    } catch (err) {
      console.error("[SUBSCRIPTION SERVICE] Error fetching subscription status:", err.message);
      return {
        userId: internalUserId,
        planId: 'cringe_vip_monthly_599',
        priceUsd: 5.99,
        isVip: false,
        vipStatus: 'FREE',
        vipExpiresAt: null
      };
    }
  }

  async setSubscription(internalUserId, { plan = 'cringe_vip_monthly_599', status = 'active', provider = 'stripe', expiresAt = null }) {
    if (!isConfigured() || !supabase || !internalUserId) return null;

    try {
      const { user } = await userService.getOrCreateUser(internalUserId);
      if (!user) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan,
          status,
          provider,
          current_period_end: expiresAt
        })
        .select()
        .single();

      if (error) {
        console.error("[SUBSCRIPTION SERVICE] Error upserting subscription:", error.message);
      }
      return data;
    } catch (e) {
      console.error("[SUBSCRIPTION SERVICE] Unexpected error:", e.message);
      return null;
    }
  }
}

module.exports = new SubscriptionService();
