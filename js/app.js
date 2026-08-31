/**
 * CRINGE METER — Main Application Controller
 * Handles UI interactions, view switching, audio triggers, and DOM bindings.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  if (window.leaderboardService) {
    window.leaderboardService.init();
  }

  const engine = window.gameEngine;
  const sound = window.soundEngine;
  const faceSensor = window.faceDetectorService;
  const promptService = window.cringePromptService;

  // DOM Elements
  const views = document.querySelectorAll('.view-screen');
  const navBtns = document.querySelectorAll('.nav-btn');

  // Header Elements
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userCoinsDisplay = document.getElementById('userCoinsDisplay');
  const userStreakDisplay = document.getElementById('userStreakDisplay');
  const userAvatarEmoji = document.getElementById('userAvatarEmoji');

  // Home Screen Elements
  const btnFindBattle = document.getElementById('btnFindBattle');
  const cardStreak = document.getElementById('cardStreak');
  const cardRank = document.getElementById('cardRank');
  const cardLevel = document.getElementById('cardLevel');

  // Matchmaking Elements
  const mmSearchingState = document.getElementById('mmSearchingState');
  const mmMatchFoundState = document.getElementById('mmMatchFoundState');
  const btnCancelMM = document.getElementById('btnCancelMM');
  const mmNameP1 = document.getElementById('mmNameP1');
  const mmAvatarP1 = document.getElementById('mmAvatarP1');
  const mmNameP2 = document.getElementById('mmNameP2');
  const mmAvatarP2 = document.getElementById('mmAvatarP2');
  const mmLvlP2 = document.getElementById('mmLvlP2');
  const roleTitle = document.getElementById('roleTitle');
  const roleIcon = document.getElementById('roleIcon');
  const roleDesc = document.getElementById('roleDesc');
  const roleProgressFill = document.getElementById('roleProgressFill');

  // Battle View Elements
  const battleTimerDigits = document.getElementById('battleTimerDigits');
  const cringeGaugeFill = document.getElementById('cringeGaugeFill');
  const cringeGaugeNeedle = document.getElementById('cringeGaugeNeedle');
  const gaugeStatusText = document.getElementById('gaugeStatusText');

  const oppVideoName = document.getElementById('oppVideoName');
  const oppRoleBadge = document.getElementById('oppRoleBadge');
  const oppFaceEmoji = document.getElementById('oppFaceEmoji');
  const oppReactionSub = document.getElementById('oppReactionSub');
  const smileRiskFill = document.getElementById('smileRiskFill');
  const smileRiskVal = document.getElementById('smileRiskVal');

  const selfRoleBadge = document.getElementById('selfRoleBadge');
  const selfCamEmoji = document.getElementById('selfCamEmoji');
  const localVideoFeed = document.getElementById('localVideoFeed');
  const btnToggleCam = document.getElementById('btnToggleCam');

  const performerPanel = document.getElementById('performerPanel');
  const defenderPanel = document.getElementById('defenderPanel');
  const aiPromptText = document.getElementById('aiPromptText');
  const btnShufflePrompt = document.getElementById('btnShufflePrompt');
  const btnILaughed = document.getElementById('btnILaughed');

  // Sound Buttons
  const btnSoundAirhorn = document.getElementById('btnSoundAirhorn');
  const btnSoundHonk = document.getElementById('btnSoundHonk');
  const btnSoundBoing = document.getElementById('btnSoundBoing');
  const btnSoundEvil = document.getElementById('btnSoundEvil');

  // Results View Elements
  const resultBanner = document.getElementById('resultBanner');
  const resultIcon = document.getElementById('resultIcon');
  const resultTitle = document.getElementById('resultTitle');
  const resultTagline = document.getElementById('resultTagline');
  const rwXpVal = document.getElementById('rwXpVal');
  const rwCoinsVal = document.getElementById('rwCoinsVal');
  const rwStreakVal = document.getElementById('rwStreakVal');
  const resRankName = document.getElementById('resRankName');
  const resRankXp = document.getElementById('resRankXp');
  const recapMode = document.getElementById('recapMode');
  const recapTime = document.getElementById('recapTime');
  const recapPeak = document.getElementById('recapPeak');
  const btnRematch = document.getElementById('btnRematch');
  const btnReturnHome = document.getElementById('btnReturnHome');

  // Leaderboard & Settings Elements
  const leaderboardList = document.getElementById('leaderboardList');
  const toggleSound = document.getElementById('toggleSound');
  const toggleFrameShell = document.getElementById('toggleFrameShell');
  const mobileFrame = document.getElementById('mobileFrame');

  // Modal Elements
  const avatarModal = document.getElementById('avatarModal');
  const btnEditAvatar = document.getElementById('btnEditAvatar');
  const btnCloseAvatarModal = document.getElementById('btnCloseAvatarModal');
  const avatarGrid = document.getElementById('avatarGrid');

  // Navigation State
  let appEntered = false;
  document.body.classList.add('app-not-entered');
  document.body.classList.remove('app-entered');

  function enterApp(targetView = 'view-home') {
    appEntered = true;
    document.body.classList.remove('app-not-entered');
    document.body.classList.add('app-entered');
    switchView(targetView);
  }

  window.enterApp = enterApp;

  // Helper Functions: View Navigation
  function switchView(viewId) {
    if (viewId !== 'view-landing' && !appEntered) {
      appEntered = true;
      document.body.classList.remove('app-not-entered');
      document.body.classList.add('app-entered');
    }

    if (viewId !== 'view-battle') {
      if (faceSensor) faceSensor.setBattleActive(false);
      if (viewId !== 'view-matchmaking') {
        if (window.livekitClientEngine) window.livekitClientEngine.disconnect();
        if (window.onlineBattleController && window.onlineBattleController.livekit) {
          window.onlineBattleController.livekit.disconnect();
        }
      }
    }

    views.forEach(view => {
      if (view.id === viewId) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    const viewsContainer = document.getElementById('viewsContainer');
    if (viewsContainer) {
      viewsContainer.scrollTop = 0;
    }

    navBtns.forEach(btn => {
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.desktop-nav-btn').forEach(btn => {
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (viewId === 'view-leaderboard' && window.leaderboardService) {
      window.leaderboardService.loadAndRender();
    } else if (viewId === 'view-home' && window.leaderboardService) {
      window.leaderboardService.renderHomeTopPerformers();
    }

    sound.playClick();
  }

  window.appSwitchView = switchView;

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      switchView(targetView);
      if (targetView === 'view-leaderboard' && window.leaderboardService) {
        window.leaderboardService.loadAndRender();
      }
    });
  });

  function applyTheme(themeName) {
    document.body.classList.remove('theme-magenta', 'theme-cyan', 'theme-green', 'theme-purple', 'theme-gold');
    if (themeName && themeName !== 'magenta') {
      document.body.classList.add(`theme-${themeName}`);
    }
  }

  function updatePlayerHUD(stats) {
    userNameDisplay.textContent = stats.name;
    userCoinsDisplay.textContent = (stats.coins || 0).toLocaleString();
    userStreakDisplay.textContent = stats.streak || 0;

    if (stats.avatarPhoto) {
      userAvatarEmoji.innerHTML = `<img src="${stats.avatarPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      userAvatarEmoji.textContent = stats.avatar || "👤";
    }

    cardStreak.textContent = `${stats.streak || 0} Games`;
    cardRank.textContent = stats.rank || "Unranked";
    cardLevel.textContent = `LVL ${stats.level || 1}`;

    const cardXpProgress = document.getElementById('cardXpProgress');
    if (cardXpProgress) {
      const currentLevelXp = stats.currentLevelXp !== undefined ? stats.currentLevelXp : (stats.xp || 0);
      const xpForNext = stats.xpForNextLevel || 1000;
      cardXpProgress.textContent = `${currentLevelXp.toLocaleString()} / ${xpForNext.toLocaleString()} XP`;
    }

    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) profileNameEl.textContent = stats.name || "Anonymous";

    if (stats.avatarPhoto) {
      document.getElementById('profileLargeAvatar').innerHTML = `<img src="${stats.avatarPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      document.getElementById('profileLargeAvatar').textContent = stats.avatar || "👤";
    }

    document.getElementById('profileRankBadge').textContent = `🏆 ${stats.rank || 'Unranked'} (${(stats.xp || 0).toLocaleString()} XP)`;
    if (document.getElementById('profileTitleTag')) {
      document.getElementById('profileTitleTag').textContent = `"${stats.title || 'GUEST FIGHTER'}"`;
    }

    const matchesCount = stats.totalMatches !== undefined ? stats.totalMatches : 0;
    document.getElementById('pstatMatches').textContent = matchesCount;
    
    const winRateEl = document.getElementById('pstatWinRate');
    if (winRateEl) {
      const rate = matchesCount > 0 ? (stats.winRate !== undefined ? stats.winRate : (Math.round(((stats.wins || 0) / matchesCount) * 1000) / 10)) : 0;
      winRateEl.textContent = `${rate}%`;
    }

    const bestStreakEl = document.getElementById('pstatBestStreak');
    if (bestStreakEl) {
      bestStreakEl.textContent = stats.bestStreak || 0;
    }

    if (document.getElementById('pstatStreak')) document.getElementById('pstatStreak').textContent = stats.streak || 0;
    document.getElementById('pstatBreaks').textContent = stats.peopleBroken !== undefined ? stats.peopleBroken : (stats.wins || 0);

    // VIP Indicators & Status Banner
    const isVip = window.subscriptionService ? window.subscriptionService.hasVipAccess(stats) : false;
    const headerCrown = document.getElementById('headerVipCrown');
    if (headerCrown) {
      if (isVip) headerCrown.classList.remove('hidden');
      else headerCrown.classList.add('hidden');
    }

    const profileCrown = document.getElementById('profileVipCrown');
    if (profileCrown) {
      if (isVip) profileCrown.classList.remove('hidden');
      else profileCrown.classList.add('hidden');
    }

    const profileVipBanner = document.getElementById('profileVipBanner');
    if (profileVipBanner) {
      if (isVip) profileVipBanner.classList.remove('hidden');
      else profileVipBanner.classList.add('hidden');
    }

    if (stats.theme) {
      applyTheme(stats.theme);
    }
  }

  engine.registerCallbacks({
    onPlayerUpdated: (stats) => updatePlayerHUD(stats),
    onBattleTick: (timeLeft, cringeLevel) => {
      const secs = timeLeft < 10 ? `0${timeLeft}` : `${timeLeft}`;
      if (battleTimerDigits) battleTimerDigits.textContent = `00:${secs}`;
      if (cringeGaugeFill) cringeGaugeFill.style.width = `${cringeLevel}%`;

      if (gaugeStatusText) {
        if (cringeLevel > 75) {
          gaugeStatusText.textContent = "CRINGE LEVEL: CRITICAL 💀";
          gaugeStatusText.style.color = "var(--accent-magenta)";
        } else if (cringeLevel > 45) {
          gaugeStatusText.textContent = "CRINGE DETECTED";
          gaugeStatusText.style.color = "var(--accent-gold)";
        } else {
          gaugeStatusText.textContent = "CRINGE DETECTED";
          gaugeStatusText.style.color = "var(--accent-cyan)";
        }
      }

      if (oppFaceEmoji) {
        if (cringeLevel > 75) oppFaceEmoji.textContent = "😬";
        else if (cringeLevel > 45) oppFaceEmoji.textContent = "😏";
        else oppFaceEmoji.textContent = "😐";
      }
      if (oppReactionSub) {
        if (cringeLevel > 75) oppReactionSub.textContent = "Sweating & Holding Back...";
        else if (cringeLevel > 45) oppReactionSub.textContent = "Smirking Detected!";
        else oppReactionSub.textContent = "Poker Face Active...";
      }
    },
    onMatchEnd: (results, updatedPlayer) => {
      updatePlayerHUD(updatedPlayer);
      faceSensor.setBattleActive(false);
      faceSensor.stopCamera();

      // Disconnect LiveKit audio/mic tracks immediately
      if (window.livekitClientEngine) {
        window.livekitClientEngine.disconnect();
      }
      if (window.onlineBattleController && window.onlineBattleController.livekit) {
        window.onlineBattleController.livekit.disconnect();
      }

      resultTitle.textContent = results.title;
      resultTagline.textContent = `"${results.subtitle}"`;
      rwXpVal.textContent = results.isWinner ? "+150 XP" : "+40 XP";
      
      const isVipWinner = results.isWinner && (results.isVip || (window.subscriptionService && window.subscriptionService.hasVipAccess(updatedPlayer)));
      rwCoinsVal.textContent = results.isWinner ? (isVipWinner ? `+${results.earnedCoins || 100} COINS (2× VIP)` : `+${results.earnedCoins || 50} COINS`) : "+0 COINS";
      rwStreakVal.textContent = results.isWinner ? "+1 STREAK" : "STREAK RESET";

      if (window.progressionService) {
        const prog = window.progressionService.getPlayerProgress(updatedPlayer.xp);
        resRankName.textContent = prog.rankTitle;
        resRankXp.textContent = `${prog.currentLevelXp.toLocaleString()} / ${prog.xpForNextLevel.toLocaleString()} XP`;
      } else {
        resRankName.textContent = updatedPlayer.rank;
        resRankXp.textContent = `${(updatedPlayer.xp || 0).toLocaleString()} XP`;
      }
      recapMode.textContent = `${results.mode} (60s)`;
      recapTime.textContent = results.timeElapsed;
      recapPeak.textContent = results.peakCringe;

      if (results.isWinner) {
        resultIcon.textContent = "🏆";
        resultBanner.style.color = "var(--accent-gold)";
      } else {
        resultIcon.textContent = "💀";
        resultBanner.style.color = "var(--accent-magenta)";
      }

      if (window.leaderboardService) {
        window.leaderboardService.recordMatchOutcome(results.isWinner, updatedPlayer);
      }

      switchView('view-results');
    }
  });

  updatePlayerHUD(engine.getPlayerStats());

  // ==========================================
  // LANDING SHOWCASE & QUICK SETUP RULES MODAL (191248.png & 191258.png)
  // ==========================================
  const btnLandingBattles = document.getElementById('btnLandingBattles');
  const cardLandingBattles = document.getElementById('cardLandingBattles');
  const cardLandingStudio = document.getElementById('cardLandingStudio');
  const quickSetupRulesModal = document.getElementById('quickSetupRulesModal');
  const quickSetupDisplayName = document.getElementById('quickSetupDisplayName');
  const btnCancelRules = document.getElementById('btnCancelRules');
  const btnAgreeStartRules = document.getElementById('btnAgreeStartRules');
  const linkRulesSignIn = document.getElementById('linkRulesSignIn');

  function goToBattlesHome() {
    sound.playClick();
    enterApp('view-home');
  }

  if (btnLandingBattles) {
    btnLandingBattles.addEventListener('click', goToBattlesHome);
  }
  if (cardLandingBattles) {
    cardLandingBattles.addEventListener('click', goToBattlesHome);
  }
  if (cardLandingStudio) {
    cardLandingStudio.addEventListener('click', () => {
      enterApp('view-home');
      requestOpenCringeStudio('tab-identity');
    });
  }

  function openQuickSetupRulesModal() {
    if (quickSetupDisplayName) {
      quickSetupDisplayName.value = engine.getPlayerStats().name || 'Anonymous';
    }
    if (quickSetupRulesModal) {
      quickSetupRulesModal.classList.remove('hidden');
    }
  }

  if (btnCancelRules) {
    btnCancelRules.addEventListener('click', () => {
      if (quickSetupRulesModal) quickSetupRulesModal.classList.add('hidden');
    });
  }

  if (linkRulesSignIn) {
    linkRulesSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      if (quickSetupRulesModal) quickSetupRulesModal.classList.add('hidden');
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.classList.remove('hidden');
    });
  }

  function startMatchmakingFlow() {
    switchView('view-matchmaking');
    if (window.onlineBattleController) {
      window.onlineBattleController.startOnlineMatchmaking();
    } else {
      // Local fallback
      mmSearchingState.classList.remove('hidden');
      mmMatchFoundState.classList.add('hidden');
      const matchData = engine.startMatchmaking();
      setTimeout(() => {
        sound.playMatchFound();
        mmSearchingState.classList.add('hidden');
        mmMatchFoundState.classList.remove('hidden');
      }, 2200);
    }
  }

  if (btnAgreeStartRules) {
    btnAgreeStartRules.addEventListener('click', () => {
      const allChecked = Array.from(document.querySelectorAll('.rule-chk')).every(chk => chk.checked);
      if (!allChecked) {
        alert("Please review and check all safety rules to confirm your agreement before entering Cringe Battles.");
        return;
      }

      const enteredName = quickSetupDisplayName ? quickSetupDisplayName.value.trim() : '';
      const finalName = enteredName || 'Anonymous';
      engine.updateProfile({ name: finalName });
      localStorage.setItem('cringe_rules_accepted', 'true');
      localStorage.setItem('cringe_terms_version', '1.0');
      localStorage.setItem('cringe_terms_accepted_at', new Date().toISOString());

      // If signed in, sync terms acceptance with backend
      try {
        const user = window.userService ? window.userService.getCurrentUser() : null;
        if (user && user.isSignedIn && user.internalUserId) {
          fetch('/api/terms/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.internalUserId,
              termsVersion: '1.0'
            })
          }).catch(() => {});
        }
      } catch (e) {}

      if (quickSetupRulesModal) quickSetupRulesModal.classList.add('hidden');
      sound.playClick();
      startMatchmakingFlow();
    });
  }

  btnFindBattle.addEventListener('click', () => {
    const rulesAccepted = localStorage.getItem('cringe_rules_accepted');
    if (rulesAccepted !== 'true') {
      openQuickSetupRulesModal();
      return;
    }

    startMatchmakingFlow();
  });

  btnCancelMM.addEventListener('click', () => {
    if (window.onlineBattleController) {
      window.onlineBattleController.cancelMatchmaking();
    } else if (window.onlineMatchmaker) {
      window.onlineMatchmaker.cancelMatch();
    }
    switchView('view-home');
  });

  function updatePromptDisplay(promptObj) {
    const text = typeof promptObj === 'string' ? promptObj : (promptObj ? promptObj.text : "");
    const isCustom = typeof promptObj === 'object' && promptObj ? promptObj.isCustom : false;
    aiPromptText.textContent = `"${text}"`;

    const customBadge = document.getElementById('customPromptBadge');
    if (customBadge) {
      if (isCustom) {
        customBadge.classList.remove('hidden');
      } else {
        customBadge.classList.add('hidden');
      }
    }
  }

  function launchBattleView(matchData) {
    switchView('view-battle');

    const oppName = matchData.opponent?.displayName || matchData.opponent?.name || "Opponent";
    const selfStats = engine.getPlayerStats();
    const selfName = selfStats.name || "You";

    if (oppVideoName) oppVideoName.textContent = oppName;
    if (oppFaceEmoji) oppFaceEmoji.textContent = matchData.opponent?.avatar || "🤡";

    if (selfRoleBadge) selfRoleBadge.textContent = `${selfName} (You)`;
    if (oppRoleBadge) oppRoleBadge.textContent = oppName;

    if (matchData.role === 'PERFORMER') {
      if (performerPanel) performerPanel.classList.remove('hidden');
      if (defenderPanel) defenderPanel.classList.add('hidden');
      updatePromptDisplay(matchData.cringePrompt);
    } else {
      if (performerPanel) performerPanel.classList.add('hidden');
      if (defenderPanel) defenderPanel.classList.remove('hidden');
    }

    faceSensor.setBattleActive(true);
    faceSensor.startCamera(localVideoFeed);

    engine.startBattle();
  }

  // Hook faceSensor lose event (triggers on 5s continuous full smile or 5s face/mouth covered)
  faceSensor.onLose((reason) => {
    if (window.onlineMatchmaker && window.onlineMatchmaker.status === 'CONNECTED') {
      window.onlineMatchmaker.triggerLaughed();
    }
    engine.triggerMatchEnd('DEFENDER_LAUGHED');
  });

  btnShufflePrompt.addEventListener('click', () => {
    sound.playClick();
    const newPrompt = promptService.getRandomPrompt();
    updatePromptDisplay(newPrompt);
    if (window.onlineMatchmaker && window.onlineMatchmaker.status === 'CONNECTED') {
      const promptText = typeof newPrompt === 'string' ? newPrompt : newPrompt.text;
      window.onlineMatchmaker.shufflePrompt(newPrompt.isCustom ? promptText : null);
    }
  });

  btnSoundAirhorn.addEventListener('click', () => {
    sound.playAirhorn();
    faceSensor.triggerSpike(30);
  });
  btnSoundHonk.addEventListener('click', () => {
    sound.playHonk();
    faceSensor.triggerSpike(20);
  });
  btnSoundBoing.addEventListener('click', () => {
    sound.playBoing();
    faceSensor.triggerSpike(25);
  });
  btnSoundEvil.addEventListener('click', () => {
    sound.playEvilLaugh();
    faceSensor.triggerSpike(35);
  });

  btnILaughed.addEventListener('click', () => {
    if (window.onlineMatchmaker && window.onlineMatchmaker.status === 'CONNECTED') {
      window.onlineMatchmaker.triggerLaughed();
    }
    engine.triggerMatchEnd('DEFENDER_LAUGHED');
  });

  btnToggleCam.addEventListener('click', () => {
    if (faceSensor.active) {
      faceSensor.stopCamera();
    } else {
      faceSensor.startCamera(localVideoFeed);
    }
  });

  // ==========================================
  // BATTLE SMILE & CAMERA TEST DOCK
  // ==========================================
  const btnToggleTestDock = document.getElementById('btnToggleTestDock');
  const battleTestPanel = document.getElementById('battleTestPanel');
  const btnCloseTestPanel = document.getElementById('btnCloseTestPanel');
  const testSmileVal = document.getElementById('testSmileVal');
  const btnTestSmile50 = document.getElementById('btnTestSmile50');
  const btnTestSmile100 = document.getElementById('btnTestSmile100');
  const btnTestReset = document.getElementById('btnTestReset');

  if (btnToggleTestDock && battleTestPanel) {
    btnToggleTestDock.addEventListener('click', () => {
      sound.playClick();
      battleTestPanel.classList.toggle('hidden');
    });
  }

  if (btnCloseTestPanel && battleTestPanel) {
    btnCloseTestPanel.addEventListener('click', () => {
      sound.playClick();
      battleTestPanel.classList.add('hidden');
    });
  }

  if (faceSensor && testSmileVal) {
    faceSensor.onSmileMeterUpdate((val, isFull) => {
      const pct = Math.round(val * 100);
      testSmileVal.textContent = isFull ? `${pct}% (FULL)` : `${pct}%`;
      testSmileVal.style.color = isFull ? "var(--accent-magenta)" : (pct > 40 ? "var(--accent-gold)" : "var(--accent-green)");
    });
  }

  if (btnTestSmile50) {
    btnTestSmile50.addEventListener('click', () => {
      sound.playClick();
      if (faceSensor) faceSensor.simulateSmile(0.50);
    });
  }

  if (btnTestSmile100) {
    btnTestSmile100.addEventListener('click', () => {
      sound.playClick();
      if (faceSensor) faceSensor.simulateSmile(1.0);
    });
  }

  if (btnTestReset) {
    btnTestReset.addEventListener('click', () => {
      sound.playClick();
      if (faceSensor) faceSensor.simulateSmile(0.0);
    });
  }

  // ==========================================
  // SMILE & CAMERA TEST LAB MODAL HANDLERS
  // ==========================================
  const smileTestModal = document.getElementById('smileTestModal');
  const btnCloseSmileTestModal = document.getElementById('btnCloseSmileTestModal');
  const btnHomeOpenSmileTest = document.getElementById('btnHomeOpenSmileTest');
  const btnFloatingTestSmile = document.getElementById('btnFloatingTestSmile');
  const testLabVideoFeed = document.getElementById('testLabVideoFeed');
  const testLabCamFallback = document.getElementById('testLabCamFallback');
  const testLabSmileFill = document.getElementById('testLabSmileFill');
  const testLabCountdownOverlay = document.getElementById('testLabCountdownOverlay');
  const testLabSmileVal = document.getElementById('testLabSmileVal');
  const testLabStatusVal = document.getElementById('testLabStatusVal');
  const btnLabTestSmile50 = document.getElementById('btnLabTestSmile50');
  const btnLabTestSmile100 = document.getElementById('btnLabTestSmile100');
  const btnLabTestReset = document.getElementById('btnLabTestReset');

  function openSmileTestLab() {
    sound.playClick();
    if (smileTestModal) smileTestModal.classList.remove('hidden');
    if (faceSensor && testLabVideoFeed) {
      faceSensor.startCamera(testLabVideoFeed);
      faceSensor.setBattleActive(true);
    }
  }

  function closeSmileTestLab() {
    sound.playClick();
    if (smileTestModal) smileTestModal.classList.add('hidden');
    if (faceSensor) {
      faceSensor.stopCamera();
      faceSensor.setBattleActive(false);
      faceSensor.simulateSmile(0.0);
    }
    if (testLabCountdownOverlay) testLabCountdownOverlay.classList.add('hidden');
  }

  if (btnHomeOpenSmileTest) btnHomeOpenSmileTest.addEventListener('click', openSmileTestLab);
  if (btnFloatingTestSmile) btnFloatingTestSmile.addEventListener('click', openSmileTestLab);
  if (btnCloseSmileTestModal) btnCloseSmileTestModal.addEventListener('click', closeSmileTestLab);

  if (smileTestModal) {
    smileTestModal.addEventListener('click', (e) => {
      if (e.target === smileTestModal) closeSmileTestLab();
    });
  }

  // Sync Live Lab Smile Meter & Countdown
  if (faceSensor) {
    faceSensor.onSmileMeterUpdate((val, isFull) => {
      const pct = Math.round(val * 100);
      if (testLabSmileFill) {
        testLabSmileFill.style.width = `${pct}%`;
        if (isFull) testLabSmileFill.classList.add('is-full');
        else testLabSmileFill.classList.remove('is-full');
      }
      if (testLabSmileVal) {
        testLabSmileVal.textContent = isFull ? `${pct}% (FULL BAR)` : `${pct}%`;
        testLabSmileVal.style.color = isFull ? "var(--accent-magenta)" : (pct > 40 ? "var(--accent-gold)" : "var(--accent-green)");
      }
      if (testLabStatusVal) {
        if (isFull) {
          testLabStatusVal.textContent = "🔥 FULL SMILE — 5S COUNTDOWN!";
          testLabStatusVal.style.color = "var(--accent-magenta)";
        } else if (pct > 40) {
          testLabStatusVal.textContent = "SMILING DETECTED (METER RISING)";
          testLabStatusVal.style.color = "var(--accent-gold)";
        } else {
          testLabStatusVal.textContent = "POKER FACE (SAFE)";
          testLabStatusVal.style.color = "var(--accent-green)";
        }
      }
    });

    // Also mirror countdown to lab overlay
    const originalCountdownEl = document.getElementById('smileCountdownOverlay');
    if (originalCountdownEl && testLabCountdownOverlay) {
      const observer = new MutationObserver(() => {
        testLabCountdownOverlay.textContent = originalCountdownEl.textContent;
        if (originalCountdownEl.classList.contains('hidden')) {
          testLabCountdownOverlay.classList.add('hidden');
        } else {
          testLabCountdownOverlay.classList.remove('hidden');
        }
      });
      observer.observe(originalCountdownEl, { attributes: true, childList: true, characterData: true, subtree: true });
    }
  }

  if (btnLabTestSmile50) {
    btnLabTestSmile50.addEventListener('click', () => {
      sound.playClick();
      if (faceSensor) faceSensor.simulateSmile(0.50);
    });
  }

  if (btnLabTestSmile100) {
    btnLabTestSmile100.addEventListener('click', () => {
      sound.playClick();
      if (faceSensor) faceSensor.simulateSmile(1.0);
    });
  }

  if (btnLabTestReset) {
    btnLabTestReset.addEventListener('click', () => {
      sound.playClick();
      if (faceSensor) faceSensor.simulateSmile(0.0);
    });
  }

  btnRematch.addEventListener('click', () => {
    btnFindBattle.click();
  });
  btnReturnHome.addEventListener('click', () => {
    switchView('view-home');
  });

  function renderLeaderboard() {
    if (window.leaderboardService) {
      window.leaderboardService.loadAndRender();
    }
  }

  const roomModal = document.getElementById('roomModal');
  const btnCreateRoom = document.getElementById('btnCreateRoom');
  const btnJoinRoom = document.getElementById('btnJoinRoom');
  const btnCloseRoomModal = document.getElementById('btnCloseRoomModal');
  const roomModalTitle = document.getElementById('roomModalTitle');
  const createRoomBody = document.getElementById('createRoomBody');
  const joinRoomBody = document.getElementById('joinRoomBody');
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  const btnCopyCode = document.getElementById('btnCopyCode');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const btnConnectRoom = document.getElementById('btnConnectRoom');

  btnCreateRoom.addEventListener('click', () => {
    roomModal.classList.remove('hidden');
    roomModalTitle.textContent = "CREATE MULTIPLAYER ROOM";
    createRoomBody.classList.remove('hidden');
    joinRoomBody.classList.add('hidden');

    const roomCode = engine.createRoom();
    roomCodeDisplay.textContent = roomCode;
    sound.playClick();
  });

  btnJoinRoom.addEventListener('click', () => {
    roomModal.classList.remove('hidden');
    roomModalTitle.textContent = "JOIN MULTIPLAYER ROOM";
    createRoomBody.classList.add('hidden');
    joinRoomBody.classList.remove('hidden');
    sound.playClick();
  });

  btnCloseRoomModal.addEventListener('click', () => {
    roomModal.classList.add('hidden');
  });

  btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCodeDisplay.textContent);
    btnCopyCode.textContent = "COPIED!";
    setTimeout(() => { btnCopyCode.innerHTML = '<i data-lucide="copy"></i> COPY'; }, 2000);
  });

  btnConnectRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim();
    if (code) {
      engine.joinRoom(code);
      roomModal.classList.add('hidden');
      btnFindBattle.click();
    }
  });

  if (btnEditAvatar) {
    btnEditAvatar.addEventListener('click', () => {
      avatarModal.classList.remove('hidden');
    });
  }

  btnCloseAvatarModal.addEventListener('click', () => {
    avatarModal.classList.add('hidden');
  });

  avatarGrid.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      engine.setAvatar(opt.textContent);
      avatarModal.classList.add('hidden');
      sound.playClick();
    });
  });

  const selectLanguage = document.getElementById('selectLanguage');
  if (selectLanguage && window.i18nEngine) {
    selectLanguage.value = window.i18nEngine.currentLang;
    selectLanguage.addEventListener('change', (e) => {
      window.i18nEngine.setLanguage(e.target.value);
      sound.playClick();
    });
    window.i18nEngine.updateDOM();
  }

  toggleSound.addEventListener('change', (e) => {
    sound.toggleSound(e.target.checked);
  });
  toggleFrameShell.addEventListener('change', (e) => {
    if (e.target.checked) {
      mobileFrame.classList.remove('full-screen-mode');
    } else {
      mobileFrame.classList.add('full-screen-mode');
    }
  });

  document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
    card.addEventListener('click', () => {
      const modeKey = card.dataset.mode;
      if (modeKey === 'dont_laugh') {
        engine.activeMode = new window.DontLaughMode();
      } else if (modeKey === 'coop_duo') {
        engine.activeMode = new window.CoopDuoMode();
      } else if (modeKey === 'staring') {
        engine.activeMode = new window.StaringContestMode();
      }
      engine.activeMode.init(engine);

      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('mode-active'));
      card.classList.add('mode-active');
      sound.playClick();
      switchView('view-home');
    });
  });

  // ==========================================
  // CRINGE STUDIO PERSONALIZATION CONTROLLER
  // ==========================================
  const cringeStudioModal = document.getElementById('cringeStudioModal');
  const btnHeaderMakeMine = document.getElementById('btnHeaderMakeMine');
  const btnProfileOpenStudio = document.getElementById('btnProfileOpenStudio');
  const btnCloseStudioModal = document.getElementById('btnCloseStudioModal');

  function openStudioModal(initialTab = 'tab-identity') {
    if (!cringeStudioModal) return;
    cringeStudioModal.classList.remove('hidden');

    const stats = engine.getPlayerStats();
    if (document.getElementById('inputStudioName')) document.getElementById('inputStudioName').value = stats.name || '';
    if (document.getElementById('inputStudioTitle')) document.getElementById('inputStudioTitle').value = stats.title || '';
    if (document.getElementById('inputStudioTaunt')) document.getElementById('inputStudioTaunt').value = stats.taunt || 'YOU BROKE THEM 💀';

    document.querySelectorAll('.studio-avatar-opt').forEach(opt => {
      if (opt.textContent === stats.avatar) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });

    const previewWrap = document.getElementById('studioPhotoPreviewWrap');
    if (previewWrap) {
      if (stats.avatarPhoto) {
        previewWrap.innerHTML = `<img src="${stats.avatarPhoto}" style="width:100%;height:100%;object-fit:cover;" />`;
      } else {
        previewWrap.innerHTML = `<span class="photo-preview-placeholder">Click to upload photo</span>`;
      }
    }

    document.querySelectorAll('.theme-card').forEach(card => {
      if (card.dataset.theme === (stats.theme || 'magenta')) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    renderCustomPromptsList();
    switchStudioTab(initialTab);
    sound.playClick();
  }

  function switchStudioTab(tabId) {
    document.querySelectorAll('.studio-tab').forEach(tab => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    document.querySelectorAll('.studio-panel').forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });
  }

  const btnHomeOpenStudio = document.getElementById('btnHomeOpenStudio');
  const btnHomeViewLeaderboard = document.getElementById('btnHomeViewLeaderboard');

  function requestOpenCringeStudio(initialTab = 'tab-identity') {
    const stats = engine.getPlayerStats();
    const isVip = window.subscriptionService ? window.subscriptionService.hasVipAccess(stats) : false;
    if (isVip) {
      openStudioModal(initialTab);
    } else {
      sound.playClick();
      const vipModal = document.getElementById('vipUpgradeModal');
      if (vipModal) vipModal.classList.remove('hidden');
    }
  }

  if (btnHeaderMakeMine) btnHeaderMakeMine.addEventListener('click', () => requestOpenCringeStudio('tab-identity'));
  if (btnProfileOpenStudio) btnProfileOpenStudio.addEventListener('click', () => requestOpenCringeStudio('tab-identity'));
  if (btnHomeOpenStudio) btnHomeOpenStudio.addEventListener('click', () => requestOpenCringeStudio('tab-identity'));
  if (btnCloseStudioModal) btnCloseStudioModal.addEventListener('click', () => cringeStudioModal.classList.add('hidden'));

  // ==========================================
  // VIP UPGRADE & CHECKOUT MODAL HANDLERS
  // ==========================================
  const vipUpgradeModal = document.getElementById('vipUpgradeModal');
  const btnGetCringeVip = document.getElementById('btnGetCringeVip');
  const btnDismissVipModal = document.getElementById('btnDismissVipModal');
  const vipCheckoutModal = document.getElementById('vipCheckoutModal');
  const btnCloseVipCheckoutModal = document.getElementById('btnCloseVipCheckoutModal');
  const btnConfirmVipCheckoutClose = document.getElementById('btnConfirmVipCheckoutClose');

  if (btnDismissVipModal) {
    btnDismissVipModal.addEventListener('click', () => {
      if (vipUpgradeModal) vipUpgradeModal.classList.add('hidden');
    });
  }

  if (btnGetCringeVip) {
    btnGetCringeVip.addEventListener('click', () => {
      sound.playClick();
      if (vipUpgradeModal) vipUpgradeModal.classList.add('hidden');
      if (vipCheckoutModal) vipCheckoutModal.classList.remove('hidden');
    });
  }

  if (btnCloseVipCheckoutModal) {
    btnCloseVipCheckoutModal.addEventListener('click', () => {
      if (vipCheckoutModal) vipCheckoutModal.classList.add('hidden');
    });
  }
  if (btnConfirmVipCheckoutClose) {
    btnConfirmVipCheckoutClose.addEventListener('click', () => {
      if (vipCheckoutModal) vipCheckoutModal.classList.add('hidden');
    });
  }

  if (btnHomeViewLeaderboard) {
    btnHomeViewLeaderboard.addEventListener('click', () => {
      switchView('view-leaderboard');
      renderLeaderboard();
    });
  }

  // PC Home Soundboard Quick Buttons
  document.querySelectorAll('.btn-tool-pc[data-sound]').forEach(btn => {
    btn.addEventListener('click', () => {
      const soundType = btn.dataset.sound;
      if (soundType && sound) {
        sound.playSound(soundType);
        btn.classList.add('hotkey-active');
        setTimeout(() => btn.classList.remove('hotkey-active'), 180);
      }
    });
  });

  document.querySelectorAll('.studio-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchStudioTab(tab.dataset.tab);
      sound.playClick();
    });
  });

  document.querySelectorAll('.studio-avatar-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.studio-avatar-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      engine.setAvatar(opt.textContent);
      sound.playClick();
    });
  });

  const studioPhotoInput = document.getElementById('studioPhotoInput');
  const btnClearPhoto = document.getElementById('btnClearPhoto');
  if (studioPhotoInput) {
    studioPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target.result;
          engine.setAvatarPhoto(base64);
          const previewWrap = document.getElementById('studioPhotoPreviewWrap');
          if (previewWrap) previewWrap.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;" />`;
          sound.playClick();
        };
        reader.readAsDataURL(file);
      }
    });
  }
  if (btnClearPhoto) {
    btnClearPhoto.addEventListener('click', () => {
      engine.setAvatarPhoto(null);
      const previewWrap = document.getElementById('studioPhotoPreviewWrap');
      if (previewWrap) previewWrap.innerHTML = `<span class="photo-preview-placeholder">Click to upload photo</span>`;
      sound.playClick();
    });
  }

  const btnSaveIdentity = document.getElementById('btnSaveIdentity');
  if (btnSaveIdentity) {
    btnSaveIdentity.addEventListener('click', () => {
      const name = document.getElementById('inputStudioName').value.trim();
      const title = document.getElementById('inputStudioTitle').value.trim();
      const taunt = document.getElementById('inputStudioTaunt').value.trim();
      engine.updateProfile({ name, title, taunt });
      sound.playClick();
      cringeStudioModal.classList.add('hidden');
    });
  }

  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const theme = card.dataset.theme;
      engine.updateProfile({ theme });
      applyTheme(theme);
      sound.playClick();
    });
  });

  function renderCustomPromptsList() {
    const listContainer = document.getElementById('customPromptsList');
    if (!listContainer) return;
    const customPrompts = promptService.getCustomPrompts();
    listContainer.innerHTML = '';

    if (customPrompts.length === 0) {
      listContainer.innerHTML = `<p class="panel-desc" style="text-align:center;padding:12px;">No custom prompts created yet. Add your first prompt above!</p>`;
      return;
    }

    customPrompts.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-prompt-item';
      item.innerHTML = `
        <span>"${p.text}"</span>
        <button class="btn-del-prompt" data-idx="${idx}" title="Delete Prompt"><i data-lucide="trash-2"></i></button>
      `;
      listContainer.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();

    listContainer.querySelectorAll('.btn-del-prompt').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        promptService.removeCustomPrompt(idx);
        renderCustomPromptsList();
        sound.playClick();
      });
    });
  }

  const btnAddPrompt = document.getElementById('btnAddPrompt');
  const inputNewPrompt = document.getElementById('inputNewPrompt');
  if (btnAddPrompt && inputNewPrompt) {
    btnAddPrompt.addEventListener('click', () => {
      const val = inputNewPrompt.value.trim();
      if (val) {
        promptService.addCustomPrompt(val);
        inputNewPrompt.value = '';
        renderCustomPromptsList();
        sound.playClick();
      }
    });
  }

  const inputSoundVolume = document.getElementById('inputSoundVolume');
  if (inputSoundVolume) {
    inputSoundVolume.addEventListener('input', (e) => {
      sound.setVolume(parseInt(e.target.value, 10) / 100);
    });
  }

  document.querySelectorAll('.btn-sound-test').forEach(btn => {
    btn.addEventListener('click', () => {
      const snd = btn.dataset.sound;
      if (snd === 'airhorn') sound.playAirhorn();
      else if (snd === 'honk') sound.playHonk();
      else if (snd === 'boing') sound.playBoing();
      else if (snd === 'evil') sound.playEvilLaugh();
      else if (snd === 'buzzer') sound.playBuzzer();
      else if (snd === 'victory') sound.playVictory();
    });
  });

  const btnExportSetup = document.getElementById('btnExportSetup');
  if (btnExportSetup) {
    btnExportSetup.addEventListener('click', () => {
      const data = {
        player: engine.getPlayerStats(),
        customPrompts: promptService.getCustomPrompts()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cringe_meter_setup_${Date.now()}.json`;
      a.click();
      sound.playClick();
    });
  }

  const btnResetData = document.getElementById('btnResetData');
  if (btnResetData) {
    btnResetData.addEventListener('click', () => {
      if (confirm("Reset all Cringe Meter profile stats, custom prompts, and themes to default?")) {
        engine.resetPlayerData();
      }
    });
  }

  // ==========================================
  // ACCOUNT SIGN IN & AUTH CONTROLLER
  // ==========================================
  const authModal = document.getElementById('authModal');
  const btnOpenAuthModal = document.getElementById('btnOpenAuthModal');
  const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
  const btnSubmitAuth = document.getElementById('btnSubmitAuth');
  const btnSubmitAuthText = document.getElementById('btnSubmitAuthText');
  const btnAuthGuest = document.getElementById('btnAuthGuest');
  const btnAuthSignOut = document.getElementById('btnAuthSignOut');
  const authSignedInView = document.getElementById('authSignedInView');
  const modalCurrentAccountName = document.getElementById('modalCurrentAccountName');
  const modalCurrentAccountEmail = document.getElementById('modalCurrentAccountEmail');
  const authModalTitle = document.getElementById('authModalTitle');
  const authUsernameInput = document.getElementById('authUsernameInput');
  const authEmailInput = document.getElementById('authEmailInput');
  const accountStatusText = document.getElementById('accountStatusText');
  const accountEmailText = document.getElementById('accountEmailText');
  const btnAuthText = document.getElementById('btnAuthText');

  function updateAccountUI() {
    const user = window.userService ? window.userService.getCurrentUser() : null;
    if (user && user.isSignedIn) {
      if (accountStatusText) accountStatusText.textContent = "ACCOUNT SIGNED IN ✅";
      if (accountEmailText) {
        accountEmailText.innerHTML = `<span style="color:#FFF;font-weight:900;font-size:1rem;">${user.displayName}</span><br/><span style="font-size:0.75rem;color:var(--text-dim,#8a8aa3);font-weight:600;">${user.email || 'Cloud Account'}</span>`;
      }
      if (btnAuthText) btnAuthText.textContent = "SWITCH ACCOUNT";

      if (authSignedInView) authSignedInView.classList.remove('hidden');
      if (modalCurrentAccountName) modalCurrentAccountName.textContent = user.displayName;
      if (modalCurrentAccountEmail) modalCurrentAccountEmail.textContent = user.email || 'Connected to Supabase';
      if (authModalTitle) authModalTitle.textContent = "YOUR ACCOUNT";
      if (btnSubmitAuthText) btnSubmitAuthText.textContent = "SWITCH ACCOUNT";
    } else {
      if (accountStatusText) accountStatusText.textContent = "GUEST USER";
      if (accountEmailText) accountEmailText.textContent = "Not Signed In (Anonymous)";
      if (btnAuthText) btnAuthText.textContent = "SIGN IN";

      if (authSignedInView) authSignedInView.classList.add('hidden');
      if (authModalTitle) authModalTitle.textContent = "SIGN IN TO CRINGE METER";
      if (btnSubmitAuthText) btnSubmitAuthText.textContent = "SIGN IN / CREATE ACCOUNT";
    }
  }

  if (window.userService) {
    window.userService.onUserChange(() => {
      updateAccountUI();
      if (engine) updatePlayerHUD(engine.getPlayerStats());
    });
    window.userService.init().then(() => {
      updateAccountUI();
      if (engine) updatePlayerHUD(engine.getPlayerStats());
    });
  } else {
    updateAccountUI();
  }

  if (btnOpenAuthModal) {
    btnOpenAuthModal.addEventListener('click', () => {
      updateAccountUI();
      if (authModal) authModal.classList.remove('hidden');
    });
  }
  if (btnCloseAuthModal) {
    btnCloseAuthModal.addEventListener('click', () => {
      if (authModal) authModal.classList.add('hidden');
    });
  }
  if (btnAuthSignOut) {
    btnAuthSignOut.addEventListener('click', () => {
      if (window.userService) {
        window.userService.signOut();
      }
      updateAccountUI();
      if (authModal) authModal.classList.add('hidden');
      sound.playClick();
    });
  }
  if (btnAuthGuest) {
    btnAuthGuest.addEventListener('click', () => {
      if (window.userService) {
        window.userService.signOut();
      }
      updateAccountUI();
      if (authModal) authModal.classList.add('hidden');
      sound.playClick();
    });
  }
  if (btnSubmitAuth) {
    btnSubmitAuth.addEventListener('click', async () => {
      const username = authUsernameInput ? authUsernameInput.value.trim() : '';
      const email = authEmailInput ? authEmailInput.value.trim() : '';
      if (!username && !email) {
        alert("Please enter your player display name or email address.");
        return;
      }

      if (btnSubmitAuthText) btnSubmitAuthText.textContent = "CONNECTING...";

      try {
        if (window.userService) {
          await window.userService.signIn({ email, username });
        }
        updateAccountUI();
        if (authUsernameInput) authUsernameInput.value = '';
        if (authEmailInput) authEmailInput.value = '';
        if (authModal) authModal.classList.add('hidden');
        sound.playVictory();
      } catch (err) {
        console.error("[AUTH] Sign in failed:", err);
        alert("Sign in failed. Please try again.");
      } finally {
        updateAccountUI();
      }
    });
  }
});
