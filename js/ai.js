// NPC guys: wandering, noticing Rusana, fighting back (guard, sidestep, taunt, telegraphed punch), fleeing,
// pain-state reactions with recovery, tapping out.
import * as THREE from 'three';
import { TRAITS, COMBAT, STATE_RU } from './config.js';
import { Pain, ORDER } from './combat.js';

const _v = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const RECOVER = [0, 0.7, 2.4, 3.6, 5.2];      // s after the last hit before a guy climbs one pain level back up
const GUY_WALK = 1.25, GUY_RUN = 3.3;

export class Guy {
  constructor(def, actor, game) {
    this.def = def; this.actor = actor; this.game = game; this.world = game.world;
    this.trait = TRAITS[def.trait]; this.pain = new Pain(this.trait.tough);
    this.pos = this.world.randomPoint(def.area); this.yaw = Math.random() * Math.PI * 2; this.vel = new THREE.Vector3();
    this.mode = 'calm'; this.level = 0; this.out = false; this.dropped = false; this.met = false;
    this.act = null; this.actT = 0; this.decideT = rnd(0.5, 2); this.goal = null; this.idleT = rnd(1, 4);
    this.guardLv = 0; this.guardUntil = 0; this.guardAt = 0; this.hits = 0; this.lastHitT = -99; this.tapT = 0;
    this.sayCd = 0; this.bubble = null; this.fleeT = 0; this.stepV = new THREE.Vector3();
    this.radius = 0.32; this.head = actor.vrm.humanoid.getNormalizedBoneNode('head');
    this.hipsBone = actor.vrm.humanoid.getNormalizedBoneNode('hips');
    actor.play('idle', { fade: 0 }); actor.actions.idle.time = Math.random() * 2;
    actor.setExpr('relaxed', 0.2);
  }
  get state() { return this.out ? 'tap' : ORDER[this.level]; }
  get stateRu() { return this.out ? 'сдался' : STATE_RU[ORDER[this.level]]; }
  get down() { return this.level >= 3 || this.out; }
  get canAct() { return this.level === 0 && !this.out; }
  headPos(out = new THREE.Vector3()) { return this.head.getWorldPosition(out); }
  hitPoint(out = new THREE.Vector3()) {           // where strikes land (groin ≈ hips bone, a bit forward)
    this.hipsBone.getWorldPosition(out); out.y -= 0.06;
    out.x += Math.sin(this.yaw) * 0.1; out.z += Math.cos(this.yaw) * 0.1; return out;
  }
  say(text, dur = 2.2, cls = '') { this.game.ui.bubble(this, text, dur, cls); this.sayCd = 3; }
  guard() { return this.guardLv; }
  isOpen() {   // mid-windup, recovering from a punch, taunting or slowed by witch-time
    return this.act === 'taunt' || (this.act === 'windup' && this.actT > 0.2) || (this.act === 'punch' && this.actT > 0.2) || this.game.witch > 0;
  }
  // ---- called by the player when a strike starts toward this guy ----
  onStrikeStart(eta, move) {
    if (!this.canAct || this.game.witch > 0) return;
    this.alert();
    const toP = Math.atan2(this.game.player.pos.x - this.pos.x, this.game.player.pos.z - this.pos.z);
    if (Math.abs(angDiff(toP, this.yaw)) > 1.5) return;                   // hit from behind: no chance to react
    if (this.act === 'windup' || this.act === 'punch') return;           // committed
    const learn = Math.min(0.25, this.hits * 0.04);                       // guys wise up after being hit
    const r = Math.random();
    if (r < this.trait.guard + learn) {
      const delay = rnd(0.1, 0.26) / (0.8 + this.trait.react);
      this.guardAt = this.game.now + delay; this.guardUntil = this.game.now + delay + rnd(0.8, 1.4); this.setAct('guard');
    } else if (r < this.trait.guard + learn + this.trait.dodge && move !== 'finisher') {
      // hop back / sideways: forces a distance error unless Rusana adjusts
      const side = Math.random() < 0.5 ? -1 : 1, bx = Math.sin(this.yaw), bz = Math.cos(this.yaw);
      this.stepV.set(-bx * 2.6 + bz * side * 1.4, 0, -bz * 2.6 - bx * side * 1.4); this.setAct('hop', 0.25);
      if (this.sayCd <= 0 && Math.random() < 0.5) this.say(pick(this.trait.lines));
    }
  }
  setAct(a, dur = 0) { this.act = a; this.actT = 0; this.actDur = dur; }
  alert() {
    if (this.out) return;
    if (this.mode === 'calm') { this.mode = 'alert'; this.decideT = rnd(0.4, 1.0); if (!this.met) { this.met = true; this.say(this.def.intro.replace(/^[^:]+:\s*/, ''), 3.2); } }
  }
  // ---- result of a strike (grade already decided) ----
  // Realistic rule: one Идеально / Чисто to the groin DROPS him. He does not get back up to fight.
  // Glance / block sting but fade — no KO farm from spam.
  onHit(grade, move, now) {
    this.hits++; this.lastHitT = now; this.mode = this.mode === 'calm' ? 'alert' : this.mode;
    const A = this.actor, g = this.game, P = g.player;
    if (grade === 'block') {
      this.pain.hit('block', 1, now);
      this.setAct('blockstun', 0.35); A.play('guard', { fade: 0.05, restart: true });
      A.setExpr('angry', 0.5); this.faceT = 0.6;
      return;
    }
    if (grade === 'miss') return;
    const S = g.strikes[move]; const before = this.level;
    this.pain.hit(grade, S.dmg, now);
    // ---- hard drop: perfect / clean ----
    if (grade === 'perfect' || grade === 'clean') {
      this.dropped = true; this.mode = 'alert'; this.guardUntil = 0; this.guardLv = 0;
      const toFloor = grade === 'perfect' || move === 'finisher' || move === 'stomp' || before >= 3;
      this.level = toFloor ? 4 : 3;
      this.pain.value = Math.max(this.pain.value, toFloor ? COMBAT.pain.floor + 20 : COMBAT.pain.knees + 15);
      A.play(toFloor ? 'floor' : 'knees', { fade: 0.08, restart: true });
      A.setExpr('surprised', 1); A.setExpr('aa', 0.7); A.setExpr('sad', 0.8); this.faceT = 2.5;
      // knockback
      const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1;
      const kb = toFloor ? 0.55 : 0.4; this.vel.x += dx / d * kb * 6; this.vel.z += dz / d * kb * 6;
      g.sfx.grunt(this.def.base === 'guy_a' ? 0.85 : 1, 0.45, toFloor ? 1 : 0.7);
      this.say(pick(toFloor
        ? ['А-А-А…!', 'Нет… ноги…', 'Я… не могу…', 'Ыыыы…']
        : ['Ох… колени…', 'Не могу встать…', 'Больно… очень…']), 2.0, 'pain');
      // schedule: knees → floor → tap; perfect already on floor → tap soon
      clearTimeout(this._dropT);
      if (toFloor) {
        this._dropT = setTimeout(() => { if (!this.out) this.startTap(); }, 900);
      } else {
        this._dropT = setTimeout(() => {
          if (this.out) return;
          this.level = 4; A.play('floor', { fade: 0.2, restart: true });
          this.say(pick(['Всё… ложусь…', 'Не встану…', 'Хватит…']), 1.8, 'pain');
          this._dropT = setTimeout(() => { if (!this.out) this.startTap(); }, 1100);
        }, 1400);
      }
      return;
    }
    // ---- glance: flinch only, recovers fully ----
    let lv = ORDER.indexOf(this.pain.state);
    this.level = Math.max(this.level, Math.min(lv, 1));   // glance never past flinch via level latch
    if (this.level > before || this.level <= 1) {
      A.play(this.level === 0 ? 'flinch' : 'flinch', { fade: 0.06, restart: true });
    }
    const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1;
    this.vel.x += dx / d * 0.15 * 6; this.vel.z += dz / d * 0.15 * 6;
    A.setExpr('surprised', 0.35); A.setExpr('sad', 0.2); this.faceT = 0.5;
    g.sfx.grunt(this.def.base === 'guy_a' ? 0.85 : 1, 0.15, 0.15);
    if (this.trait.flee && Math.random() < this.trait.flee * 0.4) { this.fleeNext = true; }
  }
  startTap() {
    if (this.out) return;
    this.dropped = true; this.level = 4; this.out = true; this.tapT = 0; this.mode = 'out';
    this.actor.play('floor', { fade: 0.1, restart: true });
    this.actor.setExpr('sad', 1); this.actor.setExpr('surprised', 0.4); this.actor.setExpr('aa', 0.5);
    setTimeout(() => { this.actor.play('tap', { fade: 0.3 }); this.say(pick(['Всё! Всё! Сдаюсь!', 'Хватит… я сдаюсь…', 'Ладно, ты победила!', 'Больше не встану…']), 2.8, 'pain'); }, 700);
    this.game.onDefeat(this);
  }
  // ---- per-frame ----
  update(dt, now) {
    const A = this.actor, g = this.game, P = g.player;
    this.sayCd -= dt; this.actT += dt; this.pain.update(dt, now, this.out);
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    let want = null, speed = 0, face = null;
    if (this.faceT !== undefined && (this.faceT -= dt) < 0 && !this.out) {
      const L = this.level; A.setExpr('surprised', L >= 3 ? 0.25 : 0); A.setExpr('aa', L >= 2 ? 0.35 : 0);
      A.setExpr('sad', L ? 0.35 + L * 0.15 : 0); A.setExpr('angry', L === 0 && this.mode === 'alert' ? 0.4 : 0); this.faceT = undefined;
    }
    // guard ramp
    const gOn = now >= this.guardAt && now < this.guardUntil && this.level === 0;
    this.guardLv += ((gOn ? 1 : 0) - this.guardLv) * Math.min(1, dt * (gOn ? 14 : 5));
    if (this.out) {
      this.tapT += dt;
      if (this.tapT > 5 && A.curName === 'tap') A.play('floor', { fade: 0.6 });
    } else if (this.level > 0) {
      // dropped = finished by a clean/perfect hit: NEVER recover to standing
      if (this.dropped) {
        // only writhe; tap is scheduled from onHit
        if (this.level >= 3 && A.curName !== 'floor' && A.curName !== 'knees' && A.curName !== 'tap') A.play(this.level >= 4 ? 'floor' : 'knees', { fade: 0.2 });
      } else {
        // glance flinch only — recover to idle quickly
        const since = now - this.lastHitT;
        if (this.level === 1 && (since > 0.55 || (A.curName === 'flinch' && A.time > 0.7))) {
          this.level = 0; this.setAct(null);
          if (this.fleeNext || (this.trait.flee && Math.random() < this.trait.flee * 0.5)) { this.fleeNext = false; this.mode = 'flee'; this.fleeT = rnd(2, 4); }
        } else if (since > RECOVER[this.level] && ORDER.indexOf(this.pain.state) < this.level && this.level < 3) {
          this.level = 0; A.play('getup', { fade: 0.25, restart: true }); this.setAct('getup', 0.6); this.mode = 'alert';
        }
      }
    } else if (this.act === 'hop') {
      this.pos.addScaledVector(this.stepV, dt); this.stepV.multiplyScalar(Math.exp(-dt * 6)); face = toP;
      if (this.actT > 0.35) this.setAct(null);
      if (A.curName !== 'guard') A.play('guard', { fade: 0.08 });
    } else if (this.act === 'getup' || this.act === 'blockstun') {
      if (this.actT > this.actDur) this.setAct(null); face = toP;
    } else if (this.act === 'windup') {
      face = toP; if (this.actT > 0.5 / this.trait.speed) { this.setAct('punch'); A.play('punch', { fade: 0.04, restart: true }); this.punchHit = false; }
    } else if (this.act === 'punch') {
      face = toP; if (this.actT < 0.14) { want = [dx, dz]; speed = 2.2; }
      if (!this.punchHit && this.actT >= 0.12) { this.punchHit = true; g.onGuyPunch(this, dist, Math.abs(angDiff(toP, this.yaw))); }
      if (this.actT > 0.7) this.setAct(null);
    } else if (this.act === 'taunt') {
      face = toP; if (this.actT > 1.6) this.setAct(null);
    } else if (this.act === 'guard') {
      face = toP; if (A.curName !== 'guard') A.play('guard', { fade: 0.08 });
      if (now > this.guardUntil) this.setAct(null);
    } else if (this.mode === 'flee') {
      this.fleeT -= dt; const r = this.world.areas[this.def.area].rect;
      const away = new THREE.Vector3(-dx, 0, -dz).normalize();
      const cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2, ex = this.pos.x - cx, ez = this.pos.z - cz;
      // steer back toward the area if running out of it
      if (Math.abs(ex) > (r[1] - r[0]) / 2 - 1 || Math.abs(ez) > (r[3] - r[2]) / 2 - 1) { away.x -= ex * 0.2; away.z -= ez * 0.2; away.normalize(); }
      want = [away.x, away.z]; speed = GUY_RUN * this.trait.speed; face = Math.atan2(away.x, away.z);
      if (dist > 11 || this.fleeT < 0) { this.mode = 'alert'; if (this.sayCd <= 0) this.say(pick(this.trait.lines)); }
    } else if (this.mode === 'alert') {
      face = toP;
      if (dist > 13) { this.mode = 'calm'; this.goal = null; }
      this.decideT -= dt;
      const T = this.trait, pref = T.flee > 0.3 ? 3.2 : T.attack > 0.3 ? 1.5 : 2.2;
      if (this.decideT <= 0) {
        this.decideT = rnd(0.7, 1.5) / T.speed;
        const r = Math.random();
        if (T.flee && dist < 2.5 && r < T.flee * 0.5) { this.mode = 'flee'; this.fleeT = rnd(2, 4); }
        else if (dist < 2.4 && r < T.attack + (P.state === 'move' && P.speed < 0.3 ? 0.1 : 0)) { this.setAct('windup'); A.play('windup', { fade: 0.1, restart: true }); if (Math.random() < 0.4) this.say(pick(['Получай!', 'На!', 'Ща как дам!']), 1.2); }
        else if (r < T.attack + T.taunt) { this.setAct('taunt'); A.play('taunt', { fade: 0.15, restart: true }); if (this.sayCd <= 0) this.say(pick(T.lines)); }
        else if (r < T.attack + T.taunt + T.guard) { this.guardAt = now; this.guardUntil = now + rnd(0.8, 1.8); this.setAct('guard'); }
        else this.strafe = Math.random() < 0.5 ? -1 : 1;
      }
      if (!this.act) {
        if (dist > pref + 0.5) { want = [dx, dz]; speed = dist > 5 ? GUY_RUN * 0.8 * T.speed : GUY_WALK * T.speed; }
        else if (dist < pref - 0.6) { want = [-dx, -dz]; speed = GUY_WALK * 0.8; }
        else if (this.strafe) { want = [dz * this.strafe, -dx * this.strafe]; speed = 0.6; }
      }
    } else {
      // calm: wander inside the home area, sometimes stand and talk / idle
      if (dist < 4.5 || (dist < 8 && P.state === 'strike')) this.alert();
      if (!this.goal) {
        this.idleT -= dt;
        if (this.idleT <= 0) { this.goal = this.world.randomPoint(this.def.area); this.idleT = rnd(2, 6); }
      } else {
        const gx = this.goal.x - this.pos.x, gz = this.goal.z - this.pos.z, gd = Math.hypot(gx, gz);
        if (gd < 0.4 || this.goalT > 14) { this.goal = null; this.goalT = 0; } else { want = [gx, gz]; speed = GUY_WALK; face = Math.atan2(gx, gz); this.goalT = (this.goalT || 0) + dt; }
      }
    }
    // locomotion
    const mv = this.level === 0 && !this.out && this.act !== 'getup';
    const tv = new THREE.Vector3(); if (want && mv) { const l = Math.hypot(want[0], want[1]) || 1; tv.set(want[0] / l * speed, 0, want[1] / l * speed); }
    this.vel.x += (tv.x - this.vel.x) * Math.min(1, dt * 8); this.vel.z += (tv.z - this.vel.z) * Math.min(1, dt * 8);
    if (!mv) this.vel.multiplyScalar(Math.exp(-dt * 6));
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z, this.pos.y);
    this.world.collide(this.pos, this.radius);
    if (face !== null && this.level <= 1) this.yaw += angDiff(face, this.yaw) * Math.min(1, dt * 7);
    else if (want && mv) this.yaw += angDiff(Math.atan2(tv.x, tv.z), this.yaw) * Math.min(1, dt * 7);
    // animation selection when free
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (mv && !this.act) {
      const fight = this.mode === 'alert';
      if (sp > 2.2) A.play('run', { speed: sp / 3.4 });
      else if (sp > 0.35) A.play('walk', { speed: Math.max(0.6, sp / 1.25) });
      else A.play(fight ? 'stance' : (this.goal === null && this.def.trait === 'cocky' ? 'talk' : 'idle'), { fade: 0.25 });
    }
    this.speed = sp;
    A.root.position.copy(this.pos); A.root.rotation.y = this.yaw;
  }
}
