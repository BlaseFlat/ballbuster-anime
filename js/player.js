// Rusana: third-person movement, auto-targeted anime dash-in strikes, dodge with perfect-dodge witch time.
import * as THREE from 'three';
import { PLAYER, STRIKES, COMBAT } from './config.js';
import { gradeStrike } from './combat.js';

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const DEG = 180 / Math.PI;

export class Player {
  constructor(actor, game) {
    this.actor = actor; this.game = game; this.world = game.world;
    this.pos = new THREE.Vector3(-12, 0, 2.2); this.yaw = Math.PI / 2; this.vel = new THREE.Vector3(); this.speed = 0;
    this.state = 'move'; this.t = 0; this.queue = null; this.target = null; this.strike = null;
    this.dodgeCd = 0; this.iframes = 0; this.lastContact = -99; this.combatT = 0;
    this.radius = 0.28; this.hipsBone = actor.vrm.humanoid.getNormalizedBoneNode('hips');
    this.footR = actor.vrm.humanoid.getNormalizedBoneNode('rightFoot'); this.kneeR = actor.vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
    actor.play('idle', { fade: 0 });
    this.baseFace();
  }
  baseFace() { const A = this.actor; A.setExpr('angry', 0.35); A.setExpr('relaxed', 0.3); A.setExpr('happy', 0); A.setExpr('surprised', 0); A.setExpr('aa', 0); }
  smirk(t = 0.8) { const A = this.actor; A.setExpr('happy', 0.45); A.setExpr('angry', 0.15); A.setExpr('relaxed', 0.2); clearTimeout(this._sm); this._sm = setTimeout(() => this.state !== 'victory' && this.baseFace(), t * 1000); }

