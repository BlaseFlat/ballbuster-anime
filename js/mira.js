// Мира — подруга на районе: диалоги, квесты, помощь в бою (держать руки / отвлечь).
import * as THREE from 'three';
import { MIRA } from './config.js';
import { tint } from './chars.js';
import { save } from './outfits.js';

const $ = (id) => document.getElementById(id);
const pick = (a) => a[(Math.random() * a.length) | 0];

// Assist tuning
const HOLD_DUR = 3.2;     // s arms locked
const HOLD_CD = 9.0;      // s between holds
const DIST_DUR = 1.35;    // s open window
const DIST_CD = 7.0;
const RUN = 4.8;
const JOIN_RANGE = 22;    // can call from this far
const GRAB_RANGE = 1.15;

export class Mira {
  constructor(game, actor) {
    this.g = game; this.actor = actor; this.def = MIRA;
    this.home = new THREE.Vector3(...MIRA.pos);
    this.pos = this.home.clone(); this.yaw = MIRA.yaw;
    this.radius = 0.35; this.talking = false; this.cooldown = 0; this.near = false;
    this.assist = null;           // Guy currently targeted for help
    this.state = 'idle';          // idle | run | hold | distract | return
    this.holdT = 0; this.holdCd = 0;
    this.distT = 0; this.distCd = 0;
    this._hinted = false; this._fightHint = 0;
    tint(actor.vrm, { hair: MIRA.hair, tint: MIRA.tint });
    actor.root.position.copy(this.pos); actor.root.rotation.y = this.yaw;
    actor.play('idle', { fade: 0 }); actor.setExpr('happy', 0.35);
  }

  // ---------- dialogue (unchanged flow) ----------
  update(dt) {
    const g = this.g, P = g.player, A = this.actor;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.holdCd = Math.max(0, this.holdCd - dt);
    this.distCd = Math.max(0, this.distCd - dt);
    if (this.holdT > 0) this.holdT = Math.max(0, this.holdT - dt);
    if (this.distT > 0) this.distT = Math.max(0, this.distT - dt);

    if (this.state === 'idle' || this.state === 'return') this._idleOrReturn(dt);
    else this._assistTick(dt);

    A.root.position.copy(this.pos); A.root.rotation.y = this.yaw;

    // talk prompt only when idle at home and not fighting
    const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    this.near = this.state === 'idle' && d < 2.4 && !g.shopMode && !g.nearFight && !g.dialogOpen
      && P.state !== 'strike' && P.state !== 'caught';
    if (this.near && !this.talking && !this._hinted) {
      this._hinted = true;
      g.ui.hint(save.miraMet ? 'E — поговорить с Мирой' : 'E — познакомиться с Мирой', 3.5);
    }
    if (!this.near) this._hinted = false;

    // fight assist prompt
    if (save.miraMet && g.nearFight && !g.shopMode && !g.dialogOpen && this.state === 'idle') {
      this._fightHint -= dt;
      if (this._fightHint <= 0) {
        this._fightHint = 5;
        const h = this.holdCd > 0 ? `держать ${this.holdCd.toFixed(0)}с` : 'R — держать';
        const t = this.distCd > 0 ? `отвлечь ${this.distCd.toFixed(0)}с` : 'T — отвлечь';
        g.ui.hint(`Мира рядом: ${h} · ${t}`, 3.5);
      }
    }
  }

  /** After Actor mixer + vrm.update — wrist snap IK and look-at so they aren't overwritten. */
  lateUpdate() {
    const A = this.actor, vrm = A.vrm, guy = this.assist;
    if (this.state === 'hold' && guy && !guy.out && !guy.dropped) this._grabIK(guy);
    if ((this.state === 'distract' || this.state === 'hold') && guy && vrm.lookAt) {
      const hp = guy.headPos(new THREE.Vector3());
      try { vrm.lookAt.lookAt(hp); } catch (e) {}
    }
  }

