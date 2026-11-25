import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildTrack, nearest, angleDiff } from '../track/trackMath.js';
import { CarSim, resolveWalls } from '../vehicle/CarSim.js';
import { RaceLogic, formatTime } from '../race/RaceLogic.js';
import { Car } from '../vehicle/Car.js';
import { Track } from '../world/Track.js';
import { Atmosphere } from '../world/Atmosphere.js';
import { Rain } from '../world/Rain.js';
import { Particles } from '../systems/Particles.js';
import { AudioManager } from '../systems/AudioManager.js';
import { Input } from './Input.js';
import { UI } from '../ui/UI.js';

export const STATE = { MENU: 'menu', COUNTDOWN: 'countdown', RACING: 'racing', FINISHED: 'finished' };
const T = CONFIG.track;
const IDLE = { throttle: 0, brake: 0, steer: 0, handbrake: false };

export class Game {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.3, 6000);
    this.scene.add(this.camera);

    // ---- data & dunia ----
    this.tr = buildTrack(T.points, { samples: T.samples, halfWidth: T.halfWidth });
    this.atmo = new Atmosphere(this.scene, this.renderer);
    this.track = new Track(this.scene, this.tr, this.renderer);
    this.car = new Car(this.scene);
    this.sim = new CarSim(CONFIG.car);
    this.rain = new Rain(this.scene);
    this.fx = new Particles(this.scene);
    this.race = new RaceLogic(this.tr.N, CONFIG.laps);
    this.audio = new AudioManager();
    this.ui = new UI();
    this.ui.buildMinimap(this.tr);
    this.input = new Input();

    this.state = STATE.MENU;
    this.stateTime = 0; this.time = 0; this.last = 0;
    this.paused = false; this.camMode = 0; this.hiQuality = true;
    this.camH = 0; this.shake = 0; this.wrongTimer = 0;
    this.focus = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.lastInput = IDLE;

    this.placeOnGrid();
    this.bindEvents();
    this.ui.show(this.state);
  }

  // --------------------------------------------------------------- setup
  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.ui.onConfirm(() => this.confirm());
    this.input.on('confirm', () => this.confirm());
    this.input.on('camera', () => { this.camMode = (this.camMode + 1) % 3; });
    this.input.on('mute', () => this.audio.toggleMute());
    this.input.on('reset', () => this.resetToTrack());
    this.input.on('pause', () => this.togglePause());
    this.input.on('quality', () => this.toggleQuality());
  }

  /** Posisi start: sekitar 40 m sebelum garis start. */
  placeOnGrid() {
    const tr = this.tr, i = tr.N - 18;
    this.sim.reset(tr.x[i] + tr.rx[i] * 2.5, tr.z[i] + tr.rz[i] * 2.5, tr.heading[i]);
    this.near = nearest(tr, this.sim.x, this.sim.z, -1);
    this.race.reset(i);
    this.camH = this.sim.h;
  }

  confirm() {
    if (this.state === STATE.MENU) this.startCountdown();
    else if (this.state === STATE.FINISHED && this.stateTime > 1) this.startCountdown();
  }

  startCountdown() {
    this.audio.unlock(); // harus dari interaksi pengguna
    this.placeOnGrid();
    this.setState(STATE.COUNTDOWN);
  }

  setState(s) { this.state = s; this.stateTime = 0; this.ui.show(s); }

  togglePause() {
    if (this.state === STATE.MENU) return;
    this.paused = !this.paused; this.ui.setPaused(this.paused);
  }

  toggleQuality() {
    this.hiQuality = !this.hiQuality;
    this.renderer.setPixelRatio(this.hiQuality ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.atmo.shadows = this.hiQuality;
    this.ui.flash(this.hiQuality ? 'Kualitas: tinggi' : 'Kualitas: rendah', { small: true });
  }

  /** Mengembalikan mobil ke titik terdekat di garis tengah (tombol R). */
  resetToTrack() {
    if (this.state !== STATE.RACING && this.state !== STATE.FINISHED) return;
    const tr = this.tr, n = nearest(tr, this.sim.x, this.sim.z, -1);
    this.sim.reset(tr.x[n.idx], tr.z[n.idx], tr.heading[n.idx]);
    this.near = n; this.camH = this.sim.h;
  }

  // ---------------------------------------------------------------- loop
  start() { this.renderer.setAnimationLoop((t) => this.loop(t)); }

  loop(ms) {
    const dt = Math.min((ms - this.last) / 1000, 0.05);
    this.last = ms;
    if (!this.paused) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    this.time += dt; this.stateTime += dt;
    const sim = this.sim, tr = this.tr;
    let inp = IDLE;

    if (this.state === STATE.COUNTDOWN) {
      const left = CONFIG.countdown - this.stateTime;
      const n = Math.ceil(left);
      if (left > 0) { if (this.ui.cache.cd !== n) { this.ui.cache.cd = n; this.ui.flash(String(n), { ms: 0 }); } }
      else { this.ui.cache.cd = null; this.ui.flash('GO!', { ms: 900 }); this.setState(STATE.RACING); }
    } else if (this.state === STATE.RACING) {
      inp = this.input.state();
    } else if (this.state === STATE.FINISHED) {
      inp = { throttle: 0, brake: 0.5, steer: 0, handbrake: false };
    }

    // ---------- fisika (sub-langkah agar stabil di kecepatan tinggi) ----------
    if (this.state !== STATE.MENU) {
      const steps = Math.max(1, Math.ceil(dt / (1 / 90))), h = dt / steps;
      for (let k = 0; k < steps; k++) {
        const off = Math.abs(this.near.offset);
        const grass = off > T.halfWidth + T.curb;
        const curb = !grass && off > T.halfWidth;
        sim.update(h, inp, { grass, gripMul: curb ? 0.92 : 1 });
        this.near = nearest(tr, sim.x, sim.z, this.near.idx);
        const hit = resolveWalls(sim, tr, this.near, T.wallOffset);
        if (hit > 3) this.onImpact(hit);
      }
      if (this.state === STATE.RACING) this.updateRace(dt);
    } else {
      sim.speed = 0;
    }
    this.lastInput = inp;

    // ---------- tampilan ----------
    this.focus.set(sim.x, 0, sim.z);
    this.updateCamera(dt);
    this.atmo.update(dt, this.time, this.focus, this.camera);
    this.track.update(this.atmo.night);
    this.car.update(sim, dt, this.atmo.night, inp.brake > 0 && sim.vf > 1);
    this.rain.update(dt, this.camera.position, this.atmo.night);
    this.emitEffects(dt);
    this.fx.update(dt);
    this.audio.update(dt, { speed: Math.abs(sim.vf), throttle: inp.throttle, slip: sim.slip, grass: Math.abs(this.near.offset) > T.halfWidth + T.curb, running: this.state !== STATE.MENU });
    this.updateHud();
  }

  updateRace(dt) {
    const ev = this.race.update(this.near.idx, dt), r = this.race;
    if (ev === 'lapStart') this.ui.flash('LAP 1', { small: true });
    else if (ev === 'lap') this.ui.flash(`LAP ${r.lapTimes.length}  ${formatTime(r.lastLap)}${r.lastLap === r.best ? '  TERCEPAT' : ''}`, { small: true, ms: 2200 });
    else if (ev === 'finish') { this.ui.showResults(r); this.setState(STATE.FINISHED); this.ui.flash('FINISH!', { ms: 1800 }); }

    // arah salah: bergerak melawan arah sirkuit
    const i = this.near.idx, along = this.sim.vx * this.tr.tx[i] + this.sim.vz * this.tr.tz[i];
    this.wrongTimer = this.sim.speed > 6 && along < -0.5 * this.sim.speed ? this.wrongTimer + dt : 0;
  }

  onImpact(v) {
    this.shake = Math.min(1, v / 30);
    this.audio.impact(v);
    this.tmp.set(this.sim.x, 0.6, this.sim.z);
    this.fx.emit(this.tmp, 0xffaa33, 22, { spread: 9, up: 4, life: 0.5, vx: this.sim.vx * 0.2 });
  }

  /** Percikan air dari roda belakang dan asap saat drift. */
  emitEffects(dt) {
    const s = this.sim;
    if (this.state === STATE.MENU || s.speed < 12) return;
    const f = [Math.sin(s.h), Math.cos(s.h)], side = [Math.cos(s.h), -Math.sin(s.h)];
    const rate = Math.min(1, s.speed / 60);
    if (Math.random() < rate * 1.2) {
      for (const sx of [-1, 1]) {
        this.tmp.set(s.x - f[0] * 1.4 + side[0] * sx * 0.95, 0.15, s.z - f[1] * 1.4 + side[1] * sx * 0.95);
        this.fx.emit(this.tmp, 0x9fb2c4, 1, { spread: 3.5, up: 2.2, life: 0.85, vx: s.vx * 0.18, drift: s.vz * 0.18 });
      }
    }
    if (s.drifting) {
      for (const sx of [-1, 1]) {
        this.tmp.set(s.x - f[0] * 1.4 + side[0] * sx * 0.95, 0.1, s.z - f[1] * 1.4 + side[1] * sx * 0.95);
        this.fx.emit(this.tmp, 0xdfe3e8, 2, { spread: 2, up: 1.4, life: 1.1, vx: s.vx * 0.12, drift: s.vz * 0.12 });
      }
    }
  }

  updateCamera(dt) {
    const s = this.sim, cam = this.camera;
    if (this.state === STATE.MENU) { // kamera berputar pelan di sekitar mobil
      const a = this.time * 0.25;
      cam.position.set(s.x + Math.sin(a) * 7.5, 2.3, s.z + Math.cos(a) * 7.5);
      this.camLook.set(s.x, 0.8, s.z); cam.lookAt(this.camLook); cam.fov = 55; cam.updateProjectionMatrix();
      return;
    }
    let dist = 7.6, height = 2.5, look = 14;
    if (this.camMode === 1) { dist = 12; height = 4.6; look = 18; }
    if (this.camMode === 2) { // kamera kap mesin
      const fx = Math.sin(s.h), fz = Math.cos(s.h);
      cam.position.set(s.x + fx * 0.6, 1.15, s.z + fz * 0.6);
      this.camLook.set(s.x + fx * 25, 1.0, s.z + fz * 25);
    } else {
      this.camH += angleDiff(s.h, this.camH) * (1 - Math.exp(-5 * dt)); // arah kamera menyusul pelan: terasa saat drift
      const fx = Math.sin(this.camH), fz = Math.cos(this.camH), stretch = 1 + (s.speed / 78) * 0.25;
      cam.position.set(s.x - fx * dist * stretch, height + (s.speed / 78) * 0.4, s.z - fz * dist * stretch);
      this.camLook.set(s.x + fx * look, 1.0, s.z + fz * look);
    }
    if (this.shake > 0.01) { // getaran saat menabrak
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.6; cam.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.shake = THREE.MathUtils.damp(this.shake, 0, 6, dt);
    }
    cam.lookAt(this.camLook);
    const fov = 62 + (s.speed / 78) * 18;
    cam.fov = THREE.MathUtils.damp(cam.fov, fov, 4, dt); cam.updateProjectionMatrix();
  }

  updateHud() {
    const r = this.race, s = this.sim;
    this.ui.update({ lap: r.lap, laps: CONFIG.laps, lapTime: r.lapTime, best: r.best, last: r.lastLap, speed: s.speed, reverse: s.vf < -0.5, wrongWay: this.wrongTimer > 1.2 });
    this.ui.drawMinimap(s.x, s.z, s.h);
  }
}
