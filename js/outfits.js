// Rusana's outfits + wallet. Clothing is painted into the Body texture (VRoid style); a region mask
// (assets/outfits/rusana_mask.png: R = top, G = shorts, B = trim) lets us re-dye it at runtime without new meshes.
// Future shop: list OUTFITS, buy(id) spends money, equip(id) re-dyes. Mesh-based outfits can later add
// `vrm: 'outfits/xxx.vrm'` and swap the whole body — the save format already stores just the id.
import * as THREE from 'three';
import { asset, RANKS, MIRA } from './config.js';
import { recolorTexture } from './chars.js';

// Wardrobe. Two kinds of looks:
//  * `dye`: the default painted top/shorts re-dyed through a region mask (cheap recolours)
//  * `tex`: a full Body texture painted offline by tools/outfits/paint_outfits.py (bandeau, bodycon, catsuit, ...)
//    plus optional real cloth meshes kept in rusana.vrm (B's varsity jacket, full or cropped, and the spring-bone
//    pleated skirt), glossy latex/leather via MToon matcap × gloss mask, shoe tint and a "Figure" morph weight
//    (fuller bust/hips/glutes — only on the figure-hugging outfits).
// rank = index into RANKS (unlocked by best-ever reputation).
export const OUTFITS = [
  { id: 'street', ru: 'Уличный боец', style: 'Бордовый топ и велошорты', price: 0, rank: 0, dye: null,
    desc: 'Её фирменный комплект: бордовый топ, чёрные велошорты, чокер.' },
  { id: 'neon', ru: 'Неон', style: 'Перекрас · чёрный с неоном', price: 100, rank: 0, dye: { top: 0x16141f, bottom: 0x16141f, trim: 0xff3f8e }, shoes: 0x222026,
    desc: 'Тот же крой в чёрном с кислотно-розовой окантовкой — для ночных улиц.' },
  { id: 'fitness', ru: 'Фитнес', style: 'Спортивный топ + облегающие леггинсы', price: 140, rank: 0, tex: 'fitness', shoes: 0xf2f2f2, figure: 0.55,
    desc: 'Короткий спортивный топ и леггинсы в обтяжку с бирюзовыми лампасами. Подчёркивает каждый изгиб.' },
  { id: 'bandeau', ru: 'Бандо', style: 'Топ-бандо + джинсовые микрошорты', price: 180, rank: 0, tex: 'bandeau', shoes: 0xfbe2ea, figure: 0.3,
    desc: 'Белый топ-бандо и крошечные джинсовые шорты с бахромой. Летний вайб.' },
  { id: 'varsity', ru: 'Варсити', style: 'Кроп-бомбер + плиссированная мини', price: 220, rank: 0, tex: 'varsity', jacket: 'crop', skirt: true, shoes: 0x2a2438,
    desc: 'Укороченный бомбер поверх топа-трубы, розовая плиссе-мини и гольфы.' },
  { id: 'fishnet', ru: 'Сетка', style: 'Кожаные микрошорты + сетка', price: 260, rank: 1, tex: 'fishnet_street', gloss: 0.6, shoes: 0x141217, figure: 0.2,
    desc: 'Кожаные микрошорты с ремнём, колготки-сетка и кроп на тонких бретелях.' },
  { id: 'beach', ru: 'Пляж', style: 'Бикини', price: 280, rank: 0, tex: 'beach', shoes: 0xfff1e6, figure: 0.5, tie: 0xff5d8f,
    desc: 'Ярко-розовое бикини на завязках. Пляж где-то рядом, наверное.' },
  { id: 'bodycon', ru: 'Мини-платье', style: 'Платье-бандо по фигуре', price: 340, rank: 1, tex: 'bodycon', gloss: 0.45, skirt: 0xc8102e, shoes: 0xc8102e, figure: 0.85,
    desc: 'Красное платье-бандо: лиф в обтяжку с драпировкой, тонкий пояс и короткая юбка. Фигура — главный аргумент.' },
  { id: 'biker', ru: 'Байкерша', style: 'Кожаный халтер + шорты + ботфорты', price: 380, rank: 1, tex: 'biker', gloss: 0.8, shoes: 0x151213, figure: 0.3,
    desc: 'Кожаный топ-халтер на молнии, шорты с ремнём и высокие сапоги.' },
  { id: 'corset', ru: 'Корсет', style: 'Корсет + мини + чулки', price: 420, rank: 2, tex: 'corset', gloss: 0.5, skirt: 0x1b1820, shoes: 0x151116, figure: 0.7,
    desc: 'Винный корсет со шнуровкой, чёрная мини-юбка и чулки с кружевом.' },
  { id: 'latex', ru: 'Латекс', style: 'Глянцевый кэтсьют', price: 520, rank: 2, tex: 'latex', gloss: 1.0, shoes: 0x0d0c10, figure: 1.0,
    desc: 'Чёрный латексный комбинезон с молнией. Блестит, скрипит, сидит как вторая кожа.' },
  { id: 'champion', ru: 'Чемпионка', style: 'Боди с высоким вырезом + ботфорты', price: 650, rank: 3, tex: 'champion', gloss: 1.0, shoes: 0x121015, figure: 1.0,
    desc: 'Чёрно-золотое глянцевое боди, длинные перчатки и сапоги выше колена. Для королевы района.' },
];
// ids from v1 saves (recolour-era) -> current outfits
const ALIAS = { sport: 'fitness', sakura: 'beach', military: 'biker', gold: 'champion', fishnet_street: 'fishnet' };
export const outfitById = (id) => OUTFITS.find((o) => o.id === (ALIAS[id] || id)) || OUTFITS[0];

