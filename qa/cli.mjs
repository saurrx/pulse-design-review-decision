#!/usr/bin/env node
/**
 * qa — the test selector.
 *
 *   qa affected            areas touched by the current diff, and the tests for them
 *   qa run --tier security --area ideas
 *   qa checkpoint smoke
 *   qa exceptions          check the exception register is honest
 *   qa contract            check the shared contract has not drifted
 *
 * Why this exists rather than a tool: the three repos are SEPARATE git repos,
 * so nothing off the shelf does cross-repo impact analysis. Nx and Turbo
 * `affected` are one-workspace concepts; jest/vitest `--changed` walk a module
 * graph that stops at the repo edge. The mapping from "I changed this file" to
 * "run those tests over there" has to be declared, so it is declared in
 * qa/areas.json and resolved here.
 *
 * Depends on nothing. Node built-ins only, in all three repos.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = dirname(fileURLToPath(import.meta.url));
const ROOT = join(QA, '..');
const read = (f) => JSON.parse(readFileSync(join(QA, f), 'utf8'));

const contract = read('contract.json');
const areasMap = read('areas.json');
const ALL_AREAS = new Set(contract.areas.values);

/* ---------- glob matching (no dependency) ---------------------------------
 * Supports the two forms areas.json uses: `**` across directories and `*`
 * within a segment. Deliberately small — if a pattern needs more than this,
 * the pattern is too clever.
 */
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else if (c === '?') re += '[^/]';
    else re += c;
  }
  return new RegExp('^' + re + '$');
}
const compiled = Object.entries(areasMap.map).map(([g, areas]) => [globToRe(g), areas, g]);

function areasFor(files) {
  const hit = new Set(); const why = new Map(); const unmatched = [];
  for (const f of files) {
    let matched = false;
    for (const [re, areas, g] of compiled) {
      if (!re.test(f)) continue;
      matched = true;
      for (const a of areas) {
        if (a === '*') { for (const x of ALL_AREAS) hit.add(x); }
        else hit.add(a);
      }
      if (!why.has(g)) why.set(g, []);
      why.get(g).push(f);
    }
    if (!matched) unmatched.push(f);
  }
  return { areas: [...hit].sort(), why, unmatched };
}

function changedFiles(base) {
  const b = base || process.env.QA_BASE || 'origin/main';
  let mergeBase;
  try { mergeBase = execSync(`git merge-base ${b} HEAD`, { cwd: ROOT }).toString().trim(); }
  catch {
    console.error(`qa: no merge base with ${b}.`);
    console.error('    If this is CI, the clone is probably shallow — set GIT_DEPTH: 0.');
    process.exit(2);
  }
  const out = execSync(`git diff --name-only ${mergeBase}...HEAD`, { cwd: ROOT }).toString();
  const staged = execSync('git status --porcelain', { cwd: ROOT }).toString()
    .split('\n').filter(Boolean).map(l => l.slice(3).trim()).filter(Boolean);
  return [...new Set([...out.split('\n'), ...staged])].filter(Boolean);
}

/* ---------- exception register ------------------------------------------- */
function loadExceptions() {
  const p = join(QA, 'exceptions.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).exceptions ?? [] : [];
}

function checkExceptions() {
  const ex = loadExceptions();
  const today = new Date().toISOString().slice(0, 10);
  let bad = 0;
  if (!ex.length) { console.log('qa: no exceptions registered.'); return 0; }
  for (const e of ex) {
    const problems = [];
    if (!e.id) problems.push('no id');
    if (!e.reason) problems.push('no reason');
    if (!e.owner) problems.push('no owner');
    if (!e.expires) problems.push('no expiry');
    else if (e.expires < today) problems.push(`EXPIRED ${e.expires}`);
    if (problems.length) { bad++; console.log(`  FAIL ${e.id ?? '(unnamed)'} — ${problems.join(', ')}`); }
    else console.log(`  ok   ${e.id}  (expires ${e.expires}, ${e.owner})`);
  }
  // A suppression that has outlived its reason is itself a defect: it hides a
  // real failure and nobody is looking at it any more.
  if (bad) console.log(`\nqa: ${bad} exception(s) are expired or incomplete. Fix the underlying issue or renew deliberately.`);
  return bad ? 1 : 0;
}

/* ---------- contract drift ------------------------------------------------ */
function checkContract() {
  const expect = areasMap.contractSha256;
  const actual = execSync(`shasum -a 256 "${join(QA, 'contract.json')}"`).toString().split(' ')[0];
  if (!expect) { console.log(`qa: contract sha not pinned. Add "contractSha256": "${actual}" to areas.json.`); return 1; }
  if (expect !== actual) {
    console.log('qa: CONTRACT DRIFT.');
    console.log(`    expected ${expect}`);
    console.log(`    actual   ${actual}`);
    console.log('    qa/contract.json must be byte-identical across all three repos.');
    console.log('    If you changed it deliberately, copy it to the other two repos and update contractSha256 in each.');
    return 1;
  }
  console.log(`qa: contract ok (${actual.slice(0, 12)}…)`);
  return 0;
}

/* ---------- test discovery ------------------------------------------------ */
// Skipped wholesale. node_modules is the one that matters: patent-agent is a
// pnpm workspace, so every package links the others' node_modules back in and
// a naive walk finds ~1,300 "tests" belonging to zod.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage',
  '.turbo', '.next', 'playwright-report', 'test-results']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }   // broken symlink
    if (st.isDirectory()) walk(p, out);
    else if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(e) || /\.qa\.mjs$/.test(e)) out.push(p);
  }
  return out;
}

