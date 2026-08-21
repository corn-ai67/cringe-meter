/**
 * CRINGE METER — Staring Contest Game Mode
 */

class StaringContestMode extends window.BaseGameMode {
  constructor() {
    super('staring', 'Staring Contest', 'No blinking allowed! Face detection camera mode.', 15);
  }
}

window.StaringContestMode = StaringContestMode;
