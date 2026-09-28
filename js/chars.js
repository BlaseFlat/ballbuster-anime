// VRM characters: loading (one fetch per file, parsed per instance), material look, per-NPC recolour, animation actor.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { makeClip } from './clips.js';

const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p));
const bufCache = new Map();
export async function fetchVRM(url, onProgress) {
  if (!bufCache.has(url)) bufCache.set(url, (async () => {
    const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    const total = +r.headers.get('content-length') || 0; const reader = r.body.getReader(); const chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress && onProgress(got, total); }
    const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out.buffer;
  })());
  return bufCache.get(url);
}
export async function parseVRM(buf) {
  const gltf = await loader.parseAsync(buf.slice(0), '');
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; } });
  return vrm;
}

// ---- colour helpers ----
const _c = new THREE.Color(); const _v = new THREE.Vector3();
function imgToCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return [c, g];
}
// colourise a texture: keep luminance structure, map to the target colour (dark->shadow, light->highlight)
const texCache = new Map();
export function recolorTexture(tex, hex, { strength = 1, keepSat = 0, mask = null } = {}) {
  const key = tex.uuid + ':' + hex.toString(16) + ':' + strength + ':' + (mask || '');
  if (texCache.has(key)) return texCache.get(key);
  const img = tex.image; if (!img || !img.width) return tex;
  const [cv, g] = imgToCanvas(img); const id = g.getImageData(0, 0, cv.width, cv.height); const d = id.data;
  _c.setHex(hex); const tr = _c.r, tg = _c.g, tb = _c.b;
  const tl = 0.3 * tr + 0.59 * tg + 0.11 * tb + 1e-3;
  // reference luminance of the source: median-ish of opaque pixels
  let sum = 0, cnt = 0; for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 20) { sum += (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255; cnt++; }
  const ref = Math.max(0.05, sum / Math.max(1, cnt));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 4) continue;
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx > 0 ? (mx - mn) / mx : 0;
    if (mask === 'lowsat' && sat > 0.35) continue;          // keep coloured details (logos, zips)
    if (mask === 'light' && l < 0.18) continue;              // keep near-black parts
    const k = l / ref;                                        // relative brightness
    let nr = Math.min(1, tr * k), ng = Math.min(1, tg * k), nb = Math.min(1, tb * k);
    if (k > 1) { const s = Math.min(1, (k - 1) * 0.6); nr += (1 - nr) * s * 0.5; ng += (1 - ng) * s * 0.5; nb += (1 - nb) * s * 0.5; }
    const w = strength;
    d[i] = 255 * (r + (nr - r) * w); d[i + 1] = 255 * (gg + (ng - gg) * w); d[i + 2] = 255 * (b + (nb - b) * w);
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  t.anisotropy = 4; t.needsUpdate = true;
  texCache.set(key, t); return t;
}
function recolorMat(m, hex, opts) {
  if (m.map) m.map = recolorTexture(m.map, hex, opts);
  if (m.shadeMultiplyTexture) m.shadeMultiplyTexture = recolorTexture(m.shadeMultiplyTexture, hex, opts);
  m.needsUpdate = true;
}

// Style pass for every VRM material (MToon): softer shade, anime rim, consistent outline, shadows.
export function stylize(vrm, { rimColor = 0xffe6d0, outline = 1.0 } = {}) {
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m.isMToonMaterial) continue;
      if (m.parametricRimColorFactor && !/EYE|FACE_|Brow|Lash|Line|Mouth/i.test(m.name)) {
        m.parametricRimColorFactor.setHex(rimColor).multiplyScalar(0.28);
        m.parametricRimFresnelPowerFactor = 4.0; m.parametricRimLiftFactor = 0.05;
      }
      if (m.outlineWidthFactor !== undefined && m.isOutline) m.outlineWidthFactor *= outline;
      m.shadingToonyFactor = Math.max(m.shadingToonyFactor ?? 0.9, 0.9);
    }
  });
}