  // --- target selection: nearest standing-able guy in a cone around the wanted direction ---
  pickTarget(dirYaw) {
    let best = null, bs = 1e9;
    for (const g of this.game.guys) {
      if (g.out && g.tapT > 0.3) continue;
      const dx = g.pos.x - this.pos.x, dz = g.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > COMBAT.reach || Math.abs(g.pos.y - this.pos.y) > 1) continue;
      const a = Math.abs(angDiff(Math.atan2(dx, dz), dirYaw)) * DEG;
      if (a > COMBAT.cone && d > 1.1) continue;
      const s = d + a / 60 + (g.out ? 5 : 0);
      if (s < bs) { bs = s; best = g; }
    }
    return best;
  }
  request(kind) {
    if (this.state === 'strike' && this.t > this.strike.def.contact) { this.queue = kind; return; }
    if (this.state === 'dash' || this.state === 'dodge' || this.state === 'caught' || this.state === 'strike') { this.queue = kind; return; }
    if (this.state === 'victory') return;
    this.begin(kind);
  }
  begin(kind) {
    const g = this.game;
    const dirYaw = g.input.moveLen > 0.2 ? g.input.moveYaw : this.target && !this.target.out ? Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) : this.yaw;
    const tgt = this.pickTarget(dirYaw);
    if (kind === 'finisher' && (g.focus < 100 || !tgt || tgt.out)) { g.ui.hint(g.focus < 100 ? 'Добивание: нужен полный «Фокус»' : 'Нет цели для добивания'); return; }
    let move = kind;
    // contextual finishers on downed guys always override the loadout slot
    if (tgt && kind !== 'finisher') { if (tgt.level === 3) move = 'lowkick'; else if (tgt.level >= 4) move = 'stomp'; }
    if (!STRIKES[move]) { g.ui.hint('Приём не экипирован'); return; }
    this.target = tgt; this.move = move; this.dashed = false;
    if (tgt) {
      const d = this.distTo(tgt);
      if (d > STRIKES[move].dist + 0.4) { this.state = 'dash'; this.t = 0; this.dashed = true; this.actor.play('sprint', { fade: 0.08, speed: 1.3 }); g.sfx.whoosh(0.7); g.fx.speedLines(0.55); return; }
    }
    this.startStrike();
  }
  distTo(g) { return Math.hypot(g.pos.x - this.pos.x, g.pos.z - this.pos.z); }
  startStrike() {
    const def = STRIKES[this.move], g = this.game;
    this.state = 'strike'; this.t = 0; this.resolved = false; this.strike = { def, move: this.move };
    this.actor.play(def.clip.slice(2), { fade: 0.06, restart: true, speed: this.move === 'finisher' ? 1 : 1.0 });
    this.fromYaw = this.yaw;
    if (this.target) this.target.onStrikeStart(def.contact, this.move);
    g.sfx.whoosh(this.move === 'knee' ? 0.8 : 1.1);
    if (this.move === 'finisher') g.startFinisher(this.target);
    this.combatT = 4;
    // skirt mesh clips through raised thighs on high kicks — hide for the strike
    this._skirtHide = null;
    if (/kick|roundhouse|axe|heel|jumpknee|finisher/.test(this.move)) {
      this._skirtHide = [];
      this.actor.vrm.scene.traverse((ob) => {
        if (ob.isMesh && /Bottoms_01/.test(ob.name) && ob.visible) { this._skirtHide.push(ob); ob.visible = false; }
      });
    }
  }
  _restoreSkirt() {
    if (!this._skirtHide) return;
    for (const ob of this._skirtHide) ob.visible = true;
    this._skirtHide = null;
  }
  dodge() {
    if (this.dodgeCd > 0 || this.state === 'victory' || this.state === 'caught') return;
    if (this.state === 'strike' && this.t < this.strike.def.contact) return;   // committed until contact
    const g = this.game;
    const dir = g.input.moveLen > 0.2 ? g.input.moveYaw : this.yaw + Math.PI;
    this.dodgeDir = new THREE.Vector3(Math.sin(dir), 0, Math.cos(dir));
    this.state = 'dodge'; this.t = 0; this.iframes = PLAYER.dodgeIframes; this.dodgeCd = PLAYER.dodgeTime + PLAYER.dodgeCd;
    this.actor.play('dodge', { fade: 0.05, restart: true, speed: 0.38 / PLAYER.dodgeTime });
    g.sfx.whoosh(1.4);
    // perfect dodge: a guy's punch lands within the next ~0.3 s nearby
    for (const guy of g.guys) {
      if (guy.out || guy.level) continue;
      const tl = guy.act === 'windup' ? 0.5 / guy.trait.speed - guy.actT + 0.12 : guy.act === 'punch' ? 0.12 - guy.actT : 9;
      if (tl > -0.05 && tl < 0.32 && this.distTo(guy) < 2.4) { g.perfectDodge(guy); break; }
    }
  }
  caught(guy) {
    const g = this.game;
    this.state = 'caught'; this.t = 0; this.queue = null;
    this.actor.play('caught', { fade: 0.04, restart: true });
    const A = this.actor; A.setExpr('surprised', 0.6); A.setExpr('angry', 0.6); A.setExpr('happy', 0);
    setTimeout(() => this.baseFace(), 700);
    const dx = this.pos.x - guy.pos.x, dz = this.pos.z - guy.pos.z, d = Math.hypot(dx, dz) || 1; this.vel.set(dx / d * 3, 0, dz / d * 3);
  }
  resolve() {
    const g = this.game, S = this.strike, tgt = this.target;
    this.resolved = true;
    if (!tgt || tgt.out && S.move !== 'stomp') { g.onWhiff(S.move); return; }
    const d = this.distTo(tgt), a = Math.abs(angDiff(Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), this.yaw)) * DEG;
    const since = g.now - this.lastContact;
    const timing = { open: tgt.isOpen(), held: !!tgt.held, distract: g.now < (tgt.openUntil || 0), rhythm: since >= COMBAT.rhythmWin[0] && since <= COMBAT.rhythmWin[1] + S.def.contact, dash: this.dashed, witch: g.witch > 0 || S.move === 'finisher' };
    const res = gradeStrike({ move: S.move, distErr: Math.abs(d - S.def.dist), angleDeg: a, timing, defense: { guard: tgt.guard() } });
    if (tgt.out && S.move === 'stomp' && res.grade !== 'miss') res.grade = 'glance';
    if (res.grade !== 'miss') this.lastContact = g.now;
    g.onStrike(tgt, S.move, res, { d, a, timing });
  }
  contactPoint(out = new THREE.Vector3()) {
    const n = this.move === 'knee' ? this.kneeR : this.footR; return n.getWorldPosition(out);
  }
  update(dt, input) {
    const g = this.game, A = this.actor;
    this.t += dt; this.dodgeCd -= dt; this.iframes -= dt; this.combatT -= dt;
    let tv = new THREE.Vector3(), faceYaw = null, accel = PLAYER.accel;
    if (this.state === 'move') {
      if (this._skirtHide) this._restoreSkirt();
      if (input.moveLen > 0.05) {
        const sp = input.run ? PLAYER.run : PLAYER.walk;
        tv.set(Math.sin(input.moveYaw), 0, Math.cos(input.moveYaw)).multiplyScalar(sp * Math.min(1, input.moveLen)); faceYaw = input.moveYaw;
      }
      if (this.queue) { const q = this.queue; this.queue = null; this.begin(q); }
    } else if (this.state === 'dash') {
      const tgt = this.target, def = STRIKES[this.move];
      const dx = tgt.pos.x - this.pos.x, dz = tgt.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      faceYaw = Math.atan2(dx, dz); accel = 40;
      tv.set(dx / d, 0, dz / d).multiplyScalar(COMBAT.dashSpeed);
      if (d <= def.dist + 0.45 || this.t > 0.7) { g.fx.speedLines(0); this.vel.multiplyScalar(0.35); this.startStrike(); }
    } else if (this.state === 'strike') {
      const def = this.strike.def, tgt = this.target; accel = 30;
      if (tgt && this.t < def.contact) {
        const dx = tgt.pos.x - this.pos.x, dz = tgt.pos.z - this.pos.z, d = Math.hypot(dx, dz);
        faceYaw = Math.atan2(dx, dz);
        // magnet: slide toward the ideal contact distance, capped
        const err = d - def.dist, rem = Math.max(0.03, def.contact - this.t);
        const v = Math.max(-COMBAT.lungeMax / def.contact, Math.min(COMBAT.lungeMax / def.contact * 1.6, err / rem * COMBAT.magnet));
        tv.set(dx / d * v, 0, dz / d * v); accel = 60;
      }
      if (!this.resolved && this.t >= def.contact) this.resolve();
      if (this.queue && this.t >= def.contact + def.recover * 0.6) { const q = this.queue; this.queue = null; this._restoreSkirt(); this.state = 'move'; this.begin(q); }
      else if (this.t >= A.dur / Math.max(0.1, A.cur.timeScale) - 0.02) { this._restoreSkirt(); this.state = 'move'; if (this.move === 'finisher') g.endFinisher(); }
    } else if (this.state === 'dodge') {
      const k = Math.max(0, 1 - this.t / PLAYER.dodgeTime);
      tv.copy(this.dodgeDir).multiplyScalar(PLAYER.dodgeDist / PLAYER.dodgeTime * 1.6 * k); accel = 60;
      if (this.t >= PLAYER.dodgeTime) { this.state = 'move'; if (this.queue) { const q = this.queue; this.queue = null; this.begin(q); } }
    } else if (this.state === 'caught') {
      accel = 6; if (this.t > 0.5) { this.state = 'move'; this.queue = null; }
    } else if (this.state === 'victory') {
      accel = 10;
    }
    this.vel.x += (tv.x - this.vel.x) * Math.min(1, dt * accel); this.vel.z += (tv.z - this.vel.z) * Math.min(1, dt * accel);
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.world.collide(this.pos, this.radius);
    // keep a personal-space circle to guys (not while striking the target at contact distance)
    for (const guy of g.guys) {
      const dx = this.pos.x - guy.pos.x, dz = this.pos.z - guy.pos.z, d = Math.hypot(dx, dz), m = guy.level >= 3 ? 0.35 : 0.42;
      if (d < m && d > 1e-4 && Math.abs(guy.pos.y - this.pos.y) < 1) { this.pos.x = guy.pos.x + dx / d * m; this.pos.z = guy.pos.z + dz / d * m; }
    }
    if (faceYaw !== null) this.yaw += angDiff(faceYaw, this.yaw) * Math.min(1, dt * (this.state === 'move' ? PLAYER.turn : 22));
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.state === 'move') {
      const fight = this.combatT > 0 || g.nearFight;
      if (this.speed > 3.2) A.play('run', { speed: this.speed / 3.9, fade: 0.2 });
      else if (this.speed > 0.3) A.play('walk', { speed: Math.max(0.7, this.speed / 1.35), fade: 0.2 });
      else A.play(fight ? 'stance' : 'idle', { fade: 0.25 });
    }
    A.root.position.copy(this.pos); A.root.rotation.y = this.yaw;
  }
}
