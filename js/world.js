// Procedural toon district: «Неоновый квартал» — shopping street, courtyard park with a basketball court,
// club plaza with a rooftop terrace (ramp stairs). Static geometry is merged by material into few draw calls,
// every solid gets an inverted-hull outline. Exposes colliders, ground height and NPC areas.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const grad = (() => { const d = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
const outlineMat = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: new THREE.Color(0x2a2230) }, width: { value: 0.035 } }]),
  vertexShader: `uniform float width; attribute vec3 onormal;
    #include <fog_pars_vertex>
    void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); float w = width * clamp(-mvPosition.z * 0.06, 0.35, 2.2);
      vec3 n = normalize(normalMatrix * onormal); mvPosition.xyz += n * w * 0.5; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 color;
    #include <fog_pars_fragment>
    void main(){ gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
  side: THREE.BackSide, fog: true,
});

const C = (hex) => new THREE.Color(hex);
export class World {
  constructor(scene) {
    this.scene = scene; this.parts = []; this.outlineParts = []; this.colliders = []; this.circles = [];
    this.ramps = []; this.platforms = []; this.signs = []; this.anim = []; this.lamps = [];
    this.areas = {
      street: { name: 'Торговая улица', rect: [-34, 34, -5.5, 5.5], y: 0 },
      park: { name: 'Двор-сквер', rect: [-13, 19, -37, -14], y: 0 },
      club: { name: 'Площадь у клуба «Неон»', rect: [41, 58, -9, 5], y: 0 },
      roof: { name: 'Крыша', rect: [43, 59, 11, 24], y: 5 },
    };
    this.build();
  }
  // ---------- geometry helpers ----------
  add(geo, color, { outline = true, collide = false, pos, rot, scale } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4().compose(pos || new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot || 0, 0)), scale || new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    const col = C(color); const n = g.attributes.position.count; const ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    this.parts.push(g); if (outline) this.outlineParts.push(g);
    return g;
  }
  box(x, y, z, w, h, d, color, o = {}) {
    this.add(new THREE.BoxGeometry(w, h, d), color, { ...o, pos: new THREE.Vector3(x, y + h / 2, z), rot: o.rot });
    if (o.collide) this.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y, y1: y + h });
  }
  cyl(x, y, z, r0, r1, h, color, seg = 10, o = {}) {
    this.add(new THREE.CylinderGeometry(r1, r0, h, seg), color, { ...o, pos: new THREE.Vector3(x, y + h / 2, z) });
    if (o.collide) this.circles.push({ x, z, r: Math.max(r0, r1) + 0.05, y0: y, y1: y + h });
  }
  sphere(x, y, z, r, color, o = {}) { this.add(new THREE.IcosahedronGeometry(r, 1), color, { ...o, pos: new THREE.Vector3(x, y, z), scale: o.scale }); }
  sign(text, x, y, z, w, h, { rot = 0, bg = '#ff5a8a', fg = '#ffffff', glow = false, font = 'bold', neon = false } = {}) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
    const g = cv.getContext('2d');
    if (neon) { g.fillStyle = '#140c1c'; g.fillRect(0, 0, cv.width, cv.height); }
    else { g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 10; g.strokeRect(5, 5, cv.width - 10, cv.height - 10); }
    let fs = cv.height * 0.62; g.font = `${font} ${fs}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`;
    while (g.measureText(text).width > cv.width * 0.88 && fs > 10) { fs -= 4; g.font = `${font} ${fs}px system-ui, "Segoe UI", Roboto, Arial, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (neon) { g.shadowColor = fg; g.shadowBlur = 28; g.fillStyle = fg; g.fillText(text, cv.width / 2, cv.height / 2); g.shadowBlur = 8; g.fillStyle = '#fff'; g.fillText(text, cv.width / 2, cv.height / 2); }
    else { g.lineWidth = fs * 0.12; g.strokeStyle = 'rgba(40,20,40,0.55)'; g.strokeText(text, cv.width / 2, cv.height / 2); g.fillStyle = fg; g.fillText(text, cv.width / 2, cv.height / 2); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = glow || neon ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }) : new THREE.MeshToonMaterial({ map: t, gradientMap: grad });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.set(x, y, z); mesh.rotation.y = rot;
    this.scene.add(mesh); this.signs.push(mesh); return mesh;
  }
  finalize() {
    const geo = mergeGeometries(this.parts, false);
    const mesh = new THREE.Mesh(geo, toonMat); mesh.receiveShadow = true; mesh.castShadow = true; this.scene.add(mesh);
    // outline hull with smoothed normals
    const og = mergeGeometries(this.outlineParts.map((g) => { const c = g.clone(); c.deleteAttribute('color'); c.deleteAttribute('normal'); return c; }), false);
    const sm = mergeVertices(og, 1e-3); sm.computeVertexNormals();
    sm.setAttribute('onormal', sm.attributes.normal);
    const ol = new THREE.Mesh(sm, outlineMat); ol.frustumCulled = false; this.scene.add(ol);
    this.mesh = mesh; this.outline = ol;
  }
  // ---------- queries ----------
  heightAt(x, z, y = 0) {
    let h = 0;
    for (const r of this.ramps) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { const u = (r.axis === 'z' ? (z - r.z0) / (r.z1 - r.z0) : (x - r.x0) / (r.x1 - r.x0)); h = Math.max(h, r.h0 + (r.h1 - r.h0) * (r.flip ? 1 - u : u)); }
    for (const p of this.platforms) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && y > p.h - 1.2) h = Math.max(h, p.h);
    return h;
  }
  // push a circle (radius r) at position p (Vector3) out of colliders; y = feet height
  collide(p, r = 0.3) {
    for (const b of this.colliders) {
      if (p.y >= b.y1 - 0.25 || p.y + 1.6 <= b.y0) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { // inside: push out along the shortest axis
          const ex = [p.x - b.x0, b.x1 - p.x, p.z - b.z0, b.z1 - p.z]; const m = Math.min(...ex);
          if (m === ex[0]) p.x = b.x0 - r; else if (m === ex[1]) p.x = b.x1 + r; else if (m === ex[2]) p.z = b.z0 - r; else p.z = b.z1 + r;
        }
      }
    }
    for (const c of this.circles) {
      if (p.y >= c.y1 - 0.25 || p.y + 1.6 <= c.y0) continue;
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
  }
  // is a point inside solid geometry (camera collision)
  solidAt(x, y, z) {
    for (const b of this.colliders) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true;
    return false;
  }
  areaAt(p) { for (const [k, a] of Object.entries(this.areas)) { const r = a.rect; if (p.x >= r[0] - 2 && p.x <= r[1] + 2 && p.z >= r[2] - 2 && p.z <= r[3] + 2 && Math.abs(p.y - a.y) < 2) return k; } return null; }
  randomPoint(area) { const r = this.areas[area].rect; return new THREE.Vector3(r[0] + Math.random() * (r[1] - r[0]), this.areas[area].y, r[2] + Math.random() * (r[3] - r[2])); }
  update(t) { for (const f of this.anim) f(t); }

  // ---------- the district ----------
  build() {
    const B = this.box.bind(this);
    // ground
    B(10, -0.2, -8, 160, 0.2, 120, 0x7d8a96, { outline: false });                 // base
    B(0, 0, 0, 84, 0.02, 8.4, 0x767d8a, { outline: false });                        // road
    for (let x = -38; x <= 38; x += 4) B(x, 0.02, 0, 2, 0.01, 0.18, 0xf2efe6, { outline: false });   // lane marks
    for (let i = 0; i < 7; i++) B(-18, 0.021, -3 + i, 3.2, 0.01, 0.5, 0xe2ded6, { outline: false });  // crosswalk
    for (let i = 0; i < 7; i++) B(20, 0.021, -3 + i, 3.2, 0.01, 0.5, 0xe2ded6, { outline: false });
    B(0, 0, 5.6, 84, 0.14, 2.8, 0xd9cfc3, { outline: false }); B(0, 0, -5.6, 84, 0.14, 2.8, 0xd9cfc3, { outline: false });
    for (let x = -41; x <= 41; x += 1.4) { B(x, 0.141, 5.6, 0.04, 0.005, 2.8, 0xc4b8aa, { outline: false }); B(x, 0.141, -5.6, 0.04, 0.005, 2.8, 0xc4b8aa, { outline: false }); }
    // --- shops, south side (z>0) and north side (z<0), leaving a gate to the park at x∈[-5,5] north
    const pal = [0xf6d7b0, 0xf2b5b5, 0xb9e3d0, 0xc9c1ee, 0xf7e7a1, 0xa9d3f2, 0xf3c6a0, 0xe7b7d6];
    const shops = [['Кофейня «Утро»', '#8a4b2a'], ['Раменная', '#d83a3a'], ['Цветы', '#e36aa2'], ['Аптека', '#2aa36b'], ['Караоке «Звезда»', '#6a4ad8'], ['Комиксы', '#2a7bd8'], ['Пекарня', '#d89a2a'], ['Суши', '#1f8f8f'], ['Спорттовары', '#d85a2a'], ['Книги', '#5a6a2a']];
    let si = 0;
    const building = (x0, x1, side, h, color, shop) => {
      const w = x1 - x0, cx = (x0 + x1) / 2, d = side < 0 ? 5 : 10, zf = side * 7.2, cz = zf + side * d / 2;
      B(cx, 0, cz, w, h, d, color, { collide: true });
      B(cx, h, cz, w + 0.3, 0.35, d + 0.3, 0x6b5f6e);                                   // roof cap
      // ground floor shop front
      const f = zf - side * 0.02;
      B(cx, 0.14, f, w - 0.6, 2.6, 0.1, 0x86bccf, { outline: false });                     // glass
      for (const sy of [0.95, 1.75]) B(cx, sy, f - side * 0.06, w - 0.8, 0.05, 0.02, 0x5f8fa3, { outline: false });   // shelves seen through
      for (let xx = x0 + 0.8; xx < x1 - 0.8; xx += 0.55) if (Math.random() < 0.7) B(xx, Math.random() < 0.5 ? 1.0 : 1.8, f - side * 0.065, 0.3, 0.28 + Math.random() * 0.2, 0.02, [0xf2a0a0, 0xf7e09a, 0xa8e0c0, 0xc4b0f0, 0xffffff][(Math.random() * 5) | 0], { outline: false });
      B(x0 + 0.5 + (w - 1) * 0.5 + 1.1, 0.14, f - side * 0.07, 0.04, 2.3, 0.02, 0xe8f4fa, { outline: false });   // glint
      B(cx, 0.14, f - side * 0.02, w - 0.4, 0.3, 0.14, 0x5d4e5e);                          // sill
      for (let xx = x0 + 1.5; xx < x1 - 0.6; xx += 2.4) B(xx, 0.14, f - side * 0.03, 0.12, 2.6, 0.12, 0xf4efe8);
      // awning (striped)
      const aw = shop ? shop[1] : '#c85a5a';
      for (let k = 0; k < Math.floor(w / 0.7); k++) this.add(new THREE.BoxGeometry(0.7, 0.08, 1.5), k % 2 ? 0xffffff : parseInt(aw.slice(1), 16), { outline: k === 0, pos: new THREE.Vector3(x0 + 0.35 + k * 0.7, 3.1, zf - side * 0.7), rot: 0, scale: new THREE.Vector3(1, 1, 1) });
      if (shop) this.sign(shop[0], cx, 3.75, zf - side * 0.06, Math.min(w - 1, 5.5), 0.9, { rot: side > 0 ? Math.PI : 0, bg: shop[1] });
      // windows on upper floors
      for (let fy = 4.4; fy < h - 1.2; fy += 2.8) for (let xx = x0 + 1.2; xx < x1 - 0.8; xx += 2.1) {
        B(xx + 0.45, fy, f, 1.2, 1.5, 0.08, 0x7ea9c6, { outline: false });
        B(xx + 0.45, fy - 0.1, f - side * 0.04, 1.4, 0.12, 0.2, 0xf4efe8);
        if (Math.random() < 0.35) B(xx + 0.45, fy + 0.15, f - side * 0.05, 1.0, 0.5, 0.02, [0xfff3c4, 0xffd6e8, 0xd6f0ff][(Math.random() * 3) | 0], { outline: false });
      }
      // AC units / pipes for texture
      if (Math.random() < 0.6) B(x0 + 1 + Math.random() * (w - 2), 4.2 + Math.floor(Math.random() * 2) * 2.8, f - side * 0.35, 0.8, 0.55, 0.5, 0xe8e8ea);
    };
    const sSouth = [[-42, -32], [-32, -24], [-24, -14], [-14, -6], [-6, 4], [4, 12], [12, 22], [22, 30], [30, 38]];
    sSouth.forEach(([a, b], i) => building(a, b, 1, 7 + ((i * 37) % 7), pal[i % pal.length], shops[si++ % shops.length]));
    const sNorth = [[-42, -30], [-30, -20], [-20, -5.5], [5.5, 16], [16, 26], [26, 38]];
    sNorth.forEach(([a, b], i) => building(a, b, -1, 8 + ((i * 53) % 8), pal[(i + 3) % pal.length], shops[si++ % shops.length]));
    // park gate (arch) between north buildings
    B(-5.2, 0, -7.4, 0.8, 5.2, 0.8, 0xb07a5a, { collide: true }); B(5.2, 0, -7.4, 0.8, 5.2, 0.8, 0xb07a5a, { collide: true });
    B(0, 4.6, -7.4, 11.2, 0.9, 1.0, 0xc98d66);
    this.sign('ДВОР', 0, 5.05, -6.86, 3, 0.7, { bg: '#2f7a5a' });
    // west end: construction fence
    for (let z = -6.5; z <= 6.5; z += 1.3) B(-39, 0, z, 0.3, 1.4, 1.1, z % 2.6 === 0 ? 0xf2c230 : 0xfff6e0, { collide: true });
    this.sign('РЕМОНТ', -38.8, 1.8, 0, 3, 0.7, { rot: Math.PI / 2, bg: '#f2c230', fg: '#2a2a2a' });
    // street furniture
    for (let x = -34; x <= 34; x += 8) for (const s of [1, -1]) {
      if (s === -1 && Math.abs(x) < 6) continue;
      this.lamp(x, s * 4.6);
      if ((x / 8) % 2 === 0) this.tree(x + 4, s * 5.4, 0.7, s > 0);
    }
    for (const [x, s] of [[-26, 1], [8, 1], [-12, -1], [28, -1]]) { this.bench(x, s * 6.4, s > 0 ? Math.PI : 0); }
    for (const [x, s, c] of [[-20, 1, 0xd83a3a], [15, -1, 0x2a7bd8], [33, 1, 0x2aa36b]]) this.vending(x, s * 6.55, s > 0 ? Math.PI : 0, c);
    // parked cars (toon blobs)
    for (const [x, z, c, r] of [[-30, -3.2, 0xe86a6a, 0], [-8, 3.2, 0x6ab0e8, Math.PI], [24, -3.2, 0xf2d060, 0], [35, 3.2, 0xffffff, Math.PI]]) this.car(x, z, c, r);
    this.buildPark();
    this.buildClub();
    this.buildSkyline();
    this.finalize();
  }
  lamp(x, z) {
    this.cyl(x, 0, z, 0.09, 0.07, 4.2, 0x3d4658, 8, { collide: true });
    this.box(x, 4.1, z, 0.2, 0.12, 0.9, 0x3d4658);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.6), toneMapped: false }));
    bulb.position.set(x, 4.0, z); this.scene.add(bulb); this.lamps.push(bulb);
  }
  tree(x, z, s = 1, planter = true) {
    if (planter) this.box(x, 0, z, 1.1, 0.5, 1.1, 0xa98f7a, { collide: true });
    this.cyl(x, 0.3, z, 0.14 * s + 0.05, 0.1 * s + 0.04, 2.2 * s + 0.6, 0x7a5236, 7, { collide: !planter });
    const greens = [0x6fbf5a, 0x5aa84f, 0x86cf62];
    this.sphere(x, 2.6 * s + 1.0, z, 1.1 * s + 0.3, greens[0]);
    this.sphere(x + 0.6 * s, 2.2 * s + 1.0, z + 0.3 * s, 0.8 * s + 0.2, greens[1]);
    this.sphere(x - 0.5 * s, 2.3 * s + 1.1, z - 0.4 * s, 0.75 * s + 0.2, greens[2]);
  }
  bench(x, z, rot) {
    const g = new THREE.Group();
    const add = (w, h, d, px, py, pz, c) => this.add(new THREE.BoxGeometry(w, h, d), c, { pos: new THREE.Vector3(x + Math.cos(rot) * px + Math.sin(rot) * pz, py, z - Math.sin(rot) * px + Math.cos(rot) * pz), rot });
    add(1.8, 0.08, 0.5, 0, 0.45, 0, 0xb5774a); add(1.8, 0.4, 0.06, 0, 0.75, -0.24, 0xb5774a);
    add(0.08, 0.45, 0.45, -0.8, 0.22, 0, 0x3d4658); add(0.08, 0.45, 0.45, 0.8, 0.22, 0, 0x3d4658);
    this.circles.push({ x, z, r: 0.75, y0: 0, y1: 1 });
  }
  vending(x, z, rot, c) {
    this.box(x, 0.14, z, 0.9, 1.9, 0.7, c, { collide: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 1.6), toneMapped: false }));
    m.position.set(x, 1.45, z + (rot === 0 ? 0.36 : -0.36)); m.rotation.y = rot; this.scene.add(m);
  }
  car(x, z, c, r) {
    this.box(x, 0.25, z, 3.8, 0.7, 1.7, c, { collide: true });
    this.box(x - 0.2, 0.95, z, 2.0, 0.6, 1.5, c);
    this.box(x - 0.2, 1.0, z, 2.02, 0.4, 1.52, 0x3b5670, { outline: false });
    for (const dx of [-1.2, 1.2]) for (const dz of [-0.8, 0.8]) this.add(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12).rotateX(Math.PI / 2), 0x2a2a30, { pos: new THREE.Vector3(x + dx, 0.32, z + dz) });
  }
  buildPark() {
    const B = this.box.bind(this);
    // enclosure walls (buildings around the courtyard)
    B(-20, 0, -26, 6, 11, 36, 0xe7d8c2, { collide: true }); B(26, 0, -26, 6, 10, 36, 0xd9c9ee, { collide: true });
    B(3, 0, -45, 52, 12, 6, 0xf2c9b0, { collide: true });
    for (let x = -14; x <= 20; x += 2.4) for (let y = 2; y < 10; y += 2.8) { B(x, y, -41.95, 1.1, 1.4, 0.1, 0x44607e, { outline: false }); }
    for (let z = -40; z <= -12; z += 2.6) for (let y = 2; y < 9; y += 2.8) { B(-16.95, y, z, 0.1, 1.4, 1.1, 0x44607e, { outline: false }); B(22.95, y, z, 0.1, 1.4, 1.1, 0x44607e, { outline: false }); }
    // grass + paths
    B(3, 0.0, -25, 40, 0.06, 28, 0x8fcf6a, { outline: false });
    B(0, 0.061, -20, 3, 0.01, 26, 0xe9dcc4, { outline: false }); B(3, 0.061, -24, 38, 0.01, 2.6, 0xe9dcc4, { outline: false });
    // fountain
    this.cyl(0, 0, -24, 3.2, 3.2, 0.55, 0xd8d2c8, 24, { collide: true });
    this.cyl(0, 0.5, -24, 2.9, 2.9, 0.08, 0x6ec3e8, 24, { outline: false });
    this.cyl(0, 0.5, -24, 0.5, 0.35, 1.3, 0xd8d2c8, 12);
    this.cyl(0, 1.8, -24, 1.0, 1.0, 0.2, 0xd8d2c8, 16);
    const water = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.5, 1.8), transparent: true, opacity: 0.55, toneMapped: false }));
    water.position.set(0, 2.5, -24); water.rotation.x = Math.PI; this.scene.add(water);
    this.anim.push((t) => { water.scale.set(1 + Math.sin(t * 6) * 0.05, 1 + Math.sin(t * 4) * 0.08, 1 + Math.cos(t * 6) * 0.05); });
    // trees and benches
    for (const [x, z, s] of [[-10, -15, 1.1], [-11, -33, 1.2], [8, -34, 1.0], [-6, -30, 0.9], [10, -15, 1.0], [-12, -22, 0.8], [17, -14, 0.9]]) this.tree(x, z, s, false);
    for (const [x, z, r] of [[-4.5, -19, Math.PI / 2], [4.5, -29, -Math.PI / 2], [-4.5, -29, Math.PI / 2]]) this.bench(x, z, r);
    // basketball court
    B(14, 0.062, -28, 9, 0.01, 12, 0xd96f4a, { outline: false });
    B(14, 0.073, -28, 8.6, 0.004, 0.08, 0xffffff, { outline: false });
    for (const zz of [-33.6, -22.4]) { this.cyl(14, 0, zz + (zz < -28 ? -0.6 : 0.6), 0.08, 0.08, 3.0, 0x3d4658, 8, { collide: true }); B(14, 2.8, zz, 1.8, 1.1, 0.08, 0xffffff); this.add(new THREE.TorusGeometry(0.24, 0.025, 6, 16).rotateX(Math.PI / 2), 0xff6a2a, { pos: new THREE.Vector3(14, 3.05, zz + (zz < -28 ? 0.3 : -0.3)) }); }
    for (let z = -34; z <= -22; z += 1.5) { B(18.8, 0, z, 0.06, 2.2, 0.06, 0x3d4658, { outline: false }); }
    B(18.8, 2.1, -28, 0.08, 0.08, 12, 0x3d4658, { collide: false });
    this.colliders.push({ x0: 18.7, x1: 18.9, z0: -34, z1: -22, y0: 0, y1: 2.2 });
    this.sign('СКВЕР', 0, 3.2, -41.9, 3.4, 0.8, { bg: '#2f7a5a' });
  }
  buildClub() {
    const B = this.box.bind(this);
    // plaza floor
    B(51, 0.0, -1, 24, 0.05, 18, 0xcdbfd6, { outline: false });
    for (let x = 40; x <= 62; x += 2) B(x, 0.051, -1, 0.05, 0.005, 18, 0xb9aac4, { outline: false });
    // club building (east)
    B(68, 0, -1, 12, 12, 26, 0x2d2638, { collide: true });
    B(62.1, 0.05, -1, 0.3, 3.2, 3.2, 0x121016);                                      // door
    this.sign('НЕОН', 62.0, 6.2, -1, 7, 2.2, { rot: -Math.PI / 2, neon: true, fg: '#ff4fd8' });
    this.sign('CLUB · 21+', 62.0, 4.2, -1, 3.4, 0.6, { rot: -Math.PI / 2, neon: true, fg: '#52e5ff' });
    for (const z of [-3.2, 1.2]) { this.cyl(60.6, 0, z, 0.06, 0.06, 1.0, 0xd8b44a, 8, { collide: true }); this.cyl(60.6, 0, z + 2, 0.06, 0.06, 1.0, 0xd8b44a, 8, { collide: true }); }
    // north block of the plaza
    B(51, 0, -14, 24, 9, 8, 0xa9d3f2, { collide: true });
    this.sign('Бар «Лис»', 51, 3.6, -9.95, 5, 0.9, { bg: '#e0762a' });
    // rooftop building (south of the plaza) + ramp stairs on its west side
    const H = 5;
    B(52, 0, 17, 20, H, 18, 0xf1b7a8, { collide: true });
    B(52, H, 17, 20.2, 0.12, 18.2, 0xb8a5b0, { outline: true });
    for (let x = 43; x <= 61; x += 2.5) B(x, 1.2, 7.95, 1.2, 1.6, 0.1, 0x44607e, { outline: false });
    this.platforms.push({ x0: 42, x1: 62, z0: 8, z1: 26, h: H });
    // ramp with steps: x∈[38.4,42], z from 8 (h=0) to 22 (h=5); landing z∈[22,26] at h=5
    this.ramps.push({ x0: 38.4, x1: 42, z0: 8, z1: 22, h0: 0, h1: H, axis: 'z' });
    this.platforms.push({ x0: 38.4, x1: 42.1, z0: 22, z1: 26, h: H });
    const steps = 20;
    for (let i = 0; i < steps; i++) { const z0 = 8 + i * 14 / steps, h = (i + 1) * H / steps; B(40.2, 0, z0 + 0.35, 3.6, h, 14 / steps, i % 2 ? 0xd9cfc3 : 0xcfc4b6, { outline: i % 4 === 0 }); }
    B(40.2, 0, 24, 3.6, H, 4, 0xcfc4b6);
    // side rails of the stairs + roof railing
    B(38.3, 0, 15, 0.1, 1.0, 14, 0x3d4658); this.colliders.push({ x0: 38.1, x1: 38.4, z0: 8, z1: 26, y0: -1, y1: 7 });
    for (let z = 8; z <= 26; z += 1.5) this.cyl(38.3, this.heightAt(40, Math.min(z, 22), 9), z, 0.04, 0.04, 1.0, 0x3d4658, 6);
    const rail = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      B(cx, H + 1.0, cz, Math.abs(x1 - x0) + 0.08, 0.08, Math.abs(z1 - z0) + 0.08, 0x3d4658);
      for (let t = 0; t <= len; t += 1.5) this.cyl(x0 + (x1 - x0) * t / len, H, z0 + (z1 - z0) * t / len, 0.04, 0.04, 1.0, 0x3d4658, 6);
      this.colliders.push({ x0: Math.min(x0, x1) - 0.15, x1: Math.max(x0, x1) + 0.15, z0: Math.min(z0, z1) - 0.15, z1: Math.max(z0, z1) + 0.15, y0: H - 0.5, y1: H + 1.2 }); };
    rail(42, 8, 62, 8); rail(62, 8, 62, 26); rail(38.4, 26, 62, 26); rail(42, 8, 42, 22);
    // rooftop props
    this.cyl(58, H, 23, 1.3, 1.3, 2.4, 0x9fb3c8, 16, { collide: true }); this.cyl(58, H + 2.4, 23, 1.4, 0.2, 0.8, 0x7f93a8, 16);
    for (const [x, z] of [[47, 24], [50, 24], [60, 12]]) this.box(x, H, z, 1.2, 0.9, 1.0, 0xe8e8ea, { collide: true });
    this.bench(52, 12.5, Math.PI); this.bench(46, 12.5, Math.PI);
    this.tree(55, 13, 0.6, true);
    // string lights across the roof
    const bulbs = new THREE.Group(); const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 1.1), toneMapped: false });
    for (let i = 0; i <= 24; i++) { const t = i / 24; const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), bm); b.position.set(43 + t * 18, H + 2.6 - Math.sin(t * Math.PI) * 0.6, 18); bulbs.add(b); }
    this.scene.add(bulbs);
    this.cyl(43, H, 18, 0.05, 0.05, 2.7, 0x3d4658, 6); this.cyl(61, H, 18, 0.05, 0.05, 2.7, 0x3d4658, 6);
    this.sign('КРЫША ↑', 40.2, 1.6, 7.6, 2.4, 0.6, { rot: Math.PI, bg: '#f25a7a' });
    // lamps on the plaza
    this.lamp(44, -7.5); this.lamp(58, -7.5); this.lamp(44, 5.5);
    // connect plaza with street end (open) — low planters as edge
    for (const z of [-8.5, 5.8]) this.box(39.5, 0, z, 1.2, 0.6, 1.2, 0xa98f7a, { collide: true });
  }
  buildSkyline() {
    const cols = [0x9fb6d6, 0xb3c4e0, 0x8ea8cc, 0xc2cde6];
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2, r = rnd(85, 130);
      const x = 10 + Math.cos(a) * r, z = -8 + Math.sin(a) * r * 0.8;
      const h = rnd(18, 55), w = rnd(8, 18);
      this.box(x, 0, z, w, h, w * rnd(0.6, 1.2), cols[i % 4], { outline: true });
    }
  }
}
