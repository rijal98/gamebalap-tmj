// Audio mobil dengan Web Audio API: suara mesin (sintesis), hujan, angin,
// decit ban, dan benturan. Tidak membutuhkan berkas suara apa pun.

export const GEAR_SPEEDS = [0, 20, 34, 46, 57, 67, 79]; // batas kecepatan (m/s) tiap gigi

/** Gigi dan putaran mesin (0..1) dari kecepatan. Fungsi murni agar mudah diuji. */
export function gearInfo(speed) {
  let g = 0;
  while (g < GEAR_SPEEDS.length - 2 && speed >= GEAR_SPEEDS[g + 1]) g++;
  const lo = GEAR_SPEEDS[g], hi = GEAR_SPEEDS[g + 1];
  const f = Math.min(1, Math.max(0, (speed - lo) / (hi - lo)));
  return { gear: g + 1, rpm: 0.22 + 0.78 * f };
}

export class AudioManager {
  constructor() { this.ctx = null; this.muted = false; this.gear = 1; this.shift = 0; }

  /** Wajib dipanggil di dalam event klik/tombol (kebijakan autoplay peramban). */
  unlock() {
    if (!this.ctx) { try { this.build(); } catch (e) { console.warn('Audio tidak tersedia:', e); return; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseSource(loop = true) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    return src;
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(ctx.destination);

    // mesin: dua osilator -> lowpass -> gain
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.Q.value = 3;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.o1.connect(this.engFilter); this.o2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.o1.start(); this.o2.start();

    // hujan: derau difilter
    const rain = this.noiseSource(); const rHp = ctx.createBiquadFilter(); rHp.type = 'highpass'; rHp.frequency.value = 1500;
    const rGain = ctx.createGain(); rGain.gain.value = 0.045; rain.connect(rHp); rHp.connect(rGain); rGain.connect(this.master); rain.start();

    // angin
    const wind = this.noiseSource(); const wLp = ctx.createBiquadFilter(); wLp.type = 'lowpass'; wLp.frequency.value = 450;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0; wind.connect(wLp); wLp.connect(this.windGain); this.windGain.connect(this.master); wind.start();

    // decit ban
    const sq = this.noiseSource(); const sBp = ctx.createBiquadFilter(); sBp.type = 'bandpass'; sBp.frequency.value = 1700; sBp.Q.value = 5;
    this.sqGain = ctx.createGain(); this.sqGain.gain.value = 0; sq.connect(sBp); sBp.connect(this.sqGain); this.sqGain.connect(this.master); sq.start();
  }

  /** Dipanggil tiap frame. speed (m/s), throttle 0..1, slip 0..1, grass boolean */
  update(dt, { speed, throttle, slip, grass, running }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { gear, rpm } = gearInfo(speed);
    if (gear !== this.gear) { this.gear = gear; this.shift = 0.12; } // jeda singkat saat pindah gigi
    this.shift = Math.max(0, this.shift - dt);
    const f = 46 + rpm * 160;
    this.o1.frequency.setTargetAtTime(f, t, 0.04);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    this.engFilter.frequency.setTargetAtTime(380 + rpm * 1500 + throttle * 1100, t, 0.06);
    const vol = running ? (0.09 + 0.15 * throttle + 0.05 * rpm) * (this.shift > 0 ? 0.35 : 1) : 0.06;
    this.engGain.gain.setTargetAtTime(vol, t, 0.05);
    this.windGain.gain.setTargetAtTime(Math.min(0.2, (speed / 78) * 0.2), t, 0.1);
    const sq = slip > 0.35 && speed > 8 ? (slip - 0.3) * 0.22 : grass ? 0.03 : 0;
    this.sqGain.gain.setTargetAtTime(sq, t, 0.05);
  }

  /** Benturan dengan dinding. v = kecepatan benturan (m/s) */
  impact(v) {
    if (!this.ctx) return;
    const ctx = this.ctx, src = this.noiseSource(false);
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const t = ctx.currentTime, vol = Math.min(1, v / 35);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.5);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}
