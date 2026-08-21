/**
 * CRINGE METER — Synthesized Web Audio Engine
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterVolume = 0.8;
    this.unlockAudioOnIOS();
  }

  unlockAudioOnIOS() {
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'running') {
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('click', unlock);
      }
    };
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('click', unlock, { passive: true });
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(enable) {
    this.enabled = enable;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  playTone(freq, type = 'sine', duration = 0.2, volume = 0.3) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const finalVol = volume * this.masterVolume;
      gain.gain.setValueAtTime(finalVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play failure:", e);
    }
  }

  playClick() {
    this.playTone(600, 'sine', 0.05, 0.2);
  }

  playMatchFound() {
    if (!this.enabled) return;
    this.init();
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.3, 0.4);
      }, idx * 100);
    });
  }

  playRoleReveal() {
    if (!this.enabled) return;
    this.init();
    this.playTone(120, 'sawtooth', 0.5, 0.5);
  }

  playTick() {
    this.playTone(800, 'square', 0.03, 0.15);
  }

  playCriticalAlarm() {
    this.playTone(950, 'sawtooth', 0.15, 0.3);
  }

  playBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.5 * this.masterVolume, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch (e) {}
  }

  playVictory() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.playTone(note, 'sine', 0.4, 0.4);
      }, i * 140);
    });
  }

  playAirhorn() {
    if (!this.enabled) return;
    this.init();
    [280, 370, 470, 560].forEach(f => this.playTone(f, 'sawtooth', 0.4, 0.3));
  }

  playHonk() {
    this.playTone(320, 'triangle', 0.25, 0.5);
    setTimeout(() => this.playTone(240, 'triangle', 0.3, 0.5), 120);
  }

  playBoing() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.4 * this.masterVolume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {}
  }

  playEvilLaugh() {
    const pitches = [180, 160, 140, 120, 100];
    pitches.forEach((p, i) => {
      setTimeout(() => this.playTone(p, 'sawtooth', 0.15, 0.4), i * 110);
    });
  }

  playCustomSynth(freq = 440, type = 'sine', duration = 0.3) {
    this.playTone(freq, type, duration, 0.4);
  }
}

window.soundEngine = new SoundEngine();
