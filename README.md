# Game Balapan (WETLINE GT)

Teknik Multimedia dan Jaringan - Politeknik Negeri Ujung Pandang

Game balap 3D di peramban (Three.js, WebGL): mobil GT3 low-poly, drift di aspal basah,
hujan, dan cahaya yang berubah dari sore ke malam. 3 lap, ada waktu lap, peta mini,
dan kontrol keyboard maupun sentuh.

> Terinspirasi dari gaya *Project Endurance* (Anderson Mancini). Proyek ini implementasi
> terpisah yang ditulis dari nol: nama, kode, model, sirkuit, dan suara semuanya asli
> (dibuat dengan kode), tidak menyalin apa pun dari proyek tersebut.

## Menjalankan

Butuh Node.js LTS (https://nodejs.org). Di PowerShell Windows, bila muncul galat
"running scripts is disabled", jalankan sekali: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`.

    npm install
    npm run dev          # buka alamat yang tampil, biasanya http://localhost:5173
    npm run build        # hasil di folder dist/ (siap diunggah ke Netlify / GitHub Pages)
    npm test             # uji logika inti (sirkuit, fisika, hitung lap) tanpa GPU

Untuk mencoba di ponsel: satu Wi-Fi dengan komputer, buka `http://<IP-komputer>:5173`.

## Kontrol

| Aksi | Keyboard | Ponsel |
|---|---|---|
| Gas / Rem & mundur | W atau ↑ / S atau ↓ | tombol GAS / REM |
| Setir | A D atau ← → | tombol ◀ ▶ |
| Drift (rem tangan) | Spasi | tombol DRIFT |
| Kembali ke jalur | R | - |
| Kamera (belakang / jauh / kap mesin) | C | - |
| Suara / Jeda / Kualitas | M / P / Q | - |
| Mulai / balap lagi | Enter atau tombol di layar | tombol di layar |

Tips: di aspal basah, gas penuh sambil membelok membuat belakang mobil melebar (oversteer).
Tahan Spasi sambil membelok untuk drift. Rumput memperlambat; dinding memantulkan mobil.

## Struktur

    src/config.js            semua angka penyetelan: sirkuit, mobil, cahaya, hujan
    src/track/trackMath.js   sirkuit tertutup dari titik kontrol (murni JS, teruji)
    src/vehicle/CarSim.js    fisika arcade: grip basah, oversteer, drift, dinding (murni JS, teruji)
    src/race/RaceLogic.js    hitung lap dan waktu, kebal curang mundur-maju (murni JS, teruji)
    src/vehicle/Car.js       model mobil dari bentuk dasar + lampu
    src/world/Track.js       aspal basah, curb, dinding, pohon, lampu jalan, gerbang start
    src/world/Atmosphere.js  langit, matahari, kabut, siklus cahaya, peta pantulan
    src/world/Rain.js        hujan (satu draw call)
    src/systems/             Particles (percikan/asap), AudioManager (mesin, hujan, ban)
    src/ui/UI.js             HUD, menu, hasil, minimap
    src/core/                Game (perakit), Input (keyboard + sentuh)

## Mengubah sesuatu

- **Sirkuit lain:** ubah `track.points` di `config.js` (titik x,z berurutan; kurva dibuat otomatis).
  Jalankan `npm test`: uji akan memberi tahu bila tikungan terlalu rapat atau sirkuit saling menyentuh.
- **Lebih licin / lebih grip:** `car.wet`, `car.maxLat`, `car.latGrip`.
- **Siklus cahaya:** `atmosphere.period` (detik) dan `startPhase`.
- **Jumlah lap:** `laps`.

## Status pengujian

Logika inti (sirkuit, fisika, lap) diuji otomatis dengan pengemudi AI (3 lap selesai, waktu konsisten,
drift stabil, dinding bekerja). Alur game (menu, hitung mundur, balapan, hasil, jeda, reset) diuji
dengan tiruan Three.js. **Tampilan WebGL asli, performa, dan `vite build` belum diuji**; periksa
di peramban lalu setel visual (warna, intensitas lampu, kekasaran aspal) di `Atmosphere.js` / `Track.js` / `Car.js`.
