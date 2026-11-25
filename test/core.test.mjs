import { CONFIG } from '../src/config.js';
import { buildTrack, nearest, angleDiff } from '../src/track/trackMath.js';
import { CarSim, resolveWalls } from '../src/vehicle/CarSim.js';
import { RaceLogic } from '../src/race/RaceLogic.js';

let fails = 0;
const ok = (n, c, i = '') => { console.log(`${c ? '  ok  ' : '  FAIL'} ${n} ${i}`); if (!c) fails++; };
const T = CONFIG.track;
const track = buildTrack(T.points, { samples: T.samples, halfWidth: T.halfWidth });

// ---- geometri sirkuit ----
console.log('panjang sirkuit', track.length.toFixed(0), 'm, ds', track.ds.toFixed(2));
let maxK = 0; for (const k of track.curvature) maxK = Math.max(maxK, k);
ok('radius tikungan terkecil >= 30 m', 1 / maxK >= 30, `(minR=${(1 / maxK).toFixed(1)} m)`);
// tidak ada bagian sirkuit yang saling berdekatan (kecuali tetangga di sepanjang kurva)
let minGap = Infinity;
for (let i = 0; i < track.N; i += 3) for (let j = i + 1; j < track.N; j += 3) {
  const sep = Math.min(j - i, track.N - (j - i)) * track.ds;
  if (sep < 150) continue;
  minGap = Math.min(minGap, Math.hypot(track.x[i] - track.x[j], track.z[i] - track.z[j]));
}
ok('bagian sirkuit berjauhan >= 2x lebar+dinding', minGap > 2 * T.wallOffset + 10, `(min=${minGap.toFixed(1)} m)`);
ok('panjang kontinu (tak ada lompatan)', (() => { for (let i = 0; i < track.N; i++) { const j = (i + 1) % track.N; if (Math.hypot(track.x[i] - track.x[j], track.z[i] - track.z[j]) > track.ds * 1.5) return false; } return true; })());

// ---- pengemudi AI ----
function drive({ laps = 3, maxT = 600, wetMul = 1, handbrakeAt = null }) {
  const sim = new CarSim(CONFIG.car);
  const startIdx = track.N - 18;
  sim.reset(track.x[startIdx], track.z[startIdx], track.heading[startIdx]);
  const race = new RaceLogic(track.N, laps);
  race.reset(startIdx);
  let near = nearest(track, sim.x, sim.z, -1);
  const dt = 1 / 60; let t = 0, offMax = 0, offTrackTime = 0, wallHits = 0, maxSlip = 0, events = [];
  while (t < maxT && !race.finished) {
    // titik tujuan di depan
    const look = Math.floor(8 + sim.speed * 0.55 / track.ds * 1.0);
    const ti = (near.idx + look) % track.N;
    const want = Math.atan2(track.x[ti] - sim.x, track.z[ti] - sim.z);
    const err = angleDiff(sim.h, want); // + : tujuan di kanan (h lebih besar -> perlu putar kanan)
    const steer = Math.max(-1, Math.min(1, err * 2.2));
    // batas kecepatan dari kelengkungan di depan
    let kmax = 0; for (let k = 0; k < 90; k += 3) kmax = Math.max(kmax, track.curvature[(near.idx + k * 2) % track.N]);
    const vTarget = Math.min(CONFIG.car.maxSpeed, Math.sqrt(CONFIG.car.maxLat * CONFIG.car.wet * 0.78 * wetMul / Math.max(kmax, 1e-4)));
    const throttle = sim.speed < vTarget ? 1 : 0;
    const brake = sim.speed > vTarget * 1.08 ? 1 : 0;
    const hb = handbrakeAt && t > handbrakeAt[0] && t < handbrakeAt[1];
    const surfGrass = Math.abs(near.offset) > T.halfWidth + T.curb;
    sim.update(dt, { throttle, brake, steer: hb ? 1 : steer, handbrake: hb }, { grass: surfGrass });
    near = nearest(track, sim.x, sim.z, near.idx);
    if (resolveWalls(sim, track, near, T.wallOffset) > 0) wallHits++;
    const ev = race.update(near.idx, dt); if (ev) events.push([ev, +t.toFixed(1)]);
    offMax = Math.max(offMax, Math.abs(near.offset)); if (surfGrass) offTrackTime += dt;
    maxSlip = Math.max(maxSlip, sim.slip);
    if (!Number.isFinite(sim.x + sim.z + sim.h + sim.vx + sim.vz)) return { nan: true };
    t += dt;
  }
  return { sim, race, t, offMax, offTrackTime, wallHits, maxSlip, events };
}

const r = drive({ laps: 3 });
ok('tidak ada NaN', !r.nan);
ok('3 lap selesai', r.race.finished, `(t=${r.t.toFixed(1)}s, events=${JSON.stringify(r.events)})`);
ok('waktu lap masuk akal (35-120 s)', r.race.lapTimes.every((x) => x > 35 && x < 120), JSON.stringify(r.race.lapTimes.map((x) => +x.toFixed(1))));
ok('AI tetap di dekat aspal (<= tepi curb 2 m)', r.offMax < T.halfWidth + T.curb + 2, `(offMax=${r.offMax.toFixed(1)} m, rumput ${r.offTrackTime.toFixed(1)} s, dinding ${r.wallHits}x)`);
ok('lap ke-2 dan 3 mirip lap 1 (konsisten ±8%)', Math.abs(r.race.lapTimes[1] / r.race.lapTimes[0] - 1) < 0.08);
console.log('   kecepatan rata-rata', (track.length / r.race.lapTimes[1] * 3.6).toFixed(0), 'km/jam');

