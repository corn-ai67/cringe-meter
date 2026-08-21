/**
 * CRINGE METER — Subscription & VIP Entitlement Service
 * Centralized service for evaluating VIP entitlement, subscription state, and coin multipliers.
 */

(function() {
  class SubscriptionService {
    constructor() {
      this.VIP_PLAN_ID = 'cringe_vip_monthly_599';
      this.VIP_PRICE_USD = 5.99;
      this.VIP_TITLE = '👑 CRINGE VIP';
    }

    /**
     * Evaluates whether a player currently has active VIP access.
     * @param {Object} player - The player object from GameEngine
     * @returns {boolean}
     */
    hasVipAccess(player) {
      if (!player) return false;
      return this.getVipStatus(player) === 'VIP_ACTIVE';
    }

    /**
     * Returns the strict entitlement state: 'VIP_ACTIVE', 'VIP_EXPIRED', or 'FREE'
     * @param {Object} player
     * @returns {'VIP_ACTIVE' | 'VIP_EXPIRED' | 'FREE'}
     */
    getVipStatus(player) {
      if (!player || !player.isVip) {
        return 'FREE';
      }

      if (player.vipExpiresAt) {
        const expiryTime = new Date(player.vipExpiresAt).getTime();
        const now = Date.now();
        if (expiryTime <= now) {
          return 'VIP_EXPIRED';
        }
      }

      return 'VIP_ACTIVE';
    }

    /**
     * Calculates the coin reward multiplier based on VIP status.
     * @param {Object} player
     * @returns {number} 2 for active VIP, 1 for free/expired
     */
    getCoinMultiplier(player) {
      return this.hasVipAccess(player) ? 2 : 1;
    }

    /**
     * Checks if a title is restricted to VIP members.
     * @param {string} title
     * @returns {boolean}
     */
    isVipTitle(title) {
      if (!title) return false;
      return title.trim().toLowerCase().includes('cringe vip') || title.trim() === this.VIP_TITLE;
    }

    /**
     * Formats remaining VIP subscription time in a readable format.
     * @param {string|number} expiresAt
     * @returns {string}
     */
    formatRemainingTime(expiresAt) {
      if (!expiresAt) return 'Active Subscription';
      const remainingMs = new Date(expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) return 'Expired';
      const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      return `${days} days remaining`;
    }
  }

  window.subscriptionService = new SubscriptionService();

  /* ==========================================================================
     ⚠️ DEVELOPMENT VIP TEST MODE
     For developer and pair-programming verification only.
     NOT production payment verification.
     ========================================================================== */
  window.devVipTestHelper = {
    setFree: function() {
      if (!window.gameEngine) return;
      window.gameEngine.player.isVip = false;
      window.gameEngine.player.vipPlan = null;
      window.gameEngine.player.vipExpiresAt = null;
      
      // Fallback title if currently equipped VIP title
      if (window.subscriptionService.isVipTitle(window.gameEngine.player.title)) {
        window.gameEngine.player.title = window.gameEngine.player.isSignedIn ? 'ABSOLUTELY SHAMELESS' : 'GUEST FIGHTER';
      }
      
      window.gameEngine.savePlayerData();
      if (window.gameEngine.uiCallbacks.onPlayerUpdated) {
        window.gameEngine.uiCallbacks.onPlayerUpdated(window.gameEngine.player);
      }
      console.log("[DEV VIP TEST] Mode set to: FREE");
      return "State: FREE";
    },

    setVipActive: function(days = 30) {
      if (!window.gameEngine) return;
      const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      window.gameEngine.player.isVip = true;
      window.gameEngine.player.vipPlan = 'cringe_vip_monthly_599';
      window.gameEngine.player.vipExpiresAt = expiryDate;
      window.gameEngine.player.title = '👑 CRINGE VIP';
      window.gameEngine.savePlayerData();
      if (window.gameEngine.uiCallbacks.onPlayerUpdated) {
        window.gameEngine.uiCallbacks.onPlayerUpdated(window.gameEngine.player);
      }
      console.log(`[DEV VIP TEST] Mode set to: VIP_ACTIVE (Expires: ${expiryDate})`);
      return `State: VIP_ACTIVE (Valid for ${days} days)`;
    },

    setVipExpired: function() {
      if (!window.gameEngine) return;
      // Set expiration to 1 day ago
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      window.gameEngine.player.isVip = true;
      window.gameEngine.player.vipPlan = 'cringe_vip_monthly_599';
      window.gameEngine.player.vipExpiresAt = expiredDate;

      // Fallback title if currently equipped VIP title
      if (window.subscriptionService.isVipTitle(window.gameEngine.player.title)) {
        window.gameEngine.player.title = window.gameEngine.player.isSignedIn ? 'ABSOLUTELY SHAMELESS' : 'GUEST FIGHTER';
      }

      window.gameEngine.savePlayerData();
      if (window.gameEngine.uiCallbacks.onPlayerUpdated) {
        window.gameEngine.uiCallbacks.onPlayerUpdated(window.gameEngine.player);
      }
      console.log(`[DEV VIP TEST] Mode set to: VIP_EXPIRED (Expired at: ${expiredDate})`);
      return "State: VIP_EXPIRED";
    },

    getStatus: function() {
      if (!window.gameEngine) return "Engine not ready";
      const status = window.subscriptionService.getVipStatus(window.gameEngine.player);
      const details = {
        status: status,
        isVip: window.gameEngine.player.isVip,
        vipPlan: window.gameEngine.player.vipPlan,
        vipExpiresAt: window.gameEngine.player.vipExpiresAt,
        coinMultiplier: window.subscriptionService.getCoinMultiplier(window.gameEngine.player)
      };
      console.table(details);
      return details;
    }
  };
})();
