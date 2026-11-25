import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Hujan: ribuan goresan garis dalam SATU objek LineSegments (satu draw call).
 * Tetesan hidup di dalam kotak yang mengikuti kamera dan berputar (wrap)
 * sehingga hujan terlihat ada di mana-mana walau jumlahnya tetap.
 */
export class Rain {
  constructor(scene) {
    const R = CONFIG.rain;
    this.n = R.count; this.area = R.area; this.height = R.height;
    this.p = new Float32Array(this.n * 3); // posisi atas tiap tetesan
    this.len = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.p[i * 3] = (Math.random() * 2 - 1) * this.area;
      this.p[i * 3 + 1] = Math.random() * this.height;
      this.p[i * 3 + 2] = (Math.random() * 2 - 1) * this.area;
      this.len[i] = 0.7 + Math.random() * 0.9;
    }
    this.pos = new Float32Array(this.n * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xb9c8d8, transparent: true, opacity: 0.32, depthWrite: false });
    this.mesh = new THREE.LineSegments(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.cx = 0; this.cz = 0;
  }

  update(dt, camPos, night) {
    const A = this.area, H = this.height;
    const fall = 28, wind = 3;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      let x = this.p[i3], y = this.p[i3 + 1] - fall * dt, z = this.p[i3 + 2];
      if (y < 0) y += H;
      // posisi dunia = kotak di sekitar kamera: bungkus ke kotak
      if (x - camPos.x > A) x -= 2 * A; else if (x - camPos.x < -A) x += 2 * A;
      if (z - camPos.z > A) z -= 2 * A; else if (z - camPos.z < -A) z += 2 * A;
      this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
      const L = this.len[i], j = i * 6;
      this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z;
      this.pos[j + 3] = x - wind * 0.03 * L; this.pos[j + 4] = y - L; this.pos[j + 5] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.opacity = 0.34 - 0.08 * night;
  }
}
