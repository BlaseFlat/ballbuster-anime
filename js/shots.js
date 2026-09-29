// Headless screenshot / smoke-test scenarios (?shot=name). Drives the loop with a fixed timestep.
import * as THREE from 'three';
const Q = new URLSearchParams(location.search);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const step = (g, n, dt = 1 / 30) => { g.fixedDt = dt; for (let i = 0; i < n; i++) g.tick(); };
const place = (guy, x, z, yaw) => { guy.pos.set(x, guy.world.heightAt(x, z, 0), z); guy.yaw = yaw; guy.goal = null; guy.idleT = 99; guy.vel.set(0, 0, 0); };
export async function run(g, name) {
  const t0 = performance.now(); g.start(); document.getElementById('toast').style.display = 'none'; document.getElementById('hint').style.display = 'none';
  const P = g.player, G = (id) => g.guys.find((x) => x.def.id === id);
  const info = { name };
  if (name === 'closeup') {
    P.pos.set(-14, 0, 0); P.yaw = 0.35; g.guys.forEach((x) => place(x, 30, 30, 0)); place(G("dima"), -13.2, 2.2, -2.4);
    step(g, 40); const h = P.actor.vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(V(0, 0, 0));
    g.camOverride = { pos: V(h.x + Math.sin(0.35 + 0.35) * 1.05, h.y - 0.08, h.z + Math.cos(0.35 + 0.35) * 1.05), look: V(h.x, h.y - 0.12, h.z), fov: 32 };
    document.body.classList.remove('playing'); step(g, 2);
  } else if (name === 'full') {
    P.pos.set(-14, 0, 0); P.yaw = 0.5; g.guys.forEach((x) => place(x, 30, 30, 0)); step(g, 40);
    g.camOverride = { pos: V(-14 + Math.sin(0.8) * 3.0, 1.1, Math.cos(0.8) * 3.0), look: V(-14, 0.85, 0), fov: 38 };
    document.body.classList.remove('playing'); step(g, 2);
  } else if (name === 'district') {
    P.pos.set(-2, 0, 1.5); P.yaw = 2.6; step(g, 60);
    const cp = (Q.get('cp') || '-30,7,0').split(',').map(Number), cl = (Q.get('cl') || '10,1,-4').split(',').map(Number);
    g.camOverride = { pos: V(...cp), look: V(...cl), fov: 55 }; step(g, 2);
  } else if (name === 'group') {
    P.pos.set(0, 0, 2.2); P.yaw = Math.PI; const ids = ['dima', 'artem', 'maks', 'stas', 'lyokha', 'kirill'];
    ids.forEach((id, i) => { const gy = G(id); place(gy, -3.4 + i * 1.35, -1.2 + Math.abs(i - 2.5) * 0.25, 0); gy.mode = 'alert'; gy.decideT = 99; gy.met = true; });
    step(g, 50); ids.forEach((id, i) => { const gy = G(id); place(gy, -3.4 + i * 1.35, -1.2 + Math.abs(i - 2.5) * 0.25, 0); });
    g.camOverride = { pos: V(0.5, 1.6, 4.8), look: V(0, 0.95, -0.6), fov: 45 }; step(g, 2);
  } else if (name === 'strike' || name === 'knee' || name === 'fin') {
    const d = G('dima'); g.guys.forEach((x) => { if (x !== d) place(x, 30, 30, 0); });
    P.pos.set(-14, 0, 0); P.yaw = Math.PI / 2; place(d, -12.6, 0, -Math.PI / 2); d.mode = 'alert'; d.met = true; d.decideT = 99; d.trait = { ...d.trait, guard: 0, dodge: 0 };
    step(g, 30);
    if (name === 'fin') g.focus = 100;
    P.request(name === 'strike' ? 'kick' : name === 'knee' ? 'knee' : 'finisher');
    let k = 0; while (!P.resolved && k++ < 60) step(g, 1);
    step(g, +(Q.get('n') || 7), 1 / 60);
    info.pops = [...document.querySelectorAll('.pop')].map((e) => e.textContent + '|' + e.style.transform + '|' + e.style.opacity);
    info.grade = g.stats; info.pain = d.pain.value; info.level = d.level;
    g.camOverride = { pos: V(-13.0 + (+(Q.get('cx') || 0.6)), 1.15, +(Q.get('cz') || 3.3)), look: V(-13.2, 0.8, 0), fov: 40 }; g.fixedDt = 1 / 240; g.tick();
  } else if (name === 'combo') {
    // play a whole fight against Дима and report the state flow
    const d = G('dima'); g.guys.forEach((x) => { if (x !== d) place(x, 30, 30, 0); });
    P.pos.set(-14, 0, 0); P.yaw = Math.PI / 2; place(d, -11.5, 0, -Math.PI / 2); step(g, 20);
    info.flow = []; const seq = ['kick', 'knee', 'kick', 'kick', 'knee', 'kick', 'kick', 'kick', 'kick', 'kick', 'kick', 'kick'];
    for (const m of seq) { P.request(m); for (let i = 0; i < 26; i++) step(g, 1); info.flow.push(`${m}:${d.state}:${d.pain.value.toFixed(0)}`); if (d.out) break; }
    step(g, 60); info.stats = g.stats; info.rep = g.rep; info.out = d.out; info.combo = g.stats.best;
    info.dpos = d.pos.toArray(); info.ppos = P.pos.toArray(); const mx = (d.pos.x + P.pos.x) / 2, mz = (d.pos.z + P.pos.z) / 2, sz = mz > 0 ? -1 : 1;
    g.camOverride = { pos: V(mx + 1.2, 1.5, mz + sz * 3.2), look: V(mx, 0.55, mz), fov: 45 }; step(g, 1);
  } else if (name === 'brawl') {
    // randomised fight in the park against Артём + Стас (+ everyone else brought over) to shake out AI bugs
    const ids = ['artem', 'stas', 'maks', 'lyokha']; ids.forEach((id, i) => place(G(id), 2 + i * 1.5, -24 + (i % 2) * 2, Math.PI));
    P.pos.set(3, 0, -20); step(g, 10);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    info.ev = {}; const orig = { caught: P.caught.bind(P), pd: g.perfectDodge.bind(g) };
    P.caught = (gy) => { info.ev.caught = (info.ev.caught || 0) + 1; orig.caught(gy); };
    g.perfectDodge = (gy) => { info.ev.pdodge = (info.ev.pdodge || 0) + 1; orig.pd(gy); };
    const N = +(Q.get('n') || 600);
    for (let i = 0; i < N; i++) {
      if (i % 9 === 0) { const r = rnd(); if (r < 0.45) P.request('kick'); else if (r < 0.7) P.request('knee'); else if (r < 0.85) P.dodge(); else if (g.focus >= 100) P.request('finisher'); }
      if (i % 30 === 0) { const r = rnd(); g.autoMove = r < 0.5 ? [1, 0] : r < 0.7 ? [0, 1] : [0, 0]; g.cam.yaw = rnd() * 6.28; }
      step(g, 1);
    }
    info.stats = g.stats; info.rep = +g.rep.toFixed(1); info.guys = g.guys.map((x) => x.def.id + ':' + x.state + ':' + x.mode + ':' + x.pain.value.toFixed(0)); info.frames = g.frames;
    g.autoMove = null; g.camOverride = null; g.cam.dist = 5; step(g, 5);
  } else if (name === 'walk') {
    // free-roam smoke test: walk through all areas with the real camera
    P.pos.set(-12, 0, 2); const route = [[0, 1], [0, 1]]; g.autoMove = [1, 0]; g.autoRun = true; g.cam.yaw = -Math.PI / 2; step(g, 90);
    info.pos1 = P.pos.toArray().map((v) => +v.toFixed(2)); info.area = g.area;
  } else if (name === 'roof') {
    P.pos.set(50, 5, 16); P.yaw = 2.5; place(G('kirill'), 51, 17.4, -1); step(g, 40); g.cam.yaw = 0.6; g.cam.pitch = 0.3; step(g, 20);
  } else if (name === 'outfit' || name === 'shop') {
    // outfit gallery / shop UI: ?shot=outfit&o=latex&view=front|side|back|quarter&fig=0|1  ·  ?shot=shop&o=bodycon&money=500&fame=120
    const { save, applyOutfit } = await import('./outfits.js');
    if (Q.has('money')) save.earn(+Q.get('money') - save.money); if (Q.has('fame')) save.fameUp(+Q.get('fame'));
    g.guys.forEach((x) => place(x, 30, 30, 0)); step(g, 5);
    g.shop.enter(); await g.shop.select(Q.get('o') || 'street', true);
    if (Q.has('buy')) g.shop.action();
    if (Q.has('fig')) { g.shop.figOn = Q.get('fig') === '1'; g.shop.applyFig(); g.shop.refresh(); }
    g.shop.view(Q.get('view') || 'quarter');
    if (Q.has('yaw')) g.shop.orb.tYaw = g.shop.orb.yaw = +Q.get('yaw');
    if (Q.has('dist')) g.shop.orb.tDist = g.shop.orb.dist = +Q.get('dist');
    if (Q.has('pitch')) g.shop.orb.tPitch = g.shop.orb.pitch = +Q.get('pitch');
    if (name === 'outfit') { document.getElementById('shop').style.display = 'none'; g.shop.orb.tDist = g.shop.orb.dist = +(Q.get('dist') || 2.9); }
    step(g, 40); await new Promise((r) => setTimeout(r, 300)); step(g, 2);
    info.outfit = g.rusana.vrm.userData.outfit; info.money = save.money; info.owned = save.owned; info.eq = save.outfit;
    info.vis = []; g.rusana.vrm.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (/CLOTH/.test(m.name) && !m.isOutline) info.vis.push(m.name.replace('F00_', '') + ':' + m.visible); });
    info.fig = []; g.rusana.vrm.scene.traverse((o) => { const k = o.isMesh && o.morphTargetDictionary?.Figure; if (k !== undefined && k !== false) info.fig.push(+o.morphTargetInfluences[k].toFixed(2)); });
  } else if (name === 'outfitfight') {
    // equipped outfit in a fight: ?shot=outfitfight&o=corset&move=kick&n=7
    const { applyOutfit } = await import('./outfits.js'); await applyOutfit(g.rusana.vrm, Q.get('o') || 'street');
    const d = G('dima'); g.guys.forEach((x) => { if (x !== d) place(x, 30, 30, 0); });
    P.pos.set(-14, 0, 0); P.yaw = Math.PI / 2; place(d, -12.6, 0, -Math.PI / 2); d.mode = 'alert'; d.met = true; d.decideT = 99; d.trait = { ...d.trait, guard: 0, dodge: 0 };
    step(g, 30); P.request(Q.get('move') || 'kick'); let k = 0; while (!P.resolved && k++ < 60) step(g, 1);
    step(g, +(Q.get('n') || 7), 1 / 60); info.grade = g.stats;
    g.camOverride = { pos: V(-13.0 + (+(Q.get('cx') || 0.6)), 1.15, +(Q.get('cz') || 3.3)), look: V(-13.2, 0.8, 0), fov: 40 }; g.fixedDt = 1 / 240; g.tick();
  } else if (name === 'onehit') {
    // one perfect kick → floor → tap; ?shot=onehit&n=frames after contact
    const d = G('dima'); g.guys.forEach((x) => { if (x !== d) place(x, 30, 30, 0); });
    P.pos.set(-14, 0, 0); P.yaw = Math.PI / 2; place(d, -12.65, 0, -Math.PI / 2); d.mode = 'alert'; d.met = true; d.decideT = 99; d.trait = { ...d.trait, guard: 0, dodge: 0 };
    step(g, 30); P.request('kick');
    let k = 0; while (!P.resolved && k++ < 60) step(g, 1);
    info.atContact = { grade: g.stats._lastGrade, level: d.level, dropped: d.dropped, pain: +d.pain.value.toFixed(1) };
    // hold a few frames then advance until tap
    step(g, +(Q.get('n') || 8), 1 / 60);
    const t0 = performance.now();
    while (!d.out && performance.now() - t0 < 5000) { step(g, 3); await new Promise((r) => setTimeout(r, 50)); }
    info.after = { out: d.out, level: d.level, dropped: d.dropped, state: d.state, money: (await import('./outfits.js')).save.money, grade: g.stats };
    g.camOverride = { pos: V(-13.0, 1.2, 3.4), look: V(-13.2, 0.55, 0), fov: 40 }; step(g, 2);
  } else if (name === 'assist') {
    // Mira hold/distract + KO. ?shot=assist&mode=hold|distract|ko
    const { save } = await import('./outfits.js');
    save.miraMeet();
    const d = G('dima'); g.guys.forEach((x) => { if (x !== d) place(x, 30, 30, 0); });
    P.pos.set(-14, 0, 0); P.yaw = Math.PI / 2; place(d, -12.6, 0, -Math.PI / 2);
    d.mode = 'alert'; d.met = true; d.decideT = 99; d.trait = { ...d.trait, guard: 0.9, dodge: 0, attack: 0.5 };
    g.mira.pos.set(-14.5, 0, -1.2); g.mira.home.copy(g.mira.pos); g.mira.yaw = Math.PI / 2; g.mira.state = 'idle';
    step(g, 20);
    const mode = Q.get('mode') || 'hold';
    if (mode === 'distract') g.mira.requestAssist('distract');
    else g.mira.requestAssist('hold');
    // let her run in and start the assist
    for (let i = 0; i < 90 && g.mira.state === 'run'; i++) step(g, 1);
    step(g, 20);
    info.assist = { state: g.mira.state, held: d.held, open: g.now < (d.openUntil || 0), guard: d.guard(), miraPos: g.mira.pos.toArray().map((v)=>+v.toFixed(2)) };
    if (mode === 'holdpose') {
      const mid = d.pos.clone().add(g.mira.pos).multiplyScalar(0.5);
      g.camOverride = { pos: V(mid.x - 0.2, 1.4, mid.z + 3.2), look: V(mid.x, 1.0, mid.z), fov: 40 }; step(g, 2);
    } else if (mode === 'ko' || mode === 'hold') {
      // kick while held → expect perfect/clean drop
      P.request('kick'); let k = 0; while (!P.resolved && k++ < 60) step(g, 1);
      step(g, 10, 1 / 60);
      const t0 = performance.now();
      while (!d.out && performance.now() - t0 < 4000) { step(g, 3); await new Promise((r) => setTimeout(r, 40)); }
      info.ko = { grade: g.stats._lastGrade, out: d.out, dropped: d.dropped, heldAtHit: info.assist.held };
    }
    if (mode === 'distract') {
      info.distract = { open: d.isOpen(), openUntil: d.openUntil, now: g.now };
      P.request('kick'); let k = 0; while (!P.resolved && k++ < 60) step(g, 1);
      step(g, 8, 1 / 60);
      info.ko = { grade: g.stats._lastGrade, out: d.out, dropped: d.dropped };
      const t0 = performance.now();
      while (!d.out && performance.now() - t0 < 4000) { step(g, 3); await new Promise((r) => setTimeout(r, 40)); }
      info.ko.out = d.out;
    }
    if (mode !== 'holdpose') {
      const mid = d.pos.clone().lerp(P.pos, 0.4);
      g.camOverride = { pos: V(mid.x + 0.3, 1.35, mid.z + 3.5), look: V(mid.x, 0.9, mid.z), fov: 42 }; step(g, 2);
    }
  } else if (name === 'mira') {
    const { save } = await import('./outfits.js');
    const { MIRA: M } = await import('./config.js');
    g.guys.forEach((x) => place(x, 30, 30, 0));
    g.mira.pos.set(M.pos[0], 0, M.pos[2]); g.mira.yaw = M.yaw;
    g.mira.actor.root.position.copy(g.mira.pos); g.mira.actor.root.rotation.y = g.mira.yaw;
    g.mira.actor.play('idle', { fade: 0 }); g.mira.actor.setExpr('happy', 0.4);
    P.pos.set(M.pos[0] + 0.9, 0, M.pos[2] - 1.3); P.yaw = Math.atan2(M.pos[0] - P.pos.x, M.pos[2] - P.pos.z);
    step(g, 40);
    info.miraBox = (() => { const b = new THREE.Box3().setFromObject(g.mira.actor.root); return { min: b.min.toArray(), max: b.max.toArray(), pos: g.mira.pos.toArray() }; })();
    if (Q.get('talk') !== '0') { g.mira.open(); if (Q.get('mode') === 'quests') g.mira.render('quests'); step(g, 10); }
    g.camOverride = { pos: V(M.pos[0] + 0.4, 1.4, M.pos[2] - 2.8), look: V(M.pos[0], 1.05, M.pos[2]), fov: 38 }; step(g, 3);
    info.mira = { met: save.miraMet, talking: g.mira.talking, quests: M.quests.map((q) => q.id + ':' + save.questProg(q.id)) };
  } else if (name === 'storefront') {
    P.pos.set(-1, 0, 4.2); P.yaw = 0; g.guys.forEach((x) => place(x, 30, 30, 0)); step(g, 30);
    g.camOverride = { pos: V(-1 + 3.2, 1.7, 0.2), look: V(-1, 1.5, 6.5), fov: 55 }; step(g, 2);
  } else if (name === 'park') {
    P.pos.set(2, 0, -24); P.yaw = 0.3; step(g, 50); g.cam.yaw = 2.7; g.cam.dist = 6; g.cam.pitch = 0.35; step(g, 30);
  }
  { const e = document.querySelector('.pop'); if (e) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); info.popRect = [r.x, r.y, r.width, r.height, cs.display, cs.visibility, cs.color, cs.fontSize, getComputedStyle(e.parentElement).display, getComputedStyle(e.parentElement).zIndex, document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.className]; } info.plates = [...document.querySelectorAll('.plate')].map((e) => e.style.display + '|' + e.style.transform.slice(0, 60)); }
  info.hidden = g.guys.map((x) => { let n = 0, names = []; x.actor.vrm.scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { if (!m.visible) n++; if (/Bottoms/.test(m.name)) names.push(m.name + ':' + m.visible); } }); return x.def.id + ':' + n + ':' + names.join(','); });
  info.ms = Math.round(performance.now() - t0); info.dpr = g.R.dpr;
  window.info = info; window.done = true;
}
