// Бутик «Шёлк»: вкладки «Наряды» и «Зал» (приёмы). Примерка, покупка, экипировка, слоты J/K/U.
import * as THREE from 'three';
import { OUTFITS, save, applyOutfit, outfitById, preloadOutfit } from './outfits.js';
import { RANKS, MOVES, moveById, LOADOUT_LABELS, STRIKES } from './config.js';

const $ = (id) => document.getElementById(id);
const hex = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
const SW = { street: [0x701428, 0x18171c], neon: [0x16141f, 0xff3f8e], fitness: [0x1f2a36, 0x33d1c4], bandeau: [0xf7f3f0, 0x5c7fb5], varsity: [0x23203a, 0xf0a3bd],
  fishnet: [0x141217, 0x8a8494], beach: [0xff5d8f, 0xffd1df], bodycon: [0xc8102e, 0x7e0a1d], biker: [0x1b1718, 0x5a2d1e], corset: [0x5a0d1f, 0x16121a],
  latex: [0x0d0c10, 0x6a6a78], champion: [0x121015, 0xe0b23a] };
const MSW = { kick: [0xff4f8b, 0x701428], knee: [0xff7a3d, 0x8e1244], heel: [0x7fd3ff, 0x2a5a8c], roundhouse: [0xe0b23a, 0x8a5a10],
  jumpknee: [0xb07cff, 0x4a2a8e], axe: [0xff2f6d, 0x5a1020] };

