/**
 * CRINGE METER — Leaderboard Service Module
 * Handles Multi-tab Leaderboard (Global Top, Win Streaks, Weekly), Search Filtering,
 * Backend Synchronization, Socket.IO Real-time Updates, and Verified Real Player Data.
 */

(function() {
  // Optional developer flag: MUST remain false in production
  const USE_DEV_LEADERBOARD_DATA = false;

  class LeaderboardService {
    constructor() {
      this.currentTab = 'global'; // 'global' | 'streaks' | 'weekly'
      this.searchQuery = '';
      this.cachedData = {
        global: null,
        streaks: null,
        weekly: null
      };
      this.isLoading = false;
      this.isError = false;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.bindTabEvents();
      this.bindSearchEvents();
      this.listenSocketEvents();

      // Initial load
      this.loadAndRender();
      this.renderHomeTopPerformers();
    }

    bindTabEvents() {
      const tabGlobal = document.getElementById('lbTabGlobal');
      const tabStreak = document.getElementById('lbTabStreak');
      const tabWeekly = document.getElementById('lbTabWeekly');

      if (tabGlobal) {
        tabGlobal.addEventListener('click', () => this.switchTab('global'));
      }
      if (tabStreak) {
        tabStreak.addEventListener('click', () => this.switchTab('streaks'));
      }
      if (tabWeekly) {
        tabWeekly.addEventListener('click', () => this.switchTab('weekly'));
      }
    }

    bindSearchEvents() {
      const searchInput = document.getElementById('leaderboardSearchInput');
      const clearBtn = document.getElementById('btnClearLeaderboardSearch');

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          if (clearBtn) {
            if (this.searchQuery) {
              clearBtn.classList.remove('hidden');
            } else {
              clearBtn.classList.add('hidden');
            }
          }
          this.renderLeaderboard();
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          this.searchQuery = '';
          clearBtn.classList.add('hidden');
          this.renderLeaderboard();
        });
      }
    }

    listenSocketEvents() {
      if (window.io) {
        try {
          const socket = window.onlineBattleController?.socket;
          if (socket) {
            socket.on('leaderboard_updated', () => {
              console.log("[LEADERBOARD] Real-time leaderboard update received from server.");
              this.invalidateCache();
              this.loadAndRender();
              this.renderHomeTopPerformers();
            });
          }
        } catch (e) {
          console.warn("[LEADERBOARD] Socket binding info:", e);
        }
      }
    }

    invalidateCache() {
      this.cachedData.global = null;
      this.cachedData.streaks = null;
      this.cachedData.weekly = null;
    }

    switchTab(tabName) {
      if (this.currentTab === tabName) return;
      this.currentTab = tabName;

      // Update Tab Pill UI
      const tabGlobal = document.getElementById('lbTabGlobal');
      const tabStreak = document.getElementById('lbTabStreak');
      const tabWeekly = document.getElementById('lbTabWeekly');

      if (tabGlobal) tabGlobal.classList.toggle('active', tabName === 'global');
      if (tabStreak) tabStreak.classList.toggle('active', tabName === 'streaks');
      if (tabWeekly) tabWeekly.classList.toggle('active', tabName === 'weekly');

      if (window.soundEngine) {
        window.soundEngine.playClick();
      }

      this.loadAndRender();
    }

    async fetchLeaderboardData(type) {
      const serverUrl = window.location.origin;
      try {
        const response = await fetch(`${serverUrl}/api/leaderboard?type=${type}&limit=50`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && Array.isArray(data.players)) {
          // Filter to only players who have completed at least 1 battle
          return data.players.filter(p => {
            const battles = (p.wins || 0) + (p.losses || 0) || (p.totalBattles || 0);
            return battles > 0;
          });
        }
        throw new Error("Invalid response format");
      } catch (err) {
        console.warn("[LEADERBOARD] API unavailable, using local verified data:", err.message);
        return this.getLocalSortedFallback(type);
      }
    }

    getLocalSortedFallback(type) {
      let list = [];

      // If developer mode is explicitly enabled, load dev mock fixtures
      if (USE_DEV_LEADERBOARD_DATA && window.DEV_MOCK_LEADERBOARD) {
        list = JSON.parse(JSON.stringify(window.DEV_MOCK_LEADERBOARD));
      }

      // Inject local player ONLY if they have completed at least one battle
      const player = window.gameEngine?.getPlayerStats();
      const totalMatches = player?.totalMatches || 0;
      if (player && totalMatches > 0) {
        const localUserEntry = {
          userId: player.userId || "local_player_user",
          displayName: player.name || "Anonymous",
          avatar: player.avatar || "👤",
          avatarPhoto: player.avatarPhoto || null,
          rankTitle: player.rank || "Unranked",
          level: player.level || 1,
          xp: player.xp || 0,
          wins: player.peopleBroken || 0,
          losses: Math.max(0, totalMatches - (player.peopleBroken || 0)),
          totalBattles: totalMatches,
          winRate: totalMatches > 0 ? Math.round(((player.peopleBroken || 0) / totalMatches) * 1000) / 10 : 0,
          currentStreak: player.streak || 0,
          bestStreak: player.bestStreak || player.streak || 0,
          weeklyWins: Math.floor((player.peopleBroken || 0) * 0.8),
          weeklyScore: Math.floor((player.xp || 0) * 0.8),
          totalScore: player.xp || 0,
          isVip: window.subscriptionService ? window.subscriptionService.hasVipAccess(player) : false,
          title: player.title || "GUEST FIGHTER",
          isPlayer: true
        };

        const existingIdx = list.findIndex(p => p.displayName === player.name || p.isPlayer);
        if (existingIdx !== -1) {
          list[existingIdx] = localUserEntry;
        } else {
          list.push(localUserEntry);
        }
      }

      // Deterministic Sorting
      if (type === 'streaks') {
        list.sort((a, b) => {
          if ((b.currentStreak || 0) !== (a.currentStreak || 0)) return (b.currentStreak || 0) - (a.currentStreak || 0);
          if ((b.bestStreak || 0) !== (a.bestStreak || 0)) return (b.bestStreak || 0) - (a.bestStreak || 0);
          if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
          if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
      } else if (type === 'weekly') {
        list.sort((a, b) => {
          if ((b.weeklyScore || 0) !== (a.weeklyScore || 0)) return (b.weeklyScore || 0) - (a.weeklyScore || 0);
          if ((b.weeklyWins || 0) !== (a.weeklyWins || 0)) return (b.weeklyWins || 0) - (a.weeklyWins || 0);
          if ((b.winRate || 0) !== (a.winRate || 0)) return (b.winRate || 0) - (a.winRate || 0);
          if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
      } else {
        // Global Top
        list.sort((a, b) => {
          if ((b.totalScore || 0) !== (a.totalScore || 0)) return (b.totalScore || 0) - (a.totalScore || 0);
          if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
          if ((b.winRate || 0) !== (a.winRate || 0)) return (b.winRate || 0) - (a.winRate || 0);
          return (a.displayName || '').localeCompare(b.displayName || '');
        });
      }

      return list.map((p, index) => ({ rank: index + 1, ...p }));
    }

    async loadAndRender() {
      const container = document.getElementById('leaderboardList');
      if (!container) return;

      this.isLoading = true;
      this.isError = false;
      this.renderLoading(container);

      try {
        if (!this.cachedData[this.currentTab]) {
          const rawPlayers = await this.fetchLeaderboardData(this.currentTab);
          this.cachedData[this.currentTab] = rawPlayers;
        }
        this.isLoading = false;
        this.renderLeaderboard();
      } catch (err) {
        this.isLoading = false;
        this.isError = true;
        this.renderError(container);
      }
    }

    renderLoading(container) {
      container.innerHTML = `
        <div class="lb-state-box">
          <div class="lb-spinner"></div>
          <p class="lb-state-text">LOADING CRINGE RANKINGS...</p>
        </div>
      `;
    }

    renderError(container) {
      container.innerHTML = `
        <div class="lb-state-box error-box">
          <span class="lb-state-icon">⚠️</span>
          <p class="lb-state-title">LEADERBOARD UNAVAILABLE</p>
          <p class="lb-state-desc">Could not connect to the ranking server.</p>
          <button class="btn-xs btn-lb-retry" id="btnRetryLeaderboard">RETRY</button>
        </div>
      `;
      const retryBtn = document.getElementById('btnRetryLeaderboard');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.invalidateCache();
          this.loadAndRender();
        });
      }
    }

    renderLeaderboard() {
      const container = document.getElementById('leaderboardList');
      const userRankContainer = document.getElementById('userRankSummaryCard');
      if (!container) return;

      const players = this.cachedData[this.currentTab] || [];
      const currentPlayer = window.gameEngine?.getPlayerStats();
      const currentUserName = currentPlayer ? currentPlayer.name : 'Anonymous';
      const playerHasBattles = (currentPlayer?.totalMatches || 0) > 0;

      // Filter by search query
      let filtered = players;
      if (this.searchQuery) {
        filtered = players.filter(p => (p.displayName || '').toLowerCase().includes(this.searchQuery));
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="lb-state-box empty-box">
            <span class="lb-state-icon">🏆</span>
            <p class="lb-state-title">NO RANKED PLAYERS YET</p>
            <p class="lb-state-desc">${this.searchQuery ? `No players match "${this.searchQuery}".` : 'Complete your first battle and become CRINGE METER\'s #1 player.'}</p>
          </div>
        `;
        if (userRankContainer) userRankContainer.classList.add('hidden');
        return;
      }

      container.innerHTML = '';

      let playerInTopList = false;
      let playerGlobalRank = null;

      filtered.forEach((p, index) => {
        const isCurrentPlayer = (p.isPlayer || p.displayName === currentUserName);
        if (isCurrentPlayer) {
          playerInTopList = true;
          playerGlobalRank = p.rank || (index + 1);
        }

        const rowEl = document.createElement('div');
        const rankClass = p.rank === 1 ? 'lb-top-1' : p.rank === 2 ? 'lb-top-2' : p.rank === 3 ? 'lb-top-3' : '';
        const youClass = isCurrentPlayer ? 'lb-is-you' : '';
        rowEl.className = `lb-item-row ${rankClass} ${youClass}`;

        // Top 3 Badge Icon
        let rankBadge = `<span class="lb-rank-num">#${p.rank}</span>`;
        if (p.rank === 1) rankBadge = `<span class="lb-rank-num rank-gold">#1 🥇</span>`;
        else if (p.rank === 2) rankBadge = `<span class="lb-rank-num rank-silver">#2 🥈</span>`;
        else if (p.rank === 3) rankBadge = `<span class="lb-rank-num rank-bronze">#3 🥉</span>`;

        // Avatar
        const avatarHtml = (isCurrentPlayer && currentPlayer?.avatarPhoto) ?
          `<img src="${currentPlayer.avatarPhoto}" class="lb-avatar-img" />` :
          `<span class="lb-avatar-emoji">${p.avatar || '👤'}</span>`;

        // VIP Badge
        const vipBadge = p.isVip ? `<span class="lb-vip-tag">👑 VIP</span>` : '';
        const youBadge = isCurrentPlayer ? `<span class="lb-you-tag">⭐ YOU</span>` : '';

        // Dynamic metrics column based on active tab
        let metricsHtml = '';
        if (this.currentTab === 'streaks') {
          metricsHtml = `
            <div class="lb-stat-pill">
              <span class="stat-main-num highlight-streak">🔥 ${p.currentStreak || 0}</span>
              <span class="stat-sub-label">CURRENT STREAK</span>
            </div>
            <div class="lb-stat-pill desktop-only">
              <span class="stat-main-num">${p.bestStreak || p.currentStreak || 0}</span>
              <span class="stat-sub-label">BEST STREAK</span>
            </div>
            <div class="lb-stat-pill">
              <span class="stat-main-num">${(p.wins || 0).toLocaleString()}</span>
              <span class="stat-sub-label">TOTAL WINS</span>
            </div>
          `;
        } else if (this.currentTab === 'weekly') {
          metricsHtml = `
            <div class="lb-stat-pill">
              <span class="stat-main-num highlight-weekly">${(p.weeklyScore || 0).toLocaleString()}</span>
              <span class="stat-sub-label">WEEKLY PTS</span>
            </div>
            <div class="lb-stat-pill">
              <span class="stat-main-num">${p.weeklyWins || 0}</span>
              <span class="stat-sub-label">WEEKLY WINS</span>
            </div>
            <div class="lb-stat-pill desktop-only">
              <span class="stat-main-num">${p.winRate || 0}%</span>
              <span class="stat-sub-label">WIN RATE</span>
            </div>
          `;
        } else {
          // Global Top (Default)
          metricsHtml = `
            <div class="lb-stat-pill">
              <span class="stat-main-num highlight-score">${(p.totalScore || p.xp || 0).toLocaleString()}</span>
              <span class="stat-sub-label">SCORE PTS</span>
            </div>
            <div class="lb-stat-pill">
              <span class="stat-main-num">${(p.wins || 0).toLocaleString()}</span>
              <span class="stat-sub-label">WINS</span>
            </div>
            <div class="lb-stat-pill desktop-only">
              <span class="stat-main-num">${p.winRate || 0}%</span>
              <span class="stat-sub-label">WIN RATE</span>
            </div>
          `;
        }

        rowEl.innerHTML = `
          <div class="lb-rank-col">${rankBadge}</div>
          <div class="lb-avatar-col">${avatarHtml}</div>
          <div class="lb-identity-col">
            <div class="lb-name-row">
              <span class="lb-player-name">${p.displayName}</span>
              ${vipBadge}
              ${youBadge}
            </div>
            <div class="lb-title-row">
              <span class="lb-rank-title">${p.rankTitle || 'Unranked'}</span>
              <span class="lb-bullet">•</span>
              <span class="lb-user-title">${p.title || 'CRINGER'}</span>
            </div>
          </div>
          <div class="lb-metrics-col">${metricsHtml}</div>
        `;

        container.appendChild(rowEl);
      });

      // Sticky "YOUR RANK" Card rendering - only show if player has completed battles
      if (userRankContainer) {
        if (currentPlayer && playerHasBattles) {
          const userRank = playerGlobalRank || this.computeCurrentPlayerRank(players, currentUserName);
          userRankContainer.classList.remove('hidden');
          userRankContainer.innerHTML = `
            <div class="user-rank-card-content">
              <div class="ur-left">
                <span class="ur-tag">YOUR CURRENT RANKING</span>
                <div class="ur-player-row">
                  <span class="ur-rank-badge">#${userRank}</span>
                  <span class="ur-avatar">${currentPlayer.avatarPhoto ? `<img src="${currentPlayer.avatarPhoto}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />` : (currentPlayer.avatar || '👤')}</span>
                  <span class="ur-name">${currentPlayer.name} (YOU)</span>
                  ${window.subscriptionService && window.subscriptionService.hasVipAccess(currentPlayer) ? '<span class="lb-vip-tag">👑 VIP</span>' : ''}
                </div>
              </div>
              <div class="ur-right">
                <div class="ur-stat-box">
                  <span class="ur-stat-val">${currentPlayer.streak || 0} 🔥</span>
                  <span class="ur-stat-lbl">STREAK</span>
                </div>
                <div class="ur-stat-box">
                  <span class="ur-stat-val">${(currentPlayer.xp || 0).toLocaleString()} ⚡</span>
                  <span class="ur-stat-lbl">XP SCORE</span>
                </div>
              </div>
            </div>
          `;
        } else {
          userRankContainer.classList.add('hidden');
        }
      }

      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    computeCurrentPlayerRank(players, currentUserName) {
      const idx = players.findIndex(p => p.isPlayer || p.displayName === currentUserName);
      return idx !== -1 ? (idx + 1) : players.length + 1;
    }

    async renderHomeTopPerformers() {
      const container = document.querySelector('.pc-mini-lb-list');
      if (!container) return;

      let players = this.cachedData.global;
      if (!players) {
        players = await this.fetchLeaderboardData('global');
        this.cachedData.global = players;
      }

      const activePerformers = (players || []).filter(p => {
        const battles = (p.wins || 0) + (p.losses || 0) || (p.totalBattles || 0);
        return battles > 0;
      });

      container.innerHTML = '';

      if (activePerformers.length === 0) {
        container.innerHTML = `
          <div class="pc-mini-empty">
            <span class="pc-mini-empty-icon">🏆</span>
            <p class="pc-mini-empty-title">NO PERFORMERS YET</p>
            <small class="pc-mini-empty-sub">Complete a battle to claim #1</small>
          </div>
        `;
        return;
      }

      const top4 = activePerformers.slice(0, 4);
      top4.forEach((p, idx) => {
        const rank = idx + 1;
        const badgeClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        const row = document.createElement('div');
        row.className = 'pc-lb-row';
        row.innerHTML = `
          <span class="pc-rank-badge ${badgeClass}">#${rank}</span>
          <span class="pc-lb-name">${p.avatar || '👤'} ${p.displayName}</span>
          <strong class="pc-lb-score">${p.winRate || 0}%</strong>
        `;
        container.appendChild(row);
      });
    }

    async recordMatchOutcome(isWinner, playerStats) {
      const serverUrl = window.location.origin;
      try {
        const payload = {
          winner: isWinner ? {
            userId: playerStats.userId || "local_player_user",
            displayName: playerStats.name,
            avatar: playerStats.avatar,
            rankTitle: playerStats.rank,
            isVip: window.subscriptionService ? window.subscriptionService.hasVipAccess(playerStats) : false,
            title: playerStats.title
          } : null,
          loser: !isWinner ? {
            userId: playerStats.userId || "local_player_user",
            displayName: playerStats.name,
            avatar: playerStats.avatar,
            rankTitle: playerStats.rank,
            isVip: window.subscriptionService ? window.subscriptionService.hasVipAccess(playerStats) : false,
            title: playerStats.title
          } : null
        };

        await fetch(`${serverUrl}/api/leaderboard/record-match`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.warn("[LEADERBOARD] Could not record match outcome on server:", e);
      }

      this.invalidateCache();
      this.loadAndRender();
      this.renderHomeTopPerformers();
    }
  }

  window.leaderboardService = new LeaderboardService();
})();
