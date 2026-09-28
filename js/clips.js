// Animation library for VRM humanoids.
//  * Retargeted CC0 mocap-style loops (Quaternius Universal Animation Library, baked by tools/dev/bake_quaternius.html
//    into assets/anim/quaternius.json: VRM-1 normalized local rotations + hips offset in hip-height units).
//  * Procedural keyframed clips authored here (strikes, reactions, victory…) in the same space:
//    rest = T-pose, character faces +Z, left = +X.  Euler degrees [x, y, z]:
//      upperLeg x<0 thigh forward, lowerLeg x>0 knee bend, foot x>0 toes down, spine/chest/head x>0 bend forward,
//      leftUpperArm z<0 arm down (right: z>0), leftUpperArm y<0 arm forward (right: y>0), leftLowerArm y<0 elbow bend (right: y>0).
import * as THREE from 'three';

const D = Math.PI / 180;
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
export function qOf(r, order = 'YZX') { _e.set(r[0] * D, r[1] * D, r[2] * D, order); return _q.setFromEuler(_e).toArray(); }
const mirrorName = (b) => b.startsWith('left') ? 'right' + b.slice(4) : b.startsWith('right') ? 'left' + b.slice(5) : b;
// mirror a pose left<->right (x stays, y and z flip)
export function mirror(p) { const o = {}; for (const k in p) { const r = p[k]; o[mirrorName(k)] = [r[0], -r[1], -r[2]]; } if (p.hips) o.hips = [p.hips[0], -p.hips[1], -p.hips[2]]; return o; }
const M = (...ps) => Object.assign({}, ...ps);

// ---------------- poses ----------------
const ARMS_DOWN = { leftUpperArm: [0, 0, -74], rightUpperArm: [0, 0, 74], leftLowerArm: [0, -8, 0], rightLowerArm: [0, 8, 0], leftHand: [0, 0, -6], rightHand: [0, 0, 6] };
const FIST = {}; for (const s of ['left', 'right']) for (const f of ['Index', 'Middle', 'Ring', 'Little']) { FIST[s + f + 'Proximal'] = [0, 0, s === 'left' ? -80 : 80]; FIST[s + f + 'Intermediate'] = [0, 0, s === 'left' ? -95 : 95]; FIST[s + f + 'Distal'] = [0, 0, s === 'left' ? -60 : 60]; }
Object.assign(FIST, { leftThumbProximal: [0, -30, -20], rightThumbProximal: [0, 30, 20], leftThumbDistal: [0, -30, 0], rightThumbDistal: [0, 30, 0] });
const SOFT_HAND = {}; for (const k in FIST) SOFT_HAND[k] = FIST[k].map((v) => v * 0.3);

