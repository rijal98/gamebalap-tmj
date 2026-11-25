// Semua angka penyetelan game dikumpulkan di sini.
export const CONFIG = {
  laps: 3,
  countdown: 3, // detik hitung mundur sebelum start

  track: {
    halfWidth: 7.5, // setengah lebar aspal (meter)
    curb: 1.3, // lebar curb di tepi aspal
    wallOffset: 12, // jarak dinding pembatas dari garis tengah
    samples: 900, // jumlah titik sampel sepanjang sirkuit
    // Titik kontrol sirkuit tertutup (x, z) dalam meter. Kurva Catmull-Rom
    // dibuat melewati semua titik ini. Ubah titik untuk membuat sirkuit lain.
    points: [
      [0, 0], [140, 0], [290, -20], [390, -110], [380, -250], [290, -330],
      [160, -320], [60, -390], [-70, -440], [-210, -400], [-295, -300],
      [-245, -190], [-290, -85], [-180, 15],
    ],
  },

  car: {
    maxSpeed: 78, // m/s (±280 km/jam)
    accel: 11, // percepatan awal m/s²
    brake: 17,
    reverseMax: 12,
    maxYaw: 1.5, // laju putar maksimum (rad/detik) saat pelan
    maxLat: 15, // batas percepatan menyamping (m/s²), lebih kecil = lebih licin
    latGrip: 9, // seberapa cepat gerak menyamping diredam
    wet: 0.85, // pengali cengkeraman karena aspal basah (1 = kering)
  },

  atmosphere: {
    period: 260, // detik untuk satu siklus cahaya (siang -> senja -> malam -> siang)
    startPhase: 0.0, // 0 = mulai dari sore cerah
  },

  rain: { count: 3500, area: 70, height: 45 },
};
