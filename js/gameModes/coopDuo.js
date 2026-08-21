/**
 * CRINGE METER — Co-Op Duo Game Mode
 */

class CoopDuoMode extends window.BaseGameMode {
  constructor() {
    super('coop_duo', 'Co-Op Duo Tag Team', 'Team up with a friend to perform double cringe!', 15);
  }
}

window.CoopDuoMode = CoopDuoMode;