// Rusana fighting stance (bladed, fists up, weight low) — right leg is the kicking leg (back)
const R_STANCE = M(SOFT_HAND, FIST, {
  hips: [0, -18, 0], spine: [4, 6, 0], chest: [3, 6, 0], upperChest: [0, 2, 0], neck: [0, 4, 0], head: [-4, 4, 0],
  leftUpperLeg: [-18, 12, 6], leftLowerLeg: [24, 0, 0], leftFoot: [-6, -10, 0],
  rightUpperLeg: [12, 8, -8], rightLowerLeg: [22, 0, 0], rightFoot: [-10, 6, 0],
  leftUpperArm: [-40, -20, -70], leftLowerArm: [0, -130, 0], leftHand: [0, 0, -10],
  rightUpperArm: [-40, 24, 68], rightLowerArm: [0, 128, 0], rightHand: [0, 0, 10],
});
const R_KICK_CHAMBER = M(R_STANCE, {
  hips: [-6, -6, 0], spine: [-6, 2, 0], chest: [-4, 0, 0], head: [6, 0, 0],
  leftUpperLeg: [-4, 4, 2], leftLowerLeg: [12, 0, 0], leftFoot: [10, 0, 0],
  rightUpperLeg: [-72, 0, -4], rightLowerLeg: [100, 0, 0], rightFoot: [40, 0, 0],
  leftUpperArm: [-10, -40, -50], rightUpperArm: [10, -10, 58], rightLowerArm: [0, 90, 0],
});
const R_KICK_HIT = M(R_KICK_CHAMBER, {
  hips: [-10, -4, 0], spine: [-14, 0, 0], chest: [-6, 0, 0], neck: [6, 0, 0], head: [12, 0, 0],
  leftUpperLeg: [4, 4, 2], leftLowerLeg: [6, 0, 0], leftFoot: [26, 0, 0],
  rightUpperLeg: [-80, 0, -2], rightLowerLeg: [8, 0, 0], rightFoot: [45, 0, 0],
  leftUpperArm: [0, -30, -40], leftLowerArm: [0, -70, 0], rightUpperArm: [14, -20, 50], rightLowerArm: [0, 40, 0],
});
const R_KICK_FOLLOW = M(R_KICK_HIT, { rightUpperLeg: [-88, 0, -2], rightLowerLeg: [16, 0, 0], spine: [-16, 0, 0] });
const R_KNEE_GRAB = M(R_STANCE, {
  hips: [0, -4, 0], spine: [10, 0, 0], chest: [6, 0, 0], head: [-6, 0, 0],
  leftUpperArm: [0, -62, -8], leftLowerArm: [0, -30, 0], rightUpperArm: [0, 62, 8], rightLowerArm: [0, 30, 0],
  leftHand: [0, 0, 0], rightHand: [0, 0, 0],
  rightUpperLeg: [10, 0, -4], rightLowerLeg: [30, 0, 0],
});
const R_KNEE_HIT = M(R_KNEE_GRAB, {
  hips: [-14, 0, 0], spine: [18, 0, 0], chest: [8, 0, 0], head: [-10, 0, 0],
  leftUpperArm: [0, -70, 16], leftLowerArm: [0, -45, 0], rightUpperArm: [0, 70, -16], rightLowerArm: [0, 45, 0],
  leftUpperLeg: [6, 0, 2], leftLowerLeg: [8, 0, 0], leftFoot: [30, 0, 0],
  rightUpperLeg: [-86, 0, -2], rightLowerLeg: [118, 0, 0], rightFoot: [35, 0, 0],
});
const R_FIN_WIND = M(R_STANCE, { hips: [-4, -40, 0], spine: [-2, -14, 0], chest: [0, -10, 0], head: [0, 30, 0],
  rightUpperLeg: [-40, 0, -10], rightLowerLeg: [110, 0, 0], leftLowerLeg: [30, 0, 0] });
const R_FIN_HIT = M(R_KICK_HIT, { hips: [-12, 10, 0], spine: [-18, 6, 0], rightUpperLeg: [-84, 0, 0], rightLowerLeg: [4, 0, 0], leftFoot: [34, 0, 0],
  leftUpperArm: [-20, -10, -30], rightUpperArm: [-20, 10, 30] });
const R_LOW_HIT = M(R_KICK_HIT, { hips: [-4, -4, 0], spine: [-4, 0, 0], head: [16, 0, 0], leftUpperLeg: [-8, 4, 2], leftLowerLeg: [20, 0, 0], leftFoot: [0, 0, 0],
  rightUpperLeg: [-46, 0, -2], rightLowerLeg: [6, 0, 0], rightFoot: [50, 0, 0] });
const R_STOMP_UP = M(R_STANCE, { hips: [-4, -4, 0], spine: [-4, 0, 0], head: [20, 0, 0], leftUpperLeg: [-4, 4, 2], leftLowerLeg: [8, 0, 0], leftFoot: [0, 0, 0],
  rightUpperLeg: [-88, 0, -4], rightLowerLeg: [96, 0, 0], rightFoot: [-10, 0, 0], leftUpperArm: [-10, -30, -40], rightUpperArm: [-10, 30, 40] });
const R_STOMP_HIT = M(R_STOMP_UP, { hips: [6, 0, 0], spine: [14, 0, 0], head: [22, 0, 0], leftUpperLeg: [-10, 4, 2], leftLowerLeg: [30, 0, 0],
  rightUpperLeg: [-44, 0, -4], rightLowerLeg: [30, 0, 0], rightFoot: [-14, 0, 0] });
