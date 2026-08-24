/**
 * CRINGE METER — Frontend User & Authentication Service
 * Single Authoritative Source of Truth for current user profile, Supabase session restoration,
 * and seamless guest vs signed-in account state management.
 */

class UserService {
  constructor() {
    this.currentUser = {
      isSignedIn: false,
      id: null,
      internalUserId: null,
      email: null,
      displayName: "Anonymous",
      avatar: "👤",
      avatarPhoto: null,
      rankTitle: "Unranked",
      title: "GUEST FIGHTER",
      theme: "magenta",
      taunt: "YOU BROKE THEM 💀",
      coins: 0,
      xp: 0,
      level: 1,
      wins: 0,
      losses: 0,
      totalBattles: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalScore: 0,
      isVip: false
    };

    this.listeners = [];
    this.isInitialized = false;
  }

  onUserChange(fn) {
    if (typeof fn === 'function') {
      this.listeners.push(fn);
    }
  }

  notifyChange() {
    this.listeners.forEach(fn => {
      try {
        fn(this.currentUser);
      } catch (e) {
        console.warn("[USER SERVICE] Error in listener:", e);
      }
    });
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Check for stored session
      const savedSessionRaw = localStorage.getItem('cringe_meter_session') || localStorage.getItem('cringe_meter_account');
      if (savedSessionRaw) {
        const session = JSON.parse(savedSessionRaw);
        const email = session.email || null;
        const internalUserId = session.internalUserId || session.userId || null;
        const cachedName = session.displayName || session.username || "Anonymous";

        // Pre-populate with cached session info to prevent flashing Anonymous while fetching
        if (email || internalUserId) {
          this.currentUser.isSignedIn = true;
          this.currentUser.email = email;
          this.currentUser.internalUserId = internalUserId;
          this.currentUser.displayName = cachedName;
          this.currentUser.avatar = session.avatar || "🤡";
          this.currentUser.title = session.title || "GUEST FIGHTER";
          this.notifyChange();

          // Fetch authoritative profile from Supabase
          await this.fetchUserFromCloud(internalUserId, email);
          return;
        }
      }

      // 2. Default to Guest state if no session exists
      this.setGuestState();
    } catch (e) {
      console.warn("[USER SERVICE] Error during init:", e);
      this.setGuestState();
    }
  }

  setGuestState() {
    this.currentUser = {
      isSignedIn: false,
      id: null,
      internalUserId: null,
      email: null,
      displayName: "Anonymous",
      avatar: "👤",
      avatarPhoto: null,
      rankTitle: "Unranked",
      title: "GUEST FIGHTER",
      theme: "magenta",
      taunt: "YOU BROKE THEM 💀",
      coins: 0,
      xp: 0,
      level: 1,
      wins: 0,
      losses: 0,
      totalBattles: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalScore: 0,
      isVip: false
    };
    this.notifyChange();
  }

  async fetchUserFromCloud(internalUserId, email) {
    try {
      const url = internalUserId
        ? `/api/users/me?userId=${encodeURIComponent(internalUserId)}`
        : `/api/users/me?email=${encodeURIComponent(email)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.success && data.user) {
        this.applyUserData(data.user);
      }
    } catch (err) {
      console.warn("[USER SERVICE] Could not fetch user from cloud:", err.message);
    }
  }

  applyUserData(userData) {
    const wins = userData.wins || 0;
    const losses = userData.losses || 0;
    const totalBattles = userData.totalBattles !== undefined ? userData.totalBattles : (wins + losses);
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 1000) / 10 : 0;

    this.currentUser = {
      isSignedIn: true,
      id: userData.id || this.currentUser.id,
      internalUserId: userData.internalUserId || this.currentUser.internalUserId,
      email: userData.email || this.currentUser.email,
      displayName: userData.displayName || "Anonymous",
      avatar: userData.avatar || userData.avatarEmoji || "🤡",
      avatarPhoto: userData.avatarPhoto || userData.avatarUrl || null,
      rankTitle: userData.rankTitle || "Unranked",
      title: userData.title || userData.customTitle || "GUEST FIGHTER",
      theme: userData.theme || "magenta",
      taunt: userData.taunt || userData.victoryTaunt || "YOU BROKE THEM 💀",
      coins: userData.coins || 0,
      xp: userData.xp || 0,
      level: userData.level || 1,
      wins: wins,
      losses: losses,
      totalBattles: totalBattles,
      winRate: winRate,
      currentStreak: userData.currentStreak || 0,
      bestStreak: userData.bestStreak || 0,
      totalScore: userData.totalScore || (userData.xp || 0),
      isVip: !!userData.isVip
    };

    // Save active session
    localStorage.setItem('cringe_meter_session', JSON.stringify({
      internalUserId: this.currentUser.internalUserId,
      email: this.currentUser.email,
      displayName: this.currentUser.displayName,
      avatar: this.currentUser.avatar,
      title: this.currentUser.title
    }));

    this.notifyChange();
  }

  async signIn({ email, username, password }) {
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanUsername = username ? username.trim() : (cleanEmail ? cleanEmail.split('@')[0] : "Anonymous");

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanUsername,
          internalUserId: this.currentUser.internalUserId || `cm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          profile: {
            avatar: this.currentUser.avatar === '👤' ? '🤡' : this.currentUser.avatar,
            title: this.currentUser.title || 'GUEST FIGHTER'
          }
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        this.applyUserData(data.user);

        // If email provided, register subscriber
        if (cleanEmail && cleanEmail.includes('@')) {
          fetch('/api/subscribers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              displayName: data.user.displayName,
              userId: data.user.internalUserId,
              source: 'auth_signin'
            })
          }).catch(() => {});
        }

        return { success: true, user: this.currentUser };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (e) {
      console.error("[USER SERVICE] Login network error:", e);
      // Fallback local sign in if backend unreachable
      this.applyUserData({
        internalUserId: `cm_${Date.now()}`,
        email: cleanEmail,
        displayName: cleanUsername,
        avatar: '🤡',
        rankTitle: 'Unranked',
        title: 'GUEST FIGHTER',
        coins: 0, xp: 0, level: 1, wins: 0, losses: 0, totalBattles: 0, winRate: 0,
        currentStreak: 0, bestStreak: 0, isVip: false
      });
      return { success: true, user: this.currentUser };
    }
  }

  signOut() {
    localStorage.removeItem('cringe_meter_session');
    localStorage.removeItem('cringe_meter_account');
    localStorage.removeItem('cringe_meter_player_data');
    this.setGuestState();
    return { success: true };
  }

  async updateProfile(profileUpdates) {
    if (profileUpdates.name !== undefined) this.currentUser.displayName = profileUpdates.name.trim() || this.currentUser.displayName;
    if (profileUpdates.title !== undefined) this.currentUser.title = profileUpdates.title.trim() || this.currentUser.title;
    if (profileUpdates.avatar !== undefined) this.currentUser.avatar = profileUpdates.avatar;
    if (profileUpdates.avatarPhoto !== undefined) this.currentUser.avatarPhoto = profileUpdates.avatarPhoto;
    if (profileUpdates.theme !== undefined) this.currentUser.theme = profileUpdates.theme;
    if (profileUpdates.taunt !== undefined) this.currentUser.taunt = profileUpdates.taunt;

    // Update active session cache
    if (this.currentUser.isSignedIn) {
      localStorage.setItem('cringe_meter_session', JSON.stringify({
        internalUserId: this.currentUser.internalUserId,
        email: this.currentUser.email,
        displayName: this.currentUser.displayName,
        avatar: this.currentUser.avatar,
        title: this.currentUser.title
      }));

      // Push to Supabase
      try {
        const res = await fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.currentUser.internalUserId,
            profile: {
              displayName: this.currentUser.displayName,
              avatar: this.currentUser.avatar,
              avatarPhoto: this.currentUser.avatarPhoto,
              title: this.currentUser.title,
              theme: this.currentUser.theme,
              taunt: this.currentUser.taunt
            }
          })
        });
        const data = await res.json();
        if (data.success && data.user) {
          this.applyUserData(data.user);
          return;
        }
      } catch (e) {
        console.warn("[USER SERVICE] Sync error:", e);
      }
    }

    this.notifyChange();
  }
}

window.userService = new UserService();
