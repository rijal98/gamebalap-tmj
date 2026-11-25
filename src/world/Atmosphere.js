import * as THREE from 'three';
import { CONFIG } from '../config.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (r, g, b) => new THREE.Color(r, g, b);

// Palet langit (ruang warna linear). Tiga suasana: siang berawan, senja jingga, malam.
const PAL = {
  horizon: { day: C(0.36, 0.42, 0.48), dusk: C(0.62, 0.3, 0.14), night: C(0.006, 0.009, 0.02) },
  top: { day: C(0.12, 0.17, 0.25), dusk: C(0.07, 0.07, 0.14), night: C(0.002, 0.003, 0.008) },
  sun: { day: C(1, 0.92, 0.8), dusk: C(1, 0.4, 0.12) },
};

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 groundColor;
uniform vec3 sunColor; uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.45));
  col = mix(col, groundColor, smoothstep(0.0, -0.12, h));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 700.0) * 2.5 + pow(s, 14.0) * 0.22 + pow(s, 3.0) * 0.1);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Langit, matahari, kabut, dan siklus cahaya (senja -> malam -> pagi).
 * Langit juga dijadikan peta lingkungan (PMREM) sehingga aspal basah
 * memantulkan warna langit yang sedang aktif.
 */
export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.night = 0; this.elevation = 40; this.shadows = true;
    this.skyUniforms = {
      topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() }, groundColor: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
    const geo = new THREE.SphereGeometry(4000, 32, 16);
    this.sky = new THREE.Mesh(geo, mat); this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    scene.add(this.sky);

    // salinan langit di scene terpisah untuk membuat peta lingkungan
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(geo, mat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = null; this.envTimer = 0;

    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x151a14, 0.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 260;
    sc.updateProjectionMatrix(); // wajib setelah mengubah ukuran kamera bayangan
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0x888888, 40, 620);

    this.tmpA = new THREE.Color(); this.tmpB = new THREE.Color();
  }

  mix(out, set, warm, nightF) {
    out.copy(set.day).lerp(set.dusk, warm).lerp(set.night, nightF);
    return out;
  }

  /** time = detik sejak awal; focus = posisi yang diikuti bayangan (mobil) */
  update(dt, time, focus, camera) {
    const A = CONFIG.atmosphere;
    const phase = A.startPhase + time / A.period;
    const e = 16 + 24 * Math.cos(phase * Math.PI * 2); // elevasi matahari (derajat): 40 .. -8
    this.elevation = e;
    const warm = smooth(34, 3, e), nightF = smooth(3, -7, e);
    this.night = nightF;

    const er = (e * Math.PI) / 180, az = 3.5;
    const dir = new THREE.Vector3(Math.cos(er) * Math.sin(az), Math.sin(er), Math.cos(er) * Math.cos(az));
    const u = this.skyUniforms;
    this.mix(u.horizonColor.value, PAL.horizon, warm, nightF);
    this.mix(u.topColor.value, PAL.top, warm, nightF);
    u.groundColor.value.copy(u.horizonColor.value).multiplyScalar(0.5);
    u.sunColor.value.copy(PAL.sun.day).lerp(PAL.sun.dusk, warm).multiplyScalar(1 - nightF);
    u.sunDir.value.copy(dir);

    this.scene.fog.color.copy(u.horizonColor.value).multiplyScalar(0.9);
    this.sun.color.copy(PAL.sun.day).lerp(PAL.sun.dusk, warm);
    this.sun.intensity = 2.6 * smooth(-3, 14, e);
    this.sun.castShadow = this.shadows; // dibiarkan aktif: mengubahnya saat berjalan memicu kompilasi ulang shader
    this.hemi.color.copy(u.topColor.value).lerp(u.horizonColor.value, 0.6).multiplyScalar(1.4);
    this.hemi.intensity = 0.12 + 0.75 * (1 - nightF);

    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(dir, 120);
    this.sky.position.copy(camera.position);

    this.envTimer -= dt;
    if (this.envTimer <= 0) { this.envTimer = 0.8; this.refreshEnv(); }
  }

  refreshEnv() {
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 9000);
    if (this.envTarget) this.envTarget.dispose();
    this.envTarget = rt;
    this.scene.environment = rt.texture;
  }
}
