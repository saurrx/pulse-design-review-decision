/**
 * The adapter's translation tables must agree with the screens' vocabulary.
 * @tier:contract @area:patents @cp:pre-deploy
 *
 *   node qa/contract/status-parity.qa.mjs
 *
 * The plan called for this in as many words: "assert both sides of each
 * translation table hold the same enum set — that is the NONPAYMENT-shaped bug,
 * mechanically." It is named after a real one. PSTATUS_TO_LEGAL had no entry
 * for NONPAYMENT, and the lookup is `PSTATUS_TO_LEGAL[s] ?? s`, so 487
 * production patents arrived carrying the raw API value. It is not in
 * PATENT_LEGAL_STATUS_VALUES, so those patents had no label, no chip colour,
 * and could not be selected in the status filter — and nothing failed, because
 * a `?? s` fallback always produces a string.
 *
 * Checked WITHIN this repo rather than against pulse-backend's schema: the
 * frontend CI checkout has no sibling repo, and a check that cannot run is not
 * a check. The screens' own vocabulary is the reference, which is enough — it
 * already contained INACTIVE_NONPAYMENT, waiting.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/** Read an object literal's key/value string pairs out of the source. */
function readMap(file, name) {
  const text = readFileSync(join(SRC, file), 'utf8');
  const m = text.match(new RegExp(`${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!m) throw new Error(`${name} not found in ${file} — the parser is blind, fix it`);
  return Object.fromEntries([...m[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)].map(x => [x[1], x[2]]));
}

/** Read a string-array literal. */
function readList(file, name) {
  const text = readFileSync(join(SRC, file), 'utf8');
  const m = text.match(new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`${name} not found in ${file} — the parser is blind, fix it`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
}

const pstatusToLegal = readMap('lib/realAdapter.ts', 'PSTATUS_TO_LEGAL');
const screenValues = readList('utils/patentLegalStatus.ts', 'PATENT_LEGAL_STATUS_VALUES');

const problems = [];

// Guard the parser itself: silently reading an empty map would pass forever.
if (Object.keys(pstatusToLegal).length < 5) problems.push(`only parsed ${Object.keys(pstatusToLegal).length} adapter entries`);
if (screenValues.length < 5) problems.push(`only parsed ${screenValues.length} screen values`);

const produced = new Set(Object.values(pstatusToLegal));
for (const v of screenValues) {
  if (!produced.has(v)) {
    problems.push(`the screens know "${v}" but no API status maps to it — patents in that state arrive raw, unlabelled and unfilterable`);
  }
}
for (const [api, legal] of Object.entries(pstatusToLegal)) {
  if (!screenValues.includes(legal)) {
    problems.push(`PSTATUS_TO_LEGAL maps ${api} -> "${legal}", which the screens do not know`);
  }
}

console.log(`${Object.keys(pstatusToLegal).length} API statuses -> ${produced.size} screen values · ${screenValues.length} known to the screens`);
if (problems.length) {
  console.log(`\n${problems.length} parity problem(s):`);
  problems.forEach(p => console.log('  ' + p));
  process.exit(1);
}
console.log('\nboth sides of the patent-status table agree');
