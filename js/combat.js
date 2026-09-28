// Combat rules: accuracy grading (distance / facing / timing / defence) and the pain meter.
import { COMBAT } from './config.js';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lin = (x, ok, zero) => clamp01(1 - (x - ok) / (zero - ok));

export function gradeStrike({ move, distErr, angleDeg, timing = {}, defense = {} }) {
  const C = COMBAT;
  const dist = lin(distErr, C.distOk, C.distZero), ang = lin(angleDeg, C.angOk, C.angZero);
  const acc = dist * ang;
  let bonus = 0;
  if (timing.open) bonus += C.openBonus;
  if (timing.rhythm) bonus += C.rhythmBonus;
  if (timing.dash) bonus -= C.dashPenalty;
  if (timing.witch) bonus += 1;
  const score = acc + bonus;
  let grade = (acc >= C.perfectAcc || (score >= C.grade.perfect && acc >= 0.8)) ? 'perfect' : score >= C.grade.clean ? 'clean' : score >= C.grade.glance ? 'glance' : 'miss';
  if (grade !== 'miss' && (defense.guard || 0) >= C.guardBlock && !timing.witch) {
    if (move === 'knee' && Math.random() < C.kneeGuardBreak) grade = grade === 'perfect' ? 'clean' : grade;   // clinch drives through
    else grade = 'block';
  }
  return { grade, acc: +acc.toFixed(3), score: +score.toFixed(3) };
}

export class Pain {
  constructor(tough = 1) { this.value = 0; this.tough = tough; this.lastHit = -99; this.chain = 0; }
  hit(grade, mul, now) {
    const C = COMBAT; let base = C.dmg[grade] || 0; if (base <= 0) return 0;
    const landed = grade === 'perfect' || grade === 'clean';
    if (landed) { this.chain = now - this.lastHit <= C.seriesWindow ? Math.min(3, this.chain + 1) : 0; this.lastHit = now; }
    const add = base * mul * (1 + C.seriesStep * (landed ? this.chain : 0)) / this.tough;
    this.value = Math.min(130, this.value + add); return add;
  }
  update(dt, now, frozen) { if (frozen || now - this.lastHit < COMBAT.decayDelay) return; this.value = Math.max(0, this.value - COMBAT.decay * dt); }
  get state() { const P = COMBAT.pain, v = this.value; return v >= P.floor ? 'floor' : v >= P.knees ? 'knees' : v >= P.double_over ? 'double_over' : v >= P.flinch ? 'flinch' : 'idle'; }
  get frac() { return Math.min(1, this.value / COMBAT.pain.floor); }
}
export const ORDER = ['idle', 'flinch', 'double_over', 'knees', 'floor', 'tap'];
export const stateIdx = (s) => ORDER.indexOf(s);