export class Shop {
  constructor(game) {
    this.g = game; this.open = false; this.tab = 'outfits'; this.sel = save.outfit; this.spin = true; this.figOn = true; this.armed = true;
    this.orb = { yaw: 0.25, pitch: 0.1, dist: 3.4, tYaw: 0.25, tPitch: 0.1, tDist: 3.4 };
    this.el = { root: $('shop'), list: $('shopList'), name: $('shopName'), style: $('shopStyle'), tags: $('shopTags'), desc: $('shopDesc'), price: $('shopPrice'),
      btn: $('shopBtn'), note: $('shopNote'), money: $('shopMoney'), rank: $('shopRank'), spin: $('shopSpin'), fig: $('shopFig'),
      loadout: $('shopLoadout'), slots: $('shopSlots') };
    this.buildList();
    $('shopClose').onclick = () => this.exit();
    this.el.btn.onclick = () => this.action();
    this.el.spin.onclick = () => { this.spin = !this.spin; this.refresh(); };
    this.el.fig.onclick = () => { this.figOn = !this.figOn; this.applyFig(); this.refresh(); };
    for (const b of document.querySelectorAll('#shopTabs [data-tab]')) b.onclick = () => this.setTab(b.dataset.tab);
    for (const b of document.querySelectorAll('#shopCtl [data-view]')) b.onclick = () => this.view(b.dataset.view);
    let drag = null; const bg = this.el.root;
    bg.addEventListener('pointerdown', (e) => { if (e.target !== bg && e.target.id !== 'shopView') return; drag = { x: e.clientX, y: e.clientY }; bg.setPointerCapture?.(e.pointerId); });
    bg.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      this.orb.tYaw -= dx * 0.008; this.orb.tPitch = Math.max(-0.25, Math.min(0.75, this.orb.tPitch + dy * 0.005)); });
    bg.addEventListener('pointerup', () => (drag = null));
    bg.addEventListener('wheel', (e) => { e.preventDefault(); this.orb.tDist = Math.max(1.3, Math.min(4.6, this.orb.tDist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
  }
  setTab(tab) {
    this.tab = tab;
    for (const b of document.querySelectorAll('#shopTabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    this.el.loadout.style.display = tab === 'moves' ? '' : 'none';
    this.el.fig.style.display = tab === 'outfits' ? '' : 'none';
    this.buildList();
    if (tab === 'outfits') this.select(save.outfit, true);
    else this.selectMove(save.slotMove(0) || 'kick', true);
  }
  buildList() {
    this.el.list.innerHTML = ''; this.cards = {};
    if (this.tab === 'outfits') {
      for (const o of OUTFITS) {
        const c = document.createElement('div'); c.className = 'scard'; c.dataset.id = o.id;
        const [a, b] = SW[o.id] || [0x888888, 0x444444];
        c.innerHTML = `<div class="sw" style="background:linear-gradient(135deg, ${hex(a)} 0 55%, ${hex(b)} 55% 100%)"></div><div class="sc-t"><b>${o.ru}</b><span>${o.style}</span></div><div class="sc-p"></div>`;
        c.onclick = () => this.select(o.id);
        this.el.list.appendChild(c); this.cards[o.id] = c;
      }
    } else {
      for (const m of MOVES) {
        const c = document.createElement('div'); c.className = 'scard'; c.dataset.id = m.id;
        const [a, b] = MSW[m.id] || [0x888888, 0x444444];
        c.innerHTML = `<div class="sw" style="background:linear-gradient(135deg, ${hex(a)} 0 55%, ${hex(b)} 55% 100%)"></div><div class="sc-t"><b>${m.ru}</b><span>${m.style}</span></div><div class="sc-p"></div>`;
        c.onclick = () => this.selectMove(m.id);
        this.el.list.appendChild(c); this.cards[m.id] = c;
      }
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
    this.spin = true; this.figOn = true;
    for (const o of OUTFITS) preloadOutfit(o.id);
    g.sfx.chord?.(); this.setTab(this.tab || 'outfits');
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
    const lo = save.loadout.filter(Boolean).map((id) => moveById(id).ru).join(' · ');
    g.ui.toast('Бутик «Шёлк»', `Наряд: «${outfitById(save.outfit).ru}» · Приёмы: ${lo}`);
  }
  async select(id, silent) {
    this.tab = 'outfits'; const o = outfitById(id); this.sel = o.id; this.refresh();
    if (this.shown !== o.id) { this.shown = o.id; await applyOutfit(this.g.rusana.vrm, o.id); this.applyFig(); }
    if (!silent) this.g.sfx.blip?.(880);
  }
  selectMove(id, silent) {
    this.tab = 'moves'; this.sel = id; this.refresh();
    // preview pose: play the strike clip once on the podium
    const st = STRIKES[id];
    if (st) this.g.rusana.play(st.clip.slice(2), { fade: 0.08, restart: true });
    if (!silent) this.g.sfx.blip?.(988);
  }
  applyFig() {
    const o = outfitById(this.shown || save.outfit), v = this.figOn ? o.figure || 0 : 0;
    this.g.rusana.vrm.scene.traverse((m) => { const k = m.isMesh && m.morphTargetDictionary?.Figure; if (k !== undefined && k !== false) m.morphTargetInfluences[k] = v; });
  }
  view(v) { this.spin = false; const A = this.g.rusana; A.root.rotation.y = { front: 0, side: Math.PI / 2, back: Math.PI, quarter: 0.7 }[v] ?? 0; this.orb.tYaw = 0; this.refresh(); }
  action() {
    if (this.tab === 'moves') return this.actionMove();
    const o = outfitById(this.sel), g = this.g;
    if (save.outfit === o.id) return;
    if (save.has(o.id)) { save.setOutfit(o.id); g.ui.hint(`Надето: «${o.ru}»`, 2); g.sfx.chord?.(); }
    else if (save.locked(o.id)) { g.ui.hint(`Откроется на ранге «${RANKS[o.rank][1]}»`, 2.5); return; }
    else if (save.money < o.price) { g.ui.hint(`Не хватает ${o.price - save.money} ₽`, 2.5); return; }
    else if (save.buy(o.id)) { save.setOutfit(o.id); g.ui.hint(`Куплено и надето: «${o.ru}» (−${o.price} ₽)`, 2.5); g.sfx.chord?.(); this.flash(); g.mira?.onBuy(); }
    this.refresh();
  }
  actionMove() {
    const m = moveById(this.sel), g = this.g;
    if (!save.hasMove(m.id)) {
      if (save.moveLocked(m.id)) { g.ui.hint(`Нужен ранг «${RANKS[m.rank][1]}»`, 2.5); return; }
      if (save.money < m.price) { g.ui.hint(`Не хватает ${m.price - save.money} ₽`, 2.5); return; }
      if (save.buyMove(m.id)) { g.ui.hint(`Куплено: «${m.ru}» (−${m.price} ₽). Назначь на слот.`, 3); g.sfx.chord?.(); this.flash(); }
      this.refresh(); return;
    }
    // already owned → cycle equip into next empty / first slot
    const lo = save.loadout;
    let slot = lo.findIndex((x) => x === m.id);
    if (slot >= 0) {
      // unequip only slot 2; J/K must keep something
      if (slot === 2) { save.equipMove(2, null); g.ui.hint(`«${m.ru}» снят со слота U`, 2); }
      else g.ui.hint(`«${m.ru}» уже на ${LOADOUT_LABELS[slot]}`, 2);
    } else {
      slot = lo.findIndex((x) => !x);
      if (slot < 0) slot = 2; // replace U by default, or ask — replace U
      if (slot < 0) slot = 0;
      // prefer empty, else replace U, else replace K
      if (lo.every(Boolean)) slot = 2;
      save.equipMove(slot, m.id);
      g.ui.hint(`«${m.ru}» → слот ${LOADOUT_LABELS[slot]}`, 2.5); g.sfx.chord?.();
    }
    this.refresh();
  }
  equipTo(slot) {
    if (this.tab !== 'moves') return;
    const m = moveById(this.sel);
    if (!save.hasMove(m.id)) { this.g.ui.hint('Сначала купи приём', 2); return; }
    save.equipMove(slot, m.id);
    this.g.ui.hint(`«${m.ru}» → ${LOADOUT_LABELS[slot]}`, 2); this.g.sfx.blip?.(1200);
    this.refresh();
  }
  flash() { const c = this.cards[this.sel]; if (!c) return; c.classList.remove('bought'); void c.offsetWidth; c.classList.add('bought'); }
  key(e) {
    if (e.code === 'Escape' || e.code === 'KeyB') { this.exit(); return; }
    if (e.code === 'Digit1') { this.setTab('outfits'); return; }
    if (e.code === 'Digit2') { this.setTab('moves'); return; }
    if (this.tab === 'moves' && (e.code === 'Digit8' || e.code === 'Digit9' || e.code === 'Digit0')) {
      this.equipTo(e.code === 'Digit8' ? 0 : e.code === 'Digit9' ? 1 : 2); return;
    }
    const list = this.tab === 'outfits' ? OUTFITS : MOVES;
    const i = list.findIndex((x) => x.id === this.sel);
    if (e.code === 'ArrowDown' || e.code === 'ArrowRight' || e.code === 'KeyS' || e.code === 'KeyD') {
      const n = list[(i + 1) % list.length].id; this.tab === 'outfits' ? this.select(n) : this.selectMove(n);
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'KeyW' || e.code === 'KeyA') {
      const n = list[(i + list.length - 1) % list.length].id; this.tab === 'outfits' ? this.select(n) : this.selectMove(n);
    } else if (e.code === 'Enter' || e.code === 'Space') this.action();
    else if (e.code === 'KeyQ') this.orb.tYaw += 0.4; else if (e.code === 'KeyE') this.orb.tYaw -= 0.4;
    else if (e.code === 'KeyR') { this.spin = !this.spin; this.refresh(); }
    e.preventDefault?.();
  }
  refresh() {
    const E = this.el, rk = save.rankIdx();
    E.money.textContent = `${save.money} ₽`; E.rank.textContent = `Ранг: ${RANKS[rk][1]}`;
    // loadout strip
    if (E.slots) {
      E.slots.innerHTML = '';
      save.loadout.forEach((id, i) => {
        const b = document.createElement('button'); b.className = 'slot' + (id === this.sel && this.tab === 'moves' ? ' on' : '');
        b.innerHTML = `<i>${LOADOUT_LABELS[i]}</i><b>${id ? moveById(id).ru : '—'}</b>`;
        b.onclick = () => { if (this.tab === 'moves') this.equipTo(i); };
        E.slots.appendChild(b);
      });
    }
    if (this.tab === 'outfits') this._refreshOutfit(E, rk);
    else this._refreshMove(E, rk);
  }
  _refreshOutfit(E, rk) {
    const o = outfitById(this.sel);
    for (const x of OUTFITS) {
      const c = this.cards[x.id]; if (!c) continue;
      const own = save.has(x.id), eq = save.outfit === x.id, lock = !own && save.locked(x.id);
      c.classList.toggle('sel', x.id === this.sel); c.classList.toggle('owned', own); c.classList.toggle('eq', eq); c.classList.toggle('locked', lock);
      c.querySelector('.sc-p').innerHTML = eq ? '<i>надето</i>' : own ? '<i>куплено</i>' : lock ? `🔒 ${RANKS[x.rank][1]}` : `${x.price} ₽`;
    }
    E.name.textContent = o.ru; E.style.textContent = o.style; E.desc.textContent = o.desc;
    const tags = [];
    if ((o.figure || 0) >= 0.5) tags.push('<span class="tg fig">✦ Подчёркивает фигуру</span>');
    if (o.gloss >= 0.5) tags.push('<span class="tg">Глянец</span>');
    if (o.skirt) tags.push('<span class="tg">Юбка</span>'); if (o.jacket) tags.push('<span class="tg">Куртка</span>');
    if (o.hideShoes) tags.push('<span class="tg">Своя обувь</span>');
    if (o.rank) tags.push(`<span class="tg rk">Ранг «${RANKS[o.rank][1]}»</span>`);
    E.tags.innerHTML = tags.join('');
    const own = save.has(o.id), eq = save.outfit === o.id, lock = !own && save.locked(o.id), poor = !own && save.money < o.price;
    E.price.innerHTML = own ? 'Уже в гардеробе' : `Цена: <b>${o.price} ₽</b>`;
    E.btn.disabled = eq || lock || (!own && poor);
    E.btn.className = eq ? 'eq' : own ? 'wear' : lock ? 'lock' : poor ? 'poor' : 'buy';
    E.btn.textContent = eq ? 'Надето ✓' : own ? 'Надеть' : lock ? `🔒 Нужен ранг «${RANKS[o.rank][1]}»` : poor ? `Не хватает ${o.price - save.money} ₽` : `Купить за ${o.price} ₽`;
    E.note.textContent = 'Вкладка «Зал» — купить и назначить приёмы на J / K / U';
    E.spin.classList.toggle('on', this.spin); E.fig.style.display = o.figure ? '' : 'none';
    E.fig.textContent = this.figOn ? 'Фигура: пышнее ✓' : 'Фигура: обычная';
  }
  _refreshMove(E, rk) {
    const m = moveById(this.sel), st = STRIKES[m.id];
    for (const x of MOVES) {
      const c = this.cards[x.id]; if (!c) continue;
      const own = save.hasMove(x.id), eq = save.loadout.includes(x.id), lock = !own && save.moveLocked(x.id);
      c.classList.toggle('sel', x.id === this.sel); c.classList.toggle('owned', own); c.classList.toggle('eq', eq); c.classList.toggle('locked', lock);
      const slot = save.loadout.indexOf(x.id);
      c.querySelector('.sc-p').innerHTML = eq ? `<i>слот ${LOADOUT_LABELS[slot]}</i>` : own ? '<i>куплено</i>' : lock ? `🔒 ${RANKS[x.rank][1]}` : `${x.price} ₽`;
    }
    E.name.textContent = m.ru; E.style.textContent = m.style; E.desc.textContent = m.desc;
    const tags = [];
    if (st) tags.push(`<span class="tg">Дист. ${(st.dist).toFixed(2)} м</span>`, `<span class="tg">Контакт ${st.contact.toFixed(2)} с</span>`, `<span class="tg">Сила ×${st.dmg}</span>`);
    if (m.rank) tags.push(`<span class="tg rk">Ранг «${RANKS[m.rank][1]}»</span>`);
    E.tags.innerHTML = tags.join('');
    const own = save.hasMove(m.id), eq = save.loadout.includes(m.id), lock = !own && save.moveLocked(m.id), poor = !own && save.money < m.price;
    E.price.innerHTML = own ? 'В арсенале — нажми слот J/K/U ниже или кнопку' : `Цена: <b>${m.price} ₽</b>`;
    E.btn.disabled = lock || (!own && poor);
    E.btn.className = eq ? 'eq' : own ? 'wear' : lock ? 'lock' : poor ? 'poor' : 'buy';
    E.btn.textContent = !own ? (lock ? `🔒 Нужен ранг «${RANKS[m.rank][1]}»` : poor ? `Не хватает ${m.price - save.money} ₽` : `Купить за ${m.price} ₽`)
      : eq ? 'Сменить слот / снять с U' : 'Назначить на слот';
    E.note.textContent = 'Кликни слот J/K/U под карточкой, чтобы назначить. Низкий кик и стопа — авто, когда парень уже на коленях/полу.';
    E.spin.classList.toggle('on', this.spin); E.fig.style.display = 'none';
  }
  update(dt) {
    const g = this.g, A = g.rusana, c = g.world.shopRoom.center, O = this.orb;
    if (this.spin && this.tab === 'outfits') A.root.rotation.y += dt * 0.55;
    const k = Math.min(1, dt * 8); O.yaw += (O.tYaw - O.yaw) * k; O.pitch += (O.tPitch - O.pitch) * k; O.dist += (O.tDist - O.dist) * k;
    const lookY = 0.95 - (3.4 - O.dist) * 0.07 + (O.dist < 2 ? 0.1 : 0);
    const pos = new THREE.Vector3(c.x + Math.sin(O.yaw) * Math.cos(O.pitch) * O.dist, c.y + lookY + Math.sin(O.pitch) * O.dist, c.z + Math.cos(O.yaw) * Math.cos(O.pitch) * O.dist);
    g.camOverride = { pos, look: new THREE.Vector3(c.x, c.y + lookY, c.z), fov: 38 };
  }
}
