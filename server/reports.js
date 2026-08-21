/**
 * CRINGE METER — Reports & Block List Module
 * Stores user safety reports and maintains blocked stranger pairings.
 */

class SafetyManager {
  constructor() {
    this.reports = [];
    this.blocks = new Map(); // userId -> Set of blockedUserIds
  }

  addReport(reportData) {
    const report = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      reporterId: reportData.reporterId,
      reportedUserId: reportData.reportedUserId,
      sessionId: reportData.sessionId,
      reason: reportData.reason || 'Other',
      timestamp: new Date().toISOString(),
      status: 'REPORT_STORED'
    };
    this.reports.push(report);
    console.log(`[SAFETY] Report stored: Reporter ${report.reporterId} -> Reported ${report.reportedUserId} (${report.reason})`);
    return report;
  }

  blockUser(userId, targetUserId) {
    if (!this.blocks.has(userId)) {
      this.blocks.set(userId, new Set());
    }
    this.blocks.get(userId).add(targetUserId);
    console.log(`[SAFETY] User ${userId} blocked ${targetUserId}`);
    return true;
  }

  isBlocked(userIdA, userIdB) {
    if (this.blocks.has(userIdA) && this.blocks.get(userIdA).has(userIdB)) return true;
    if (this.blocks.has(userIdB) && this.blocks.get(userIdB).has(userIdA)) return true;
    return false;
  }

  getReports() {
    return this.reports;
  }
}

module.exports = new SafetyManager();
