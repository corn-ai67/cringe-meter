/**
 * CRINGE METER — Internationalization Engine (English / Thai)
 */

const THAI_AI_PROMPTS = [
  "พยายามขาย 'อากาศอัดกระป๋อง' ให้คู่แข่งด้วยสำเนียงฝรั่งเศสแบบโอเวอร์แอคติ้ง",
  "ทำเสียงกระซิบดราม่า 15 วินาที อธิบายว่าทำไมถุงเท้าข้างซ้ายของคุณถึงรู้สึกเหงา",
  "ร้องเพลงเฮฟวี่เมทัลอธิบายความเจ็บปวดตอนเดินชนโต๊ะกาแฟ",
  "ทำเป็นนักสร้างแรงบันดาลใจพูดเกี่ยวกับความสำคัญของการกินบะหมี่กึ่งสำเร็จรูปตอนตี 3"
];

const TRANSLATIONS = {
  en: {
    tagline: "How much cringe can you handle?",
    find_battle: "FIND BATTLE",
    find_battle_sub: "10 SECONDS. DON'T LAUGH.",
    caption: "\"Find out how much cringe you can handle.\"",
    create_room: "CREATE ROOM",
    join_code: "JOIN CODE",
    active_mode_title: "ACTIVE MODE",
    dont_laugh_title: "Don't Laugh 🤡 vs 😐",
    dont_laugh_desc: "Make them break before timer hits 0:00!",
    change_mode: "Change Mode",
    nav_home: "HOME",
    nav_leaderboard: "LEADERBOARD",
    nav_modes: "MODES",
    nav_profile: "PROFILE",
    win_streak: "WIN STREAK",
    current_rank: "CURRENT RANK",
    season_tag: "SEASON 1: BREAK THEM",
    active_mode_tag: "DON'T LAUGH MODE",
    settings_title: "SETTINGS & CONTROLS",
    lang_setting: "App Language (ภาษา)",
    sound_setting: "Sound Effects & Audio Synth",
    sensor_setting: "Webcam Smile Sensor",
    shell_setting: "Desktop Mobile Frame Shell",
    role_performer_title: "MAKE THEM BREAK 🤡",
    role_performer_desc: "You are the PERFORMER! Deliver your AI cringe challenge and break their poker face before timer runs out.",
    role_defender_title: "DON'T. LAUGH. 😐",
    role_defender_desc: "You are the DEFENDER! Hold your ground without smiling or laughing for 10 seconds."
  },
  th: {
    tagline: "คุณทนความกลั้นขำได้แค่ไหน?",
    find_battle: "ค้นหาคู่ประลอง",
    find_battle_sub: "10 วินาที ห้ามขำเด็ดขาด!",
    caption: "\"มาดูกันว่าคุณจะกลั้นขำได้นานแค่ไหน\"",
    create_room: "สร้างห้องเล่นกับเพื่อน",
    join_code: "ใส่รหัสเข้าห้อง",
    active_mode_title: "โหมดปัจจุบัน",
    dont_laugh_title: "โหมดกลั้นขำ 🤡 vs 😐",
    dont_laugh_desc: "ทำให้ฝั่งตรงข้ามหลุดขำก่อนเวลาหมด!",
    change_mode: "เปลี่ยนโหมด",
    nav_home: "หน้าแรก",
    nav_leaderboard: "อันดับ",
    nav_modes: "โหมดเกม",
    nav_profile: "โปรไฟล์",
    win_streak: "ชนะต่อเนื่อง",
    current_rank: "แรงก์ปัจจุบัน",
    season_tag: "ซีซั่น 1: ทำลายความนิ่ง",
    active_mode_tag: "โหมดกลั้นขำ",
    settings_title: "ตั้งค่าและระบบ",
    lang_setting: "เปลี่ยนภาษา (Language)",
    sound_setting: "เสียงเอฟเฟกต์และดนตรี",
    sensor_setting: "ระบบตรวจจับรอยยิ้มผ่านกล้อง",
    shell_setting: "กรอบจำลองมือถือบนคอม",
    role_performer_title: "ทำให้เขาหลุดขำ! 🤡",
    role_performer_desc: "คุณคือผู้แสดง! ปลดปล่อยพลังความกลั้นขำและทำให้คู่แข่งหลุดยิ้มให้ได้ก่อนหมดเวลา",
    role_defender_title: "ห้าม ยิ้ม เด็ด ขาด! 😐",
    role_defender_desc: "คุณคือผู้ตั้งรับ! นิ่งให้ได้ 10 วินาทีโดยไม่ยิ้มหรือขำเด็ดขาด"
  }
};

class I18nEngine {
  constructor() {
    this.currentLang = localStorage.getItem('cringe_meter_lang') || 'en';
  }

  setLanguage(lang) {
    if (TRANSLATIONS[lang]) {
      this.currentLang = lang;
      localStorage.setItem('cringe_meter_lang', lang);
      this.updateDOM();
    }
  }

  t(key) {
    return (TRANSLATIONS[this.currentLang] && TRANSLATIONS[this.currentLang][key]) || TRANSLATIONS['en'][key] || key;
  }

  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });
  }
}

window.THAI_AI_PROMPTS = THAI_AI_PROMPTS;
window.i18nEngine = new I18nEngine();
