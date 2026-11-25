import * as THREE from 'three';

const MAX = 900; // jumlah partikel maksimum (kolam tetap)

/**
 * Sistem partikel sederhana: satu objek THREE.Points berisi MAX titik.
 * Semua data disimpan di array bertipe (Float32Array) agar cepat; titik
 * yang "mati" dipakai ulang oleh emit() berikutnya. Seluruh partikel
 * digambar dalam SATU draw call, sehingga ringan.
 */
export class Particles {
  constructor(scene) {
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.velocities = new Float32Array(MAX * 3);
    this.baseColors = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX); // sisa umur (detik)
    this.maxLife = new Float32Array(MAX);
    this.cursor = 0; // indeks slot berikutnya (ring buffer)

    // Awalnya semua partikel disembunyikan jauh di bawah lantai
    for (let i = 0; i < MAX; i++) this.positions[i * 3 + 1] = -999;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending, // warna hitam = tak terlihat -> efek "memudar"
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // bounding sphere-nya tidak ikut diperbarui
    scene.add(this.points);
  }

  /**
   * Memancarkan `count` partikel dari `origin`.
   * @param {THREE.Vector3} origin  posisi awal
   * @param {number} color          warna hex
   * @param {number} count          jumlah partikel
   * @param {object} opt            { spread, up, drift, life, size }
   */
  emit(origin, color, count, opt = {}) {
    const { spread = 3, up = 3, drift = 0, vx = 0, life = 0.7 } = opt;
    const c = new THREE.Color(color);

    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const i3 = i * 3;

      this.positions[i3] = origin.x + (Math.random() - 0.5) * 0.3;
      this.positions[i3 + 1] = origin.y;
      this.positions[i3 + 2] = origin.z + (Math.random() - 0.5) * 0.3;

      this.velocities[i3] = vx + (Math.random() - 0.5) * spread;
      this.velocities[i3 + 1] = Math.random() * up;
      this.velocities[i3 + 2] = drift + (Math.random() - 0.5) * spread * 0.5;

      this.baseColors[i3] = c.r;
      this.baseColors[i3 + 1] = c.g;
      this.baseColors[i3 + 2] = c.b;

      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
    }
  }

  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;

      if (this.life[i] <= 0) {
        // mati: sembunyikan
        this.positions[i3 + 1] = -999;
        this.colors[i3] = this.colors[i3 + 1] = this.colors[i3 + 2] = 0;
        continue;
      }

      this.velocities[i3 + 1] -= 1.5 * dt; // kabut/percikan melayang pelan
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      // Memudar: kecerahan warna berkurang mengikuti sisa umur
      const fade = this.life[i] / this.maxLife[i];
      this.colors[i3] = this.baseColors[i3] * fade;
      this.colors[i3 + 1] = this.baseColors[i3 + 1] * fade;
      this.colors[i3 + 2] = this.baseColors[i3 + 2] * fade;
    }
    // Beri tahu GPU bahwa data buffer berubah
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
