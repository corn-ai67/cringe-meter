/**
 * CRINGE METER — Face Smile Detector & Anti-Cheat Occlusion Service
 * Real-time client-side MediaPipe FaceMesh analysis, smooth Smile Meter mapping,
 * 5-Second Full-Smile Lose Timer, and 5-Second Face-Covering Anti-Cheat.
 */

class FaceDetectorService {
  constructor() {
    this.active = false;
    this.stream = null;
    this.videoElement = null;
    this.animFrameId = null;

    // MediaPipe FaceMesh instance
    this.faceMesh = null;
    this.isFaceMeshReady = false;
    this.isInitializing = false;
    this.isProcessingFrame = false;
    this.faceMeshInitError = null;

    // Smile tracking & smoothing
    this.rawSmile = 0;
    this.smoothedSmile = 0;
    this.FULL_SMILE_THRESHOLD = 0.90;
    this.LOSE_DURATION = 5000; // 5 continuous seconds

    // Timers
    this.fullSmileStartTime = null;
    this.faceCoveredStartTime = null;

    // Occlusion / Glitch-smoothing tracking
    this.occludedStreak = 0;
    this.visibleStreak = 0;
    this.isFaceCovered = false;

    // Battle state & single-trigger protection
    this.battleActive = false;
    this.hasLost = false;

    // Test Mode state
    this.testModeActive = false;
    this.testCallbacks = {};

    // Callbacks
    this.smileCallbacks = [];
    this.smileMeterCallbacks = [];
    this.loseCallbacks = [];

    // Offscreen canvas for frame sampling & fallback
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.lastFrameTime = 0;

    // Legacy support
    this.smileRisk = 12;

    this.initFaceMesh();
  }

