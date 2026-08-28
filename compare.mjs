import { PNG } from 'pngjs';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Compares two capture directories.
 *
 * Exact hashing was the first attempt and it is too brittle: two runs of
 * IDENTICAL code differ by 20-odd pixels on antialiased element edges, which
 * reports as a failure and trains you to ignore the tool. A real regression
 * moves thousands of pixels, so a threshold separates the two cleanly.
 *
 *   under 0.02%  noise — subpixel edges
 *   over  0.02%  look at it
 */
const [A, B, thresholdPct = '0.02'] = process.argv.slice(2);
const LIMIT = Number(thresholdPct);

const shots = readdirSync(A).filter(f => f.endsWith('.png'));
let flagged = 0, worst = 0, worstName = '';

for (const f of shots) {
  let a, b;
  try { a = PNG.sync.read(readFileSync(`${A}/${f}`)); b = PNG.sync.read(readFileSync(`${B}/${f}`)); }
  catch { console.log(`  ${f.padEnd(26)} MISSING in one side`); flagged++; continue; }

  if (a.width !== b.width || a.height !== b.height) {
    console.log(`  ${f.padEnd(26)} SIZE ${a.width}x${a.height} -> ${b.width}x${b.height}`);
    flagged++; continue;
  }
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    // Ignore 1-step differences: those are rounding, not rendering.
    if (Math.abs(a.data[i] - b.data[i]) > 1 ||
        Math.abs(a.data[i+1] - b.data[i+1]) > 1 ||
        Math.abs(a.data[i+2] - b.data[i+2]) > 1) n++;
  }
  const pct = (n / (a.width * a.height)) * 100;
  if (pct > worst) { worst = pct; worstName = f; }
  if (pct > LIMIT) { console.log(`  ${f.padEnd(26)} ${pct.toFixed(4)}%  (${n} px)  <-- REVIEW`); flagged++; }
}

console.log(`\n  ${shots.length} screens · threshold ${LIMIT}% · worst ${worst.toFixed(4)}% (${worstName})`);
console.log(flagged ? `  ${flagged} screen(s) need review` : '  no visual regression');
process.exit(flagged ? 1 : 0);