export function tint(vrm, def) {
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material).map((m) => {
      let hex = null, opts = {};
      if (/HAIR/i.test(m.name) && def.hair !== undefined) { hex = def.hair; opts = { strength: 1 }; }
      for (const k in (def.tint || {})) if (m.name.includes(k)) { hex = def.tint[k]; opts = { strength: 0.9, mask: k === 'Tops' && def.base === 'guy_a' ? 'lowsat' : null }; }
      if (hex === null) return m;
      const c = m.clone(); recolorMat(c, hex, opts); return c;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
}

// Animated character: mixer, crossfades, expression helper, look-at, spring bones.
export class Actor {
  constructor(vrm, clipData, { prefix, scale = 1 } = {}) {
    this.vrm = vrm; this.root = new THREE.Group(); this.root.add(vrm.scene);
    vrm.scene.scale.setScalar(scale); this.scale = scale;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.clips = {}; this.actions = {};
    for (const [name, data] of Object.entries(clipData)) {
      if (prefix && !name.startsWith(prefix)) continue;
      const short = prefix ? name.slice(prefix.length) : name;
      const clip = makeClip(vrm, short, data); this.clips[short] = clip;
      const a = this.mixer.clipAction(clip); a.setLoop(data.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
      this.actions[short] = a;
    }
    this.cur = null; this.curName = ''; this.expr = {}; this.exprTarget = {};
    this.blinkT = 2 + Math.random() * 3; this.yaw = 0; this.speedScale = 1;
    // ground contact: joints that may touch the floor and their clearance (m, unscaled)
    const h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
    const y0 = (b) => { const n = h.getNormalizedBoneNode(b); return n ? n.getWorldPosition(new THREE.Vector3()).y / scale : 0; };
    this.ground = [];
    for (const [b, c] of [['leftFoot', null], ['rightFoot', null], ['leftToes', null], ['rightToes', null], ['leftLowerLeg', 0.06], ['rightLowerLeg', 0.06],
      ['hips', 0.1], ['head', 0.1], ['leftHand', 0.03], ['rightHand', 0.03], ['chest', 0.11], ['leftUpperArm', 0.05], ['rightUpperArm', 0.05]]) {
      const n = h.getNormalizedBoneNode(b); if (n) this.ground.push([n, c === null ? y0(b) : c]);
    }
    this.groundOff = 0; this.groundFix = true;
  }
  fixGround(dt) {
    const s = this.vrm.scene; s.position.y = 0; s.updateMatrixWorld(true);
    const baseY = this.root.getWorldPosition(_v).y; let need = -1e9;
    for (const [n, c] of this.ground) { const y = n.getWorldPosition(_v).y - baseY; need = Math.max(need, c * this.scale - y); }
    // allow feet to leave the ground (kicks/jumps) but never sink below it; pull down when floating (both feet high)
    const target = need;
    this.groundOff += (target - this.groundOff) * Math.min(1, dt * 18);
    s.position.y = this.groundOff;
  }
  play(name, { fade = 0.18, speed = 1, restart = false, at = 0 } = {}) {
    const a = this.actions[name]; if (!a) { console.warn('no clip', name); return null; }
    if (this.cur === a && !restart) { a.timeScale = speed; return a; }
    a.enabled = true; a.reset(); a.time = at; a.timeScale = speed; a.setEffectiveWeight(1);
    if (this.cur && fade > 0) { a.play(); this.cur.crossFadeTo(a, fade, false); }
    else { if (this.cur) this.cur.stop(); a.play(); }
    this.cur = a; this.curName = name; return a;
  }
  get time() { return this.cur ? this.cur.time : 0; }
  get dur() { return this.cur ? this.cur.getClip().duration : 0; }
  setExpr(name, v) { this.exprTarget[name] = v; }
  update(dt) {
    this.mixer.update(dt);
    // expressions: smooth toward targets + blinking
    const em = this.vrm.expressionManager;
    if (em) {
      for (const k in this.exprTarget) { const c = this.expr[k] || 0; const t = this.exprTarget[k]; this.expr[k] = c + (t - c) * Math.min(1, dt * 10); em.setValue(k, this.expr[k]); }
      this.blinkT -= dt; let bl = 0;
      if (this.blinkT < 0.12) bl = Math.sin(Math.max(0, this.blinkT) / 0.12 * Math.PI);
      if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3.5;
      const closed = (this.expr.happy || 0) > 0.5;
      if (!closed) em.setValue('blink', Math.max(bl, this.expr.blink || 0));
    }
    this.vrm.update(dt);
    if (this.groundFix) this.fixGround(dt);
  }
}
