// Fisika mobil gaya arcade untuk aspal basah dan drift. Tanpa Three.js.
// Konvensi: depan = (sin h, cos h), kanan = (-cos h, sin h).
// Setir +1 = belok KANAN = arah hadap h BERKURANG.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class CarSim {
  constructor(params = {}) {
    this.p = { maxSpeed: 78, accel: 11, brake: 17, reverseMax: 12, maxYaw: 1.5, maxLat: 15, latGrip: 9, wet: 0.85, ...params };
    this.reset(0, 0, 0);
  }

  reset(x, z, h) {
    this.x = x; this.z = z; this.h = h;
    this.vx = 0; this.vz = 0;
    this.vf = 0; // kecepatan searah hadap mobil
    this.vl = 0; // kecepatan menyamping (+ = ke kanan)
    this.yawRate = 0;
    this.steer = 0; // setir yang sudah dihaluskan
    this.speed = 0;
    this.slip = 0; // 0..1 seberapa besar mobil menyamping
    this.drifting = false;
    this.latG = 0; // untuk kemiringan badan mobil
    this.longA = 0;
  }

  /**
   * @param {number} dt detik
   * @param {{throttle:number, brake:number, steer:number, handbrake:boolean}} input
   * @param {{gripMul?:number, grass?:boolean}} surf permukaan di bawah mobil
   */
  update(dt, input, surf = {}) {
    const p = this.p;
    const grass = !!surf.grass;
    const gripMul = p.wet * (surf.gripMul ?? 1) * (grass ? 0.6 : 1);

    // basis arah SEBELUM berputar
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    const rx = -Math.cos(this.h), rz = Math.sin(this.h);
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;
    const vf0 = vf;

    // setir dihaluskan (tombol digital -> gerak analog)
    const sRate = input.steer === 0 ? 10 : 6;
    this.steer += (input.steer - this.steer) * (1 - Math.exp(-sRate * dt));

    // ---------- memanjang ----------
    let a = 0;
    const r = Math.max(0, vf) / p.maxSpeed;
    if (input.throttle > 0) a += p.accel * input.throttle * Math.max(0, 1 - r * r) * (0.55 + 0.45 * gripMul / p.wet) * (vf < 0 ? 1.6 : 1);
    if (input.brake > 0) {
      if (vf > 0.5) a -= p.brake * input.brake * Math.min(1, gripMul + 0.15);
      else a -= p.accel * 0.55 * input.brake * Math.max(0, 1 - Math.abs(vf) / p.reverseMax); // mundur
    }
    const resist = 0.8 + 0.0002 * vf * vf; // hambatan gulir + angin
    a -= Math.sign(vf) * resist * (input.throttle > 0 ? 0.6 : 1);
    if (grass) a -= vf * 0.9;
    if (input.handbrake) a -= vf * 0.12;
    vf += a * dt;
    if (input.brake > 0 && input.throttle === 0 && vf0 > 0.5 && vf < 0) vf = 0; // rem tidak langsung mundur
    if (input.throttle === 0 && input.brake === 0 && Math.abs(vf) < 0.25) vf = 0;
    vf = clamp(vf, -p.reverseMax, p.maxSpeed);

    // ---------- menyamping (cengkeraman) ----------
    const speedAbs = Math.abs(vf);
    let kLat = p.latGrip * gripMul;
    const hb = !!input.handbrake;
    const steerAbs = Math.abs(this.steer);
    const powerOver = !hb && input.throttle > 0.85 && steerAbs > 0.45 && vf > 28; // oversteer karena gas penuh di aspal basah
    if (hb) kLat *= 0.12;
    else if (powerOver) kLat *= 0.4;
    const slipRatio = Math.abs(vl) / (speedAbs + 4);
    kLat /= 1 + 2.5 * Math.max(0, slipRatio - 0.18); // makin menyamping makin licin
    vl *= Math.exp(-kLat * dt);
    vf *= Math.exp(-slipRatio * 0.55 * dt); // gesekan ban saat meluncur memperlambat

    // ---------- putaran (yaw) ----------
    const steerFactor = clamp(vf / 4, -1, 1);
    const yawByGrip = (p.maxLat * gripMul) / Math.max(speedAbs, 6);
    let cmd;
    if (hb) {
      cmd = this.steer * p.maxYaw * 0.9 * Math.min(1, speedAbs / 8) * (vf >= 0 ? 1 : -1);
    } else {
      cmd = this.steer * Math.min(p.maxYaw, yawByGrip) * steerFactor;
      if (powerOver) cmd *= 1.3;
    }
    // cegah berputar terlalu jauh: sudut slip dibatasi sekitar 65 derajat
    const slipAngle = Math.atan2(vl, Math.max(Math.abs(vf), 0.5));
    if (cmd * slipAngle > 0 && Math.abs(slipAngle) > 1.1) cmd *= 0.25; // (cmd>0 = putar kanan; slip + = bergeser kanan)
    this.yawRate += (cmd - this.yawRate) * (1 - Math.exp(-(hb ? 6 : 11) * dt));

    // ---------- gabungkan kembali dengan basis LAMA, lalu putar ----------
    this.vx = fx * vf + rx * vl;
    this.vz = fz * vf + rz * vl;
    this.h -= this.yawRate * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.vf = vf; this.vl = vl;
    this.speed = Math.hypot(this.vx, this.vz);
    this.slip = clamp(slipRatio * 2.2, 0, 1);
    this.drifting = slipRatio > 0.22 && this.speed > 8;
    this.latG = this.yawRate * vf; // percepatan menyamping ~ (laju putar × kecepatan)
    this.longA = a;
  }
}

/**
 * Dinding pembatas di sisi sirkuit. near = hasil nearest().
 * Mengembalikan kecepatan benturan (m/s), 0 bila tidak menabrak.
 */
export function resolveWalls(sim, track, near, wallOffset) {
  const o = near.offset;
  if (Math.abs(o) <= wallOffset) return 0;
  const side = Math.sign(o);
  const nx = track.rx[near.idx] * side, nz = track.rz[near.idx] * side; // normal ke luar
  const pen = Math.abs(o) - wallOffset;
  sim.x -= nx * pen; sim.z -= nz * pen;
  const vOut = sim.vx * nx + sim.vz * nz;
  if (vOut <= 0) return 0;
  sim.vx -= 1.3 * vOut * nx; sim.vz -= 1.3 * vOut * nz; // memantul
  sim.vx *= 0.88; sim.vz *= 0.88; // kehilangan kecepatan
  // putar hadap sedikit sejajar dinding supaya tidak "menempel"
  return vOut;
}