const R_VICTORY = M(SOFT_HAND, {
  hips: [0, 14, -4], spine: [-4, -6, 2], chest: [-4, -6, 0], neck: [0, -6, 0], head: [6, -12, 6],
  leftUpperLeg: [-6, 0, 3], leftLowerLeg: [6, 0, 0], leftFoot: [-4, 0, 0],
  rightUpperLeg: [-14, 10, -9], rightLowerLeg: [22, 0, 0], rightFoot: [10, 0, 0],
  leftUpperArm: [0, 30, -62], leftLowerArm: [0, -100, 0], leftHand: [0, 0, 20],
  rightUpperArm: [0, 10, -25], rightLowerArm: [0, 125, 0], rightHand: [0, 0, 10],
});
const R_DODGE = M(R_STANCE, { hips: [8, -30, 0], spine: [16, -10, 0], chest: [8, 0, 0],
  leftUpperLeg: [-50, 10, 10], leftLowerLeg: [80, 0, 0], rightUpperLeg: [30, 0, -14], rightLowerLeg: [30, 0, 0] });

// Guy poses
const G_GROIN_HANDS = M(SOFT_HAND, { leftUpperArm: [0, -35, -78], leftLowerArm: [0, -40, 0], leftHand: [0, 0, 10],
  rightUpperArm: [0, 35, 78], rightLowerArm: [0, 40, 0], rightHand: [0, 0, -10] });
const G_FLINCH = M(G_GROIN_HANDS, { hips: [16, 0, 0], spine: [18, 0, 0], chest: [10, 0, 0], neck: [6, 0, 0], head: [-6, 0, 0],
  leftUpperLeg: [-30, -6, -5], leftLowerLeg: [34, 0, 0], leftFoot: [-18, 0, 0],
  rightUpperLeg: [-30, 6, 5], rightLowerLeg: [34, 0, 0], rightFoot: [-18, 0, 0] });
const G_DOUBLE = M(G_GROIN_HANDS, { hips: [24, 0, 0], spine: [30, 0, 0], chest: [20, 0, 0], upperChest: [10, 0, 0], neck: [4, 0, 0], head: [-28, 0, 0],
  leftUpperLeg: [-56, -8, -7], leftLowerLeg: [60, 0, 0], leftFoot: [-24, 0, 0],
  rightUpperLeg: [-56, 8, 7], rightLowerLeg: [60, 0, 0], rightFoot: [-24, 0, 0] });
const G_KNEES = M(G_GROIN_HANDS, { hips: [18, 0, 0], spine: [28, 0, 0], chest: [18, 0, 0], upperChest: [6, 0, 0], neck: [6, 0, 0], head: [-12, 0, 0],
  leftUpperLeg: [-22, -4, -4], leftLowerLeg: [92, 0, 0], leftFoot: [60, 0, 0],
  rightUpperLeg: [-22, 4, 4], rightLowerLeg: [92, 0, 0], rightFoot: [60, 0, 0] });
const G_FLOOR = M(G_GROIN_HANDS, { hips: [0, 0, -84], spine: [26, 0, 0], chest: [16, 0, 0], neck: [12, 0, 0], head: [-6, 0, -10],
  leftUpperLeg: [-78, 0, -4], leftLowerLeg: [104, 0, 0], leftFoot: [20, 0, 0],
  rightUpperLeg: [-66, 0, 4], rightLowerLeg: [96, 0, 0], rightFoot: [20, 0, 0] });
const G_TAP_A = M(G_FLOOR, { leftUpperArm: [0, -20, 10], leftLowerArm: [0, -20, 0], leftHand: [0, 0, 0] });
const G_TAP_B = M(G_FLOOR, { leftUpperArm: [0, -20, -12], leftLowerArm: [0, -10, 0], leftHand: [0, 0, -20] });
const G_GUARD = M(G_GROIN_HANDS, { hips: [10, 20, 0], spine: [10, -8, 0], head: [-6, -6, 0],
  leftUpperLeg: [-16, -10, -6], leftLowerLeg: [22, 0, 0], rightUpperLeg: [-6, 14, 8], rightLowerLeg: [16, 0, 0],
  leftUpperArm: [0, -45, -74], leftLowerArm: [0, -50, 0], rightUpperArm: [0, 45, 74], rightLowerArm: [0, 50, 0] });
const G_STANCE = M(ARMS_DOWN, SOFT_HAND, { hips: [0, 0, 0], spine: [2, 0, 0], head: [-2, 0, 0],
  leftUpperLeg: [0, 0, 5], rightUpperLeg: [0, 0, -5], leftFoot: [0, -10, 0], rightFoot: [0, 10, 0],
  leftUpperArm: [0, 0, -76], rightUpperArm: [0, 0, 76] });
