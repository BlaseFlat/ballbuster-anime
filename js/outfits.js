// Rusana's outfits + wallet. Clothing is painted into the Body texture (VRoid style); a region mask
// (assets/outfits/rusana_mask.png: R = top, G = shorts, B = trim) lets us re-dye it at runtime without new meshes.
// Future shop: list OUTFITS, buy(id) spends money, equip(id) re-dyes. Mesh-based outfits can later add
// `vrm: 'outfits/xxx.vrm'` and swap the whole body — the save format already stores just the id.
import * as THREE from 'three';
import { asset } from './config.js';

export const OUTFITS = [
  { id: 'street', ru: 'Уличный боец', price: 0, top: 0x701428, bottom: 0x18171c, trim: 0x701428, desc: 'Бордовый топ и чёрные велошорты. Классика.' },
  { id: 'neon', ru: 'Неон', price: 250, top: 0x16141f, bottom: 0x16141f, trim: 0xff3f8e, glow: true, desc: 'Чёрный комплект с неоново-розовой окантовкой.' },
  { id: 'sport', ru: 'Спортзал', price: 200, top: 0xf2f0ec, bottom: 0x2b4fa8, trim: 0xf2f0ec, desc: 'Белый спортивный топ, синие шорты.' },
  { id: 'sakura', ru: 'Сакура', price: 300, top: 0xf5a9c4, bottom: 0xf2f0ec, trim: 0xd24b7c, desc: 'Нежно-розовый топ и белые шорты.' },
  { id: 'military', ru: 'Хаки', price: 350, top: 0x5b6440, bottom: 0x3a3d2c, trim: 0x1e1f18, desc: 'Оливковый топ, тёмные шорты.' },
  { id: 'gold', ru: 'Чемпионка', price: 800, top: 0x1c1a20, bottom: 0x1c1a20, trim: 0xe0b23a, desc: 'Чёрное с золотом — для королевы района.' },
];

// ---------- wallet / save ----------
const KEY = 'bba-save-v1';
export const save = (() => {
  let s = { money: 0, owned: ['street'], outfit: 'street', wins: 0 };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  return {
    get money() { return s.money; }, get owned() { return s.owned.slice(); }, get outfit() { return s.outfit; }, get wins() { return s.wins; },
    earn(n) { s.money += Math.round(n); write(); return s.money; },
    win() { s.wins++; write(); },
    buy(id) { const o = OUTFITS.find((x) => x.id === id); if (!o || s.owned.includes(id) || s.money < o.price) return false; s.money -= o.price; s.owned.push(id); write(); return true; },
    setOutfit(id) { if (!s.owned.includes(id)) return false; s.outfit = id; write(); return true; },
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

export async function applyOutfit(vrm, id) {
  const o = OUTFITS.find((x) => x.id === id) || OUTFITS[0];
  const mask = await loadMask(); const cache = new Map();
  const mats = []; vrm.scene.traverse((ob) => { if (ob.isMesh) for (const mt of [].concat(ob.material)) if (/Body_00/.test(mt.name)) mats.push(mt); });
  for (const mt of mats) {
    for (const slot of ['map', 'shadeMultiplyTexture']) {
      if (!mt[slot] && !origMaps.get(mt)?.[slot]) continue;
      const om = origMaps.get(mt) || {}; if (!om[slot]) om[slot] = mt[slot]; origMaps.set(mt, om);
      const src = om[slot];
      if (o.id === 'street') { mt[slot] = src; continue; }
      if (!cache.has(src)) cache.set(src, dyeTexture(src, o, mask));
      mt[slot] = await cache.get(src);
    }
    mt.needsUpdate = true;
  }
  return o;
}
