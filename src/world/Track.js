import * as THREE from 'three';
import { CONFIG } from '../config.js';

const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rand = (a, b) => a + Math.random() * (b - a);

/**
 * Pita (ribbon) mengikuti sirkuit antara dua offset samping [o1, o2].
 * Offset positif = sisi kanan. Wajah mengarah ke atas (+Y).
 */
function ribbon(tr, o1, o2, y, vScale) {
  const N = tr.N, pos = [], uv = [], nor = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N;
    for (const [o, u] of [[o1, 0], [o2, 1]]) {
      pos.push(tr.x[k] + tr.rx[k] * o, y, tr.z[k] + tr.rz[k] * o);
      uv.push(u, (i * tr.ds) / vScale);
      nor.push(0, 1, 0);
    }
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Dinding vertikal setinggi h pada offset o (dua sisi tampak: DoubleSide). */
function wallBand(tr, o, h) {
  const N = tr.N, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const k = i % N;
    const x = tr.x[k] + tr.rx[k] * o, z = tr.z[k] + tr.rz[k] * o;
    pos.push(x, 0, z, x, h, z);
    uv.push((i * tr.ds) / 6, 0, (i * tr.ds) / 6, 1);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Track {
  constructor(scene, tr, renderer) {
    this.tr = tr;
    this.group = new THREE.Group();
    scene.add(this.group);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    const T = CONFIG.track;

    // ---------- tekstur aspal (warna + kekasaran) ----------
    // Satu ubin = lebar aspal (2 x halfWidth) x 24 meter.
    const W = 512, H = 1024;
    const col = mkCanvas(W, H), cx = col.getContext('2d');
    cx.fillStyle = '#22252a'; cx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { // butiran aspal
      const g = Math.floor(rand(25, 70)); cx.fillStyle = `rgba(${g},${g},${g + 4},${rand(0.15, 0.5)})`;
      cx.fillRect(rand(0, W), rand(0, H), rand(1, 3), rand(1, 3));
    }
    for (const u of [0.3, 0.7]) { // jejak karet ban (lebih gelap)
      const grad = cx.createLinearGradient((u - 0.09) * W, 0, (u + 0.09) * W, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.28)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = grad; cx.fillRect((u - 0.09) * W, 0, 0.18 * W, H);
    }
    cx.fillStyle = 'rgba(235,235,235,0.9)'; // garis tepi
    cx.fillRect(0.02 * W, 0, 9, H); cx.fillRect(W - 0.02 * W - 9, 0, 9, H);
    const colorTex = new THREE.CanvasTexture(col);
    colorTex.colorSpace = THREE.SRGBColorSpace;

    const rough = mkCanvas(256, 512), rx = rough.getContext('2d');
    rx.fillStyle = 'rgb(88,88,88)'; rx.fillRect(0, 0, 256, 512); // basah
    for (let i = 0; i < 26; i++) { // genangan = sangat licin (roughness kecil)
      const x = rand(0, 256), y = rand(0, 512), r = rand(18, 60), sx = rand(0.5, 1.2), sy = rand(1.2, 3.2);
      rx.save(); rx.translate(x, y); rx.scale(sx, sy);
      const g = rx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgb(6,6,6)'); g.addColorStop(0.7, 'rgb(20,20,20)'); g.addColorStop(1, 'rgba(88,88,88,0)');
      rx.fillStyle = g; rx.beginPath(); rx.arc(0, 0, r, 0, Math.PI * 2); rx.fill(); rx.restore();
    }
    const roughTex = new THREE.CanvasTexture(rough);
    for (const t of [colorTex, roughTex]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }

    const road = new THREE.Mesh(
      ribbon(tr, -T.halfWidth, T.halfWidth, 0.03, 24),
      new THREE.MeshStandardMaterial({ map: colorTex, roughnessMap: roughTex, roughness: 1, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    road.receiveShadow = true;
    this.group.add(road);

    // ---------- curb merah-putih ----------
    const cc = mkCanvas(64, 128), cctx = cc.getContext('2d');
    cctx.fillStyle = '#c4161c'; cctx.fillRect(0, 0, 64, 64);
    cctx.fillStyle = '#ececec'; cctx.fillRect(0, 64, 64, 64);
    const curbTex = new THREE.CanvasTexture(cc);
    curbTex.colorSpace = THREE.SRGBColorSpace; curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping;
    const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.35, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const [a, b] of [[T.halfWidth, T.halfWidth + T.curb], [-T.halfWidth - T.curb, -T.halfWidth]]) {
      const m = new THREE.Mesh(ribbon(tr, a, b, 0.06, 4), curbMat); m.receiveShadow = true; this.group.add(m);
    }

    // ---------- tanah (rumput basah) ----------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1f2d1d, roughness: 0.85, metalness: 0 })
    );
    ground.position.y = -0.05; ground.receiveShadow = true;
    this.group.add(ground);

    // ---------- dinding pembatas ----------
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xaeb3ba, roughness: 0.7, side: THREE.DoubleSide });
    for (const o of [T.wallOffset, -T.wallOffset]) this.group.add(new THREE.Mesh(wallBand(tr, o, 1.1), wallMat));

    // ---------- garis start/finish + gerbang ----------
    const ck = mkCanvas(128, 32), kx = ck.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { kx.fillStyle = (i + j) % 2 ? '#111' : '#f2f2f2'; kx.fillRect(i * 8, j * 8, 8, 8); }
    const ckTex = new THREE.CanvasTexture(ck); ckTex.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(T.halfWidth * 2, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ckTex, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    line.position.set(tr.x[0], 0.09, tr.z[0]); line.rotation.y = tr.heading[0];
    this.group.add(line);

    const gantry = new THREE.Group();
    const gw = T.halfWidth + T.curb + 1.5;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.5, metalness: 0.5 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), postMat); p.position.set(s * gw, 4, 0); gantry.add(p); }
    const bn = mkCanvas(1024, 128), bx = bn.getContext('2d');
    bx.fillStyle = '#0d1117'; bx.fillRect(0, 0, 1024, 128);
    bx.fillStyle = '#f2f2f2'; bx.font = 'bold 72px sans-serif'; bx.textAlign = 'center'; bx.textBaseline = 'middle';
    bx.fillText('START / FINISH', 512, 66);
    for (let i = 0; i < 64; i++) { bx.fillStyle = i % 2 ? '#f2f2f2' : '#111'; bx.fillRect(i * 16, 0, 16, 8); bx.fillRect(i * 16, 120, 16, 8); }
    const bnTex = new THREE.CanvasTexture(bn); bnTex.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(gw * 2, 1.6, 0.4), new THREE.MeshStandardMaterial({ map: bnTex, roughness: 0.6 }));
    banner.position.set(0, 7.6, 0); gantry.add(banner);
    gantry.position.set(tr.x[0], 0, tr.z[0]); gantry.rotation.y = tr.heading[0];
    this.group.add(gantry);

    this.buildTrees(tr);
    this.buildLamps(tr);
  }

  /** Pohon cemara (InstancedMesh: ratusan pohon dalam satu draw call). */
  buildTrees(tr) {
    const T = CONFIG.track, count = 320, minD2 = (T.wallOffset + 10) ** 2;
    const mesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.6, 10, 7).translate(0, 5.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x14301b, roughness: 0.95 }), count);
    const dummy = new THREE.Object3D();
    // kotak batas sirkuit untuk menyebar pohon di sekelilingnya
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < tr.N; i++) { minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]); minZ = Math.min(minZ, tr.z[i]); maxZ = Math.max(maxZ, tr.z[i]); }
    let placed = 0, tries = 0;
    while (placed < count && tries++ < count * 60) {
      const x = rand(minX - 140, maxX + 140), z = rand(minZ - 140, maxZ + 140);
      let ok = true;
      for (let i = 0; i < tr.N; i += 2) { const dx = x - tr.x[i], dz = z - tr.z[i]; if (dx * dx + dz * dz < minD2) { ok = false; break; } }
      if (!ok) continue;
      const s = rand(0.8, 1.5);
      dummy.position.set(x, 0, z); dummy.scale.set(s, s * rand(0.9, 1.3), s); dummy.rotation.y = rand(0, 6.28);
      dummy.updateMatrix(); mesh.setMatrixAt(placed++, dummy.matrix);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  /** Tiang lampu jalan; lampunya menyala makin terang saat malam. */
  buildLamps(tr) {
    const T = CONFIG.track, step = 36, n = Math.floor(tr.N / step);
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 10).translate(0, 5, 0), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 }), n);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), this.bulbMat, n);
    const d = new THREE.Object3D();
    for (let j = 0; j < n; j++) {
      const i = j * step, side = j % 2 ? 1 : -1, o = side * (T.wallOffset + 2.5);
      const x = tr.x[i] + tr.rx[i] * o, z = tr.z[i] + tr.rz[i] * o;
      d.position.set(x, 0, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); poles.setMatrixAt(j, d.matrix);
      d.position.set(x - tr.rx[i] * side * 1.2, 10.2, z - tr.rz[i] * side * 1.2); d.updateMatrix(); bulbs.setMatrixAt(j, d.matrix);
    }
    poles.instanceMatrix.needsUpdate = true; bulbs.instanceMatrix.needsUpdate = true;
    this.group.add(poles, bulbs);
  }

  /** night: 0 (siang) .. 1 (malam) */
  update(night) {
    this.bulbMat.color.setRGB(1, 0.85, 0.6).multiplyScalar(0.25 + night * 2.2);
  }
}
