/**
 * Satu pintu untuk semua input: keyboard dan tombol layar sentuh.
 * state() mengembalikan kendali analog-sederhana untuk mobil; aksi sekali tekan
 * (reset, kamera, bisu, jeda, konfirmasi) dikirim lewat on(nama, callback).
 */
const ACTIONS = { KeyR: 'reset', KeyC: 'camera', KeyM: 'mute', Enter: 'confirm', KeyP: 'pause', KeyQ: 'quality' };
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.listeners = {};
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault(); // cegah halaman ter-scroll
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = ACTIONS[e.code]; if (a) this.emit(a);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear()); // lepas semua tombol saat jendela tidak aktif

    // tombol sentuh: <button data-key="ArrowLeft"> dst.
    document.querySelectorAll('[data-key]').forEach((el) => {
      const code = el.dataset.key;
      const down = (e) => { e.preventDefault(); this.keys.add(code); const a = ACTIONS[code]; if (a) this.emit(a); };
      const up = (e) => { e.preventDefault(); this.keys.delete(code); };
      el.addEventListener('pointerdown', down);
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  on(action, cb) { (this.listeners[action] ||= []).push(cb); return this; }
  emit(action) { for (const cb of this.listeners[action] || []) cb(); }

  has(...codes) { return codes.some((c) => this.keys.has(c)); }

  /** Kendali mobil saat ini. steer: +1 = kanan, -1 = kiri. */
  state() {
    return {
      throttle: this.has('ArrowUp', 'KeyW') ? 1 : 0,
      brake: this.has('ArrowDown', 'KeyS') ? 1 : 0,
      steer: (this.has('ArrowRight', 'KeyD') ? 1 : 0) - (this.has('ArrowLeft', 'KeyA') ? 1 : 0),
      handbrake: this.has('Space'),
    };
  }
}
