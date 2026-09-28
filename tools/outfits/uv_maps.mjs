// Rasterise Rusana's Body UV layout into per-texel maps (bind-pose position, normal, body-part label)
// so outfits can be painted by 3D rules (height bands, limbs) instead of hand-picked UV rectangles.
// node uv_maps.mjs <rusana.vrm> <outdir> [size]
import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const [src, outdir, S0] = process.argv.slice(2); const S = +(S0 || 1024);
const doc = await new NodeIO().read(src);
const skin = doc.getRoot().listSkins()[0]; const jn = skin.listJoints().map((j) => j.getName());
const PART = [[/Head|Neck|Eye|Face|Hair/, 1], [/UpperChest|Chest|Bust/, 2], [/Spine/, 3], [/Hips|Skirt/, 4], [/UpperArm|Shoulder/, 5], [/LowerArm/, 6], [/Hand|Thumb|Index|Middle|Ring|Little/, 7], [/UpperLeg/, 8], [/LowerLeg/, 9], [/Foot|Toe/, 10]];
const jpart = jn.map((n) => { for (const [re, p] of PART) if (re.test(n)) return p; return 0; });
const pos = new Float32Array(S * S * 3), nrm = new Float32Array(S * S * 3), part = new Uint8Array(S * S);
const tri = (U, P, N, L) => {
  const [a, b, c] = U; const minx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - 1)), maxx = Math.min(S - 1, Math.ceil(Math.max(a[0], b[0], c[0]) + 1));
  const miny = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - 1)), maxy = Math.min(S - 1, Math.ceil(Math.max(a[1], b[1], c[1]) + 1));
  const e = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]); const ar = e(a, b, c[0], c[1]); if (Math.abs(ar) < 1e-9) return;
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const px = x + 0.5, py = y + 0.5; let w0 = e(b, c, px, py) / ar, w1 = e(c, a, px, py) / ar, w2 = e(a, b, px, py) / ar;
    const tol = -1.2 / Math.sqrt(Math.abs(ar));        // ~1 px dilation to avoid seams
    if (w0 < tol || w1 < tol || w2 < tol) continue;
    const o = y * S + x; const inside = w0 >= 0 && w1 >= 0 && w2 >= 0; if (!inside && part[o]) continue;
    w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const sw = w0 + w1 + w2; w0 /= sw; w1 /= sw; w2 /= sw;
    for (let k = 0; k < 3; k++) { pos[o * 3 + k] = P[0][k] * w0 + P[1][k] * w1 + P[2][k] * w2; nrm[o * 3 + k] = N[0][k] * w0 + N[1][k] * w1 + N[2][k] * w2; }
    part[o] = L;
  }
};
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  if (!/Body_00/.test(p.getMaterial()?.getName() || '')) continue;
  const A = (n) => p.getAttribute(n); const uv = A('TEXCOORD_0'), P = A('POSITION'), N = A('NORMAL'), J = A('JOINTS_0'), W = A('WEIGHTS_0'), idx = p.getIndices();
  const lab = (i) => { const j = [], w = []; J.getElement(i, j); W.getElement(i, w); const acc = {}; for (let k = 0; k < 4; k++) acc[jpart[j[k]]] = (acc[jpart[j[k]]] || 0) + w[k]; return +Object.entries(acc).sort((a, b) => b[1] - a[1])[0][0]; };
  const t = [], v = [], n = [];
  for (let f = 0; f < idx.getCount(); f += 3) {
    const ii = [0, 1, 2].map((k) => idx.getScalar(f + k));
    const U = ii.map((i) => { uv.getElement(i, t); return [t[0] * S, t[1] * S]; });
    const PP = ii.map((i) => { P.getElement(i, v); return v.slice(); }), NN = ii.map((i) => { N.getElement(i, n); return n.slice(); });
    const labs = ii.map(lab); const L = labs.sort((a, b) => labs.filter((x) => x === b).length - labs.filter((x) => x === a).length)[0];
    tri(U, PP, NN, L);
  }
}
fs.mkdirSync(outdir, { recursive: true });
const J = {}; for (const j of skin.listJoints()) J[j.getName()] = j.getWorldTranslation().map((x) => +x.toFixed(4));
fs.writeFileSync(outdir + '/joints.json', JSON.stringify(J));
fs.writeFileSync(outdir + '/pos.f32', Buffer.from(pos.buffer)); fs.writeFileSync(outdir + '/nrm.f32', Buffer.from(nrm.buffer)); fs.writeFileSync(outdir + '/part.u8', Buffer.from(part.buffer));
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < S * S; i++) if (part[i]) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i * 3 + k]); mx[k] = Math.max(mx[k], pos[i * 3 + k]); }
console.log('uv maps', S, 'bounds', mn.map((x) => x.toFixed(3)), mx.map((x) => x.toFixed(3)));
