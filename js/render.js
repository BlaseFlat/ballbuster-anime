// Renderer, post-processing (bloom + anime grade + impact frames/speed lines), sky, lights, adaptive resolution.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, aspect: { value: 1 },
    sat: { value: 1.12 }, warm: { value: 0.035 }, vignette: { value: 0.28 },
    impact: { value: 0 },        // 0..1 impact frame (monochrome inverted flash)
    flash: { value: 0 },         // white flash
    speed: { value: 0 },         // radial speed lines amount
    center: { value: new THREE.Vector2(0.5, 0.5) },
    tint: { value: new THREE.Color(1, 1, 1) }, tintAmt: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, aspect, sat, warm, vignette, impact, flash, speed, tintAmt; uniform vec2 center; uniform vec3 tint;
    varying vec2 vUv;
    float hash(float n){ return fract(sin(n)*43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, sat);
      // split-tone: warm highlights, cool shadows
      col += vec3(warm, warm*0.35, -warm*0.6) * smoothstep(0.35, 1.0, l);
      col += vec3(-0.015, 0.0, 0.03) * (1.0 - smoothstep(0.0, 0.4, l));
      vec2 d = vUv - center; d.x *= aspect;
      float r = length(d), a = atan(d.y, d.x);
      // speed lines (anime radial streaks), stronger toward the edges
      if (speed > 0.001) {
        float s = floor(a * 60.0 / 6.2831 * 3.0);
        float n = hash(s + floor(time * 18.0));
        float line = step(0.72, n) * smoothstep(0.18, 0.75, r);
        col = mix(col, vec3(1.0), line * speed * 0.75);
      }
      // impact frame: posterised inverted monochrome with radial burst
      if (impact > 0.001) {
        float m = step(0.42, l);
        vec3 inv = vec3(1.0 - m);
        float s2 = floor(a * 40.0 / 6.2831);
        float burst = step(0.55, hash(s2 + 7.0)) * smoothstep(0.08, 0.6, r);
        inv = mix(inv, vec3(0.0), burst * 0.8);
        col = mix(col, inv, impact);
      }
      col = mix(col, tint, tintAmt);
      col = mix(col, vec3(1.0), flash);
      float v = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(aspect, 1.0)) * 0.9);
      col *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = vec4(col, c.a);
    }`,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const maxDPR = Math.min(window.devicePixelRatio || 1, 1.75);
  let dpr = Math.min(maxDPR, 1.25);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.08, 600);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.86);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new OutputPass());
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix(); grade.uniforms.aspect.value = w / h;
    bloom.resolution.set(w * dpr / 2, h * dpr / 2);
  };
  window.addEventListener('resize', resize); resize();
  // adaptive resolution: keep ~60 fps
  let acc = 0, frames = 0, lock = false;
  const adapt = (dt) => {
    if (lock) return; acc += dt; frames++;
    if (acc < 1.0) return;
    const ms = acc / frames * 1000; acc = 0; frames = 0;
    let nd = dpr;
    if (ms > 21 && dpr > 0.6) nd = Math.max(0.6, dpr - 0.15);
    else if (ms < 14.5 && dpr < maxDPR) nd = Math.min(maxDPR, dpr + 0.1);
    if (nd !== dpr) { dpr = nd; renderer.setPixelRatio(dpr); resize(); }
  };
  return { renderer, scene, camera, composer, grade, bloom, adapt, resize,
    get dpr() { return dpr; }, setLock(v, d) { lock = v; if (d) { dpr = d; renderer.setPixelRatio(d); resize(); } } };
}

// Stylised sky dome with gradient, sun glow and painted-looking clouds.
export function createSky(scene) {
  const g = new THREE.SphereGeometry(400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3d86e8) }, mid: { value: new THREE.Color(0x8cc4ff) }, bot: { value: new THREE.Color(0xe8f3ff) },
      sunDir: { value: new THREE.Vector3(-0.3, 0.86, 0.42).normalize() }, time: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top, mid, bot, sunDir; uniform float time; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i=0;i<5;i++){ s += a*n(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        float y = vDir.y;
        vec3 c = mix(bot, mid, smoothstep(-0.05, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.75, y));
        float sd = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0, 0.92, 0.75) * (pow(sd, 400.0) * 1.6 + pow(sd, 12.0) * 0.18);
        // anime clouds: thresholded fbm with a hard light/shade split
        if (y > 0.02) {
          vec2 uv = vDir.xz / (y + 0.12) * 1.6 + vec2(time * 0.004, 0.0);
          float f = fbm(uv);
          float cl = smoothstep(0.56, 0.6, f) * smoothstep(0.02, 0.12, y);
          float shade = smoothstep(0.62, 0.7, fbm(uv + vec2(0.05, 0.04)));
          vec3 cc = mix(vec3(0.78, 0.84, 0.95), vec3(1.0), shade);
          c = mix(c, cc, cl * 0.95);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
  return sky;
}

export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xe4ecff, 0xb0a390, 1.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera; s.left = -18; s.right = 18; s.top = 18; s.bottom = -18; s.near = 1; s.far = 120;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  const offset = new THREE.Vector3(-0.3, 0.86, 0.42).normalize().multiplyScalar(60);
  return { hemi, sun, follow(p) { sun.position.copy(p).add(offset); sun.target.position.copy(p); } };
}