const G_TAUNT_A = M(G_STANCE, { hips: [0, 10, 0], spine: [-6, -6, 0], head: [8, -10, 6],
  leftUpperArm: [0, 10, -60], leftLowerArm: [0, -110, 0], rightUpperArm: [0, 40, 40], rightLowerArm: [0, 60, 0], rightHand: [0, 0, -20] });
const G_TAUNT_B = M(G_TAUNT_A, { rightUpperArm: [0, 60, 52], rightLowerArm: [0, 30, 0], head: [2, -14, 8] });
const G_WINDUP = M(FIST, G_STANCE, { hips: [0, 30, 0], spine: [-4, 18, 0], chest: [0, 10, 0], head: [0, -26, 0],
  rightUpperArm: [0, -20, 60], rightLowerArm: [0, 120, 0], leftUpperArm: [0, -50, -50], leftLowerArm: [0, -90, 0],
  leftUpperLeg: [-20, 0, 6], leftLowerLeg: [20, 0, 0], rightUpperLeg: [10, 0, -6], rightLowerLeg: [14, 0, 0] });
const G_PUNCH = M(FIST, G_STANCE, { hips: [4, -26, 0], spine: [10, -16, 0], chest: [4, -10, 0], head: [0, 24, 0],
  rightUpperArm: [0, 84, 4], rightLowerArm: [0, 6, 0], leftUpperArm: [0, -20, -60], leftLowerArm: [0, -110, 0],
  leftUpperLeg: [-30, 0, 6], leftLowerLeg: [26, 0, 0], rightUpperLeg: [14, 0, -6], rightLowerLeg: [10, 0, 0] });

// ---------------- procedural clip specs ----------------
// keys: [t, pose, hips offset (hip-height units, [x,y,z]), ease]
const K = (t, pose, h = [0, 0, 0], ease = 'io') => ({ t, pose, h, ease });
const wave = (base, amp, n, dur, fn) => { const ks = []; for (let i = 0; i <= n; i++) { const t = i / n * dur; ks.push(K(t, fn(base, Math.sin(i / n * Math.PI * 2) * amp), [0, Math.sin(i / n * Math.PI * 2) * -0.006, 0])); } return ks; };
const breathe = (p, a) => M(p, { spine: [p.spine[0] + a * 2, p.spine[1], p.spine[2]], chest: [(p.chest || [0, 0, 0])[0] - a * 1.5, (p.chest || [0, 0, 0])[1], 0], head: [p.head[0] - a, p.head[1], p.head[2]] });

