// Hitung lap dan waktu. Tanpa Three.js. Kebal dari curang: mundur lalu maju lagi
// tidak menghitung lap dua kali, karena yang dihitung adalah kemajuan kumulatif.

export class RaceLogic {
  constructor(N, totalLaps) {
    this.N = N; this.totalLaps = totalLaps;
    this.reset(0);
  }

  /** startIdx = indeks titik awal mobil (biasanya sedikit sebelum garis start). */
  reset(startIdx) {
    const N = this.N;
    this.prevIdx = startIdx;
    this.progress = startIdx > N / 2 ? startIdx - N : startIdx; // negatif = di belakang garis
    this.maxLapIdx = this.progress < 0 ? -1 : 0;
    this.time = 0; // waktu balapan berjalan
    this.lapStart = null; // waktu saat lap dimulai
    this.lapTimes = [];
    this.best = null;
    this.lastLap = null;
    this.finished = false;
    this.totalTime = null;
  }

  /** Lap yang sedang dijalani (1..totalLaps). */
  get lap() { return Math.min(this.totalLaps, Math.max(1, Math.floor(this.progress / this.N) + 1)); }
  get lapTime() { return this.lapStart === null ? 0 : this.time - this.lapStart; }

  /**
   * Dipanggil tiap frame saat balapan berjalan.
   * Mengembalikan 'lapStart' | 'lap' | 'finish' | null bila ada kejadian.
   */
  update(idx, dt) {
    const N = this.N;
    this.time += dt;
    let d = idx - this.prevIdx;
    if (d > N / 2) d -= N; else if (d < -N / 2) d += N;
    this.prevIdx = idx;
    this.progress += d;
    const lapIdx = Math.floor(this.progress / N);
    let event = null;
    if (lapIdx > this.maxLapIdx) {
      this.maxLapIdx = lapIdx;
      if (lapIdx === 0) { this.lapStart = this.time; event = 'lapStart'; }
      else {
        const t = this.time - this.lapStart;
        this.lapStart = this.time;
        this.lastLap = t;
        this.lapTimes.push(t);
        if (this.best === null || t < this.best) this.best = t;
        if (lapIdx >= this.totalLaps) { this.finished = true; this.totalTime = this.lapTimes.reduce((a, b) => a + b, 0); event = 'finish'; }
        else event = 'lap';
      }
    }
    return event;
  }
}

export function formatTime(t) {
  if (t === null || t === undefined) return '--:--.---';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}
