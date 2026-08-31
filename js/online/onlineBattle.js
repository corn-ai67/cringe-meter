/**
 * CRINGE METER — Online Battle UI & Gameplay Controller
 */

class OnlineBattleController {
  constructor() {
    this.currentMatchData = null;
    this.net = window.onlineMatchmaker;
    this.livekit = window.livekitClientEngine;
    this.initDone = false;
  }

  init() {
    if (this.initDone) return;
    this.initDone = true;

    // Bind Matchmaker Callbacks
    if (this.net) {
      this.net.registerCallbacks({
        onStatusChange: (status) => this.handleStatusChange(status),
        onMatchFound: (matchData) => this.handleMatchFound(matchData),
        onPromptUpdated: (data) => this.handlePromptUpdated(data),
        onRoundResult: (data) => this.handleRoundResult(data),
        onStrangerDisconnected: (data) => this.handleStrangerDisconnected(data)
      });
    }

    this.bindDOMEvents();
  }

  bindDOMEvents() {
    const btnOnlineMuteMic = document.getElementById('btnOnlineMuteMic');
    const btnOnlineToggleCam = document.getElementById('btnOnlineToggleCam');
    const btnOpenReportModal = document.getElementById('btnOpenReportModal');
    const btnSubmitReport = document.getElementById('btnSubmitReport');
    const btnCloseReportModal = document.getElementById('btnCloseReportModal');
    const btnBlockStranger = document.getElementById('btnBlockStranger');

    // Mute Microphone
    if (btnOnlineMuteMic) {
      btnOnlineMuteMic.addEventListener('click', () => {
        const isMuted = this.livekit.toggleMicrophone();
        btnOnlineMuteMic.classList.toggle('active', isMuted);
        btnOnlineMuteMic.innerHTML = isMuted ? '<i data-lucide="mic-off"></i>' : '<i data-lucide="mic"></i>';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Toggle Camera
    if (btnOnlineToggleCam) {
      btnOnlineToggleCam.addEventListener('click', () => {
        const isOff = this.livekit.toggleCamera();
        btnOnlineToggleCam.classList.toggle('active', isOff);
        btnOnlineToggleCam.innerHTML = isOff ? '<i data-lucide="camera-off"></i>' : '<i data-lucide="camera"></i>';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // 🚩 Report Modal
    const reportModal = document.getElementById('reportModal');
    if (btnOpenReportModal && reportModal) {
      btnOpenReportModal.addEventListener('click', () => {
        reportModal.classList.remove('hidden');
      });
    }
    if (btnCloseReportModal && reportModal) {
      btnCloseReportModal.addEventListener('click', () => {
        reportModal.classList.add('hidden');
      });
    }
    if (btnSubmitReport && reportModal) {
      btnSubmitReport.addEventListener('click', () => {
        const reasonSelect = document.getElementById('reportReasonSelect');
        const reason = reasonSelect ? reasonSelect.value : 'Other';
        if (this.currentMatchData && this.currentMatchData.opponent) {
          this.net.reportUser(this.currentMatchData.opponent.userId, this.currentMatchData.sessionId, reason);
        }
        reportModal.classList.add('hidden');
        alert("Report submitted to CRINGE METER Safety System.");
      });
    }

    // Block Stranger
    if (btnBlockStranger) {
      btnBlockStranger.addEventListener('click', () => {
        if (this.currentMatchData && this.currentMatchData.opponent) {
          if (confirm(`Block ${this.currentMatchData.opponent.displayName}? You will not match with them again.`)) {
            this.net.blockUser(this.currentMatchData.opponent.userId);
            this.nextStranger();
          }
        }
      });
    }
  }

  async checkMediaPermissionsSilently() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { ok: false, reason: "NO_MEDIA_SUPPORT" };
      }

      // Check Permissions API if supported by browser
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const camQuery = await navigator.permissions.query({ name: 'camera' });
          const micQuery = await navigator.permissions.query({ name: 'microphone' });
          if (camQuery.state === 'granted' && micQuery.state === 'granted') {
            return { ok: true };
          }
        } catch (e) {
          // Safari / WebKit query fallback
        }
      }

      // Pre-flight stream check
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      stream.getTracks().forEach(t => t.stop());

      if (hasVideo && hasAudio) {
        return { ok: true };
      }
      return { ok: false, reason: "MISSING_TRACKS" };
    } catch (err) {
      console.warn("Silent media permission check:", err.name, err.message);
      return { ok: false, reason: err.name || "DENIED" };
    }
  }

  async startOnlineMatchmaking() {
    this.init();

    // 1. Silent Check: If permission already given, bypass modal completely & enter matchmaking immediately!
    const res = await this.checkMediaPermissionsSilently();
    if (res.ok) {
      const permModal = document.getElementById('permissionsModal');
      if (permModal) permModal.classList.add('hidden');
      if (window.appSwitchView) window.appSwitchView('view-matchmaking');
      this.proceedMatchmaking();
      return;
    }

    // 2. Permission missing / denied: Show requirement modal
    if (window.appSwitchView) window.appSwitchView('view-home');
    const permModal = document.getElementById('permissionsModal');
    const btnGrant = document.getElementById('btnGrantPermissions');
    if (permModal) permModal.classList.remove('hidden');

    if (btnGrant) {
      btnGrant.onclick = async () => {
        const retryRes = await this.checkMediaPermissionsSilently();
        if (retryRes.ok) {
          permModal.classList.add('hidden');
          if (window.appSwitchView) window.appSwitchView('view-matchmaking');
          this.proceedMatchmaking();
        } else {
          alert("Camera and Microphone permissions are required to play CRINGE METER. Please allow access in browser settings.");
        }
      };
    }
  }

  proceedMatchmaking() {
    const mmSearchingState = document.getElementById('mmSearchingState');
    const mmMatchFoundState = document.getElementById('mmMatchFoundState');
    const mmTitle = document.querySelector('.mm-title');

    if (mmSearchingState) mmSearchingState.classList.remove('hidden');
    if (mmMatchFoundState) mmMatchFoundState.classList.add('hidden');
    if (mmTitle) mmTitle.textContent = "SEARCHING FOR STRANGER...";

    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }

    // Request real stranger match via Socket.IO
    this.net.findMatch();
  }