export const PROC = {
  r_stance: { loop: true, keys: wave(R_STANCE, 1, 4, 2.2, breathe) },
  r_kick: { keys: [K(0, R_STANCE), K(0.1, R_KICK_CHAMBER, [0, 0.01, 0.02]), K(0.25, R_KICK_HIT, [0, 0.05, 0.06], 'out'), K(0.33, R_KICK_FOLLOW, [0, 0.05, 0.06]), K(0.52, R_KICK_CHAMBER, [0, 0.01, 0.04]), K(0.74, R_STANCE)] },
  r_knee: { keys: [K(0, R_STANCE), K(0.1, R_KNEE_GRAB, [0, 0, 0.04]), K(0.22, R_KNEE_HIT, [0, 0.06, 0.08], 'out'), K(0.34, R_KNEE_HIT, [0, 0.05, 0.08]), K(0.5, R_KNEE_GRAB, [0, 0, 0.04]), K(0.7, R_STANCE)] },
  r_finisher: { keys: [K(0, R_STANCE), K(0.2, R_FIN_WIND, [0, -0.03, -0.02]), K(0.34, R_KICK_CHAMBER, [0, 0.02, 0.04]), K(0.46, R_FIN_HIT, [0, 0.07, 0.08], 'out'), K(0.7, R_FIN_HIT, [0, 0.06, 0.08]), K(1.0, R_STANCE)] },
  r_lowkick: { keys: [K(0, R_STANCE), K(0.1, M(R_KICK_CHAMBER, { rightUpperLeg: [-50, 0, -4] })), K(0.22, R_LOW_HIT, [0, 0, 0.05], 'out'), K(0.32, R_LOW_HIT, [0, 0, 0.05]), K(0.62, R_STANCE)] },
  r_stomp: { keys: [K(0, R_STANCE), K(0.2, R_STOMP_UP, [0, 0.03, 0.02]), K(0.3, R_STOMP_HIT, [0, -0.04, 0.08], 'in'), K(0.46, R_STOMP_HIT, [0, -0.04, 0.08]), K(0.8, R_STANCE)] },
  r_victory: { keys: [K(0, R_STANCE), K(0.4, R_VICTORY, [0, -0.01, 0]), K(1.6, M(R_VICTORY, { head: [2, -18, 8] })), K(2.6, R_VICTORY)], hold: true },
  r_dodge: { keys: [K(0, R_STANCE), K(0.08, R_DODGE, [0, -0.08, 0]), K(0.26, R_DODGE, [0, -0.06, 0]), K(0.38, R_STANCE)] },
  r_caught: { keys: [K(0, R_STANCE), K(0.1, M(R_DODGE, { spine: [-14, 0, 0], head: [10, 0, 0] }), [0, -0.02, -0.04]), K(0.5, R_STANCE)] },
  g_stance: { loop: true, keys: wave(G_STANCE, 1, 4, 3, breathe) },
  g_flinch: { keys: [K(0, G_STANCE), K(0.07, G_FLINCH, [0, -0.04, -0.05], 'out'), K(0.5, G_FLINCH, [0, -0.04, -0.05]), K(0.9, G_STANCE)] },
  g_double_over: { keys: [K(0, G_FLINCH, [0, -0.04, -0.05]), K(0.12, G_DOUBLE, [0, -0.12, -0.14], 'out'), K(0.6, M(G_DOUBLE, { head: [-18, 0, 0] }), [0, -0.13, -0.15])], hold: true },
  g_knees: { keys: [K(0, G_DOUBLE, [0, -0.12, -0.14]), K(0.35, G_KNEES, [0, -0.47, -0.06], 'in'), K(0.5, M(G_KNEES, { spine: [34, 0, 0] }), [0, -0.49, -0.06]), K(1.2, G_KNEES, [0, -0.48, -0.06])], hold: true },
  g_floor: { keys: [K(0, G_KNEES, [0, -0.48, -0.06]), K(0.45, G_FLOOR, [0.1, -0.8, 0], 'in'), K(0.6, G_FLOOR, [0.1, -0.82, 0]), K(1.4, M(G_FLOOR, { spine: [32, 0, 0] }), [0.1, -0.82, 0])], hold: true },
  g_tap: { loop: true, keys: [K(0, G_TAP_A, [0.1, -0.82, 0]), K(0.18, G_TAP_B, [0.1, -0.82, 0], 'in'), K(0.4, G_TAP_A, [0.1, -0.82, 0])] },
  g_guard: { loop: true, keys: wave(G_GUARD, 1, 4, 1.6, breathe) },
  g_taunt: { keys: [K(0, G_STANCE), K(0.3, G_TAUNT_A), K(0.6, G_TAUNT_B), K(0.9, G_TAUNT_A), K(1.2, G_TAUNT_B), K(1.6, G_STANCE)] },
  g_windup: { keys: [K(0, G_STANCE), K(0.45, G_WINDUP, [0, -0.02, -0.02])], hold: true },
  g_punch: { keys: [K(0, G_WINDUP, [0, -0.02, -0.02]), K(0.12, G_PUNCH, [0, -0.03, 0.08], 'out'), K(0.35, G_PUNCH, [0, -0.03, 0.08]), K(0.7, G_STANCE)] },
  g_getup: { keys: [K(0, G_DOUBLE, [0, -0.12, -0.14]), K(0.5, G_FLINCH, [0, -0.04, -0.05]), K(0.9, G_STANCE)] },
};

