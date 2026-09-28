// Global tuning, NPC roster and Russian strings.
export const VERSION = document.querySelector('meta[name="bba-version"]')?.content || 'dev';
export const asset = (p) => `assets/${p}?v=${VERSION}`;
export const DEBUG = /[?&]debug\b/.test(location.search);

export const PLAYER = {
  walk: 1.7, run: 4.6, accel: 14, turn: 12,
  dodgeDist: 2.4, dodgeTime: 0.34, dodgeIframes: 0.28, dodgeCd: 0.45,
};

// Strike definitions: clip name, contact time (s into the clip), ideal root-to-root distance at contact,
// recovery (s after contact before the next strike may start), damage multiplier.
export const STRIKES = {
  kick: { clip: 'r_kick', contact: 0.25, dist: 0.74, recover: 0.22, dmg: 1.0, ru: 'Ап-кик' },
  knee: { clip: 'r_knee', contact: 0.22, dist: 0.42, recover: 0.22, dmg: 1.15, ru: 'Колено' },
  lowkick: { clip: 'r_lowkick', contact: 0.22, dist: 0.62, recover: 0.2, dmg: 1.0, ru: 'Низкий кик' },
  stomp: { clip: 'r_stomp', contact: 0.3, dist: 0.5, recover: 0.3, dmg: 1.3, ru: 'Стопой' },
  finisher: { clip: 'r_finisher', contact: 0.46, dist: 0.74, recover: 0.5, dmg: 2.2, ru: 'Добивание' },
};

export const COMBAT = {
  reach: 3.2,            // farthest target J/K will dash to (m, root-to-root)
  cone: 75,              // deg: auto-target cone in front of Rusana (or camera)
  dashSpeed: 7.5,        // m/s anime dash-in
  lungeMax: 0.45,        // in-strike magnet (m)
  magnet: 0.8,
  distOk: 0.06, distZero: 0.42, angOk: 25, angZero: 120,
  openBonus: 0.2, rhythmBonus: 0.12, rhythmWin: [0.18, 0.75], dashPenalty: 0.05,
  grade: { perfect: 1.0, clean: 0.55, glance: 0.25 }, perfectAcc: 0.95,
  guardBlock: 0.55,
  dmg: { perfect: 24, clean: 16, glance: 6, block: 2, miss: 0 },
  kneeGuardBreak: 0.55,  // chance a knee drives through a guard (clinch) instead of being blocked
  seriesWindow: 1.8, seriesStep: 0.15,
  decay: 3.0, decayDelay: 1.4,
  pain: { flinch: 10, double_over: 34, knees: 62, floor: 95 },
  hitStop: 0.07, hitStopPerfect: 0.11,
  witchTime: 1.6,        // s of slow-mo after a perfect dodge
  comboWindow: 1.6,      // s to keep the combo counter alive
};

export const TRAITS = {
  cocky:  { ru: 'наглый', tough: 1.0,  react: 0.25, guard: 0.15, dodge: 0.1, flee: 0,   taunt: 0.5, attack: 0.25, speed: 1.0,
    lines: ['Ну давай, малышка!', 'Попробуй ещё', 'Ха, мимо!', 'Это всё, что умеешь?'] },
  coward: { ru: 'трус',   tough: 1.1,  react: 0.5,  guard: 0.5,  dodge: 0.3, flee: 0.5, taunt: 0.05, attack: 0, speed: 1.25,
    lines: ['Не надо!', 'Отстань от меня!', 'Я просто мимо шёл!'] },
  jock:   { ru: 'качок',  tough: 1.6,  react: 0.3,  guard: 0.3,  dodge: 0.05, flee: 0,  taunt: 0.3, attack: 0.35, speed: 0.95,
    lines: ['Не больно', 'Слабовато', 'Давай сильнее, крошка'] },
  angry:  { ru: 'злой',   tough: 1.15, react: 0.35, guard: 0.25, dodge: 0.1, flee: 0,   taunt: 0.15, attack: 0.6, speed: 1.1,
    lines: ['Ну всё, тебе конец!', 'Отвали!', 'Сейчас получишь!'] },
  runner: { ru: 'беглец', tough: 1.0,  react: 0.45, guard: 0.15, dodge: 0.45, flee: 0.5, taunt: 0.2, attack: 0.05, speed: 1.5,
    lines: ['Не догонишь!', 'Лови, если сможешь', 'Ха-ха!'] },
};

// Characters. base: which VRM; tint: recolour map for this NPC (material regex -> hex); scale: height factor.
export const GUYS = [
  { id: 'dima',   name: 'Дима',  age: 22, trait: 'cocky',  base: 'guy_b', scale: 1.0,  hair: 0x6b4a2e, tint: { Tops: 0x3b7be0, Bottoms: 0x2a2f3a },
    area: 'street', intro: 'Дима: «Эй, малышка, скучаешь? Могу показать район».',
    win: 'Дима свернулся калачиком на асфальте и хлопает ладонью. Больше не подкатывает.' },
  { id: 'artem',  name: 'Артём', age: 21, trait: 'coward', base: 'guy_b', scale: 0.98, hair: 0x2a2a30, tint: { Tops: 0x9bd4b4, Bottoms: 0x5a4a3a },
    area: 'park', intro: 'Артём: «Я… я вообще-то просто гуляю…»',
    win: 'Артём стоит на коленях у фонтана, прижимая руки к паху, и сдаётся.' },
  { id: 'maks',   name: 'Макс',  age: 24, trait: 'angry',  base: 'guy_a', scale: 1.04, hair: 0xd8c27a, tint: { Tops: 0x5a1d1d, Bottoms: 0x34405a },
    area: 'club', intro: 'Макс: «Это мой район. Иди отсюда, пока цела».',
    win: 'Макс, «хозяин района», лежит пластом у входа в клуб и тапает.' },
  { id: 'stas',   name: 'Стас',  age: 23, trait: 'jock',   base: 'guy_a', scale: 1.06, hair: 0x1c1c22, tint: { Tops: 0x3f5a2a, Bottoms: 0x8a7a58 },
    area: 'park', intro: 'Стас: «Я пресс качаю каждый день. Мне ничего не будет».',
    win: 'Стас, весь такой накачанный, скрючился на баскетбольной площадке.' },
  { id: 'lyokha', name: 'Лёха',  age: 21, trait: 'runner', base: 'guy_b', scale: 1.0,  hair: 0xc9622a, tint: { Tops: 0xe0b12a, Bottoms: 0x23262e },
    area: 'street', intro: 'Лёха: «Сначала догони!»',
    win: 'Лёха больше никуда не бежит — лежит и хлопает по асфальту.' },
  { id: 'kirill', name: 'Кирилл', age: 25, trait: 'cocky', base: 'guy_a', scale: 1.02, hair: 0x8a8f9a, tint: { Tops: 0x2c3e6b, Bottoms: 0x8e8e9c },
    area: 'roof', intro: 'Кирилл: «На крыше мои правила, красотка».',
    win: 'Кирилл лежит у края крыши и тапает. Вид отсюда теперь твой.' },
];

export const STATE_RU = { idle: 'стоит', flinch: 'вздрогнул', double_over: 'согнулся', knees: 'на коленях', floor: 'на полу', tap: 'сдался' };
export const GRADE_RU = { perfect: 'ИДЕАЛЬНО!', clean: 'ЧИСТО!', glance: 'Скользом', miss: 'Мимо', block: 'Блок' };
export const RANKS = [
  [0, 'Новенькая'], [40, 'Гроза двора'], [100, 'Уличная легенда'], [180, 'Королева района'],
];