  cancelMatchmaking() {
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.net.cancelMatch();
  }

  handleStatusChange(status) {
    const mmTitle = document.querySelector('.mm-title');
    if (mmTitle) {
      if (status === 'SEARCHING') mmTitle.textContent = "SEARCHING FOR STRANGER...";
      else if (status === 'IDLE') mmTitle.textContent = "IDLE";
    }
  }

  async handleMatchFound(matchData) {
    if (this.matchmakingTimeout) {
      clearTimeout(this.matchmakingTimeout);
      this.matchmakingTimeout = null;
    }
    this.currentMatchData = matchData;
    if (window.soundEngine) window.soundEngine.playMatchFound();

    // Show Match Found Transition
    const mmSearchingState = document.getElementById('mmSearchingState');
    const mmMatchFoundState = document.getElementById('mmMatchFoundState');
    const mmNameP1 = document.getElementById('mmNameP1');
    const mmAvatarP1 = document.getElementById('mmAvatarP1');
    const mmNameP2 = document.getElementById('mmNameP2');
    const mmAvatarP2 = document.getElementById('mmAvatarP2');
    const roleIcon = document.getElementById('roleIcon');
    const roleTitle = document.getElementById('roleTitle');
    const roleDesc = document.getElementById('roleDesc');

    if (mmSearchingState) mmSearchingState.classList.add('hidden');
    if (mmMatchFoundState) mmMatchFoundState.classList.remove('hidden');

    const selfStats = window.gameEngine ? window.gameEngine.getPlayerStats() : {};
    if (mmNameP1) mmNameP1.textContent = selfStats.name || 'You';
    if (mmAvatarP1) mmAvatarP1.textContent = selfStats.avatar || '🤡';

    if (mmNameP2) mmNameP2.textContent = matchData.opponent.displayName || 'Stranger';
    if (mmAvatarP2) mmAvatarP2.textContent = matchData.opponent.avatar || '🤖';

    const oppName = matchData.opponent?.displayName || matchData.opponent?.name || "Opponent";

    if (matchData.role === 'PERFORMER') {
      if (roleIcon) roleIcon.textContent = "🤡";
      if (roleTitle) roleTitle.textContent = `MAKE ${oppName.toUpperCase()} BREAK 🤡`;
      if (roleDesc) roleDesc.textContent = "Deliver your cringe challenge to break their poker face!";
    } else {
      if (roleIcon) roleIcon.textContent = "😐";
      if (roleTitle) roleTitle.textContent = "DON'T LAUGH! 😐";
      if (roleDesc) roleDesc.textContent = "Hold your poker face for 10 seconds!";
    }

    // 2.2 Second Countdown to Online Battle Launch
    setTimeout(async () => {
      await this.launchOnlineBattle(matchData);
    }, 2200);
  }

