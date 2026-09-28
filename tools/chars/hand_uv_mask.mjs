// Rasterise the UV islands of Rusana's hands (faces skinned to hand/finger joints) into a 1024 mask,
// so texture edits (crop top) never paint over them. node hand_uv_mask.mjs <in.vrm> <out.png>
import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
const [src, out] = process.argv.slice(2); const S = 1024;
const doc = await new NodeIO().read(src); const mask = new Uint8Array(S * S);
const skin = doc.getRoot().listSkins()[0]; const jn = skin.listJoints().map((j) => j.getName());
const isHand = jn.map((n) => /Hand|Thumb|Index|Middle|Ring|Little/.test(n));
const tri = (a, b, c) => {
  const minx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxx = Math.min(S - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const miny = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxy = Math.min(S - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const e = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]); const ar = e(a, b, c[0], c[1]);
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const px = x + 0.5, py = y + 0.5, w0 = e(b, c, px, py), w1 = e(c, a, px, py), w2 = e(a, b, px, py);
    if ((w0 >= -ar * 0.02 && w1 >= -ar * 0.02 && w2 >= -ar * 0.02 && ar > 0) || (w0 <= -ar * 0.02 && w1 <= -ar * 0.02 && w2 <= -ar * 0.02 && ar < 0)) mask[y * S + x] = 255;
  }
};
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  if (!/Body_00/.test(p.getMaterial()?.getName() || '')) continue;
  const uv = p.getAttribute('TEXCOORD_0'), J = p.getAttribute('JOINTS_0'), W = p.getAttribute('WEIGHTS_0'), idx = p.getIndices();
  const hw = (i) => { const j = [], w = []; J.getElement(i, j); W.getElement(i, w); let s = 0; for (let k = 0; k < 4; k++) if (isHand[j[k]]) s += w[k]; return s; };
  const t = [];
  for (let f = 0; f < idx.getCount(); f += 3) {
    const ii = [idx.getScalar(f), idx.getScalar(f + 1), idx.getScalar(f + 2)];
    if (ii.some((i) => hw(i) < 0.5)) continue;
    tri(...ii.map((i) => { uv.getElement(i, t); return [t[0] * S, t[1] * S]; }));
  }
}
await sharp(Buffer.from(mask), { raw: { width: S, height: S, channels: 1 } }).png().toFile(out);
console.log('hand mask', mask.reduce((a, v) => a + (v > 0), 0), 'px');