  /** CCD IK: rotate joints so the tip approaches worldTarget (axis-agnostic). */
  _ccd(bones, target, iters = 8) {
    if (!bones.length) return;
    const tip = bones[bones.length - 1];
    const bonePos = new THREE.Vector3(), tipPos = new THREE.Vector3();
    const toTip = new THREE.Vector3(), toTarget = new THREE.Vector3();
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), inv = new THREE.Quaternion();
    for (let i = 0; i < iters; i++) {
      for (let b = bones.length - 2; b >= 0; b--) {
        const bone = bones[b]; if (!bone?.parent) continue;
        bone.updateWorldMatrix(true, true);
        tip.updateWorldMatrix(true, false);
        bonePos.setFromMatrixPosition(bone.matrixWorld);
        tipPos.setFromMatrixPosition(tip.matrixWorld);
        toTip.copy(tipPos).sub(bonePos); if (toTip.lengthSq() < 1e-10) continue; toTip.normalize();
        toTarget.copy(target).sub(bonePos); if (toTarget.lengthSq() < 1e-10) continue; toTarget.normalize();
        q.setFromUnitVectors(toTip, toTarget);
        bone.parent.getWorldQuaternion(pq);
        inv.copy(pq).invert();
        // world Δq → local: inv * q * pq, then premultiply onto bone
        const local = inv.multiply(q).multiply(pq);
        bone.quaternion.premultiply(local);
      }
    }
  }

  _grabIK(guy) {
    const mh = this.actor.vrm.humanoid, gh = guy.actor.vrm.humanoid;
    const chest = mh.getNormalizedBoneNode('chest') || mh.getNormalizedBoneNode('spine');
    const cPos = chest ? chest.getWorldPosition(new THREE.Vector3()) : this.pos.clone().setY(this.pos.y + 1.15);
    // 1) tug guy wrists behind toward Mira (reinforce pin)
    for (const side of ['left', 'right']) {
      const chain = ['UpperArm', 'LowerArm', 'Hand'].map((s) => gh.getNormalizedBoneNode(side + s)).filter(Boolean);
      if (chain.length < 2) continue;
      const pull = cPos.clone();
      const lat = side === 'left' ? -0.14 : 0.14;
      pull.x += Math.cos(guy.yaw) * lat; pull.z -= Math.sin(guy.yaw) * lat;
      pull.y -= 0.05;
      this._ccd(chain, pull, 6);
    }
    guy.actor.vrm.scene.updateMatrixWorld(true);
    // 2) Mira hands reach those wrists
    for (const side of ['left', 'right']) {
      const gHand = gh.getNormalizedBoneNode(side + 'Hand');
      const chain = ['UpperArm', 'LowerArm', 'Hand'].map((s) => mh.getNormalizedBoneNode(side + s)).filter(Boolean);
      if (!gHand || chain.length < 2) continue;
      const goal = gHand.getWorldPosition(new THREE.Vector3());
      goal.lerp(cPos, 0.08); // slight overlap into the grip
      this._ccd(chain, goal, 10);
    }
    this.actor.vrm.scene.updateMatrixWorld(true);
  }

  _idleOrReturn(dt) {
    const A = this.actor, P = this.g.player;
    if (this.state === 'return') {
      const dx = this.home.x - this.pos.x, dz = this.home.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.35) {
        this.state = 'idle'; this.pos.copy(this.home); this.yaw = MIRA.yaw;
        A.play('idle', { fade: 0.25 }); A.setExpr('happy', 0.35);
      } else {
        this.pos.x += (dx / d) * RUN * dt; this.pos.z += (dz / d) * RUN * dt;
        this.yaw = Math.atan2(dx, dz);
        A.play('run', { fade: 0.15, speed: 1.1 });
      }
      return;
    }
    // idle at home: face player when close
    const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (d < 4) {
      const yaw = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
      let dy = yaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 4);
    }
    if (!this.talking) A.play(d < 3 ? 'talk' : 'idle', { fade: 0.3 });
  }

  _assistTick(dt) {
    const g = this.g, A = this.actor, guy = this.assist;
    // target gone / fight over → return home
    if (!guy || guy.out || guy.dropped || (guy.mode === 'calm' && this.state !== 'hold' && this.state !== 'distract')) {
      this._release(); this.state = 'return'; this.assist = null; return;
    }
    if (this.state === 'run') {
      const side = this._slot(guy);
      const dx = side.x - this.pos.x, dz = side.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) {
        this.pos.copy(side);
        if (this._pending === 'hold') this._beginHold(guy);
        else this._beginDistract(guy);
      } else {
        this.pos.x += (dx / d) * RUN * dt; this.pos.z += (dz / d) * RUN * dt;
        this.yaw = Math.atan2(dx, dz);
        A.play('run', { fade: 0.1, speed: 1.15 });
      }
      return;
    }
    if (this.state === 'hold') {
      // stick behind him, pin arms
      const slot = this._slot(guy, 0.55);
      this.pos.lerp(slot, Math.min(1, dt * 10));
      this.yaw = guy.yaw;
      A.play('hold', { fade: 0.1 });
      A.setExpr('angry', 0.55); A.setExpr('happy', 0);
      guy.held = true; guy.heldBy = this;
      if (guy.actor.curName !== 'held') guy.actor.play('held', { fade: 0.12 });
      if (this.holdT <= 0 || guy.level > 0) {
        this._release(); this.holdCd = HOLD_CD;
        this.state = guy.out || guy.dropped ? 'return' : 'run';
        this._pending = null;
        if (!guy.out && !guy.dropped) { this.state = 'return'; this.assist = null; }
        g.ui.toast('Мира', 'Отпустила');
      }
      return;
    }
    if (this.state === 'distract') {
      const slot = this._slot(guy, 1.35, 1); // off to the side, in his view
      this.pos.lerp(slot, Math.min(1, dt * 8));
      this.yaw = Math.atan2(guy.pos.x - this.pos.x, guy.pos.z - this.pos.z);
      A.play('tease', { fade: 0.08, restart: A.curName !== 'tease' });
      A.setExpr('happy', 0.7); A.setExpr('angry', 0.2);
      if (this.distT <= 0 || guy.level > 0) {
        this.distCd = DIST_CD;
        this.state = 'return'; this.assist = null;
        A.setExpr('happy', 0.35);
      }
    }
  }

  _slot(guy, back = 0.55, side = 0) {
    // behind (+ optional side) relative to guy facing
    const s = Math.sin(guy.yaw), c = Math.cos(guy.yaw);
    return new THREE.Vector3(
      guy.pos.x - s * back + c * side * 0.85,
      guy.pos.y,
      guy.pos.z - c * back - s * side * 0.85
    );
  }

  _beginHold(guy) {
    this.state = 'hold'; this.holdT = HOLD_DUR; this._pending = null;
    guy.held = true; guy.heldBy = this; guy._wasHeld = true;
    guy.guardUntil = 0; guy.guardLv = 0; guy.guardAt = 1e9;
    if (guy.act === 'windup' || guy.act === 'punch' || guy.act === 'guard') guy.setAct(null);
    guy.actor.play('held', { fade: 0.1, restart: true });
    guy.say(pick(['Эй, пусти!', 'Руки… руки!', 'Не трогай!']), 1.6);
    this.g.ui.banner('Мира держит!', 'mira', 1200);
    this.g.ui.toast('Мира', 'Держит руки — бей в пах!');
    this.g.sfx.chord?.();
    this.actor.play('hold', { fade: 0.08 }); this.actor.setExpr('angry', 0.6);
  }

  _beginDistract(guy) {
    this.state = 'distract'; this.distT = DIST_DUR; this._pending = null;
    guy.openUntil = this.g.now + DIST_DUR;
    guy.guardUntil = 0; guy.guardLv = 0;
    if (guy.act === 'guard' || guy.act === 'windup') guy.setAct('taunt'); // forced look-away
    else guy.setAct('taunt');
    guy.actor.play('taunt', { fade: 0.1, restart: true });
    guy.say(pick(['А? Что?', 'Эй, отстань!', 'Кто…']), 1.4);
    this.g.ui.banner('Отвлекла!', 'mira', 1100);
    this.g.ui.toast('Мира', 'Окно для идеального удара!');
    this.g.sfx.blip?.(1047);
    this.actor.play('tease', { fade: 0.08, restart: true });
  }

  _release() {
    const guy = this.assist;
    if (guy && guy.heldBy === this) { guy.held = false; guy.heldBy = null; guy.guardAt = 0; }
  }

  // ---------- player input ----------
  /** R — hold arms. T — distract. Auto-runs to the current fight target. */
  requestAssist(kind) {
    const g = this.g;
    if (!save.miraMet) { g.ui.hint('Сначала познакомься с Мирой у «Шёлка» (E)', 3); return false; }
    if (g.shopMode || g.dialogOpen || this.talking) return false;
    if (this.state === 'hold' || this.state === 'distract') {
      g.ui.hint(this.state === 'hold' ? 'Мира уже держит!' : 'Мира уже отвлекает!', 1.5); return false;
    }
    if (kind === 'hold' && this.holdCd > 0) { g.ui.hint(`Держать через ${this.holdCd.toFixed(0)} с`, 1.8); return false; }
    if (kind === 'distract' && this.distCd > 0) { g.ui.hint(`Отвлечь через ${this.distCd.toFixed(0)} с`, 1.8); return false; }

    const guy = this._pickTarget();
    if (!guy) { g.ui.hint('Рядом нет парня для боя', 2); return false; }
    const dist = Math.hypot(guy.pos.x - this.pos.x, guy.pos.z - this.pos.z);
    if (dist > JOIN_RANGE && Math.hypot(g.player.pos.x - this.home.x, g.player.pos.z - this.home.z) > JOIN_RANGE) {
      g.ui.hint('Мира слишком далеко — позови ближе к району', 2.5); return false;
    }
    this.assist = guy; this._pending = kind;
    guy.alert();
    if (dist <= GRAB_RANGE + 0.4) {
      if (kind === 'hold') this._beginHold(guy); else this._beginDistract(guy);
    } else {
      this.state = 'run';
      g.ui.toast('Мира', kind === 'hold' ? 'Бегу держать!' : 'Сейчас отвлеку!');
      this.actor.play('run', { fade: 0.1 });
    }
    return true;
  }

  _pickTarget() {
    const g = this.g, P = g.player;
    let best = null, bd = 1e9;
    // prefer player's current target, else nearest alert/engaged guy
    const cand = g.player.target && !g.player.target.out ? [g.player.target] : g.guys;
    for (const x of (Array.isArray(cand) ? cand : g.guys)) {
      if (x.out || x.dropped || x.level >= 3) continue;
      const d = Math.hypot(x.pos.x - P.pos.x, x.pos.z - P.pos.z);
      if (d < bd && d < 8) { bd = d; best = x; }
    }
    if (!best) for (const x of g.guys) {
      if (x.out || x.dropped) continue;
      if (x.mode === 'alert' || x.mode === 'flee') {
        const d = Math.hypot(x.pos.x - P.pos.x, x.pos.z - P.pos.z);
        if (d < bd && d < 10) { bd = d; best = x; }
      }
    }
    return best;
  }

  tryTalk() {
    if (!this.near || this.talking || this.cooldown > 0 || this.g.shopMode) return false;
    if (this.state !== 'idle') return false;
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
      add('Привет, Мира', () => {
        box.textContent = MIRA.greet[1] + '\n\nМира: «В бою зови: R — держу ему руки, T — отвлеку. Потом бей точно в пах».';
        opts.innerHTML = ''; add('Что нужно сделать?', () => this.render('quests')); add('Пока', () => this.close(), 'ghost');
      });
    } else if (mode === 'hub') {
      box.textContent = pick(MIRA.chat);
      add('Квесты', () => this.render('quests'));
      add('Помощь в бою', () => {
        box.textContent = 'Мира: «R — держу руки: не ударит и не закроется. T — отвлекаю: секунда на идеальный удар. Откат несколько секунд — не спамь».';
        opts.innerHTML = ''; add('Поняла', () => this.render('hub')); add('Пока', () => this.close(), 'ghost');
      });
      add('Совет по бою', () => {
        box.textContent = 'Мира: «Один идеальный ап-кик или колено — и он падает. Скользом не считается. Не долби воздухом».';
        opts.innerHTML = ''; add('Поняла', () => this.render('hub')); add('Пока', () => this.close(), 'ghost');
      });
      add('Про район', () => {
        box.textContent = 'Мира: «Торговая — наша. Во дворе трусы и Стас. У «Неона» — Макс, мнит себя хозяином. На крыше Кирилл. Зови R/T в бою — держу крепко за запястья».';
        opts.innerHTML = ''; add('Поняла', () => this.render('hub')); add('Пока', () => this.close(), 'ghost');
      });
      add('Пока', () => this.close(), 'ghost');
    } else if (mode === 'quests') {
      const lines = MIRA.quests.map((q) => {
        const p = save.questProg(q.id), done = p >= q.goal, cur = Math.min(p, q.goal);
        return `• ${q.ru} — ${done ? '✓ готово' : `${cur}/${q.goal}`}\n  ${q.desc}`;
      });
      box.textContent = 'Мира: «Вот что сейчас по району важно:»\n\n' + lines.join('\n\n');
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
  onWin(guy, grade) {
    save.questAdd('cleanup', 1);
    if (grade === 'perfect') save.questAdd('precision', 1);
    if (guy._wasHeld || guy.held) save.questAdd('teamwork', 1);
    if (guy.def?.id === 'maks') save.questAdd('neon_king', 1);
    if (this.assist === guy) { this._release(); this.state = 'return'; this.assist = null; }
  }
  onBuy() { save.questAdd('silk', 1); }
}