  async launchOnlineBattle(matchData) {
    if (window.appSwitchView) window.appSwitchView('view-battle');

    const oppName = matchData.opponent?.displayName || matchData.opponent?.name || "Opponent";
    const selfStats = window.gameEngine ? window.gameEngine.getPlayerStats() : {};
    const selfName = selfStats.name || "You";

    const oppVideoName = document.getElementById('oppVideoName');
    const oppFaceEmoji = document.getElementById('oppFaceEmoji');
    const selfRoleBadge = document.getElementById('selfRoleBadge');
    const oppRoleBadge = document.getElementById('oppRoleBadge');
    const performerPanel = document.getElementById('performerPanel');
    const defenderPanel = document.getElementById('defenderPanel');

    if (oppVideoName) oppVideoName.textContent = oppName;
    if (oppFaceEmoji) oppFaceEmoji.textContent = matchData.opponent?.avatar || "🤡";

    if (selfRoleBadge) selfRoleBadge.textContent = `${selfName} (You)`;
    if (oppRoleBadge) oppRoleBadge.textContent = oppName;

    if (matchData.role === 'PERFORMER') {
      if (performerPanel) performerPanel.classList.remove('hidden');
      if (defenderPanel) defenderPanel.classList.add('hidden');
    } else {
      if (performerPanel) performerPanel.classList.add('hidden');
      if (defenderPanel) defenderPanel.classList.remove('hidden');
    }

    this.updatePromptDisplay(matchData.cringePrompt, matchData.isCustom);

    // Connect WebRTC video/audio feeds
    const localVideoEl = document.getElementById('localVideoFeed');
    const remoteVideoEl = document.getElementById('remoteVideoFeed');
    await this.livekit.connectAndPublish(matchData.livekit, localVideoEl, remoteVideoEl);

    // Start local reaction analyzer & face smile detector
    if (window.reactionAnalyzer) {
      window.reactionAnalyzer.start(localVideoEl);
    }
    if (window.faceDetectorService) {
      window.faceDetectorService.setBattleActive(true);
      window.faceDetectorService.attachVideoElement(localVideoEl);
      window.faceDetectorService.startDetectionLoop();
    }

    // Local engine battle simulation tick
    if (window.gameEngine) window.gameEngine.startBattle();
  }

  nextStranger() {
    this.livekit.disconnect();
    if (window.reactionAnalyzer) window.reactionAnalyzer.stop();
    if (window.faceDetectorService) {
      window.faceDetectorService.setBattleActive(false);
      window.faceDetectorService.stopDetectionLoop();
    }

    if (window.appSwitchView) window.appSwitchView('view-matchmaking');

    const mmSearchingState = document.getElementById('mmSearchingState');
    const mmMatchFoundState = document.getElementById('mmMatchFoundState');
    const mmTitle = document.querySelector('.mm-title');

    if (mmSearchingState) mmSearchingState.classList.remove('hidden');
    if (mmMatchFoundState) mmMatchFoundState.classList.add('hidden');
    if (mmTitle) mmTitle.textContent = "FINDING NEW STRANGER...";

    this.net.nextMatch();
  }

  handlePromptUpdated(data) {
    this.updatePromptDisplay(data.prompt, data.isCustom);
  }

  updatePromptDisplay(promptText, isCustom = false) {
    const aiPromptText = document.getElementById('aiPromptText');
    const customBadge = document.getElementById('customPromptBadge');
    if (aiPromptText) aiPromptText.textContent = `"${promptText}"`;
    if (customBadge) {
      if (isCustom) customBadge.classList.remove('hidden');
      else customBadge.classList.add('hidden');
    }
  }

  handleRoundResult(data) {
    const selfUserId = window.onlineState ? window.onlineState.internalUserId : '';
    const isWinner = (data.winnerUserId === selfUserId);

    // Immediately stop microphone & camera media tracks
    this.livekit.disconnect();

    if (window.gameEngine) {
      const results = {
        isWinner,
        mode: "Online 1v1 Battle",
        reason: data.reason,
        title: isWinner ? "CRINGE SUCCESSFUL 🏆" : "POKER FACE BROKEN 💀",
        subtitle: isWinner ? "YOU BROKE THE STRANGER 💀" : "THE STRANGER BROKE YOU 💀",
        timeElapsed: "10s",
        peakCringe: isWinner ? "CRITICAL (88%)" : "BROKEN (100%)"
      };
      window.gameEngine.handleBattleResults(results);
    }
  }

  handleStrangerDisconnected(data) {
    const oppVideoName = document.getElementById('oppVideoName');
    if (oppVideoName) oppVideoName.textContent = "Stranger Disconnected";

    const placeholder = document.getElementById('oppCameraOffPlaceholder');
    if (placeholder) {
      placeholder.classList.remove('hidden');
      placeholder.querySelector('.cam-off-title').textContent = "STRANGER LEFT THE ROOM";
    }

    setTimeout(() => {
      if (confirm("The stranger left the room. Find another victim?")) {
        this.nextStranger();
      }
    }, 1000);
  }
}

window.onlineBattleController = new OnlineBattleController();