// ---- drift dengan rem tangan ----
const d = drive({ laps: 1, maxT: 40, handbrakeAt: [20, 22.5] });
ok('drift: tidak NaN, mobil tidak meledak', !d.nan && d.sim.speed < 200);
ok('drift: slip tercapai (> 0.5)', d.maxSlip > 0.5, `(maxSlip=${d.maxSlip.toFixed(2)})`);

// ---- fisika dasar ----
{
  const s = new CarSim(CONFIG.car); s.reset(0, 0, 0);
  let t = 0, t100 = null;
  while (t < 20) { s.update(1 / 60, { throttle: 1, brake: 0, steer: 0, handbrake: false }); t += 1 / 60; if (t100 === null && s.speed * 3.6 >= 100) t100 = t; }
  ok('0-100 km/jam antara 2.5 dan 6 detik (aspal basah)', t100 > 2.5 && t100 < 6, `(${t100?.toFixed(2)} s)`);
  ok('kecepatan puncak 230-290 km/jam', s.speed * 3.6 > 230 && s.speed * 3.6 < 290, `(${(s.speed * 3.6).toFixed(0)} km/jam)`);
  let b = 0; while (s.speed > 0.5 && b < 15) { s.update(1 / 60, { throttle: 0, brake: 1, steer: 0, handbrake: false }); b += 1 / 60; }
  ok('rem dari puncak berhenti dalam 3-9 detik', b > 3 && b < 9, `(${b.toFixed(2)} s)`);
  // belok kanan saat melaju -> h berkurang, posisi x condong negatif (kanan = -X ketika hadap +Z)
  const s2 = new CarSim(CONFIG.car); s2.reset(0, 0, 0); s2.vz = 20; for (let i = 0; i < 120; i++) s2.update(1 / 60, { throttle: 0.3, brake: 0, steer: 1, handbrake: false });
  ok('setir kanan menggeser mobil ke kanan (X negatif saat hadap +Z)', s2.x < -1 && s2.h < 0, `(x=${s2.x.toFixed(1)}, h=${s2.h.toFixed(2)})`);
  const s3 = new CarSim(CONFIG.car); s3.reset(0, 0, 0); for (let i = 0; i < 60; i++) s3.update(1 / 60, { throttle: 0, brake: 1, steer: 0, handbrake: false });
  ok('tahan rem dari diam -> mundur', s3.vf < -1, `(vf=${s3.vf.toFixed(1)})`);
}

// ---- dinding ----
{
  const s = new CarSim(CONFIG.car); const i = 100;
  s.reset(track.x[i] + track.rx[i] * (T.wallOffset + 3), track.z[i] + track.rz[i] * (T.wallOffset + 3), track.heading[i]);
  s.vx = track.rx[i] * 30; s.vz = track.rz[i] * 30; // menuju dinding kanan
  const near = nearest(track, s.x, s.z, i);
  const hit = resolveWalls(s, track, near, T.wallOffset);
  const n2 = nearest(track, s.x, s.z, i);
  ok('dinding mendorong balik dan memantulkan', hit > 20 && Math.abs(n2.offset) <= T.wallOffset + 0.01 && (s.vx * track.rx[i] + s.vz * track.rz[i]) < 0, `(hit=${hit.toFixed(1)}, offset=${n2.offset.toFixed(2)})`);
}

// ---- logika lap: tidak bisa curang dengan mundur-maju ----
{
  const N = track.N; const race = new RaceLogic(N, 3); race.reset(N - 18);
  const ev = []; const step = (idx) => { const e = race.update(idx, 0.1); if (e) ev.push(e); };
  for (let k = 0; k < 18; k++) step((N - 18 + k + 1) % N); // lewat garis start
  ok('melewati garis start memulai lap 1', ev.includes('lapStart') && race.lap === 1);
  for (let k = 0; k < 10; k++) step(N - 1 - k); // mundur melewati garis
  for (let k = 0; k < 12; k++) step(k); // maju lagi
  ok('mundur lalu maju tidak menghitung ganda', ev.filter((e) => e === 'lapStart').length === 1);
  for (let i = 12; i < N; i += 20) step(i);
  step(5); // melewati garis -> lap 1 selesai
  ok('lap pertama selesai tercatat', ev.includes('lap') && race.lapTimes.length === 1);
  for (let lap = 0; lap < 2; lap++) { for (let i = 5; i < N; i += 20) step(i); step(5); }
  ok('lap ke-3 selesai -> finish', race.finished && ev.at(-1) === 'finish' && race.lapTimes.length === 3, JSON.stringify(ev));
}
console.log(fails ? `>> ${fails} GAGAL` : '>> SEMUA LULUS'); process.exit(fails ? 1 : 0);
