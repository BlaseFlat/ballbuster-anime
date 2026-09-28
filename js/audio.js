// Tiny WebAudio synth: impacts, whooshes, UI blips, pain grunts (formant noise), ambient pad. No external files.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.vol = 0.7; }
  init() {
    if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    const n = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, n, n); const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.ambient();
  }
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.vol; return this.muted; }
  env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; }
  whoosh(pitch = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime, s = this.noiseSrc(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500 * pitch, t); f.frequency.exponentialRampToValueAtTime(2600 * pitch, t + 0.16);
    this.env(g, t, 0.03, 0.18, 0.35); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 0.3);
  }
  impact(power = 1, perfect = false) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(140 * (perfect ? 1.1 : 1), t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    this.env(g, t, 0.004, 0.2, 0.9 * power); o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.3);
    const s = this.noiseSrc(), f = this.ctx.createBiquadFilter(), g2 = this.ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 1800;
    this.env(g2, t, 0.002, 0.09, 0.6 * power); s.connect(f).connect(g2).connect(this.master); s.start(t); s.stop(t + 0.15);
    if (perfect) { const o2 = this.ctx.createOscillator(), g3 = this.ctx.createGain(); o2.type = 'triangle'; o2.frequency.setValueAtTime(1320, t); o2.frequency.exponentialRampToValueAtTime(1760, t + 0.1);
      this.env(g3, t + 0.02, 0.01, 0.35, 0.18); o2.connect(g3).connect(this.master); o2.start(t); o2.stop(t + 0.5); }
  }
  block() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08); this.env(g, t, 0.003, 0.1, 0.15); o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.15); }
  grunt(pitch = 1, len = 0.35, pain = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; const base = 120 * pitch;
    o.frequency.setValueAtTime(base * (1.3 + 0.3 * pain), t); o.frequency.exponentialRampToValueAtTime(base * 0.8, t + len);
    const g = this.ctx.createGain(); this.env(g, t, 0.02, len, 0.22 + 0.1 * pain);
    const f1 = this.ctx.createBiquadFilter(), f2 = this.ctx.createBiquadFilter(); f1.type = f2.type = 'bandpass';
    f1.frequency.value = 650; f2.frequency.value = 1100; f1.Q.value = 6; f2.Q.value = 8;
    const mix = this.ctx.createGain(); mix.gain.value = 1.4;
    o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(g).connect(this.master); o.start(t); o.stop(t + len + 0.1);
  }
  blip(f = 880) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; this.env(g, t, 0.005, 0.12, 0.12); o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2); }
  chord() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f), i * 90)); }
  ambient() {
    const t = this.ctx.currentTime, g = this.ctx.createGain(); g.gain.value = 0.035; g.connect(this.master);
    const s = this.noiseSrc(), f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; s.connect(f).connect(g); s.start(t);
    // soft city pad
    const pg = this.ctx.createGain(); pg.gain.value = 0.018; pg.connect(this.master);
    for (const fr of [220, 277.2, 329.6]) { const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05; const lg = this.ctx.createGain(); lg.gain.value = 2; lfo.connect(lg).connect(o.frequency); o.connect(pg); o.start(t); lfo.start(t); }
  }
}
