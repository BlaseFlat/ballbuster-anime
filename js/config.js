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
  kick:      { clip: 'r_kick',       contact: 0.25, dist: 0.74, recover: 0.22, dmg: 1.0,  ru: 'Ап-кик' },
  knee:      { clip: 'r_knee',       contact: 0.22, dist: 0.42, recover: 0.22, dmg: 1.15, ru: 'Колено' },
  roundhouse:{ clip: 'r_roundhouse', contact: 0.30, dist: 0.92, recover: 0.30, dmg: 1.05, ru: 'Круговой' },
  axe:       { clip: 'r_axe',        contact: 0.34, dist: 0.68, recover: 0.34, dmg: 1.2,  ru: 'Топор' },
  jumpknee:  { clip: 'r_jumpknee',   contact: 0.24, dist: 0.55, recover: 0.28, dmg: 1.25, ru: 'Прыжок-колено' },
  heel:      { clip: 'r_heel',       contact: 0.28, dist: 0.80, recover: 0.26, dmg: 1.1,  ru: 'Каблук' },
  lowkick:   { clip: 'r_lowkick',    contact: 0.22, dist: 0.62, recover: 0.2,  dmg: 1.0,  ru: 'Низкий кик' },
  stomp:     { clip: 'r_stomp',      contact: 0.3,  dist: 0.5,  recover: 0.3,  dmg: 1.3,  ru: 'Стопой' },
  finisher:  { clip: 'r_finisher',   contact: 0.46, dist: 0.74, recover: 0.5,  dmg: 2.2,  ru: 'Добивание' },
};

// Shop-buyable standing moves (loadout slots J / K / U). Contextual lowkick/stomp/finisher always free.
export const MOVES = [
  { id: 'kick',       ru: 'Ап-кик',        style: 'Быстрый · средний',     price: 0,   rank: 0, desc: 'Классика. Быстрый ап-кик в пах. Стартовый приём.' },
  { id: 'knee',       ru: 'Колено',         style: 'Клинч · мощный',        price: 0,   rank: 0, desc: 'Вплотную. Чуть сильнее, узкое окно.' },
  { id: 'heel',       ru: 'Каблук',         style: 'Дальний · точный',      price: 120, rank: 0, desc: 'Удар каблуком с дистанции. Чуть длиннее замах.' },
  { id: 'roundhouse', ru: 'Круговой',       style: 'Дальний · шире угол',   price: 160, rank: 0, desc: 'Круговой в пах. Достаёт издалека, прощает угол, дольше контакт.' },
  { id: 'jumpknee',   ru: 'Прыжок-колено',  style: 'Рывок · высокий урон',  price: 200, rank: 1, desc: 'Подскок и колено. Сильнее, но заметный замах.' },
  { id: 'axe',        ru: 'Топор',          style: 'Риск · максимальный',   price: 260, rank: 1, desc: 'Рубящий сверху вниз. Долгий замах — легко словить блок, но бьёт жёстко.' },
];
export const moveById = (id) => MOVES.find((m) => m.id === id) || MOVES[0];
export const LOADOUT_KEYS = ['KeyJ', 'KeyK', 'KeyU']; // 3 slots
export const LOADOUT_LABELS = ['J', 'K', 'U'];


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
  // Realistic one-shot feel: perfect/clean to the groin ENDS the fight. Glance/block barely sting.
  dmg: { perfect: 110, clean: 78, glance: 3, block: 1, miss: 0 },
  kneeGuardBreak: 0.7,   // knee in clinch more often drives through a guard
  seriesWindow: 1.2, seriesStep: 0.05,  // spam chain barely helps — precision matters, not farm
  decay: 10.0, decayDelay: 0.55,       // glances fade fast; no farming KO off weak hits
  pain: { flinch: 6, double_over: 45, knees: 70, floor: 95 },
  hitStop: 0.08, hitStopPerfect: 0.16,
  witchTime: 1.6,
  comboWindow: 1.6,
  dropPerfect: true,     // perfect → floor, no get-up
  dropClean: true,       // clean → knees → floor → tap, no standing recovery
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
  { id: 'maks',   name: 'Макс',  age: 24, trait: 'angry',  base: 'guy_a', scale: 1.04, hair: 0xd8c27a, tint: { Tops: 0x5a1d1d }, hide: 'Bottoms',
    area: 'club', intro: 'Макс: «Это мой район. Иди отсюда, пока цела».',
    win: 'Макс, «хозяин района», лежит пластом у входа в клуб и тапает.' },
  { id: 'stas',   name: 'Стас',  age: 23, trait: 'jock',   base: 'guy_a', scale: 1.06, hair: 0x1c1c22, tint: { Tops: 0x3f5a2a }, hide: 'Bottoms',
    area: 'park', intro: 'Стас: «Я пресс качаю каждый день. Мне ничего не будет».',
    win: 'Стас, весь такой накачанный, скрючился на баскетбольной площадке.' },
  { id: 'lyokha', name: 'Лёха',  age: 21, trait: 'runner', base: 'guy_b', scale: 1.0,  hair: 0xc9622a, tint: { Tops: 0xe0b12a, Bottoms: 0x23262e },
    area: 'street', intro: 'Лёха: «Сначала догони!»',
    win: 'Лёха больше никуда не бежит — лежит и хлопает по асфальту.' },
  { id: 'kirill', name: 'Кирилл', age: 25, trait: 'cocky', base: 'guy_a', scale: 1.02, hair: 0x8a8f9a, tint: { Tops: 0x2c3e6b }, hide: 'Bottoms',
    area: 'roof', intro: 'Кирилл: «На крыше мои правила, красотка».',
    win: 'Кирилл лежит у края крыши и тапает. Вид отсюда теперь твой.' },
];

