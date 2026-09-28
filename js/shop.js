// Бутик «Шёлк»: try-on room with an orbiting camera, outfit cards, buy / equip, rank locks.
// Entered by walking into the boutique door on the shopping street (world.boutique) or with the B key.
import * as THREE from 'three';
import { OUTFITS, save, applyOutfit, outfitById, preloadOutfit } from './outfits.js';
import { RANKS } from './config.js';

const $ = (id) => document.getElementById(id);
const hex = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
// swatch colours for cards
const SW = { street: [0x701428, 0x18171c], neon: [0x16141f, 0xff3f8e], fitness: [0x1f2a36, 0x33d1c4], bandeau: [0xf7f3f0, 0x5c7fb5], varsity: [0x23203a, 0xf0a3bd],
  fishnet: [0x141217, 0x8a8494], beach: [0xff5d8f, 0xffd1df], bodycon: [0xc8102e, 0x7e0a1d], biker: [0x1b1718, 0x5a2d1e], corset: [0x5a0d1f, 0x16121a],
  latex: [0x0d0c10, 0x6a6a78], champion: [0x121015, 0xe0b23a] };

export class Shop {
  constructor(game) {
    this.g = game; this.open = false; this.sel = save.outfit; this.spin = true; this.figOn = true; this.armed = true;
    this.orb = { yaw: 0.25, pitch: 0.1, dist: 3.4, tYaw: 0.25, tPitch: 0.1, tDist: 3.4 };
    this.el = { root: $('shop'), list: $('shopList'), name: $('shopName'), style: $('shopStyle'), tags: $('shopTags'), desc: $('shopDesc'), price: $('shopPrice'),
      btn: $('shopBtn'), note: $('shopNote'), money: $('shopMoney'), rank: $('shopRank'), spin: $('shopSpin'), fig: $('shopFig') };
    this.buildList();
    $('shopClose').onclick = () => this.exit();
    this.el.btn.onclick = () => this.action();
    this.el.spin.onclick = () => { this.spin = !this.spin; this.refresh(); };
    this.el.fig.onclick = () => { this.figOn = !this.figOn; this.applyFig(); this.refresh(); };
    for (const b of document.querySelectorAll('#shopCtl [data-view]')) b.onclick = () => this.view(b.dataset.view);
    // orbit: drag on the empty part of the screen, wheel to zoom
    let drag = null; const bg = this.el.root;
    bg.addEventListener('pointerdown', (e) => { if (e.target !== bg && e.target.id !== 'shopView') return; drag = { x: e.clientX, y: e.clientY }; bg.setPointerCapture?.(e.pointerId); });
    bg.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      this.orb.tYaw -= dx * 0.008; this.orb.tPitch = Math.max(-0.25, Math.min(0.75, this.orb.tPitch + dy * 0.005)); });
    bg.addEventListener('pointerup', () => (drag = null));
    bg.addEventListener('wheel', (e) => { e.preventDefault(); this.orb.tDist = Math.max(1.3, Math.min(4.6, this.orb.tDist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
  }
  buildList() {
    this.el.list.innerHTML = '';
    this.cards = {};
    for (const o of OUTFITS) {
      const c = document.createElement('div'); c.className = 'scard'; c.dataset.id = o.id;
      const [a, b] = SW[o.id] || [0x888888, 0x444444];
      c.innerHTML = `<div class="sw" style="background:linear-gradient(135deg, ${hex(a)} 0 55%, ${hex(b)} 55% 100%)"></div><div class="sc-t"><b>${o.ru}</b><span>${o.style}</span></div><div class="sc-p"></div>`;
      c.onclick = () => this.select(o.id);
      this.el.list.appendChild(c); this.cards[o.id] = c;
    }
  }
  canEnter() { return this.g.started && !this.open && !this.g.nearFight && this.g.player.state !== 'strike' && this.g.player.state !== 'caught'; }
  enter() {
    const g = this.g;
    if (!this.canEnter()) { if (g.started && g.nearFight) g.ui.hint('Сначала разберись с парнем — потом по магазинам', 2.5); return false; }
    this.open = true; g.shopMode = true; this.armed = false;
    document.exitPointerLock?.(); g.input.keys.clear();
    document.body.classList.add('inshop'); this.el.root.classList.add('show');
    const A = g.rusana, c = g.world.shopRoom.center;
    A.root.position.copy(c); A.root.rotation.y = 0; A.play('idle', { fade: 0 }); A.setExpr('happy', 0.35); A.setExpr('angry', 0); A.setExpr('sad', 0);
    g.lights.sun.castShadow = false; g.lights.follow(c); this.bloomT = g.R.bloom.threshold; g.R.bloom.threshold = 0.97;
    this.orb.yaw = this.orb.tYaw = 0.25; this.orb.pitch = this.orb.tPitch = 0.1; this.orb.dist = this.orb.tDist = 3.4;
    this.spin = true; this.figOn = true; this.sel = save.outfit;
    for (const o of OUTFITS) preloadOutfit(o.id);
    g.sfx.chord?.(); this.select(save.outfit, true);
    return true;
  }
  exit() {
    if (!this.open) return; const g = this.g, P = g.player, bq = g.world.boutique;
    this.open = false; g.shopMode = false; g.camOverride = null;
    document.body.classList.remove('inshop'); this.el.root.classList.remove('show');
    if (this.shown !== save.outfit) applyOutfit(g.rusana.vrm, save.outfit);
    this.shown = save.outfit; this.figOn = true; this.applyFig();
    P.pos.copy(bq.exit); P.yaw = Math.PI; P.vel.set(0, 0, 0); P.state = 'move';
    g.rusana.root.position.copy(P.pos); g.rusana.root.rotation.y = P.yaw; g.rusana.play('idle', { fade: 0 }); P.baseFace?.();
    g.cam.yaw = 0; g.cam.pitch = 0.2; g.cam.snap = true;
    g.lights.sun.castShadow = true; if (this.bloomT) g.R.bloom.threshold = this.bloomT;
    g.ui.toast('Бутик «Шёлк»', `На ней: «${outfitById(save.outfit).ru}»`);
  }
  async select(id, silent) {
    const o = outfitById(id); this.sel = o.id; this.refresh();
    if (this.shown !== o.id) { this.shown = o.id; await applyOutfit(this.g.rusana.vrm, o.id); this.applyFig(); }
    if (!silent) this.g.sfx.tick?.();
  }
  applyFig() {
    const o = outfitById(this.shown || save.outfit), v = this.figOn ? o.figure || 0 : 0;
    this.g.rusana.vrm.scene.traverse((m) => { const k = m.isMesh && m.morphTargetDictionary?.Figure; if (k !== undefined && k !== false) m.morphTargetInfluences[k] = v; });
  }
  view(v) { this.spin = false; const A = this.g.rusana; A.root.rotation.y = { front: 0, side: Math.PI / 2, back: Math.PI, quarter: 0.7 }[v] ?? 0; this.orb.tYaw = 0; this.refresh(); }
  action() {
    const o = outfitById(this.sel), g = this.g;
    if (save.outfit === o.id) return;
    if (save.has(o.id)) { save.setOutfit(o.id); g.ui.hint(`Надето: «${o.ru}»`, 2); g.sfx.chord?.(); }
    else if (save.locked(o.id)) { g.ui.hint(`Откроется на ранге «${RANKS[o.rank][1]}»`, 2.5); return; }
    else if (save.money < o.price) { g.ui.hint(`Не хватает ${o.price - save.money} ₽ — побеждай на районе`, 2.5); return; }
    else if (save.buy(o.id)) { save.setOutfit(o.id); g.ui.hint(`Куплено и надето: «${o.ru}» (−${o.price} ₽)`, 2.5); g.sfx.chord?.(); this.flash(); }
    this.refresh();
  }
  flash() { const c = this.cards[this.sel]; c.classList.remove('bought'); void c.offsetWidth; c.classList.add('bought'); }
  key(e) {
    const i = OUTFITS.findIndex((o) => o.id === this.sel);
    if (e.code === 'Escape' || e.code === 'KeyB') this.exit();
    else if (e.code === 'ArrowDown' || e.code === 'ArrowRight' || e.code === 'KeyS' || e.code === 'KeyD') this.select(OUTFITS[(i + 1) % OUTFITS.length].id);
    else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'KeyW' || e.code === 'KeyA') this.select(OUTFITS[(i + OUTFITS.length - 1) % OUTFITS.length].id);
    else if (e.code === 'Enter' || e.code === 'Space') this.action();
    else if (e.code === 'KeyQ') this.orb.tYaw += 0.4; else if (e.code === 'KeyE') this.orb.tYaw -= 0.4;
    else if (e.code === 'KeyR') { this.spin = !this.spin; this.refresh(); }
    else if (e.code === 'KeyF') { this.figOn = !this.figOn; this.applyFig(); this.refresh(); }
    e.preventDefault?.();
  }
  refresh() {
    const E = this.el, o = outfitById(this.sel), rk = save.rankIdx();
    E.money.textContent = `${save.money} ₽`; E.rank.textContent = `Ранг: ${RANKS[rk][1]}`;
    for (const x of OUTFITS) {
      const c = this.cards[x.id], own = save.has(x.id), eq = save.outfit === x.id, lock = !own && save.locked(x.id);
      c.classList.toggle('sel', x.id === this.sel); c.classList.toggle('owned', own); c.classList.toggle('eq', eq); c.classList.toggle('locked', lock);
      c.querySelector('.sc-p').innerHTML = eq ? '<i>надето</i>' : own ? '<i>куплено</i>' : lock ? `🔒 ${RANKS[x.rank][1]}` : `${x.price} ₽`;
    }
    E.name.textContent = o.ru; E.style.textContent = o.style; E.desc.textContent = o.desc;
    const tags = [];
    if ((o.figure || 0) >= 0.5) tags.push('<span class="tg fig">✦ Подчёркивает фигуру</span>');
    if (o.gloss >= 0.5) tags.push('<span class="tg">Глянец</span>');
    if (o.skirt) tags.push('<span class="tg">Юбка</span>'); if (o.jacket) tags.push('<span class="tg">Куртка</span>');
    if (o.rank) tags.push(`<span class="tg rk">Ранг «${RANKS[o.rank][1]}»</span>`);
    E.tags.innerHTML = tags.join('');
    const own = save.has(o.id), eq = save.outfit === o.id, lock = !own && save.locked(o.id), poor = !own && save.money < o.price;
    E.price.innerHTML = own ? 'Уже в гардеробе' : `Цена: <b>${o.price} ₽</b>`;
    E.btn.disabled = eq || lock || (!own && poor);
    E.btn.className = eq ? 'eq' : own ? 'wear' : lock ? 'lock' : poor ? 'poor' : 'buy';
    E.btn.textContent = eq ? 'Надето ✓' : own ? 'Надеть' : lock ? `🔒 Нужен ранг «${RANKS[o.rank][1]}»` : poor ? `Не хватает ${o.price - save.money} ₽` : `Купить за ${o.price} ₽`;
    E.note.textContent = lock ? `Твой лучший результат: ${save.fame} репутации из ${RANKS[o.rank][0]}` : !own ? 'Примерка бесплатная — покупка сразу наденет образ' : '';
    E.spin.classList.toggle('on', this.spin); E.fig.style.display = o.figure ? '' : 'none';
    E.fig.textContent = this.figOn ? 'Фигура: пышнее ✓' : 'Фигура: обычная';
  }
  update(dt) {
    const g = this.g, A = g.rusana, c = g.world.shopRoom.center, O = this.orb;
    if (this.spin) A.root.rotation.y += dt * 0.55;
    const k = Math.min(1, dt * 8); O.yaw += (O.tYaw - O.yaw) * k; O.pitch += (O.tPitch - O.pitch) * k; O.dist += (O.tDist - O.dist) * k;
    const lookY = 0.95 - (3.4 - O.dist) * 0.07 + (O.dist < 2 ? 0.1 : 0);
    // frame her a bit to the right of the screen centre (the list is on the left, the card on the right)
    const pos = new THREE.Vector3(c.x + Math.sin(O.yaw) * Math.cos(O.pitch) * O.dist, c.y + lookY + Math.sin(O.pitch) * O.dist, c.z + Math.cos(O.yaw) * Math.cos(O.pitch) * O.dist);
    g.camOverride = { pos, look: new THREE.Vector3(c.x, c.y + lookY, c.z), fov: 38 };
  }
}
