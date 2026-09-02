/**
 * CRINGE METER — Face Smile Detector & Anti-Cheat Occlusion Service
 * Real-time client-side MediaPipe FaceMesh (468 landmarks) + Pixel-Based Vision Analyzer,
 * Smooth Exponential Moving Average smile mapping, 5-Second Full-Smile Lose Timer,
 * and 5-Second Face-Covering Anti-Cheat.
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
    this.faceMeshWasmLoaded = false; // true only AFTER first successful send+onResults
    this.isInitializing = false;
    this.isProcessingFrame = false;
    this.faceMeshInitError = null;

    // Smile tracking & smoothing
    this.rawSmile = 0;
    this.smoothedSmile = 0;
    this.FULL_SMILE_THRESHOLD = 0.85; // Trigger threshold
    this.FULL_SMILE_MAINTAIN_THRESHOLD = 0.72; // Maintain threshold once started
    this.DROP_TOLERANCE_MS = 400; // Grace period before cancelling countdown
    this.LOSE_DURATION = 5000; // 5 continuous seconds

    // Baseline calibration for neutral face
    this.baselineMouthRatio = 0.38;
    this.baselineCornerElevation = -0.015;
    this.baselineSamples = 0;
    this.baselineFallbackWidth = 0.20;

    // Timers
    this.fullSmileStartTime = null;
    this.smileDropStartTime = null;
    this.faceCoveredStartTime = null;

    // Simulation override
    this.simulatedSmileValue = null;
    this.simulationTimer = null;

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
    this.canvas.width = 320;
    this.canvas.height = 240;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.lastFrameTime = 0;
    this._frameCount = 0;

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
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`
        });

        this.faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.40,
          minTrackingConfidence: 0.40
        });

        this.faceMesh.onResults((results) => this.handleFaceMeshResults(results));
        this.isFaceMeshReady = true;
        this.isInitializing = false;
        this.faceMeshInitError = null;
        console.log("[FACEDETECTOR] FaceMesh constructor ready. WASM will load on first send().");
      } catch (err) {
        console.warn("[FACEDETECTOR] FaceMesh init error:", err);
        this.isInitializing = false;
        this.faceMeshInitError = err;
        // Still allow fallback vision to work
      }
    } else {
      // Retry in 400ms if CDN script not loaded yet
      setTimeout(() => this.initFaceMesh(), 400);
    }
  }

  async startCamera(videoElement) {
    this.stopDetectionLoop();
    this.active = true;
    this.videoElement = videoElement || document.getElementById('localVideoFeed');

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Always get a fresh stream if the previous one was stopped
        if (this.stream && this.stream.active) {
          // Reuse existing active stream
        } else {
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

          // Hide the battle fallback if present
          const fallback = document.getElementById('camFallback');
          if (fallback) {
            fallback.classList.add('hidden');
            fallback.style.display = 'none';
          }

          try {
            await this.videoElement.play();
            console.log("[FACEDETECTOR] Camera playing. videoWidth:", this.videoElement.videoWidth, "testMode:", this.testModeActive);
          } catch (playErr) {
            console.warn("[FACEDETECTOR] video.play() failed:", playErr);
          }
        }
      }

      this.startDetectionLoop();
      console.log("[FACEDETECTOR] Detection loop started. testMode:", this.testModeActive, "battleActive:", this.battleActive);
      return { success: true };
    } catch (e) {
      console.warn("[FACEDETECTOR] Camera access error:", e);
      this.active = false;
      return { success: false, error: e };
    }
  }

  attachVideoElement(videoElement) {
    this.videoElement = videoElement;
    this.active = true;
    this.startDetectionLoop();
    console.log("[FACEDETECTOR] Attached video element and started detection loop.");
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
      console.log("[FACEDETECTOR] Test mode ACTIVATED. Callbacks:", Object.keys(this.testCallbacks));
    } else {
      this.testCallbacks = {};
      this.resetTimers();
      console.log("[FACEDETECTOR] Test mode DEACTIVATED.");
    }
  }

  resetTimers() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    this.simulatedSmileValue = null;
    this.fullSmileStartTime = null;
    this.smileDropStartTime = null;
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

  simulateSmile(targetSmile = 1.0, durationMs = 5500) {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }

    if (targetSmile <= 0.05) {
      this.simulatedSmileValue = null;
      this.fullSmileStartTime = null;
      this.smileDropStartTime = null;
      this.rawSmile = 0;
      this.smoothedSmile = 0;
      this.evaluateGameLogic(0, false, performance.now());
      return;
    }

    this.simulatedSmileValue = targetSmile;
    const simStartTime = performance.now();
    this.rawSmile = targetSmile;
    this.smoothedSmile = targetSmile;
    this.evaluateGameLogic(targetSmile, false, simStartTime);

    // Run continuous simulation ticks every 50ms for durationMs
    this.simulationTimer = setInterval(() => {
      const now = performance.now();
      if (now - simStartTime >= durationMs) {
        clearInterval(this.simulationTimer);
        this.simulationTimer = null;
        this.simulatedSmileValue = null;
      } else {
        this.rawSmile = targetSmile;
        this.smoothedSmile = targetSmile;
        this.evaluateGameLogic(targetSmile, false, now);
      }
    }, 50);
  }

  triggerSpike(amount = 25) {
    this.rawSmile = Math.min(1.0, this.rawSmile + (amount / 100));
    this.smoothedSmile = this.rawSmile;
    this.evaluateGameLogic(this.rawSmile, false, performance.now());
  }

  notifySmile() {
    this.smileCallbacks.forEach(cb => cb(Math.round(this.smoothedSmile * 100)));
  }

  startDetectionLoop() {
    this.active = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const loop = (now) => {
      if (!this.active) return;

      // Run detection at ~20 FPS (~50ms interval)
      if (now - this.lastFrameTime >= 50) {
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
    // If simulation override is actively running, process simulated value
    if (this.simulatedSmileValue !== null) {
      this.evaluateGameLogic(this.simulatedSmileValue, false, now);
      return;
    }

    const video = this.videoElement;
    if (!video) return;

    // Wait for video to have actual frames
    if (video.readyState < 2) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Draw frame to offscreen canvas
    try {
      this.ctx.drawImage(video, 0, 0, 320, 240);
    } catch (e) {
      return;
    }

    this._frameCount++;

    // STRATEGY: Always run the fallback vision analyzer for immediate response.
    // Additionally try MediaPipe for higher accuracy when it's ready.
    // This guarantees the user always sees the meter moving.
    
    let usedMediaPipe = false;
    
    // Try MediaPipe if ready and not already processing a frame
    if (this.faceMeshWasmLoaded && this.faceMesh && !this.isProcessingFrame) {
      this.isProcessingFrame = true;
      try {
        await this.faceMesh.send({ image: this.canvas });
        usedMediaPipe = true;
        // onResults callback will call evaluateGameLogic
      } catch (e) {
        // MediaPipe failed this frame, fall through to fallback
      } finally {
        this.isProcessingFrame = false;
      }
    } else if (this.isFaceMeshReady && this.faceMesh && !this.faceMeshWasmLoaded && !this.isProcessingFrame) {
      // First time: try to trigger WASM load in the background
      // but DON'T block the fallback
      this.isProcessingFrame = true;
      this.faceMesh.send({ image: this.canvas }).then(() => {
        // First successful send — WASM is now loaded
        this.faceMeshWasmLoaded = true;
        console.log("[FACEDETECTOR] MediaPipe WASM loaded successfully.");
      }).catch((e) => {
        console.warn("[FACEDETECTOR] MediaPipe WASM load failed:", e);
      }).finally(() => {
        this.isProcessingFrame = false;
      });
    }

    // Always run fallback vision analyzer if MediaPipe didn't handle this frame
    if (!usedMediaPipe) {
      this.processVisionFallbackFrame(now);
    }
  }

  handleFaceMeshResults(results) {
    const now = performance.now();
    
    // Mark WASM as loaded on first successful results
    if (!this.faceMeshWasmLoaded) {
      this.faceMeshWasmLoaded = true;
      console.log("[FACEDETECTOR] MediaPipe WASM confirmed loaded (first results received).");
    }
    
    const hasLandmarks = results && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    let detectedSmile = 0;
    let isOccluded = false;

    if (hasLandmarks) {
      const landmarks = results.multiFaceLandmarks[0];

      // Key MediaPipe 3D Landmark Indices:
      // Mouth corners: 61 (left), 291 (right)
      // Upper lip center: 0 (outer), 13 (inner)
      // Lower lip center: 14 (inner), 17 (outer)
      // Cheeks: 234 (left cheek), 454 (right cheek)
      // Nose base: 164 / 2
      const p61 = landmarks[61];
      const p291 = landmarks[291];
      const p0 = landmarks[0];
      const p13 = landmarks[13];
      const p14 = landmarks[14];
      const p234 = landmarks[234];
      const p454 = landmarks[454];

      if (p61 && p291 && p234 && p454) {
        const mouthWidth = Math.hypot(p291.x - p61.x, p291.y - p61.y);
        const faceWidth = Math.hypot(p454.x - p234.x, p454.y - p234.y) || 0.4;
        const widthRatio = mouthWidth / faceWidth;

        // Lip elevation relative to mouth center
        const lipY = p0 ? p0.y : (p13 ? p13.y : 0.5);
        const cornerY = (p61.y + p291.y) / 2;
        const cornerElevation = (lipY - cornerY) / faceWidth;

        // Mouth vertical opening (parted lips / teeth)
        const mouthHeight = (p13 && p14) ? Math.hypot(p13.x - p14.x, p13.y - p14.y) : 0;
        const heightRatio = mouthHeight / faceWidth;

        if (widthRatio < 0.18 || mouthWidth < 0.03 || isNaN(widthRatio)) {
          isOccluded = true;
        } else {
          // Dynamic adaptive neutral baseline calibration
          if (this.baselineSamples < 30) {
            this.baselineSamples++;
            this.baselineMouthRatio = (this.baselineMouthRatio * 0.85) + (widthRatio * 0.15);
            this.baselineCornerElevation = (this.baselineCornerElevation * 0.85) + (cornerElevation * 0.15);
          } else if (widthRatio < this.baselineMouthRatio + 0.02) {
            // Adapt baseline slowly during resting/neutral face
            this.baselineMouthRatio = (this.baselineMouthRatio * 0.99) + (widthRatio * 0.01);
            this.baselineCornerElevation = (this.baselineCornerElevation * 0.99) + (cornerElevation * 0.01);
          }

          // Relative smile expansion over individual resting baseline
          const deltaWidth = Math.max(0, widthRatio - this.baselineMouthRatio);
          const deltaElevation = Math.max(0, cornerElevation - this.baselineCornerElevation);
          const deltaHeight = Math.max(0, heightRatio - 0.018);

          // Proportional linear curve:
          // Slight smile (deltaWidth ~ 0.022) -> ~30%
          // Medium smile (deltaWidth ~ 0.045) -> ~60%
          // Big smile (deltaWidth ~ 0.075+) -> ~90-100%
          const widthScore = Math.min(1.0, deltaWidth / 0.075);
          const elevationScore = Math.min(1.0, deltaElevation / 0.032);
          const openScore = Math.min(1.0, deltaHeight / 0.06);

          detectedSmile = Math.min(1.0, (widthScore * 0.55) + (elevationScore * 0.35) + (openScore * 0.10));
        }
      } else {
        isOccluded = true;
      }
    } else {
      // No face detected by MediaPipe — try fallback
      const visionResult = this.analyzeMouthPixels(320, 240);
      detectedSmile = visionResult.smile;
      isOccluded = visionResult.isOccluded;
    }

    this.evaluateGameLogic(detectedSmile, isOccluded, now);
  }

  processVisionFallbackFrame(now) {
    const visionResult = this.analyzeMouthPixels(320, 240);
    this.evaluateGameLogic(visionResult.smile, visionResult.isOccluded, now);
  }

  analyzeMouthPixels(width, height) {
    try {
      const imgData = this.ctx.getImageData(0, 0, width, height).data;

      // Sample center face & mouth box (x: 25%-75%, y: 50%-82%)
      const minX = Math.floor(width * 0.25);
      const maxX = Math.floor(width * 0.75);
      const minY = Math.floor(height * 0.50);
      const maxY = Math.floor(height * 0.82);

      let totalBrightness = 0;
      let skinPixels = 0;
      let lipOrTeethPixels = 0;
      let leftMouthX = maxX;
      let rightMouthX = minX;

      for (let y = minY; y < maxY; y += 2) {
        for (let x = minX; x < maxX; x += 2) {
          const idx = (y * width + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          totalBrightness += brightness;

          // Skin tone check (YCbCr threshold)
          const isSkin = (r > 60 && g > 40 && b > 20 && r > b && (r - g) >= 10);
          if (isSkin) skinPixels++;

          // Lip / Teeth signature
          const isLip = (r > 1.25 * (g + 1) && r > 1.25 * (b + 1));
          const isTeeth = (r > 150 && g > 150 && b > 150 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25);

          if (isLip || isTeeth) {
            lipOrTeethPixels++;
            if (x < leftMouthX) leftMouthX = x;
            if (x > rightMouthX) rightMouthX = x;
          }
        }
      }

      const totalSampled = ((maxY - minY) / 2) * ((maxX - minX) / 2);
      const avgBrightness = totalBrightness / totalSampled;
      const isOccluded = (avgBrightness < 12 || (skinPixels < totalSampled * 0.05));

      if (isOccluded || rightMouthX <= leftMouthX) {
        return { smile: 0, isOccluded: isOccluded };
      }

      // Mouth horizontal span ratio
      const mouthWidth = (rightMouthX - leftMouthX) / width;
      const mouthDensity = lipOrTeethPixels / totalSampled;

      // Adaptive baseline for fallback analyzer
      if (!this.baselineFallbackWidth) this.baselineFallbackWidth = 0.20;
      if (mouthWidth < this.baselineFallbackWidth + 0.02) {
        this.baselineFallbackWidth = this.baselineFallbackWidth * 0.98 + mouthWidth * 0.02;
      }

      const deltaWidth = Math.max(0, mouthWidth - this.baselineFallbackWidth);
      const widthScore = Math.min(1.0, deltaWidth / 0.12);
      const densityScore = Math.min(1.0, Math.max(0, mouthDensity - 0.03) / 0.10);

      const smile = Math.min(1.0, (widthScore * 0.70) + (densityScore * 0.30));
      return { smile, isOccluded: false };
    } catch (e) {
      return { smile: 0, isOccluded: false };
    }
  }

  evaluateGameLogic(rawSmile, isOccluded, now) {
    this.rawSmile = rawSmile;

    // Asymmetric Exponential Moving Average (Fast Attack, Smooth Decay)
    // Instant response (0.65) when smiling, smooth drop (0.28) when stopping
    const alpha = (rawSmile > this.smoothedSmile) ? 0.65 : 0.28;
    this.smoothedSmile = (this.smoothedSmile * (1 - alpha)) + (rawSmile * alpha);
    if (this.smoothedSmile < 0.015) this.smoothedSmile = 0;

    // Direct 1-to-1 linear normalized smile: 0.0 to 1.0 (0% to 100%)
    const normalizedSmile = Math.min(1.0, Math.max(0, this.smoothedSmile));

    // Full smile countdown triggers when normalizedSmile >= 0.85
    const isTriggerThreshold = (normalizedSmile >= this.FULL_SMILE_THRESHOLD);
    const isMaintainThreshold = (normalizedSmile >= this.FULL_SMILE_MAINTAIN_THRESHOLD);

    if (this.fullSmileStartTime !== null) {
      // Countdown is currently running: maintain unless smile drops below maintain threshold for >400ms
      if (isMaintainThreshold) {
        this.smileDropStartTime = null;
      } else {
        if (this.smileDropStartTime === null) {
          this.smileDropStartTime = now;
        }
        if (now - this.smileDropStartTime > this.DROP_TOLERANCE_MS) {
          this.fullSmileStartTime = null;
          this.smileDropStartTime = null;
        }
      }
    } else {
      // Countdown not started yet: start as soon as trigger threshold is crossed
      if (isTriggerThreshold) {
        this.fullSmileStartTime = now;
        this.smileDropStartTime = null;
      }
    }

    const isFullSmile = (this.fullSmileStartTime !== null);

    // SMILE METER UI UPDATE
    this.updateSmileMeterUI(normalizedSmile, isFullSmile);

    // Legacy sync
    this.smileRisk = Math.round(this.smoothedSmile * 100);
    this.notifySmile();


    // TEST MODE EXECUTION PATH (NO STATS / NO BATTLE LOSS)
    if (this.testModeActive) {
      if (this.testCallbacks.onSmileUpdate) {
        this.testCallbacks.onSmileUpdate(this.smoothedSmile, normalizedSmile, isFullSmile);
      }

      if (isFullSmile) {
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
        if (this.testCallbacks.onCountdownUpdate) {
          this.testCallbacks.onCountdownUpdate(5, false, false);
        }
      }
      return; // NEVER trigger battle loss or modify stats in test mode!
    }

    // REAL BATTLE EXECUTION PATH
    if (!this.battleActive || this.hasLost) {
      this.fullSmileStartTime = null;
      this.smileDropStartTime = null;
      this.faceCoveredStartTime = null;
      this.updateCountdownUI(5, false);
      return;
    }

    // RULE 1: FULL SMILE 5-SECOND LOSE TIMER & 5..1 COUNTDOWN
    if (isFullSmile) {
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
    const testFill = document.getElementById('testLabSmileFill');
    const testBadge = document.getElementById('testFullSmileBadge');

    const pct = Math.min(100, Math.max(0, Math.round(value * 100)));

    if (fill) {
      fill.style.width = `${pct}%`;
      if (isFull) fill.classList.add('is-full');
      else fill.classList.remove('is-full');
    }

    if (testFill) {
      testFill.style.width = `${pct}%`;
      if (isFull) testFill.classList.add('is-full');
      else testFill.classList.remove('is-full');
    }

    if (testBadge) {
      if (isFull) testBadge.classList.remove('hidden');
      else testBadge.classList.add('hidden');
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
        overlay.offsetHeight;
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