// ---------------- sampling into the shared clip-data format ----------------
const EASE = { io: (t) => t * t * (3 - 2 * t), out: (t) => 1 - (1 - t) * (1 - t) * (1 - t), in: (t) => t * t, lin: (t) => t };
export function sampleProc(spec, fps = 30) {
  const keys = spec.keys, dur = keys[keys.length - 1].t, n = Math.max(2, Math.round(dur * fps) + 1);
  const names = new Set(); for (const k of keys) for (const b in k.pose) names.add(b);
  const bones = {}; for (const b of names) bones[b] = [];
  const hips = [];
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const t = Math.min(dur, i / fps);
    let j = 0; while (j < keys.length - 2 && t > keys[j + 1].t) j++;
    const A = keys[j], B = keys[j + 1] || A;
    const u = B.t > A.t ? EASE[B.ease || 'io'](Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t)))) : 0;
    for (const b of names) {
      qa.fromArray(qOf(A.pose[b] || [0, 0, 0])); qb.fromArray(qOf(B.pose[b] || [0, 0, 0]));
      qa.slerp(qb, u); bones[b].push(...qa.toArray().map((v) => +v.toFixed(4)));
    }
    for (let c = 0; c < 3; c++) hips.push(A.h[c] + (B.h[c] - A.h[c]) * u);
  }
  return { dur, fps, n, bones, hips, loop: !!spec.loop, hold: !!spec.hold };
}

// Build a THREE.AnimationClip for one VRM from clip data.
export function makeClip(vrm, name, data) {
  const v0 = vrm.meta?.metaVersion === '0';
  const times = new Float32Array(data.n); for (let i = 0; i < data.n; i++) times[i] = Math.min(data.dur, i / data.fps);
  const tracks = [];
  for (const b in data.bones) {
    const node = vrm.humanoid.getNormalizedBoneNode(b); if (!node) continue;
    const src = data.bones[b]; const vals = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 4) { vals[i] = v0 ? -src[i] : src[i]; vals[i + 1] = src[i + 1]; vals[i + 2] = v0 ? -src[i + 2] : src[i + 2]; vals[i + 3] = src[i + 3]; }
    tracks.push(new THREE.QuaternionKeyframeTrack(node.name + '.quaternion', times, vals));
  }
  const hn = vrm.humanoid.getNormalizedBoneNode('hips');
  if (data.hips && hn) {
    const p0 = vrm._hips0 || (vrm._hips0 = hn.position.clone());
    const H = p0.y; const vals = new Float32Array(data.n * 3);
    for (let i = 0; i < data.n; i++) {
      const x = data.hips[i * 3] * H, y = data.hips[i * 3 + 1] * H, z = data.hips[i * 3 + 2] * H;
      vals[i * 3] = p0.x + (v0 ? -x : x); vals[i * 3 + 1] = p0.y + y; vals[i * 3 + 2] = p0.z + (v0 ? -z : z);
    }
    tracks.push(new THREE.VectorKeyframeTrack(hn.name + '.position', times, vals));
  }
  const clip = new THREE.AnimationClip(name, data.dur, tracks);
  clip.userData = { loop: data.loop, hold: data.hold };
  return clip;
}

// Quaternius clip aliases -> our names (with loop flags). Horizontal hips drift is removed for in-place loops.
export const QMAP = {
  r_idle: ['Idle_Loop', true], r_walk: ['Walk_Formal_Loop', true], r_run: ['Jog_Fwd_Loop', true], r_sprint: ['Sprint_Loop', true], r_hit: ['Hit_Chest', false],
  g_idle: ['Idle_Loop', true], g_walk: ['Walk_Loop', true], g_run: ['Jog_Fwd_Loop', true], g_talk: ['Idle_Talking_Loop', true], g_hit: ['Hit_Head', false],
};
export function prepQuaternius(lib) {
  const out = {};
  for (const [name, [src, loop]] of Object.entries(QMAP)) {
    const d = lib[src]; if (!d) continue;
    const c = { ...d, loop, hips: d.hips.slice() };
    if (loop) for (let i = 0; i < c.n; i++) { c.hips[i * 3] = 0; c.hips[i * 3 + 2] = 0; }
    out[name] = c;
  }
  return out;
}
export function allClipData(qlib) {
  const out = prepQuaternius(qlib);
  for (const k in PROC) out[k] = sampleProc(PROC[k]);
  return out;
}
export const POSES = { R_STANCE, R_KICK_HIT, R_KNEE_HIT, R_VICTORY, G_GROIN_HANDS, G_FLINCH, G_DOUBLE, G_KNEES, G_FLOOR, G_GUARD, G_STANCE };
