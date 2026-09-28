// Боллбастер: Неоновый район — boot, game loop, camera, input, combat glue, reputation.
import * as THREE from 'three';
import { asset, GUYS, STRIKES, COMBAT, GRADE_RU, DEBUG } from './config.js';
import { createRenderer, createSky, createLights } from './render.js';
import { World } from './world.js';
import { fetchVRM, parseVRM, stylize, tint, Actor } from './chars.js';
import { allClipData } from './clips.js';
import { Player } from './player.js';
import { Guy } from './ai.js';
import { FX } from './fx.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { OUTFITS, save, applyOutfit, outfitById } from './outfits.js';
import { Shop } from './shop.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const REP = { perfect: 3, clean: 2, glance: 0.5, block: 0, miss: 0 };
const FOCUS = { perfect: 22, clean: 12, glance: 3, block: 0, miss: 0 };

class Game {
  constructor() {
    const R = createRenderer($('game')); Object.assign(this, { R, renderer: R.renderer, scene: R.scene, camera: R.camera });
    this.scene.fog = new THREE.Fog(0xcfe0f2, 45, 170);
    this.sky = createSky(this.scene); this.lights = createLights(this.scene);
    this.world = new World(this.scene);
    this.fx = new FX(this.scene, this.camera, R.grade); this.sfx = new Sfx(); this.ui = new UI(this);
    this.strikes = STRIKES; this.guys = []; this.now = 0; this.clock = new THREE.Clock();
    this.rep = 0; this.focus = 0; this.combo = 0; this.comboT = 0; this.witch = 0; this.hitStop = 0; this.started = false; this.paused = false;
    this.stats = { perfect: 0, clean: 0, glance: 0, block: 0, miss: 0, best: 0, dodges: 0 };
    this.cam = { yaw: Math.PI / 2 + Math.PI, pitch: 0.2, dist: 3.4, curDist: 3.4, pivot: new THREE.Vector3(), lastMouse: -9, fin: 0 };
    this.input = { keys: new Set(), moveLen: 0, moveYaw: 0, run: false };
    this.area = null;
  }
  async load(onProgress) {
    const files = { rusana: 'vrm/rusana.vrm', guy_a: 'vrm/guy_a.vrm', guy_b: 'vrm/guy_b.vrm' };
    const sizes = { rusana: 7.1e6, guy_a: 5.9e6, guy_b: 5.3e6, anim: 0.43e6 }, got = {};
    const tot = Object.values(sizes).reduce((a, b) => a + b, 0);
    const prog = (k) => (n) => { got[k] = n; onProgress(Object.values(got).reduce((a, b) => a + b, 0) / tot, 'Загрузка персонажей…'); };
    const animP = fetch(asset('anim/quaternius.json')).then((r) => r.json());
    const bufs = {}; await Promise.all(Object.entries(files).map(async ([k, f]) => { bufs[k] = await fetchVRM(asset(f), prog(k)); }));
    const qlib = await animP; onProgress(0.97, 'Собираю район…');
    this.clipData = allClipData(qlib);
    const rv = await parseVRM(bufs.rusana); stylize(rv, { rimColor: 0xffd8e0 });
    await applyOutfit(rv, Q.get('outfit') || save.outfit).catch((e) => console.warn('outfit', e));
    this.rusana = new Actor(rv, this.clipData, { prefix: 'r_' }); this.scene.add(this.rusana.root);
    this.player = new Player(this.rusana, this); this.shop = new Shop(this); this.shop.shown = outfitById(Q.get('outfit') || save.outfit).id;
    for (const def of GUYS) {
      const v = await parseVRM(bufs[def.base]); stylize(v); tint(v, def);
      const a = new Actor(v, this.clipData, { prefix: 'g_', scale: def.scale }); this.scene.add(a.root);
      const g = new Guy(def, a, this); this.guys.push(g); a.root.position.copy(g.pos);
    }
    // warm up shaders
    this.R.composer.render(); onProgress(1, 'Готово');
  }
  start() {
    this.started = true; this.sfx.init(); document.body.classList.add('playing');
    this.ui.toast('Неоновый район', 'Торговая улица'); this.area = 'street';
    this.ui.hint('WASD — идти, Shift — бег, J/ЛКМ — ап-кик, K/ПКМ — колено, Пробел — уклон, F — добивание', 7);
  }
  // ------------------------------------------------ combat glue
  onStrike(guy, move, res, info) {
    const { grade } = res, pt = guy.hitPoint(new THREE.Vector3()), perfect = grade === 'perfect';
    this.stats[grade]++;
    if (DEBUG) console.log('strike', move, grade, res, info);
    guy.onHit(grade, move, this.now);
    const fin = move === 'finisher';
    if (grade === 'miss') { this.fx.popup(GRADE_RU.miss, pt, 'g-miss'); this.breakCombo(); return; }
    if (grade === 'block') {
      this.fx.popup(GRADE_RU.block, pt, 'g-block'); this.fx.burst(pt, { color: 0x9ad0ff, size: 0.6 }); this.sfx.block(); this.fx.shake(0.02, 0.1); this.breakCombo(); this.hitStop = 0.04; return;
    }
    const landed = grade !== 'glance';
    if (landed) { this.combo++; this.comboT = COMBAT.comboWindow; this.stats.best = Math.max(this.stats.best, this.combo); } else this.comboT = Math.max(this.comboT, 0.6);
    this.ui.combo(this.combo);
    const mult = 1 + Math.min(1.5, this.combo * 0.1) + (fin ? 1 : 0);
    this.rep += REP[grade] * mult * (this.strikes[move].dmg);
    if (!fin) this.focus = Math.min(100, this.focus + FOCUS[grade] * (this.witch > 0 ? 1.5 : 1)); else this.focus = 0;
    this.fx.popup(fin ? 'ДОБИВАНИЕ!' : GRADE_RU[grade], pt, 'g-' + grade + (fin ? ' g-fin' : ''), perfect || fin ? 1.3 : 0.9);
    this.fx.burst(pt, { color: perfect || fin ? 0xffe066 : grade === 'clean' ? 0xfff2c8 : 0xe0e8ff, size: fin ? 1.8 : perfect ? 1.2 : grade === 'clean' ? 0.9 : 0.5, perfect: perfect || fin });
    this.sfx.impact(fin ? 1.4 : perfect ? 1.1 : grade === 'clean' ? 0.85 : 0.4, perfect || fin);
    if (perfect || fin) { this.fx.impactFrame(pt, fin ? 1.4 : 1); this.fx.shake(fin ? 0.09 : 0.05, 0.22); this.hitStop = fin ? 0.22 : COMBAT.hitStopPerfect; this.player.smirk(); }
    else if (grade === 'clean') { this.fx.shake(0.03, 0.15); this.hitStop = COMBAT.hitStop; this.fx.impactFrame(pt, 0.45); }
    else this.hitStop = 0.03;
    if (landed && guy.level >= 2 && !guy.out && Math.random() < 0.25 && this.player.move !== 'finisher') this.ui.hint(guy.level === 3 ? 'На коленях — J добьёт низким киком' : guy.level >= 4 ? 'На полу — J: стопой' : '', 2);
  }
  onWhiff(move) { this.fx.popup(GRADE_RU.miss, this.player.contactPoint(), 'g-miss', 0.7); this.breakCombo(); }
  breakCombo() { if (this.combo >= 2) this.ui.log(`Комбо: <b>${this.combo}</b>`); this.combo = 0; this.ui.combo(0); }
  onGuyPunch(guy, dist, ang) {
    const P = this.player;
    if (dist < 1.45 && ang < 0.9 && P.iframes <= 0 && P.state !== 'victory') {
      P.caught(guy); this.breakCombo(); this.focus = Math.max(0, this.focus - 25); this.rep = Math.max(0, this.rep - 2);
      this.fx.popup('Пропустила!', P.contactPoint().setY(P.pos.y + 1.3), 'g-block'); this.fx.shake(0.05, 0.2); this.sfx.impact(0.6); this.hitStop = 0.06;
      if (Math.random() < 0.6) guy.say(['Ха! Получила?', 'Не зевай!', 'Вот так!'][Math.floor(Math.random() * 3)], 1.6);
    }
  }
  perfectDodge(guy) {
    this.witch = COMBAT.witchTime; this.stats.dodges++; this.focus = Math.min(100, this.focus + 15);
    this.ui.banner('ИДЕАЛЬНЫЙ УКЛОН', 'witch', 1100); this.fx.speedLines(0.35); this.sfx.chord();
    this.R.grade.uniforms.tint.value.setRGB(0.45, 0.35, 1.0); this.R.grade.uniforms.tintAmt.value = 0.14;
  }
  startFinisher(guy) { this.cam.fin = 1.3; this.ui.banner('ДОБИВАНИЕ', 'fin', 1200); this.finSlow = 1; }
  endFinisher() { this.finSlow = 0; }
  onDefeat(guy) {
    const style = 15 + Math.min(20, this.combo * 2);
    this.rep += style; save.fameUp(this.rep);
    // money: base per win + style bonus + tougher guys pay more
    const cash = 40 + Math.min(40, this.combo * 5) + (guy.trait.tough > 1.2 ? 25 : 0) + (this.player.move === 'finisher' ? 20 : 0);
    save.earn(cash); save.win(); this.stats.cash = (this.stats.cash || 0) + cash;
    setTimeout(() => { this.ui.toast(`${guy.def.name} сдался`, guy.def.win); this.ui.log(`${guy.def.name}: +${style} репутации, +${cash} ₽`); this.sfx.chord(); }, 1100);
    if (this.guys.every((g) => g.out)) setTimeout(() => this.finale(), 4200);
  }
  finale() {
    const P = this.player; P.state = 'victory'; P.actor.play('victory', { fade: 0.3, restart: true }); P.actor.setExpr('happy', 0.6); P.actor.setExpr('angry', 0);
    const s = this.stats;
    $('endStats').innerHTML = `Репутация: <b>${Math.round(this.rep)}</b><br>Идеально: ${s.perfect} · Чисто: ${s.clean} · Скользом: ${s.glance} · Блоков: ${s.block} · Мимо: ${s.miss}<br>Лучшее комбо: ${s.best} · Идеальных уклонов: ${s.dodges}<br>Заработано: <b>${s.cash || 0} ₽</b> · В кошельке: ${save.money} ₽`;
    setTimeout(() => $('end').classList.add('show'), 2500);
  }
  // ------------------------------------------------ input
  bindInput() {
    const I = this.input, cv = $('game');
    addEventListener('keydown', (e) => {
      if (!this.started || e.repeat) { if (e.repeat) I.keys.add(e.code); return; }
      if (this.shopMode) { if (e.code === 'KeyM') this.ui.hint(this.sfx.toggle() ? 'Звук выключен' : 'Звук включён'); else this.shop.key(e); return; }
      I.keys.add(e.code);
      if (e.code === 'KeyB') { this.shop.enter(); return; }
      if (e.code === 'KeyJ') this.player.request('kick');
      if (e.code === 'KeyK') this.player.request('knee');
      if (e.code === 'KeyF') this.player.request('finisher');
      if (e.code === 'Space') { this.player.dodge(); e.preventDefault(); }
      if (e.code === 'KeyM') this.ui.hint(this.sfx.toggle() ? 'Звук выключен' : 'Звук включён');
      if (e.code === 'KeyH') $('help').classList.toggle('show');
    });
    addEventListener('keyup', (e) => I.keys.delete(e.code));
    addEventListener('blur', () => I.keys.clear());
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    let drag = null;
    cv.addEventListener('mousedown', (e) => {
      if (!this.started || this.shopMode) return;
      if (document.pointerLockElement !== cv) { if (e.button === 0 && !Q.has('nolock')) cv.requestPointerLock?.(); drag = { x: e.clientX, y: e.clientY }; return; }
      if (e.button === 0) this.player.request('kick'); else if (e.button === 2) this.player.request('knee');
    });
    addEventListener('mouseup', () => (drag = null));
    addEventListener('mousemove', (e) => {
      let dx = 0, dy = 0;
      if (document.pointerLockElement === cv) { dx = e.movementX; dy = e.movementY; } else if (drag) { dx = e.clientX - drag.x; dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; }
      if (dx || dy) { this.cam.yaw -= dx * 0.0032; this.cam.pitch = Math.max(-0.35, Math.min(1.1, this.cam.pitch + dy * 0.0028)); this.cam.lastMouse = this.now; }
    });
    addEventListener('wheel', (e) => { if (this.shopMode) return; this.cam.dist = Math.max(1.8, Math.min(7, this.cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: true });
  }
  readMove() {
    const I = this.input, k = I.keys;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (k.has('ArrowLeft') || k.has('KeyQ')) this.cam.yaw += 0.035; if (k.has('ArrowRight') || k.has('KeyE')) this.cam.yaw -= 0.035;
    if (this.autoMove) { f = this.autoMove[0]; r = this.autoMove[1]; }
    I.moveLen = Math.min(1, Math.hypot(f, r)); I.run = k.has('ShiftLeft') || k.has('ShiftRight') || !!this.autoRun;
    // camera looks along -forward: camera yaw points from pivot to camera
    const fwdYaw = this.cam.yaw + Math.PI; I.moveYaw = fwdYaw + Math.atan2(-r, f);
  }
  // ------------------------------------------------ camera
  updateCamera(dt) {
    const c = this.cam, P = this.player, cam = this.camera;
    if (this.camOverride) { const o = this.camOverride; cam.position.copy(o.pos).add(this.fx.shakeOffset(this.now)); cam.lookAt(o.look); if (o.fov) { cam.fov = o.fov; cam.updateProjectionMatrix(); } cam.updateMatrixWorld(); return; }
    const piv = new THREE.Vector3(P.pos.x, P.pos.y + 1.28, P.pos.z);
    // combat framing: shift pivot toward the engaged guy and auto-orbit gently if the mouse is idle
    const tg = P.target && !P.target.out && P.distTo(P.target) < 5 ? P.target : null;
    if (tg) { piv.lerp(new THREE.Vector3(tg.pos.x, tg.pos.y + 1.0, tg.pos.z), 0.3);
      if (this.now - c.lastMouse > 1.5 && (P.state === 'strike' || P.state === 'dash')) { const side = Math.atan2(tg.pos.x - P.pos.x, tg.pos.z - P.pos.z) + Math.PI + 0.7; c.yaw += angDiff(side, c.yaw) * Math.min(1, dt * 1.2); } }
    c.pivot.lerp(piv, Math.min(1, dt * 10)); if (c.pivot.lengthSq() === 0 || c.snap) { c.pivot.copy(piv); c.snap = false; }
    let dist = c.dist, pitch = c.pitch;
    if (c.fin > 0) { c.fin -= dt; dist = 2.4; pitch = 0.05; }
    const dir = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(c.yaw) * Math.cos(pitch));
    // collision: march out until solid
    let free = dist; for (let s = 0.3; s <= dist; s += 0.15) { const p = c.pivot.clone().addScaledVector(dir, s); if (this.world.solidAt(p.x, p.y, p.z) || p.y < 0.15) { free = Math.max(0.6, s - 0.25); break; } }
    c.curDist += (free - c.curDist) * Math.min(1, dt * (free < c.curDist ? 20 : 3));
    cam.position.copy(c.pivot).addScaledVector(dir, c.curDist).add(this.fx.shakeOffset(this.now));
    cam.lookAt(c.pivot);
    const fov = 50 + (P.state === 'dash' ? 8 : 0) + (this.witch > 0 ? -4 : 0); cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  // walk into the boutique door -> shop; a hint when passing by
  checkBoutique() {
    const bq = this.world.boutique, P = this.player; if (!bq || !this.started) return;
    const d = bq.door, inDoor = P.pos.x > d.x0 && P.pos.x < d.x1 && P.pos.z > d.z0 && P.pos.y < 0.5;
    if (inDoor && this.shop.armed) { this.shop.enter(); return; }
    if (!inDoor && P.pos.distanceTo(bq.exit) > 1.2) this.shop.armed = true;
    const near = Math.hypot(P.pos.x - bq.x, P.pos.z - bq.z) < 5;
    if (near && !this.nearFight && !this._bqHint) { this._bqHint = true; this.ui.hint('Бутик «Шёлк»: зайди в дверь (или нажми B) — примерка образов', 4); }
    if (!near) this._bqHint = false;
  }
  // ------------------------------------------------ loop
  tick() {
    let rdt = Math.min(0.05, this.clock.getDelta()); if (this.fixedDt) rdt = this.fixedDt; this.frames = (this.frames || 0) + 1;
    if (this.paused) { this.R.composer.render(); return; }
    if (this.shopMode) {   // boutique: only Rusana animates, the district is frozen
      this.now += rdt; this.shop.update(rdt); this.rusana.update(rdt); this.world.update(this.now);
      this.sky.material.uniforms.time.value = this.now; this.R.grade.uniforms.time.value = this.now;
      this.updateCamera(rdt); this.fx.update(rdt, rdt); this.R.composer.render(); this.R.adapt(rdt); return;
    }
    let gs = 1, ps = 1;                                  // game (guys) and player time scales
    if (this.hitStop > 0) { this.hitStop -= rdt; gs = ps = 0.03; }
    else if (this.witch > 0) { this.witch -= rdt; gs = 0.3; if (this.witch <= 0) { this.fx.speedLines(0); this.R.grade.uniforms.tintAmt.value = 0; } }
    if (this.finSlow && this.player.state === 'strike' && Math.abs(this.player.t - STRIKES.finisher.contact) < 0.12 && this.hitStop <= 0) { gs *= 0.35; ps *= 0.35; }
    const dt = rdt * gs, pdt = rdt * ps; this.now += dt;
    if (this.started) { this.readMove(); this.player.update(pdt, this.input); }
    this.nearFight = false; let fg = null, fd = 1e9;
    for (const g of this.guys) {
      g.update(dt, this.now);
      const d = this.player.distTo(g); if (g.mode === 'alert' && d < 4) this.nearFight = true;
      if ((g.mode === 'alert' || g.level) && d < 6 && d < fd && !(g.out && g.tapT > 3)) { fd = d; fg = g; }
      // guys don't overlap each other
      for (const h of this.guys) if (h !== g) { const dx = g.pos.x - h.pos.x, dz = g.pos.z - h.pos.z, dd = Math.hypot(dx, dz); if (dd < 0.6 && dd > 1e-4) { g.pos.x += dx / dd * (0.6 - dd) * 0.5; g.pos.z += dz / dd * (0.6 - dd) * 0.5; } }
    }
    this.focusGuy = fg;
    if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.breakCombo();
    this.rusana.update(pdt); for (const g of this.guys) g.actor.update(dt);
    this.world.update(this.now); this.sky.material.uniforms.time.value = this.now; this.R.grade.uniforms.time.value = this.now;
    this.lights.follow(this.player.pos);
    this.updateCamera(rdt);
    this.fx.update(dt, rdt); this.ui.update(rdt);
    this.checkBoutique();
    const ar = this.world.areaAt(this.player.pos);
    if (ar && ar !== this.area && this.started) { this.area = ar; this.ui.toast(this.world.areas[ar].name); }
    this.R.composer.render(); this.R.adapt(rdt);
  }
}

// ------------------------------------------------ boot: age gate → loading → title → game
const game = new Game();
// debug / test hooks: __bba.shop.list / buy(id) / equip(id)
window.__bba = { game, shop: { list: OUTFITS, save, buy: (id) => save.buy(id), equip: async (id) => { if (!save.setOutfit(id)) return false; await applyOutfit(game.rusana.vrm, id); game.shop.shown = outfitById(id).id; return true; } } };
const gate = $('gate'), title = $('title');
const skipGate = Q.has('skipgate') || Q.has('shot');
let loaded = null;
function beginLoad() {
  if (loaded) return loaded;
  const bar = $('loadFill'), txt = $('loadTxt');
  loaded = game.load((f, msg) => { bar.style.width = (f * 100).toFixed(1) + '%'; txt.textContent = msg + ' ' + Math.round(f * 100) + '%'; })
    .then(() => { $('startBtn').disabled = false; $('startBtn').textContent = 'Начать'; txt.textContent = 'Готово'; })
    .catch((e) => { console.error(e); txt.textContent = 'Ошибка загрузки: ' + e.message; throw e; });
  return loaded;
}
function accept() { try { localStorage.setItem('bba-age', '1'); } catch (e) {} gate.classList.remove('show'); title.classList.add('show'); beginLoad(); }
$('ageYes').onclick = accept;
$('ageNo').onclick = () => { location.href = 'https://www.google.com/'; };
$('startBtn').onclick = () => { title.classList.remove('show'); game.start(); };
$('againBtn').onclick = () => location.reload();
$('helpClose').onclick = () => $('help').classList.remove('show');
game.bindInput();
let rafOn = true;
const loop = () => { if (rafOn) requestAnimationFrame(loop); if (game.player) game.tick(); else game.R.composer.render(); };
if (skipGate) {
  gate.classList.remove('show');
  beginLoad().then(async () => {
    if (Q.has('shot')) { rafOn = false; const m = await import('./shots.js'); await m.run(game, Q.get('shot')); }
    else { game.start(); }
  });
} else if (localStorage.getItem('bba-age') === '1') accept(); else gate.classList.add('show');
requestAnimationFrame(loop);