const TAG_RE = /@(area|role|tier|sec|soc2|gdpr|cp):([A-Za-z0-9_.\-]+)/g;
function tagsOf(file) {
  const txt = readFileSync(file, 'utf8');
  const tags = { area: [], role: [], tier: [], sec: [], soc2: [], gdpr: [], cp: [] };
  for (const m of txt.matchAll(TAG_RE)) tags[m[1]].push(m[2]);
  return tags;
}

function discover() {
  const roots = (areasMap.testRoots ?? ['src', 'qa']).map(r => join(ROOT, r));
  const files = roots.flatMap(r => walk(r));
  return files.map(f => ({ file: relative(ROOT, f), tags: tagsOf(f) }));
}

function select({ areas, tier, sec, cp }) {
  return discover().filter(t => {
    if (tier && !t.tags.tier.includes(tier)) return false;
    if (sec && !t.tags.sec.includes(sec)) return false;
    if (cp && !t.tags.cp.includes(cp)) return false;
    if (areas && areas.length) {
      // An untagged test is always run: absence of a tag must never mean
      // "skip", or a test silently stops being selected the day someone
      // forgets the annotation.
      if (!t.tags.area.length) return true;
      if (!t.tags.area.some(a => areas.includes(a))) return false;
    }
    return true;
  });
}

/* ---------- commands ------------------------------------------------------ */
const [, , cmd, ...rest] = process.argv;
const flag = (n, d) => { const i = rest.indexOf('--' + n); return i === -1 ? d : rest[i + 1]; };

if (cmd === 'affected') {
  const files = changedFiles(flag('base'));
  if (!files.length) { console.log('qa: no changes vs base.'); process.exit(0); }
  const { areas, why, unmatched } = areasFor(files);
  console.log(`qa: ${files.length} changed file(s)`);
  for (const [g, fs] of why) console.log(`  ${g}  ->  ${areasMap.map[g].join(', ')}   (${fs.length} file${fs.length > 1 ? 's' : ''})`);
  if (unmatched.length) {
    // Unmapped is loud on purpose: an unmapped path is a hole in the map, and
    // the safe reading of "I don't know what this affects" is "everything".
    console.log(`\nqa: ${unmatched.length} file(s) match no glob — treating as full run:`);
    unmatched.slice(0, 10).forEach(f => console.log(`    ${f}`));
    if (unmatched.length > 10) console.log(`    …and ${unmatched.length - 10} more`);
  }
  const eff = unmatched.length ? [...ALL_AREAS].sort() : areas;
  console.log(`\nareas: ${eff.join(' ') || '(none)'}`);
  const tests = select({ areas: eff });
  console.log(`tests: ${tests.length}`);
  tests.forEach(t => console.log(`  ${t.file}${t.tags.tier.length ? '  [' + t.tags.tier.join(',') + ']' : ''}`));
  if (rest.includes('--print-areas')) console.log('\nQA_AREAS=' + eff.join(','));
  process.exit(0);
}

if (cmd === 'run') {
  const areas = (flag('area') ?? '').split(',').filter(Boolean);
  const tests = select({ areas, tier: flag('tier'), sec: flag('sec'), cp: flag('cp') });
  console.log(`qa: ${tests.length} test file(s)`);
  tests.forEach(t => console.log('  ' + t.file));
  process.exit(0);
}

if (cmd === 'checkpoint') {
  const tests = select({ cp: rest[0] });
  console.log(`qa: checkpoint "${rest[0]}" -> ${tests.length} test file(s)`);
  tests.forEach(t => console.log('  ' + t.file));
  process.exit(0);
}

if (cmd === 'exceptions') process.exit(checkExceptions());
if (cmd === 'contract') process.exit(checkContract());

if (cmd === 'list') {
  const all = discover();
  console.log(`qa: ${all.length} tagged test file(s)`);
  for (const t of all) {
    const s = Object.entries(t.tags).filter(([, v]) => v.length)
      .map(([k, v]) => v.map(x => `@${k}:${x}`).join(' ')).join(' ');
    console.log(`  ${t.file}\n      ${s || '(untagged — always runs)'}`);
  }
  process.exit(0);
}

console.log(`qa — test selection across the three Pulse repos

  qa affected [--base origin/main] [--print-areas]
  qa run --tier <t> [--area a,b] [--sec s] [--cp c]
  qa checkpoint <smoke|pre-deploy|post-deploy|nightly>
  qa exceptions
  qa contract
  qa list

Tiers: ${Object.keys(contract.tiers.values).join(' ')}
Areas: ${contract.areas.values.join(' ')}`);
