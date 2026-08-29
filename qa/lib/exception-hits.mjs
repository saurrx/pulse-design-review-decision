/**
 * Records which exceptions actually fired, so `qa exceptions --strict` can tell
 * a live suppression from a dead one.
 *
 * The register's whole purpose is that a suppression which has outlived its
 * reason is itself a defect — it hides a real failure nobody is looking at any
 * more. Until now the CLI could only check that an entry was well-formed and
 * unexpired, because it had no idea what the tiers suppressed; the tiers
 * resolved each finding to its exception and threw that away. See
 * pulse-backend docs/qa/findings.md F-018.
 *
 * One file per TIER, not one file overall. A security-tier exception must not
 * look dead merely because only the invariant tier ran, so --strict judges an
 * exception only when a run of its own tier is on record.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HITS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.exception-hits');

/** Called by a tier at the end of a COMPLETE run — never a partial one. */
export function recordHits(tier, ids, { complete = true } = {}) {
  mkdirSync(HITS_DIR, { recursive: true });
  writeFileSync(join(HITS_DIR, `${tier}.json`), JSON.stringify({
    tier, at: new Date().toISOString(), complete, ids: [...new Set(ids)].sort(),
  }, null, 2) + '\n');
}

/** { tier -> {ids, at, complete} } for every tier that has reported. */
export function readHits() {
  if (!existsSync(HITS_DIR)) return {};
  const out = {};
  for (const f of readdirSync(HITS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const d = JSON.parse(readFileSync(join(HITS_DIR, f), 'utf8'));
      if (d?.tier) out[d.tier] = d;
    } catch { /* a half-written file is not evidence */ }
  }
  return out;
}
