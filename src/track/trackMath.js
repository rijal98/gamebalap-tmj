// Matematika sirkuit: murni JavaScript tanpa Three.js (agar mudah diuji).
// Sistem koordinat sama dengan Three.js: bidang tanah = X dan Z.
// Arah hadap h memenuhi: depan = (sin h, cos h), kanan = (-cos h, sin h).

/** Catmull-Rom seragam untuk satu koordinat. */
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Membuat data sirkuit dari titik kontrol.
 * Hasilnya titik-titik berjarak SAMA di sepanjang kurva tertutup.
 */
export function buildTrack(points, { samples = 800, halfWidth = 7.5 } = {}) {
  const n = points.length;
  const dense = [];
  const per = 80; // detail kurva awal per segmen
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      dense.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  // panjang kumulatif (kurva tertutup)
  const M = dense.length;
  const cum = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) {
    const a = dense[i], b = dense[(i + 1) % M];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const length = cum[M];
  const N = samples;
  const ds = length / N;

  // resampling berjarak sama
  const x = new Float64Array(N), z = new Float64Array(N);
  let seg = 0;
  for (let j = 0; j < N; j++) {
    const s = j * ds;
    while (cum[seg + 1] < s) seg++;
    const a = dense[seg], b = dense[(seg + 1) % M];
    const f = (s - cum[seg]) / Math.max(cum[seg + 1] - cum[seg], 1e-9);
    x[j] = a[0] + (b[0] - a[0]) * f;
    z[j] = a[1] + (b[1] - a[1]) * f;
  }

  const tx = new Float64Array(N), tz = new Float64Array(N), rx = new Float64Array(N), rz = new Float64Array(N);
  const heading = new Float64Array(N), curvature = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    const dx = x[b] - x[a], dz = z[b] - z[a], len = Math.hypot(dx, dz);
    tx[i] = dx / len; tz[i] = dz / len;
    rx[i] = -tz[i]; rz[i] = tx[i]; // vektor "kanan"
    heading[i] = Math.atan2(tx[i], tz[i]);
  }
  for (let i = 0; i < N; i++) {
    const a = (i - 2 + N) % N, b = (i + 2) % N;
    let d = heading[b] - heading[a];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    curvature[i] = Math.abs(d) / (4 * ds); // 1/radius (1/meter)
  }
  return { N, length, ds, halfWidth, x, z, tx, tz, rx, rz, heading, curvature };
}

/**
 * Mencari titik sirkuit terdekat dari posisi (px, pz).
 * hint >= 0 : cari hanya di sekitar indeks hint (cepat); hint < 0: cari semua.
 * offset > 0 berarti posisi berada di SISI KANAN garis tengah.
 */
export function nearest(track, px, pz, hint = -1, win = 40) {
  const { N, x, z } = track;
  let best = -1, bestD = Infinity;
  if (hint < 0) {
    for (let i = 0; i < N; i++) {
      const d = (px - x[i]) ** 2 + (pz - z[i]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
  } else {
    for (let k = -win; k <= win; k++) {
      const i = (hint + k + N * 4) % N;
      const d = (px - x[i]) ** 2 + (pz - z[i]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  const offset = (px - x[best]) * track.rx[best] + (pz - z[best]) * track.rz[best];
  return { idx: best, offset, dist: Math.sqrt(bestD) };
}

/** Selisih sudut terpendek a - b dalam (-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}
