// node --import ./test/harness/register.mjs test/harness/smoke.mjs
const L = {}, els = {};
const mkCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? { addColorStop() {} } : undefined)), set: (t, k, v) => { t[k] = v; return true; } });
const mkEl = (id) => ({ id, textContent: '', innerHTML: '', style: {}, width: 200, height: 200, dataset: {}, children: [],
  classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, f) { (f ?? !this.s.has(c)) ? this.s.add(c) : this.s.delete(c); }, contains(c) { return this.s.has(c); } },
  addEventListener() {}, appendChild(c) { this.children.push(c); }, blur() {}, getContext: () => mkCtx() });
globalThis.document = { getElementById: (i) => (els[i] ||= mkEl(i)), querySelector: (s) => (els[s] ||= mkEl(s)), querySelectorAll: () => [], createElement: (t) => mkEl(t) };
const { any } = await import('./three-stub.mjs');
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2, addEventListener: (t, f) => (L[t] ||= []).push(f), AudioContext: class { constructor() { return any(); } } };
globalThis.setTimeout = (f) => 0; globalThis.clearTimeout = () => {};
const press = (code) => { for (const f of L.keydown || []) f({ code, repeat: false, preventDefault() {} }); for (const f of L.keyup || []) f({ code }); };

let fails = 0; const ok = (n, c, i = '') => { console.log(`${c ? '  ok  ' : '  FAIL'} ${n} ${i}`); if (!c) fails++; };
const { Game, STATE } = await import('../../src/core/Game.js');
const { angleDiff } = await import('../../src/track/trackMath.js');
const { CONFIG } = await import('../../src/config.js');
const g = new Game(mkEl('canvas')); g.start();
let t = 0; const frame = (n = 1, ms = 16.667) => { for (let i = 0; i < n; i++) { t += ms; globalThis.__loop(t); } };

frame(60); ok('menu berjalan (kamera berputar)', g.state === STATE.MENU && g.ui.cache.speed === 0);
ok('menu terlihat, HUD tersembunyi', !els.menu.classList.contains('hidden') && els.hud.classList.contains('hidden'));
press('Enter'); ok('Enter -> COUNTDOWN', g.state === STATE.COUNTDOWN);
frame(100); ok('hitung mundur menampilkan angka', els.center.textContent === '2' || els.center.textContent === '3' || els.center.textContent === '1', `(${els.center.textContent})`);
g.input.keys.add('ArrowUp'); frame(40); ok('gas ditahan saat hitung mundur tidak menggerakkan mobil', g.sim.speed < 0.5, `(v=${g.sim.speed.toFixed(2)})`);
frame(60); ok('COUNTDOWN -> RACING setelah 3 detik', g.state === STATE.RACING);

// ---- autopilot memegang tombol lewat kelas Input yang sama dengan pemain ----
const tr = g.tr; let guard = 0, hits = 0, wrong = 0, maxSpeed = 0;
while (g.state === STATE.RACING && guard++ < 60 * 400) {
  const s = g.sim, n = g.near;
  const look = Math.floor(8 + s.speed * 0.55 / tr.ds), ti = (n.idx + look) % tr.N;
  const err = angleDiff(s.h, Math.atan2(tr.x[ti] - s.x, tr.z[ti] - s.z));
  let kmax = 0; for (let k = 0; k < 90; k += 3) kmax = Math.max(kmax, tr.curvature[(n.idx + k * 2) % tr.N]);
  const vT = Math.min(78, Math.sqrt(CONFIG.car.maxLat * CONFIG.car.wet * 0.7 / Math.max(kmax, 1e-4)));
  const K = g.input.keys; K.clear();
  if (err > 0.03) K.add('ArrowRight'); else if (err < -0.03) K.add('ArrowLeft');
  if (s.speed < vT) K.add('ArrowUp'); else if (s.speed > vT * 1.08) K.add('ArrowDown');
  frame(1); maxSpeed = Math.max(maxSpeed, s.speed); if (g.wrongTimer > 1.2) wrong++;
}
g.input.keys.clear();
ok('balapan selesai (3 lap)', g.state === STATE.FINISHED, `(frames=${guard}, lap=${g.race.lap}, laps=${JSON.stringify(g.race.lapTimes.map((x) => +x.toFixed(1)))})`);
ok('hasil tampil', els.rLaps.children.length === 3 && els.rTotal.textContent.includes(':'), els.rTotal.textContent);
ok('kecepatan puncak wajar', maxSpeed > 35 && maxSpeed < 80, `(${(maxSpeed * 3.6).toFixed(0)} km/jam)`);
ok('tidak ada peringatan arah salah selama balapan normal', wrong === 0);
ok('HUD kecepatan diperbarui', typeof g.ui.cache.speed === 'number');

// ---- tombol-tombol lain ----
const c0 = g.camMode; press('KeyC'); ok('ganti kamera (C)', g.camMode === (c0 + 1) % 3); frame(5); press('KeyC'); press('KeyC'); frame(5);
press('KeyM'); ok('bisu (M)', g.audio.muted === true); press('KeyM');
press('KeyQ'); frame(2); ok('kualitas rendah (Q)', g.hiQuality === false); press('KeyQ');
press('KeyP'); frame(5); ok('jeda (P) menghentikan simulasi', g.paused === true); const tt = g.time; frame(5); ok('waktu tidak maju saat jeda', g.time === tt); press('KeyP');
g.stateTime = 2; press('Enter'); frame(2); ok('FINISHED -> balap lagi (COUNTDOWN)', g.state === STATE.COUNTDOWN && g.race.lapTimes.length === 0);
frame(200); g.input.keys.add('ArrowUp'); frame(300); g.sim.x += 400; g.sim.z += 400; frame(2); g.input.keys.clear(); press('KeyR'); frame(2);
ok('R mengembalikan mobil ke sirkuit', g.near.dist < 1 && g.sim.speed === 0, `(dist=${g.near.dist.toFixed(2)})`);
// menabrak dinding: lurus ke samping
g.input.keys.clear(); g.sim.vx = g.tr.rx[g.near.idx] * 40; g.sim.vz = g.tr.rz[g.near.idx] * 40; frame(120);
ok('dinding menahan mobil di dalam sirkuit', Math.abs(g.near.offset) <= CONFIG.track.wallOffset + 0.5, `(offset=${g.near.offset.toFixed(1)})`);
ok('tidak ada NaN pada kamera/mobil', [g.sim.x, g.sim.z, g.sim.h, g.camera.position.x, g.camera.position.y].every(Number.isFinite));
console.log(fails ? `>> ${fails} GAGAL` : '>> LULUS'); process.exit(fails ? 1 : 0);
