/**
 * CRINGE METER — Email Marketing & Subscriber Service (Supabase PostgreSQL)
 * Authoritatively saves marketing subscriber emails into the Supabase database.
 */

const { supabase, isConfigured } = require('./supabase');
const userService = require('./userService');

class SubscriberService {
  async addSubscriber(email, displayName = null, internalUserId = null, source = 'web_signup') {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Invalid email address' };
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isConfigured() || !supabase) {
      console.warn("[SUBSCRIBER SERVICE] Supabase not configured. Email subscriber not saved to cloud.");
      return { success: true, savedToCloud: false };
    }

    try {
      let userId = null;
      if (internalUserId) {
        const { user } = await userService.getOrCreateUser(internalUserId, { displayName, email: cleanEmail });
        userId = user?.id || null;
      }

      const { data, error } = await supabase
        .from('email_subscribers')
        .upsert({
          email: cleanEmail,
          display_name: displayName,
          user_id: userId,
          source: source,
          subscribed: true
        }, { onConflict: 'email' })
        .select()
        .single();

      if (error) {
        console.error("[SUBSCRIBER SERVICE] Supabase insert error:", error.message);
        return { success: false, message: error.message };
      }

      console.log(`[SUBSCRIBER SERVICE] Successfully registered subscriber: ${cleanEmail}`);
      return {
        success: true,
        savedToCloud: true,
        subscriber: data
      };
    } catch (err) {
      console.error("[SUBSCRIBER SERVICE] Unexpected error:", err.message);
      return { success: false, message: err.message };
    }
  }

  async unsubscribe(token) {
    if (!isConfigured() || !supabase || !token) return { success: false };

    try {
      const { data, error } = await supabase
        .from('email_subscribers')
        .update({
          subscribed: false,
          unsubscribed_at: new Date().toISOString()
        })
        .eq('unsubscribe_token', token)
        .select();

      if (error) throw error;
      return { success: true, count: data?.length || 0 };
    } catch (e) {
      console.error("[SUBSCRIBER SERVICE] Unsubscribe error:", e.message);
      return { success: false, error: e.message };
    }
  }
}

module.exports = new SubscriberService();