export const STATE_RU = { idle: 'стоит', flinch: 'вздрогнул', double_over: 'согнулся', knees: 'на коленях', floor: 'на полу', tap: 'сдался' };
export const GRADE_RU = { perfect: 'ИДЕАЛЬНО!', clean: 'ЧИСТО!', glance: 'Скользом', miss: 'Мимо', block: 'Блок' };
export const RANKS = [
  [0, 'Новенькая'], [40, 'Гроза двора'], [100, 'Уличная легенда'], [180, 'Королева района'],
];

// Mira — подруга на районе (HairSample_Female, CC0). Квесты — вертикальный срез.
export const MIRA = {
  name: 'Мира', age: 22,
  pos: [-6.5, 0, 3.2], yaw: Math.PI * 0.85,   // южный тротуар у «Шёлка», лицом к улице
  hair: 0x3a1a55, tint: { Tops: 0x2ec4b6, Shoes: 0xf2e6d8 },
  greet: [
    'Мира: «Русана! Наконец-то. Этот район совсем одичал — парни клеятся к каждой».',
    'Мира: «Я рядом. Если что — зови. Или ударь, ты же умеешь».',
  ],
  chat: [
    'Мира: «Один точный ап-кик — и он уже не встаёт. Не надо молотить воздух».',
    'Мира: «В «Шёлке» загляни — тебе пойдёт что-нибудь дерзкое».',
    'Мира: «Я в порядке. Главное — не давай им подниматься».',
    'Мира: «У клуба «Неон» Макс строит из себя хозяина. Навестим — потом».',
    'Мира: «Если держу ему руки — бей сразу. Не стесняйся».',
  ],
  // Area story beats shown once when Rusana enters (after meeting Mira)
  plot: {
    street: 'Мира шепчет: «Торговая — наша. Парни здесь уже знают твоё имя».',
    park: 'Мира: «Во дворе двое трусов и один качок. Не дай Стасу геройствовать».',
    club: 'Мира: ««Неон». Макс ждёт у входа. Один идеальный — и легенда рухнет».',
    roof: 'Мира (по рации): «Крыша Кирилла. Не подходи к краю… ну, кроме него».',
  },
  quests: [
    { id: 'precision', ru: 'Точный удар', goal: 1, desc: 'Свали одного парня идеальным ударом в пах.',
      done: 'Мира: «Вот это да… Он даже не встал. Так их».', reward: 60 },
    { id: 'silk', ru: 'Шёлковый дебют', goal: 1, desc: 'Купи любой наряд в бутике «Шёлк».',
      done: 'Мира: «Ого. Тебе идёт. Парни будут отвлекаться — пользуйся».', reward: 40 },
    { id: 'cleanup', ru: 'Зачистка двора', goal: 3, desc: 'Приучи троих парней (сдались).',
      done: 'Мира: «Трое за вечер. Район уже шушукается. Горжусь».', reward: 120 },
    { id: 'teamwork', ru: 'В четыре руки', goal: 1, desc: 'Позови Миру держать (R) и добей парня, пока она держит.',
      done: 'Мира: «Видела? Вместе мы — закон. Ещё раз позовёшь — прибегу».', reward: 80 },
    { id: 'neon_king', ru: 'Хозяин «Неона»', goal: 1, desc: 'Зайди к клубу «Неон» и приучи Макса.',
      done: 'Мира: «Макс на асфальте. Клуб теперь кивает тебе, не ему».', reward: 100 },
  ],
};