// ---------- wallet / save ----------
const KEY = 'bba-save-v1';
export const save = (() => {
  let s = { money: 0, owned: ['street'], outfit: 'street', wins: 0, fame: 0, miraMet: false, quests: {}, claimed: {} };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  // migrate v1 ids
  s.owned = [...new Set(['street', ...(s.owned || []).map((id) => outfitById(id).id)])]; s.outfit = outfitById(s.outfit).id;
  if (!s.owned.includes(s.outfit)) s.outfit = 'street';
  s.quests = s.quests || {}; s.claimed = s.claimed || {}; s.miraMet = !!s.miraMet;
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  write();
  return {
    get money() { return s.money; }, get owned() { return s.owned.slice(); }, get outfit() { return s.outfit; }, get wins() { return s.wins; }, get fame() { return s.fame || 0; },
    earn(n) { s.money += Math.round(n); write(); return s.money; },
    win() { s.wins++; write(); },
    fameUp(rep) { if (rep > (s.fame || 0)) { s.fame = Math.round(rep); write(); } },
    rankIdx() { let r = 0; RANKS.forEach(([v], i) => { if ((s.fame || 0) >= v) r = i; }); return r; },
    has(id) { return s.owned.includes(outfitById(id).id); },
    locked(id) { return outfitById(id).rank > this.rankIdx(); },
    buy(id) { const o = outfitById(id); if (s.owned.includes(o.id) || s.money < o.price || this.locked(o.id)) return false; s.money -= o.price; s.owned.push(o.id); write(); return true; },
    setOutfit(id) { const o = outfitById(id); if (!s.owned.includes(o.id)) return false; s.outfit = o.id; write(); return true; },
    miraMeet() { s.miraMet = true; write(); },
    get miraMet() { return !!s.miraMet; },
    questProg(id) { return s.quests[id] || 0; },
    questAdd(id, n = 1) {
      const q = MIRA.quests.find((x) => x.id === id); if (!q) return;
      const prev = s.quests[id] || 0; if (prev >= q.goal) return;
      s.quests[id] = Math.min(q.goal, prev + n); write();
    },
    questClaimed(id) { return !!s.claimed[id]; },
    claimQuest(id) {
      const q = MIRA.quests.find((x) => x.id === id);
      if (!q || s.claimed[id] || (s.quests[id] || 0) < q.goal) return false;
      s.claimed[id] = true; s.money += q.reward; write(); return true;
    },
  };
})();

// ---------- re-dye ----------
let maskP = null;
const loadMask = () => maskP || (maskP = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = asset('outfits/rusana_mask.png'); }));
const origMaps = new WeakMap();
const lumOf = (d, i) => (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;

async function dyeTexture(tex, o, mask) {
  const img = tex.image, W = img.width, H = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0); const id = g.getImageData(0, 0, W, H), d = id.data;
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H; const mg = mc.getContext('2d', { willReadFrequently: true });
  mg.imageSmoothingEnabled = false; mg.drawImage(mask, 0, 0, W, H); const m = mg.getImageData(0, 0, W, H).data;
  // mean luminance per region (so shading is kept relative to the original dye)
  const sum = [0, 0, 0], cnt = [0, 0, 0];
  for (let i = 0; i < d.length; i += 16) for (let c = 0; c < 3; c++) if (m[i + c] > 127) { sum[c] += lumOf(d, i); cnt[c]++; }
  const mean = sum.map((s, c) => Math.max(0.02, s / Math.max(1, cnt[c])));
  const cols = [o.top, o.bottom, o.trim].map((h) => new THREE.Color(h).convertLinearToSRGB());
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      if (m[i + c] <= 127) continue;
      const k = Math.max(0.55, Math.min(1.35, lumOf(d, i) / mean[c])), col = cols[c];
      d[i] = Math.min(255, col.r * 255 * k); d[i + 1] = Math.min(255, col.g * 255 * k); d[i + 2] = Math.min(255, col.b * 255 * k);
      break;
    }
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

