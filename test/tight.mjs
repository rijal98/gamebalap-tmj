import { CONFIG as C } from '../src/config.js';
import { buildTrack } from '../src/track/trackMath.js';
const t = buildTrack(C.track.points, { samples: 900, halfWidth: 7.5 });
const arr = [...t.curvature].map((k, i) => [1 / k, i]).sort((a, b) => a[0] - b[0]);
const seen = [];
for (const [r, i] of arr) { if (seen.every((j) => Math.min(Math.abs(i - j), 900 - Math.abs(i - j)) > 25)) { seen.push(i); console.log('R', r.toFixed(1), 'idx', i, 'pos', t.x[i].toFixed(0), t.z[i].toFixed(0)); } if (seen.length >= 5) break; }
console.log('length', t.length.toFixed(0));
