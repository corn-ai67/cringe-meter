/**
 * CRINGE METER — Base Game Mode Interface
 */

class BaseGameMode {
  constructor(id, name, description, durationSec = 10) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.durationSec = durationSec;
    this.engine = null;
    this.timeLeft = durationSec;
    this.cringeLevel = 0;
    this.matchActive = false;
    this.role = 'PERFORMER';
    this.opponent = null;
  }

  init(engine) {
    this.engine = engine;
  }

  start(role, opponent) {
    this.role = role;
    this.opponent = opponent;
    this.timeLeft = this.durationSec;
    this.cringeLevel = 0;
    this.matchActive = true;
  }

  tick() {
    if (!this.matchActive) return;
    this.timeLeft -= 1;
    this.cringeLevel = Math.min(100, Math.floor(((this.durationSec - this.timeLeft) / this.durationSec) * 100));

    if (this.engine) {
      this.engine.updateBattleHUD(this.timeLeft, this.cringeLevel);
    }

    if (this.timeLeft <= 0) {
      this.end('TIME_EXPIRED');
    }
  }

  end(reason) {
    if (!this.matchActive) return;
    this.matchActive = false;
    
    let isWinner = false;
    if (this.role === 'PERFORMER') {
      isWinner = (reason === 'OPPONENT_LAUGHED' || reason === 'TIME_EXPIRED');
    } else {
      isWinner = (reason === 'TIME_EXPIRED');
    }

    const results = {
      isWinner,
      mode: this.name,
      reason,
      title: isWinner ? "CRINGE SUCCESSFUL" : "POKER FACE BROKEN",
      subtitle: isWinner ? "YOU BROKE THEM 💀" : "THE CRINGE WAS TOO STRONG 💀",
      timeElapsed: `${this.durationSec - this.timeLeft}s`,
      peakCringe: `${this.cringeLevel}%`
    };

    if (this.engine) {
      this.engine.handleBattleResults(results);
    }
  }
}

window.BaseGameMode = BaseGameMode;