// ---------- apply ----------
const texLoader = new THREE.TextureLoader();
const texP = new Map();
function loadTex(file, srgb) {
  if (!texP.has(file)) texP.set(file, new Promise((res, rej) => texLoader.load(asset('outfits/' + file), (t) => {
    t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; res(t);
  }, undefined, rej)));
  return texP.get(file);
}
export const preloadOutfit = (id) => { const o = outfitById(id); if (o.tex) { loadTex(o.tex + '.jpg', true).catch(() => {}); if (o.gloss) loadTex(o.tex + '_gloss.png', false).catch(() => {}); } };
// glossy highlight sphere for latex/leather (added to the rim term, masked by the gloss texture)
let matcap = null;
function glossMatcap() {
  if (matcap) return matcap;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const spot = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.45, `rgba(235,240,255,${a * 0.45})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); };
  spot(S * 0.36, S * 0.3, S * 0.2, 0.95); spot(S * 0.66, S * 0.2, S * 0.1, 0.6);
  const rim = g.createRadialGradient(S / 2, S / 2, S * 0.38, S / 2, S / 2, S * 0.5); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(170,185,230,0.55)');
  g.fillStyle = rim; g.fillRect(0, 0, S, S);
  matcap = new THREE.CanvasTexture(cv); matcap.colorSpace = THREE.SRGBColorSpace; return matcap;
}
const orig = new WeakMap();   // material -> original texture slots / colours
const snap = (mt) => { if (!orig.has(mt)) orig.set(mt, { map: mt.map, shadeMultiplyTexture: mt.shadeMultiplyTexture, normalMap: mt.normalMap, matcapTexture: mt.matcapTexture, rimMultiplyTexture: mt.rimMultiplyTexture, rim: mt.parametricRimColorFactor?.clone(), matcapFactor: mt.matcapFactor?.clone() }); return orig.get(mt); };

let applySeq = 0;
export async function applyOutfit(vrm, id) {
  const o = outfitById(id), seq = ++applySeq;
  const mats = [], meshes = []; const seen = new Set();
  vrm.scene.traverse((ob) => { if (!ob.isMesh) return; meshes.push(ob); for (const mt of [].concat(ob.material)) if (!seen.has(mt)) { seen.add(mt); mats.push(mt); } });
  // resolve textures first (so the swap is atomic — no half-dressed frame)
  const [bodyTex, glossTex, mask] = await Promise.all([
    o.tex ? loadTex(o.tex + '.jpg', true) : null, o.gloss ? loadTex(o.tex + '_gloss.png', false) : null, o.dye ? loadMask() : null]);
  const dyed = new Map();
  if (o.dye) for (const mt of mats) if (/Body_00/.test(mt.name)) for (const slot of ['map', 'shadeMultiplyTexture']) {
    const src = snap(mt)[slot]; if (src && !dyed.has(src)) dyed.set(src, await dyeTexture(src, o.dye, mask));
  }
  if (seq !== applySeq) return o;   // a newer try-on superseded this one
  for (const mt of mats) {
    const n = mt.name, os = snap(mt);
    if (/Body_00/.test(n)) {
      mt.map = bodyTex || dyed.get(os.map) || os.map; mt.shadeMultiplyTexture = bodyTex || dyed.get(os.shadeMultiplyTexture) || os.shadeMultiplyTexture;
      mt.normalMap = bodyTex ? null : os.normalMap;
      if (glossTex) {
        mt.matcapTexture = glossMatcap(); mt.matcapFactor?.setScalar(0.85 * o.gloss); mt.rimMultiplyTexture = glossTex;
        if (os.rim) mt.parametricRimColorFactor.copy(os.rim).multiplyScalar(2.2);
      } else {
        mt.matcapTexture = os.matcapTexture; if (os.matcapFactor) mt.matcapFactor.copy(os.matcapFactor); mt.rimMultiplyTexture = os.rimMultiplyTexture; if (os.rim) mt.parametricRimColorFactor.copy(os.rim);
      }
    } else if (/Tops_01_CLOTH_Low/.test(n)) mt.visible = o.jacket === 'full';
    else if (/Tops_01_CLOTH/.test(n)) mt.visible = !!o.jacket;
    else if (/Bottoms_01_CLOTH/.test(n)) {
      mt.visible = !!o.skirt;
      if (o.skirt) { const t = (src) => (src && o.skirt !== true ? recolorTexture(src, o.skirt, { strength: 0.9 }) : src); mt.map = t(os.map); mt.shadeMultiplyTexture = t(os.shadeMultiplyTexture); }
    } else if (/Shoes_01_CLOTH/.test(n)) {
      mt.map = o.shoes ? recolorTexture(os.map, o.shoes, { strength: 0.85 }) : os.map;
      mt.shadeMultiplyTexture = o.shoes && os.shadeMultiplyTexture ? recolorTexture(os.shadeMultiplyTexture, o.shoes, { strength: 0.85 }) : os.shadeMultiplyTexture;
    } else continue;
    mt.needsUpdate = true;
  }
  // body shape: fuller figure for the hugging outfits
  for (const m of meshes) { const k = m.morphTargetDictionary?.Figure; if (k !== undefined) m.morphTargetInfluences[k] = o.figure || 0; }
  vrm.userData = vrm.userData || {}; vrm.userData.outfit = o.id;
  return o;
}
