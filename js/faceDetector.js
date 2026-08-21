/**
 * CRINGE METER — Face Smile Detector & Simulated Camera Service
 */

class FaceDetectorService {
  constructor() {
    this.active = false;
    this.stream = null;
    this.smileRisk = 12;
    this.smileCallbacks = [];
  }

  async startCamera(videoElement) {
    this.active = true;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoElement) {
          videoElement.srcObject = this.stream;
          videoElement.classList.remove('hidden');
          const fallback = document.getElementById('camFallback');
          if (fallback) fallback.classList.add('hidden');
        }
      }
    } catch (e) {
      console.warn("Local camera fallback active:", e);
    }
  }

  stopCamera() {
    this.active = false;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  onSmileUpdate(cb) {
    this.smileCallbacks.push(cb);
  }

  triggerSpike(amount = 25) {
    this.smileRisk = Math.min(100, this.smileRisk + amount);
    this.notifySmile();
  }

  notifySmile() {
    this.smileCallbacks.forEach(cb => cb(this.smileRisk));
  }
}

window.faceDetectorService = new FaceDetectorService();
