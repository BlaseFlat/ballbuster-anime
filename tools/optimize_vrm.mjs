// Shrink VRM (glTF binary) textures without touching VRM extensions:
//  - resize images to a max size (per-name overrides), opaque -> JPEG, alpha -> palette/PNG
//  - thumbnail -> 128 px
// usage: node optimize_vrm.mjs in.vrm out.vrm [maxSize=1024] [keepRegex=maxsize...]
import fs from 'fs';
import sharp from 'sharp';
const [inp, outp, maxArg = '1024', ...rules] = process.argv.slice(2);
const MAX = +maxArg;
const R = rules.map((r) => { const [re, s] = r.split('='); return [new RegExp(re, 'i'), +s]; });
const buf = fs.readFileSync(inp);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const binLen = buf.readUInt32LE(20 + jsonLen);
const bin = buf.subarray(binStart, binStart + binLen);
const views = json.bufferViews;
const imgView = new Map();
json.images.forEach((im, i) => { if (im.bufferView !== undefined) imgView.set(im.bufferView, i); });
const newData = [];
let before = 0, after = 0;
for (let vi = 0; vi < views.length; vi++) {
  const v = views[vi];
  let data = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  if (imgView.has(vi)) {
    const im = json.images[imgView.get(vi)];
    const name = im.name || '';
    let max = MAX; for (const [re, s] of R) if (re.test(name)) max = s;
    if (/thumbnail/i.test(name)) max = 128;
    const img = sharp(data); const meta = await img.metadata();
    const st = await sharp(data).stats();
    const alpha = meta.hasAlpha && st.channels[3] && st.channels[3].min < 250;
    const nml = /nml|normal/i.test(name);
    const size = Math.min(max, Math.max(meta.width, meta.height));
    let p = sharp(data).resize({ width: meta.width >= meta.height ? size : null, height: meta.height > meta.width ? size : null, fit: 'inside', withoutEnlargement: true });
    let out, mime;
    if (!alpha && !nml) { out = await p.removeAlpha().jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer(); mime = 'image/jpeg'; }
    else { out = await p.png({ compressionLevel: 9, palette: !nml && /Eye|Brow|Lash|Mouth|Shoes|Highlight|Extra/.test(name), quality: 95, effort: 8 }).toBuffer(); mime = 'image/png'; }
    before += data.length; after += out.length;
    im.mimeType = mime; data = out;
    console.log(name.padEnd(36), `${meta.width}x${meta.height} -> ${size}`, alpha ? 'A' : ' ', (data.length / 1024).toFixed(0) + 'k');
  }
  newData.push(data);
}
// repack
let off = 0; const parts = [];
for (let vi = 0; vi < views.length; vi++) {
  const d = newData[vi]; views[vi].byteOffset = off; views[vi].byteLength = d.length; parts.push(d); off += d.length;
  const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
}
json.buffers[0].byteLength = off;
const binOut = Buffer.concat(parts);
let js = Buffer.from(JSON.stringify(json), 'utf8'); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
const total = 12 + 8 + js.length + 8 + binOut.length; header.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binOut.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(outp, Buffer.concat([header, jh, js, bh, binOut]));
console.log(`images ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB; file ${(buf.length / 1e6).toFixed(1)} -> ${(total / 1e6).toFixed(1)}MB`);
