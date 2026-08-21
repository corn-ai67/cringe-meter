/**
 * CRINGE METER — AI Cringe Prompt Generator
 */

const CRINGE_PROMPT_CATEGORIES = {
  absurd: [
    "Attempt to sell an invisible bucket of air to your opponent using an aggressive French accent.",
    "Perform an intense 15-second dramatic whisper explaining why your left sock feels lonely.",
    "Sing a heavy-metal opera song about stubbing your toe on a coffee table.",
    "Do a high-energy infomercial for a fork with no tines.",
    "Explain quantum physics like you're an overly nervous conspiracy theorist hiding from pigeons.",
    "Try to convince your opponent that you are an undercover time traveler who lost their time machine key."
  ],
  corporate: [
    "Synergize a paradigm shift in your opponent's emotional posture using 10 corporate buzzwords in one breath.",
    "Deliver a formal LinkedIn update performance announcing your promotion to Chief Vibe Officer.",
    "Host a 10-second high-stakes emergency board meeting about the disappearance of the office stapler.",
    "Pitch a revolutionary startup that turns awkward silences into renewable energy."
  ],
  brainrot: [
    "Recite an emotional eulogy for a melted ice cream cone using maximum internet slang.",
    "Do a serious 10-second unboxing video of an imaginary box of invisible air.",
    "Pretend you are a viral streamer reacting to your opponent breathing.",
    "Perform a dramatic anime villain monologue about why you refuse to do laundry."
  ],
  dramatic: [
    "Deliver a Shakespearean soliloquy about the heartbreak of downloading a software update at 99%.",
    "Act like a telenovela star discovering that your opponent stole your last slice of pizza.",
    "Confess your secret love for a potted plant with maximum theatrical emotion.",
    "Stare intensely into your opponent's soul and passionately whisper a recipe for scrambled eggs."
  ]
};

class CringePromptService {
  constructor() {
    this.allPrompts = [];
    Object.values(CRINGE_PROMPT_CATEGORIES).forEach(category => {
      this.allPrompts.push(...category);
    });
    this.lastPrompt = "";
    this.customPrompts = [];
    this.loadCustomPrompts();
  }

  loadCustomPrompts() {
    try {
      const saved = localStorage.getItem('cringe_meter_custom_prompts');
      if (saved) {
        this.customPrompts = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Could not load custom prompts:", e);
    }
  }

  saveCustomPrompts() {
    try {
      localStorage.setItem('cringe_meter_custom_prompts', JSON.stringify(this.customPrompts));
    } catch (e) {
      console.warn("Could not save custom prompts:", e);
    }
  }

  addCustomPrompt(promptText, category = 'custom') {
    if (!promptText || !promptText.trim()) return false;
    const cleanText = promptText.trim();
    this.customPrompts.push({ text: cleanText, category });
    this.saveCustomPrompts();
    return true;
  }

  removeCustomPrompt(index) {
    if (index >= 0 && index < this.customPrompts.length) {
      this.customPrompts.splice(index, 1);
      this.saveCustomPrompts();
      return true;
    }
    return false;
  }

  getCustomPrompts() {
    return this.customPrompts;
  }

  getRandomPrompt() {
    if (window.i18nEngine && window.i18nEngine.currentLang === 'th' && window.THAI_AI_PROMPTS) {
      const idx = Math.floor(Math.random() * window.THAI_AI_PROMPTS.length);
      return { text: window.THAI_AI_PROMPTS[idx], isCustom: false };
    }

    if (this.customPrompts.length > 0 && Math.random() < 0.4) {
      const cIdx = Math.floor(Math.random() * this.customPrompts.length);
      return { text: this.customPrompts[cIdx].text, isCustom: true };
    }

    let nextPrompt = this.lastPrompt;
    while (nextPrompt === this.lastPrompt && this.allPrompts.length > 1) {
      const idx = Math.floor(Math.random() * this.allPrompts.length);
      nextPrompt = this.allPrompts[idx];
    }
    this.lastPrompt = nextPrompt;
    return { text: nextPrompt, isCustom: false };
  }
}

window.cringePromptService = new CringePromptService();
