/**
 * CRINGE METER — Automatic Device Detection & PC Keyboard Engine
 * Automatically detects device type (PC Landscape, iPad, iPhone) and adapts layout.
 */

(function() {
  class AutoDeviceEngine {
    constructor() {
      this.init();
    }

    init() {
      this.updateDeviceProfile();
      this.bindWindowEvents();
      this.bindKeyboardShortcuts();
      this.bindDesktopNav();
    }

    detectDeviceProfile() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Check width and user-agent / touch heuristics
      if (width < 768) {
        return 'iphone';
      } else if (width <= 1024) {
        return 'ipad';
      } else {
        return 'pc';
      }
    }

    updateDeviceProfile() {
      const profile = this.detectDeviceProfile();
      const body = document.body;

      body.classList.remove('device-pc', 'device-ipad', 'device-iphone');
      body.classList.add(`device-${profile}`);

      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    bindWindowEvents() {
      window.addEventListener('resize', () => this.updateDeviceProfile());
      window.addEventListener('orientationchange', () => {
        setTimeout(() => this.updateDeviceProfile(), 120);
      });
    }

    bindDesktopNav() {
      const desktopNavBtns = document.querySelectorAll('.desktop-nav-btn');
      desktopNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetView = btn.dataset.view;
          if (targetView && window.appSwitchView) {
            window.appSwitchView(targetView);
            this.syncNavState(targetView);
          }
        });
      });
    }

    syncNavState(viewId) {
      document.querySelectorAll('.desktop-nav-btn').forEach(btn => {
        if (btn.dataset.view === viewId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    bindKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        // Do not intercept hotkeys if user is actively typing
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
          if (e.key === 'Escape') {
            document.activeElement.blur();
          }
          return;
        }

        const activeScreen = document.querySelector('.view-screen.active');
        const activeScreenId = activeScreen ? activeScreen.id : '';
        const isModalOpen = !document.getElementById('vipUpgradeModal')?.classList.contains('hidden') ||
                            !document.getElementById('vipCheckoutModal')?.classList.contains('hidden') ||
                            !document.getElementById('quickSetupRulesModal')?.classList.contains('hidden') ||
                            !document.getElementById('cringeStudioModal')?.classList.contains('hidden') ||
                            !document.getElementById('roomModal')?.classList.contains('hidden') ||
                            !document.getElementById('reportModal')?.classList.contains('hidden') ||
                            !document.getElementById('authModal')?.classList.contains('hidden');

        // [ESCAPE] Close modals or cancel actions
        if (e.key === 'Escape') {
          if (isModalOpen) {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
            return;
          }
          if (activeScreenId === 'view-matchmaking') {
            const btnCancelMM = document.getElementById('btnCancelMM');
            if (btnCancelMM) btnCancelMM.click();
            return;
          }
          if (activeScreenId === 'view-results' || activeScreenId === 'view-leaderboard' || activeScreenId === 'view-modes' || activeScreenId === 'view-profile') {
            if (window.appSwitchView) window.appSwitchView('view-home');
            return;
          }
        }

        // [SPACEBAR] Contextual primary action
        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();

          if (activeScreenId === 'view-landing') {
            const btnLandingBattles = document.getElementById('btnLandingBattles');
            if (btnLandingBattles) btnLandingBattles.click();
            return;
          }

          if (activeScreenId === 'view-home') {
            const btnFindBattle = document.getElementById('btnFindBattle');
            if (btnFindBattle) btnFindBattle.click();
            return;
          }

          if (activeScreenId === 'view-results') {
            const btnRematch = document.getElementById('btnRematch');
            if (btnRematch) btnRematch.click();
            return;
          }
        }

        // [1], [2], [3], [4] Soundboard Hotkeys
        if (['1', '2', '3', '4'].includes(e.key)) {
          if (window.soundEngine) {
            const soundMap = {
              '1': 'airhorn',
              '2': 'honk',
              '3': 'boing',
              '4': 'evil'
            };
            const soundType = soundMap[e.key];
            if (soundType) {
              window.soundEngine.playSound(soundType);
              this.flashButtonFeedback(`btnSound${soundType.charAt(0).toUpperCase() + soundType.slice(1)}`);
            }
          }
        }

        // [S] Shuffle prompt in battle
        if (e.key.toLowerCase() === 's' && activeScreenId === 'view-battle') {
          const btnShufflePrompt = document.getElementById('btnShufflePrompt');
          if (btnShufflePrompt) {
            btnShufflePrompt.click();
            this.flashButtonFeedback('btnShufflePrompt');
          }
        }

        // [M] Toggle Microphone Mute
        if (e.key.toLowerCase() === 'm' && activeScreenId === 'view-battle') {
          const btnOnlineMuteMic = document.getElementById('btnOnlineMuteMic');
          if (btnOnlineMuteMic) {
            btnOnlineMuteMic.click();
          }
        }

        // [C] Toggle Camera On/Off
        if (e.key.toLowerCase() === 'c' && activeScreenId === 'view-battle') {
          const btnOnlineToggleCam = document.getElementById('btnOnlineToggleCam');
          if (btnOnlineToggleCam) {
            btnOnlineToggleCam.click();
          }
        }

        // [R] Rematch on results screen
        if (e.key.toLowerCase() === 'r' && activeScreenId === 'view-results') {
          const btnRematch = document.getElementById('btnRematch');
          if (btnRematch) btnRematch.click();
        }

        // [H] Go Home
        if (e.key.toLowerCase() === 'h' && !isModalOpen) {
          if (window.appSwitchView) window.appSwitchView('view-home');
        }
      });
    }

    flashButtonFeedback(buttonId) {
      const btn = document.getElementById(buttonId);
      if (btn) {
        btn.classList.add('hotkey-active');
        setTimeout(() => btn.classList.remove('hotkey-active'), 180);
      }
    }
  }

  window.autoDeviceEngine = new AutoDeviceEngine();
})();
