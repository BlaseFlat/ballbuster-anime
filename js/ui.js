// DOM HUD: reputation/rank, focus meter, combo counter, target card, nameplates, speech bubbles, toasts, banners.
import * as THREE from 'three';
import { RANKS, GRADE_RU } from './config.js';
import { save } from './outfits.js';
const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export class UI {
  constructor(game) {
    this.g = game; this.plates = new Map(); this.bubbles = [];
    this.el = { rep: $('rep'), money: $('money'), rank: $('rank'), focus: $('focusFill'), focusBox: $('focus'), combo: $('combo'), comboN: $('comboN'), comboL: $('comboL'),
      tcard: $('tcard'), tname: $('tname'), ttrait: $('ttrait'), tstate: $('tstate'), tpain: $('tpainFill'), toast: $('toast'), banner: $('banner'),
      hint: $('hint'), goals: $('goals'), layer: $('plates'), log: $('log') };
    this.comboHide = 0; this.hintT = 0;
  }
  plate(guy) {
    let p = this.plates.get(guy); if (p) return p;
    const el = document.createElement('div'); el.className = 'plate';
    el.innerHTML = `<b>${guy.def.name}</b><i>${guy.trait.ru}</i><div class="pbar"><div></div></div>`;
    this.el.layer.appendChild(el); p = { el, bar: el.querySelector('.pbar div') }; this.plates.set(guy, p); return p;
  }
  bubble(guy, text, dur = 2.2, cls = '') {
    for (const b of this.bubbles) if (b.guy === guy) { b.el.remove(); b.dead = true; }
    this.bubbles = this.bubbles.filter((b) => !b.dead);
    const el = document.createElement('div'); el.className = 'bubble ' + cls; el.textContent = text; this.el.layer.appendChild(el);
    this.bubbles.push({ guy, el, t: 0, dur });
  }
  toast(title, sub = '') {
    const t = this.el.toast; t.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  }
  banner(text, cls = '', ms = 1400) {
    const b = this.el.banner; b.className = ''; b.textContent = text; void b.offsetWidth; b.className = 'show ' + cls;
    clearTimeout(this._bt); this._bt = setTimeout(() => (b.className = ''), ms);
  }
  hint(text, dur = 2.5) { this.el.hint.textContent = text; this.el.hint.classList.add('show'); this.hintT = dur; }
  log(html) { const d = document.createElement('div'); d.innerHTML = html; this.el.log.prepend(d); while (this.el.log.children.length > 4) this.el.log.lastChild.remove(); setTimeout(() => d.classList.add('fade'), 5000); }
  combo(n) {
    const c = this.el.combo; if (n < 2) { c.classList.remove('show'); return; }
    this.el.comboN.textContent = n; this.el.comboL.textContent = n >= 8 ? 'БЕЗУПРЕЧНО' : n >= 5 ? 'СТИЛЬНО' : 'КОМБО';
    c.classList.add('show'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
  }
  update(dt) {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    this.el.rep.textContent = Math.round(g.rep); this.el.money.textContent = save.money + ' ₽';
    let rank = RANKS[0][1]; for (const [v, n] of RANKS) if (g.rep >= v) rank = n; this.el.rank.textContent = rank;
    this.el.focus.style.width = Math.min(100, g.focus) + '%'; this.el.focusBox.classList.toggle('full', g.focus >= 100);
    this.el.goals.innerHTML = `Проучено: <b>${g.guys.filter((x) => x.out).length}</b> / ${g.guys.length}`;
    if ((this.hintT -= dt) < 0) this.el.hint.classList.remove('show');
    // target card: current or nearest engaged guy
    const t = g.player.target && g.player.distTo(g.player.target) < 7 ? g.player.target : g.focusGuy;
    if (t) {
      this.el.tcard.classList.add('show'); this.el.tname.textContent = `${t.def.name}, ${t.def.age}`; this.el.ttrait.textContent = t.trait.ru;
      this.el.tstate.textContent = t.stateRu; this.el.tstate.dataset.s = t.state; this.el.tpain.style.width = (t.out ? 100 : t.pain.frac * 100) + '%';
    } else this.el.tcard.classList.remove('show');
    // nameplates
    for (const guy of g.guys) {
      const p = this.plate(guy); guy.headPos(_v); _v.y += 0.32;
      const d = _v.distanceTo(cam.position); _v.project(cam);
      const vis = _v.z < 1 && d < 16 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && g.started;
      p.el.style.display = vis ? '' : 'none'; if (!vis) continue;
      const s = Math.max(0.6, Math.min(1.1, 5 / d));
      p.el.style.transform = `translate(-50%,-100%) translate(${(_v.x * 0.5 + 0.5) * W}px,${(1 - (_v.y * 0.5 + 0.5)) * H}px) scale(${s})`;
      p.bar.style.width = (guy.out ? 100 : guy.pain.frac * 100) + '%'; p.el.classList.toggle('out', guy.out); p.el.classList.toggle('alert', guy.mode === 'alert' || guy.mode === 'flee');
    }
    for (const b of this.bubbles) {
      b.t += dt; b.guy.headPos(_v); _v.y += 0.62; const d = _v.distanceTo(cam.position); _v.project(cam);
      const vis = _v.z < 1 && d < 18; b.el.style.display = vis ? '' : 'none';
      b.el.style.transform = `translate(-50%,-100%) translate(${(_v.x * 0.5 + 0.5) * W}px,${(1 - (_v.y * 0.5 + 0.5)) * H}px)`;
      b.el.style.opacity = b.t > b.dur - 0.3 ? String(Math.max(0, (b.dur - b.t) / 0.3)) : '1';
      if (b.t > b.dur) { b.el.remove(); b.dead = true; }
    }
    this.bubbles = this.bubbles.filter((b) => !b.dead);
  }
}
export { GRADE_RU };
