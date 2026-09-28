// Anime hit effects: impact frames, speed lines, flashes, star bursts, rings, camera shake, popups.
import * as THREE from 'three';

function starTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64); g.fillStyle = '#fff';
  g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 16 : 62; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ringTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export class FX {
  constructor(scene, camera, grade) {
    this.scene = scene; this.camera = camera; this.grade = grade; this.items = [];
    this.star = starTex(); this.ring = ringTex();
    this.shakeAmp = 0; this.shakeT = 0; this.impact = 0; this.flash = 0; this.speed = 0; this.speedTarget = 0;
    this.pop = document.getElementById('popups');
  }
  burst(pos, { color = 0xfff2a8, size = 1, perfect = false } = {}) {
    const col = new THREE.Color(color).multiplyScalar(perfect ? 1.5 : 1.2);
    const mk = (tex, s, life, spin, grow) => {
      const m = new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m); sp.position.copy(pos); sp.scale.setScalar(s); sp.renderOrder = 10; this.scene.add(sp);
      this.items.push({ o: sp, t: 0, life, s, spin, grow });
    };
    mk(this.star, 0.36 * size, 0.2, 3, 2.0);
    mk(this.ring, 0.2 * size, 0.28, 0, 5);
    if (perfect) { mk(this.star, 0.55 * size, 0.26, -2, 1.6); mk(this.ring, 0.3 * size, 0.38, 0, 7); }
    // sparks
    for (let i = 0; i < (perfect ? 14 : 8); i++) {
      const m = new THREE.SpriteMaterial({ map: this.star, color: col, transparent: true, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m); sp.position.copy(pos); sp.scale.setScalar(0.08 * size); sp.renderOrder = 10; this.scene.add(sp);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 3);
      this.items.push({ o: sp, t: 0, life: 0.35, s: 0.08 * size, v, grow: 0 });
    }
  }
  impactFrame(pos, strength = 1) {
    const p = pos.clone().project(this.camera);
    this.grade.uniforms.center.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    this.impact = strength; this.flash = 0.25 * strength; this.speed = Math.max(this.speed, 0.9 * strength);
  }
  speedLines(v) { this.speedTarget = v; }
  shake(a, t = 0.25) { this.shakeAmp = Math.max(this.shakeAmp, a); this.shakeT = t; }
  popup(text, pos, cls = '', dur = 1.0) {
    const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text; this.pop.appendChild(el);
    this.items.push({ el, pos: pos.clone(), t: 0, life: dur });
  }
  update(dt, rdt) {
    const u = this.grade.uniforms;
    this.impact = Math.max(0, this.impact - rdt * 9); u.impact.value = this.impact > 0.5 ? 1 : this.impact * 1.2;
    this.flash = Math.max(0, this.flash - rdt * 4); u.flash.value = this.flash;
    this.speed += (this.speedTarget - this.speed) * Math.min(1, rdt * 6); if (this.speedTarget === 0) this.speed = Math.max(0, this.speed - rdt * 2.5);
    u.speed.value = this.speed;
    this.shakeT -= rdt; if (this.shakeT <= 0) this.shakeAmp *= Math.exp(-rdt * 20);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += it.el ? rdt : dt; const k = it.t / it.life;
      if (it.el) {
        const p = it.pos.clone(); p.y += k * 0.5; p.project(this.camera);
        it.el.style.transform = `translate(-50%,-50%) translate(${(p.x * 0.5 + 0.5) * innerWidth}px, ${(1 - (p.y * 0.5 + 0.5)) * innerHeight}px) scale(${k < 0.12 ? 0.6 + k / 0.12 * 0.6 : 1.2 - Math.min(0.2, (k - 0.12))})`;
        it.el.style.opacity = k > 0.75 ? String(1 - (k - 0.75) / 0.25) : '1';
        if (p.z > 1) it.el.style.opacity = '0';
      } else {
        const o = it.o; o.scale.setScalar(it.s * (1 + it.grow * k)); o.material.opacity = 1 - k * k;
        if (it.spin) o.material.rotation += it.spin * dt;
        if (it.v) { o.position.addScaledVector(it.v, dt); it.v.y -= 6 * dt; }
      }
      if (k >= 1) { if (it.el) it.el.remove(); else { this.scene.remove(it.o); it.o.material.dispose(); } this.items.splice(i, 1); }
    }
  }
  shakeOffset(t) { const a = this.shakeAmp; return new THREE.Vector3(Math.sin(t * 91) * a, Math.sin(t * 73 + 1) * a, Math.sin(t * 57 + 2) * a * 0.5); }
}
