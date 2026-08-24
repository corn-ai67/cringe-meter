/**
 * CRINGE METER — Safety & Reporting Service (Supabase PostgreSQL)
 * Stores user safety incident reports in Supabase.
 */

const { supabase, isConfigured } = require('./supabase');
const userService = require('./userService');

class ReportService {
  async addReport({ reporterInternalId, reportedInternalId, sessionId, reason, details }) {
    if (!reason) return { success: false, message: 'Missing report reason' };

    if (!isConfigured() || !supabase) {
      return { success: true, savedToCloud: false, report: { reason, details, status: 'pending' } };
    }

    try {
      const { user: reporter } = reporterInternalId ? await userService.getOrCreateUser(reporterInternalId) : { user: null };
      const { user: reported } = reportedInternalId ? await userService.getOrCreateUser(reportedInternalId) : { user: null };

      const { data, error } = await supabase
        .from('reports')
        .insert({
          reporter_id: reporter?.id || null,
          reported_user_id: reported?.id || null,
          session_id: sessionId || null,
          reason,
          details: details || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, savedToCloud: true, report: data };
    } catch (e) {
      console.error("[REPORT SERVICE] Error saving safety report:", e.message);
      return { success: false, error: e.message };
    }
  }
}

module.exports = new ReportService();
