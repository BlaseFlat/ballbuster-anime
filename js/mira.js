// Мира — подруга на районе. Встреча, диалоги, 2–3 простых квеста. Не бой.
import * as THREE from 'three';
import { MIRA } from './config.js';
import { tint } from './chars.js';
import { save } from './outfits.js';

const $ = (id) => document.getElementById(id);
const pick = (a) => a[(Math.random() * a.length) | 0];

export class Mira {
  constructor(game, actor) {
    this.g = game; this.actor = actor; this.def = MIRA;
    this.pos = new THREE.Vector3(...MIRA.pos); this.yaw = MIRA.yaw;
    this.radius = 0.35; this.talking = false; this.cooldown = 0; this.near = false;
    tint(actor.vrm, { hair: MIRA.hair, tint: MIRA.tint });
    actor.root.position.copy(this.pos); actor.root.rotation.y = this.yaw;
    actor.play('idle', { fade: 0 }); actor.setExpr('happy', 0.35);
    this._plate = null;
  }
  update(dt) {
    const g = this.g, P = g.player, A = this.actor;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    this.near = d < 2.4 && !g.shopMode && !g.nearFight && P.state !== 'strike' && P.state !== 'caught';
    // face the player when close
    if (d < 4) {
      const yaw = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
      let dy = yaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 4);
    }
    A.root.position.copy(this.pos); A.root.rotation.y = this.yaw;
    if (!this.talking) A.play(d < 3 ? 'talk' : 'idle', { fade: 0.3 });
    // tip
    if (this.near && !this.talking && !this._hinted) {
      this._hinted = true;
      g.ui.hint(save.miraMet ? 'E — поговорить с Мирой' : 'E — познакомиться с Мирой', 3.5);
    }
    if (!this.near) this._hinted = false;
  }
  tryTalk() {
    if (!this.near || this.talking || this.cooldown > 0 || this.g.shopMode) return false;
    this.open(); return true;
  }
  open() {
    const g = this.g; this.talking = true; g.dialogOpen = true;
    document.exitPointerLock?.(); g.input.keys.clear();
    const first = !save.miraMet;
    if (first) save.miraMeet();
    this.actor.setExpr('happy', 0.55); this.actor.play('talk', { fade: 0.15 });
    this.render(first ? 'greet' : 'hub');
    $('dialog').classList.add('show');
  }
  close() {
    this.talking = false; this.g.dialogOpen = false; this.cooldown = 0.6;
    $('dialog').classList.remove('show');
    this.actor.setExpr('happy', 0.3); this.actor.play('idle', { fade: 0.2 });
  }
  render(mode) {
    const box = $('dialogBody'), name = $('dialogName'), opts = $('dialogOpts');
    name.textContent = `Мира · ${MIRA.age}`;
    opts.innerHTML = '';
    const add = (label, fn, cls = '') => {
      const b = document.createElement('button'); b.className = 'dopt ' + cls; b.textContent = label;
      b.onclick = () => fn(); opts.appendChild(b);
    };
    if (mode === 'greet') {
      box.textContent = MIRA.greet[0];
      add('Привет, Мира', () => { box.textContent = MIRA.greet[1]; opts.innerHTML = ''; add('Что нужно сделать?', () => this.render('quests')); add('Пока', () => this.close(), 'ghost'); });
    } else if (mode === 'hub') {
      box.textContent = pick(MIRA.chat);
      add('Квесты', () => this.render('quests'));
      add('Совет по бою', () => { box.textContent = 'Мира: «Один идеальный ап-кик или колено — и он падает. Скользом не считается. Не долби воздухом».'; opts.innerHTML = ''; add('Поняла', () => this.render('hub')); add('Пока', () => this.close(), 'ghost'); });
      add('Пока', () => this.close(), 'ghost');
    } else if (mode === 'quests') {
      const lines = MIRA.quests.map((q) => {
        const p = save.questProg(q.id), done = p >= q.goal, cur = Math.min(p, q.goal);
        return `• ${q.ru} — ${done ? '✓ готово' : `${cur}/${q.goal}`}\n  ${q.desc}`;
      });
      box.textContent = 'Мира: «Вот что сейчас по району важно:»\n\n' + lines.join('\n\n');
      // claim rewards
      let claimed = false;
      for (const q of MIRA.quests) {
        if (save.questProg(q.id) >= q.goal && !save.questClaimed(q.id)) {
          add(`Забрать награду: «${q.ru}» (+${q.reward} ₽)`, () => {
            save.claimQuest(q.id); this.g.sfx.chord?.();
            this.g.ui.toast('Мира', q.done); this.g.ui.log(`Квест «${q.ru}»: +${q.reward} ₽`);
            this.render('quests');
          }, 'reward');
          claimed = true;
        }
      }
      if (!claimed) add('Назад', () => this.render('hub'));
      add('Пока', () => this.close(), 'ghost');
    }
  }
  // progress hooks from game events
  onWin(guy, grade) {
    save.questAdd('cleanup', 1);
    if (grade === 'perfect') save.questAdd('precision', 1);
  }
  onBuy() { save.questAdd('silk', 1); }
}
