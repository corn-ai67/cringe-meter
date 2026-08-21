/**
 * CRINGE METER — Don't Laugh Game Mode
 */

class DontLaughMode extends window.BaseGameMode {
  constructor() {
    super('dont_laugh', "Don't Laugh", "Hold your poker face for 10 seconds or make them break!", 10);
  }
}

window.DontLaughMode = DontLaughMode;
