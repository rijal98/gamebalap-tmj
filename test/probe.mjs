import { CONFIG } from '../src/config.js';
import { buildTrack, nearest, angleDiff } from '../src/track/trackMath.js';
import { CarSim, resolveWalls } from '../src/vehicle/CarSim.js';
const T = CONFIG.track; const track = buildTrack(T.points, { samples: T.samples, halfWidth: T.halfWidth });
const sim = new CarSim(CONFIG.car); const s0 = track.N - 18; sim.reset(track.x[s0], track.z[s0], track.heading[s0]);
let near = nearest(track, sim.x, sim.z, -1); const dt = 1 / 60; let last = -99; const log = [];
for (let t = 0; t < 75; t += dt) {
  const look = Math.floor(8 + sim.speed * 0.55 / track.ds);
  const ti = (near.idx + look) % track.N;
  const want = Math.atan2(track.x[ti] - sim.x, track.z[ti] - sim.z);
  const steer = Math.max(-1, Math.min(1, angleDiff(sim.h, want) * 2.2));
  let kmax = 0; for (let k = 0; k < 90; k += 3) kmax = Math.max(kmax, track.curvature[(near.idx + k * 2) % track.N]);
  const vT = Math.min(78, Math.sqrt(CONFIG.car.maxLat * CONFIG.car.wet * 0.78 / Math.max(kmax, 1e-4)));
  sim.update(dt, { throttle: sim.speed < vT ? 1 : 0, brake: sim.speed > vT * 1.08 ? 1 : 0, steer, handbrake: false }, { grass: Math.abs(near.offset) > T.halfWidth + T.curb });
  near = nearest(track, sim.x, sim.z, near.idx); resolveWalls(sim, track, near, T.wallOffset);
  if (Math.abs(near.offset) > T.halfWidth + T.curb && t - last > 1.5) { last = t; log.push(`t=${t.toFixed(1)} idx=${near.idx} off=${near.offset.toFixed(1)} v=${(sim.speed*3.6).toFixed(0)}km/h vTarget=${(vT*3.6).toFixed(0)} R=${(1/Math.max(track.curvature[near.idx],1e-4)).toFixed(0)}`); }
}
console.log(log.join('\n'));