  initFaceMesh() {
    if (this.isFaceMeshReady || this.isInitializing) return;

    if (typeof window.FaceMesh !== 'undefined') {
      try {
        this.isInitializing = true;
        this.faceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45
        });

        this.faceMesh.onResults((results) => this.handleFaceMeshResults(results));
        this.isFaceMeshReady = true;
        this.isInitializing = false;
        this.faceMeshInitError = null;
        console.log("[FACEDETECTOR] MediaPipe FaceMesh initialized successfully.");
      } catch (err) {
        console.warn("[FACEDETECTOR] MediaPipe FaceMesh init error:", err);
        this.isInitializing = false;
        this.faceMeshInitError = err;
      }
    } else {
      // Retry in 500ms if script is still downloading
      setTimeout(() => this.initFaceMesh(), 500);
    }
  }

  async startCamera(videoElement) {
    this.stopDetectionLoop();
    this.active = true;
    this.videoElement = videoElement || document.getElementById('localVideoFeed');

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (!this.stream || !this.stream.active) {
          this.stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false
          });
        }

        if (this.videoElement) {
          this.videoElement.srcObject = this.stream;
          this.videoElement.muted = true;
          this.videoElement.setAttribute('playsinline', 'true');
          this.videoElement.setAttribute('webkit-playsinline', 'true');
          this.videoElement.classList.remove('hidden');
          this.videoElement.style.display = 'block';

          const fallback = document.getElementById('camFallback');
          if (fallback) {
            fallback.classList.add('hidden');
            fallback.style.display = 'none';
          }

          try {
            await this.videoElement.play();
          } catch (e) {}
        }
      }
      this.startDetectionLoop();
      return { success: true };
    } catch (e) {
      console.warn("[FACEDETECTOR] Camera access error:", e);
      this.active = false;
      return { success: false, error: e };
    }
  }

  attachVideoElement(videoElement) {
    this.videoElement = videoElement;
    if (this.active) {
      this.startDetectionLoop();
    }
  }

  stopCamera() {
    this.active = false;
    this.stopDetectionLoop();

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    this.resetTimers();
  }

  setBattleActive(active) {
    this.battleActive = !!active;
    if (this.battleActive) {
      this.testModeActive = false;
      this.hasLost = false;
      this.resetTimers();
    } else {
      this.resetTimers();
    }
  }

  setTestModeActive(active, callbacks = {}) {
    this.testModeActive = !!active;
    this.testCallbacks = callbacks || {};
    if (this.testModeActive) {
      this.battleActive = false;
      this.hasLost = false;
      this.resetTimers();
    } else {
      this.resetTimers();
    }
  }

  resetTimers() {
    this.fullSmileStartTime = null;
    this.faceCoveredStartTime = null;
    this.occludedStreak = 0;
    this.visibleStreak = 0;
    this.isFaceCovered = false;
    this.smoothedSmile = 0;
    this.rawSmile = 0;
    this.updateSmileMeterUI(0, false);
    this.updateCountdownUI(5, false);
  }

  onSmileUpdate(cb) {
    if (typeof cb === 'function') this.smileCallbacks.push(cb);
  }

  onSmileMeterUpdate(cb) {
    if (typeof cb === 'function') this.smileMeterCallbacks.push(cb);
  }

  onLose(cb) {
    if (typeof cb === 'function') this.loseCallbacks.push(cb);
  }

  simulateSmile(targetSmile = 1.0) {
    this.rawSmile = targetSmile;
    this.smoothedSmile = targetSmile;
    const now = Date.now();
    this.evaluateGameLogic(targetSmile, false, now);
  }

  triggerSpike(amount = 25) {
    this.rawSmile = Math.min(1.0, this.rawSmile + (amount / 100));
    this.smoothedSmile = this.rawSmile;
    this.evaluateGameLogic(this.rawSmile, false, Date.now());
  }

  notifySmile() {
    this.smileCallbacks.forEach(cb => cb(Math.round(this.smoothedSmile * 100)));
  }

  startDetectionLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const loop = (now) => {
      if (!this.active) return;

      // Throttle detection frequency to ~15-20 FPS (~55ms interval) to preserve video smoothness
      if (now - this.lastFrameTime >= 55) {
        this.lastFrameTime = now;
        this.processCurrentFrame(now);
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  stopDetectionLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  async processCurrentFrame(now) {
    const video = this.videoElement || document.getElementById('localVideoFeed');
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended) {
      return;
    }

    if (this.isFaceMeshReady && this.faceMesh && !this.isProcessingFrame) {
      this.isProcessingFrame = true;
      try {
        await this.faceMesh.send({ image: video });
      } catch (e) {
        // Frame dropped gracefully
      } finally {
        this.isProcessingFrame = false;
      }
    } else if (!this.isFaceMeshReady) {
      // Fallback analyzer while model loads
      this.processFallbackFrame(video, now);
    }
  }

  handleFaceMeshResults(results) {
    const now = performance.now();
    const hasLandmarks = results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    let detectedSmile = 0;
    let isOccluded = false;

    if (hasLandmarks) {
      const landmarks = results.multiFaceLandmarks[0];

      // Key landmark indices:
      // Lip corners: 61 (left), 291 (right)
      // Lip centers: 13 (upper inner), 14 (lower inner), 0 (upper top), 17 (lower bottom)
      // Face width / Cheeks: 234 (left cheek), 454 (right cheek)
      // Eyes outer: 33 (left), 263 (right)
      const p61 = landmarks[61];
      const p291 = landmarks[291];
      const p13 = landmarks[13];
      const p0 = landmarks[0];
      const p234 = landmarks[234];
      const p454 = landmarks[454];

      if (p61 && p291 && p234 && p454) {
        const mouthWidth = Math.hypot(p291.x - p61.x, p291.y - p61.y);
        const faceWidth = Math.hypot(p454.x - p234.x, p454.y - p234.y) || 0.4;
        const widthRatio = mouthWidth / faceWidth;

        // Lip corner elevation relative to upper lip center
        const lipY = p13 ? p13.y : (p0 ? p0.y : 0.5);
        const cornerY = (p61.y + p291.y) / 2;
        const cornerElevation = (lipY - cornerY) / faceWidth;

        // Check for mouth occlusion / unnatural distortion (hands over mouth collapse mouth geometry)
        if (widthRatio < 0.18 || mouthWidth < 0.03 || isNaN(widthRatio)) {
          isOccluded = true;
        } else {
          // Continuous smile mapping (0.0 to 1.0)
          // Neutral width ratio is ~0.38-0.42, smiling is ~0.50-0.62
          const widthScore = Math.max(0, Math.min(1, (widthRatio - 0.40) / 0.17));
          const elevationScore = Math.max(0, Math.min(1, (cornerElevation + 0.01) / 0.045));

          detectedSmile = Math.max(0, Math.min(1, (widthScore * 0.65) + (elevationScore * 0.35)));
        }
      } else {
        isOccluded = true;
      }
    } else {
      // Entire face missing while video is actively running
      isOccluded = true;
    }

    this.evaluateGameLogic(detectedSmile, isOccluded, now);
  }

  processFallbackFrame(video, now) {
    if (this.canvas.width !== 120 || this.canvas.height !== 90) {
      this.canvas.width = 120;
      this.canvas.height = 90;
    }

    try {
      this.ctx.drawImage(video, 0, 0, 120, 90);
      const frameData = this.ctx.getImageData(0, 0, 120, 90).data;

      let totalLuma = 0;
      for (let i = 0; i < frameData.length; i += 16) {
        totalLuma += (frameData[i] * 0.299 + frameData[i + 1] * 0.587 + frameData[i + 2] * 0.114);
      }
      const avgLuma = totalLuma / (frameData.length / 16);

      const isOccluded = (avgLuma < 12);
      this.evaluateGameLogic(this.rawSmile, isOccluded, now);
    } catch (e) {}
  }

  evaluateGameLogic(rawSmile, isOccluded, now) {
    this.rawSmile = rawSmile;

    // ----------------------------------------------------
    // Smoothing: Exponential Moving Average for Jitter-Free Meter
    // ----------------------------------------------------
    this.smoothedSmile = (this.smoothedSmile * 0.70) + (rawSmile * 0.30);
    if (this.smoothedSmile < 0.03) this.smoothedSmile = 0;

    // Normalized 0.0 to 1.0 against FULL_SMILE_THRESHOLD
    const normalizedSmile = Math.min(1.0, this.smoothedSmile / this.FULL_SMILE_THRESHOLD);
    const isFullSmile = (this.smoothedSmile >= this.FULL_SMILE_THRESHOLD);

    // ----------------------------------------------------
    // SMILE METER UI UPDATE
    // ----------------------------------------------------
    this.updateSmileMeterUI(normalizedSmile, isFullSmile);

    // Legacy sync
    this.smileRisk = Math.round(this.smoothedSmile * 100);
    this.notifySmile();

    // ----------------------------------------------------
    // TEST MODE EXECUTION PATH (NO STATS / NO BATTLE LOSS)
    // ----------------------------------------------------
    if (this.testModeActive) {
      if (this.testCallbacks.onSmileUpdate) {
        this.testCallbacks.onSmileUpdate(this.smoothedSmile, normalizedSmile, isFullSmile);
      }

      if (isFullSmile) {
        if (this.fullSmileStartTime === null) {
          this.fullSmileStartTime = now;
        }

        const elapsedSmileTime = now - this.fullSmileStartTime;
        const remainingMs = this.LOSE_DURATION - elapsedSmileTime;
        const countdownNumber = Math.max(1, Math.ceil(remainingMs / 1000));

        if (elapsedSmileTime >= this.LOSE_DURATION) {
          if (this.testCallbacks.onCountdownUpdate) {
            this.testCallbacks.onCountdownUpdate(0, false, true); // true = success
          }
        } else {
          if (this.testCallbacks.onCountdownUpdate) {
            this.testCallbacks.onCountdownUpdate(countdownNumber, true, false);
          }
        }
      } else {
        this.fullSmileStartTime = null;
        if (this.testCallbacks.onCountdownUpdate) {
          this.testCallbacks.onCountdownUpdate(5, false, false);
        }
      }
      return; // NEVER trigger battle loss or modify stats in test mode!
    }

    // ----------------------------------------------------
    // REAL BATTLE EXECUTION PATH
    // ----------------------------------------------------
    if (!this.battleActive || this.hasLost) {
      this.fullSmileStartTime = null;
      this.faceCoveredStartTime = null;
      this.updateCountdownUI(5, false);
      return;
    }

    // RULE 1: FULL SMILE 5-SECOND LOSE TIMER & 5..1 COUNTDOWN
    if (isFullSmile) {
      if (this.fullSmileStartTime === null) {
        this.fullSmileStartTime = now;
      }

      const elapsedSmileTime = now - this.fullSmileStartTime;
      const remainingMs = this.LOSE_DURATION - elapsedSmileTime;
      const countdownNumber = Math.max(1, Math.ceil(remainingMs / 1000));

      this.updateCountdownUI(countdownNumber, true);

      if (elapsedSmileTime >= this.LOSE_DURATION) {
        this.updateCountdownUI(5, false);
        this.triggerLose("smile");
        return;
      }
    } else {
      this.fullSmileStartTime = null;
      this.updateCountdownUI(5, false);
    }

    // RULE 2: FACE / MOUTH COVERING 5-SECOND LOSE TIMER (Internal only)
    if (isOccluded) {
      this.occludedStreak++;
      this.visibleStreak = 0;
    } else {
      this.visibleStreak++;
      this.occludedStreak = 0;
    }
    this.isFaceCovered = (this.occludedStreak >= 6);

    if (this.isFaceCovered) {
      if (this.faceCoveredStartTime === null) {
        this.faceCoveredStartTime = now;
      }

      const elapsedCoveredTime = now - this.faceCoveredStartTime;
      if (elapsedCoveredTime >= this.LOSE_DURATION) {
        this.triggerLose("face-covered");
        return;
      }
    } else if (this.visibleStreak >= 3) {
      this.faceCoveredStartTime = null;
    }
  }

  updateSmileMeterUI(value, isFull) {
    const fill = document.getElementById('playerSmileMeterFill');
    if (fill) {
      const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
      fill.style.width = `${pct}%`;
      if (isFull) {
        fill.classList.add('is-full');
      } else {
        fill.classList.remove('is-full');
      }
    }

    this.smileMeterCallbacks.forEach(cb => cb(value, isFull));
  }

  updateCountdownUI(countdownNum, show) {
    const overlay = document.getElementById('smileCountdownOverlay');
    if (!overlay) return;

    if (show && countdownNum > 0) {
      if (overlay.textContent !== String(countdownNum)) {
        overlay.textContent = countdownNum;
        overlay.style.animation = 'none';
        overlay.offsetHeight; /* trigger CSS reflow */
        overlay.style.animation = '';
      }
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  triggerLose(reason) {
    if (this.hasLost || !this.battleActive) return;
    this.hasLost = true;
    this.battleActive = false;

    console.log(`[FACEDETECTOR] LOSE TRIGGERED: reason=${reason}`);

    this.fullSmileStartTime = null;
    this.faceCoveredStartTime = null;
    this.updateCountdownUI(5, false);

    this.loseCallbacks.forEach(cb => cb(reason));
  }
}

window.faceDetectorService = new FaceDetectorService();
