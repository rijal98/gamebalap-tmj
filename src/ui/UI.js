import { formatTime } from '../race/RaceLogic.js';
import { gearInfo } from '../systems/AudioManager.js';

/** HUD, menu, hasil, dan minimap. Satu-satunya modul yang menyentuh DOM. */
export class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), lap: $('lap'), laps: $('laps'), lapTime: $('lapTime'), best: $('best'), last: $('last'),
      speed: $('speed'), gear: $('gear'), rpm: $('rpmBar'), center: $('center'), wrong: $('wrong'),
      menu: $('menu'), finish: $('finish'), pause: $('pause'), fatal: $('fatal'),
      rTotal: $('rTotal'), rBest: $('rBest'), rLaps: $('rLaps'),
      startBtn: $('startBtn'), againBtn: $('againBtn'), minimap: $('minimap'),
    };
    this.cache = {};
    this.mm = this.el.minimap.getContext('2d');
    this.flashTimer = null;
  }

  onConfirm(cb) { for (const b of [this.el.startBtn, this.el.againBtn]) b.addEventListener('click', () => { b.blur(); cb(); }); }

  fatal() { this.el.fatal.classList.remove('hidden'); this.el.menu.classList.add('hidden'); }

  show(state) {
    const e = this.el;
    e.menu.classList.toggle('hidden', state !== 'menu');
    e.finish.classList.toggle('hidden', state !== 'finished');
    e.hud.classList.toggle('hidden', state === 'menu');
  }
  setPaused(p) { this.el.pause.classList.toggle('hidden', !p); }

  text(key, v) { if (this.cache[key] !== v) { this.cache[key] = v; this.el[key].textContent = v; } }

  update(d) {
    this.text('lap', d.lap); this.text('laps', d.laps);
    this.text('lapTime', formatTime(d.lapTime));
    this.text('best', formatTime(d.best)); this.text('last', formatTime(d.last));
    this.text('speed', Math.round(d.speed * 3.6));
    this.text('gear', d.speed < 0.5 && d.reverse ? 'R' : gearInfo(d.speed).gear);
    this.el.rpm.style.width = `${Math.round(gearInfo(d.speed).rpm * 100)}%`;
    this.el.wrong.classList.toggle('hidden', !d.wrongWay);
  }

  /** Teks besar di tengah layar. ms = 0 berarti tetap sampai diganti. */
  flash(msg, { ms = 1200, small = false } = {}) {
    const c = this.el.center;
    clearTimeout(this.flashTimer);
    if (!msg) { c.classList.add('hidden'); return; }
    c.textContent = msg; c.classList.remove('hidden'); c.classList.toggle('small-msg', small);
    if (ms) this.flashTimer = setTimeout(() => c.classList.add('hidden'), ms);
  }

  showResults(race) {
    const e = this.el;
    e.rTotal.textContent = formatTime(race.totalTime);
    e.rBest.textContent = formatTime(race.best);
    e.rLaps.innerHTML = '';
    race.lapTimes.forEach((t, i) => { const li = document.createElement('li'); li.textContent = `Lap ${i + 1}   ${formatTime(t)}${t === race.best ? '   (tercepat)' : ''}`; e.rLaps.appendChild(li); });
  }

  // ---------------- minimap (peta atas sirkuit) ----------------
  buildMinimap(tr) {
    const W = this.el.minimap.width, H = this.el.minimap.height;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < tr.N; i++) { minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]); minZ = Math.min(minZ, tr.z[i]); maxZ = Math.max(maxZ, tr.z[i]); }
    this.mmScale = (Math.min(W, H) * 0.86) / Math.max(maxX - minX, maxZ - minZ);
    this.mmCx = (minX + maxX) / 2; this.mmCz = (minZ + maxZ) / 2;
    // sirkuit digambar sekali ke kanvas tersembunyi
    this.mmBg = document.createElement('canvas'); this.mmBg.width = W; this.mmBg.height = H;
    const g = this.mmBg.getContext('2d');
    g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = '#ffffffaa'; g.beginPath();
    for (let i = 0; i <= tr.N; i++) { const k = i % tr.N, [px, py] = this.toMap(tr.x[k], tr.z[k]); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    const [sx, sy] = this.toMap(tr.x[0], tr.z[0]); g.fillStyle = '#ffb020'; g.fillRect(sx - 4, sy - 4, 8, 8);
  }
  /** Tampak atas: +Z ke atas layar, jadi +X ke kiri. */
  toMap(x, z) { return [this.el.minimap.width / 2 - (x - this.mmCx) * this.mmScale, this.el.minimap.height / 2 - (z - this.mmCz) * this.mmScale]; }

  drawMinimap(x, z, h) {
    const g = this.mm; g.clearRect(0, 0, this.el.minimap.width, this.el.minimap.height);
    g.drawImage(this.mmBg, 0, 0);
    const [px, py] = this.toMap(x, z);
    g.save(); g.translate(px, py); g.rotate(-h); // segitiga menunjuk ke atas = arah hadap mobil pada peta
    g.fillStyle = '#3aa0ff'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
