import * as THREE from 'three';

const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

/**
 * Mobil GT3 low-poly dari bentuk dasar. Depan = +Z lokal, kanan = -X lokal.
 * Fisika tidak ada di sini: kelas ini hanya menampilkan keadaan CarSim.
 */
export class Car {
  constructor(scene) {
    this.group = new THREE.Group();
    this.body = new THREE.Group(); // bagian yang ikut miring (roll/pitch)
    this.group.add(this.body);
    scene.add(this.group);

    const paint = new THREE.MeshPhysicalMaterial({ color: 0x0a53c8, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf0f2f5, metalness: 0.3, roughness: 0.3, clearcoat: 1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.5, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.06, metalness: 0.9 });

    const b = this.body;
    b.add(box(1.95, 0.5, 4.5, paint, 0, 0.55, 0)); // badan bawah
    b.add(box(1.8, 0.2, 1.5, paint, 0, 0.84, 1.3)); // kap mesin
    b.add(box(1.5, 0.5, 1.9, glass, 0, 1.05, -0.35)); // kabin (kaca)
    b.add(box(1.45, 0.07, 1.3, white, 0, 1.33, -0.4)); // atap
    b.add(box(0.5, 0.02, 4.3, white, 0, 0.84, -0.1)); // garis livery di atas kap
    b.add(box(2.05, 0.07, 0.55, dark, 0, 0.27, 2.3)); // splitter depan
    b.add(box(1.9, 0.12, 0.9, dark, 0, 0.3, -2.0)); // diffuser
    b.add(box(1.95, 0.06, 0.55, dark, 0, 1.32, -2.12)); // sayap belakang
    for (const s of [-1, 1]) {
      b.add(box(0.05, 0.38, 0.62, dark, s * 0.98, 1.16, -2.12)); // pelat ujung sayap
      b.add(box(0.07, 0.35, 0.07, dark, s * 0.5, 1.12, -2.0)); // penyangga
    }

    // lampu: depan putih, belakang merah
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff1cc });
    for (const s of [-1, 1]) b.add(box(0.42, 0.12, 0.08, headMat, s * 0.62, 0.68, 2.26));
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x5a0000 });
    b.add(box(1.5, 0.1, 0.06, this.tailMat, 0, 0.8, -2.27));
    this.headMat = headMat;

    // roda: pivot (belok) -> roda (berputar)
    const tire = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.9 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.3, metalness: 0.9 });
    this.wheels = [];
    for (const [sx, sz, front] of [[1, 1.4, true], [-1, 1.4, true], [1, -1.4, false], [-1, -1.4, false]]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.95, 0.38, sz);
      const wheel = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.34, 20).rotateZ(Math.PI / 2), tire);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 10).rotateZ(Math.PI / 2), rim);
      wheel.add(t, r); pivot.add(wheel); this.group.add(pivot);
      this.wheels.push({ pivot, wheel, front });
    }

    // lampu depan sungguhan (SpotLight) untuk menerangi aspal basah di malam hari
    this.spots = [];
    for (const s of [-1, 1]) {
      const spot = new THREE.SpotLight(0xfff0d8, 0, 130, 0.5, 0.6, 2);
      spot.position.set(s * 0.62, 0.7, 2.2);
      const target = new THREE.Object3D(); target.position.set(s * 0.4, 0, 32);
      this.group.add(spot, target); spot.target = target;
      this.spots.push(spot);
    }

    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  /**
   * @param sim   CarSim
   * @param night 0..1
   * @param braking true bila rem ditekan
   */
  update(sim, dt, night, braking) {
    this.group.position.set(sim.x, 0, sim.z);
    this.group.rotation.y = sim.h;
    // badan miring: ke luar saat belok, menunduk saat mengerem
    const roll = THREE.MathUtils.clamp(-sim.latG * 0.006, -0.1, 0.1);
    const pitch = THREE.MathUtils.clamp(-sim.longA * 0.004, -0.06, 0.07);
    this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, roll, 8, dt);
    this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, pitch, 8, dt);

    for (const w of this.wheels) {
      w.wheel.rotation.x += (sim.vf / 0.38) * dt;
      if (w.front) w.pivot.rotation.y = -sim.steer * 0.42; // setir kanan -> roda menghadap kanan (-X)
    }
    const k = braking ? 4 : 0.7 + night * 1.2;
    this.tailMat.color.setRGB(0.5 * k, 0.02 * k, 0.02 * k);
    const lamp = 350 + night * 2800; // siang tipis, malam terang
    for (const s of this.spots) s.intensity = lamp;
    this.headMat.color.setRGB(1, 0.94, 0.8).multiplyScalar(0.8 + night * 2);
  }
}
