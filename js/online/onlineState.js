/**
 * CRINGE METER — Online User Identity & State Manager
 * Persistent internalUserId (cm_xxxxxxxxx) distinct from cosmetic display names and avatars.
 */

class OnlineState {
  constructor() {
    this.internalUserId = this.getOrCreateUserId();
    this.currentMatch = null;
    this.blockedUsers = this.loadBlockedUsers();
  }

  getOrCreateUserId() {
    let id = localStorage.getItem('cringe_meter_user_id');
    if (!id) {
      const randStr = Math.random().toString(36).substring(2, 11);
      id = `cm_${randStr}`;
      localStorage.setItem('cringe_meter_user_id', id);
    }
    return id;
  }

  getUserIdentity() {
    const user = window.userService ? window.userService.getCurrentUser() : null;
    const stats = window.gameEngine ? window.gameEngine.getPlayerStats() : {};
    return {
      userId: user?.internalUserId || this.internalUserId,
      displayName: user?.displayName || stats.name || (user?.isSignedIn ? 'Player' : 'Anonymous'),
      avatar: user?.avatar || stats.avatar || (user?.isSignedIn ? '🤡' : '👤'),
      avatarPhoto: user?.avatarPhoto || stats.avatarPhoto || null,
      rankTitle: user?.rankTitle || stats.rank || 'Unranked',
      title: user?.title || stats.title || 'GUEST FIGHTER',
      taunt: user?.taunt || stats.taunt || 'YOU BROKE THEM 💀'
    };
  }

  loadBlockedUsers() {
    try {
      const saved = localStorage.getItem('cringe_meter_blocked_users');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  blockUser(userId) {
    if (!this.blockedUsers.includes(userId)) {
      this.blockedUsers.push(userId);
      localStorage.setItem('cringe_meter_blocked_users', JSON.stringify(this.blockedUsers));
    }
  }

  isUserBlocked(userId) {
    return this.blockedUsers.includes(userId);
  }
}

window.onlineState = new OnlineState();
