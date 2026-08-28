#!/usr/bin/env node
/**
 * Fails the build on substring matching against a role name.
 *
 * This exists because of a real regression. Renaming IHC_ADMIN to LEGAL_COUNSEL
 * and OC_ADMIN to PHOTON_ADMIN silently broke four checks of the form
 * `role.includes("IHC")` — "LEGAL_COUNSEL" contains no "IHC", so each one
 * quietly became false forever. The compiler could not see it (the code is
 * valid), and the visual harness could not see it (those branches need specific
 * data to render). Only reading the code found it.
 *
 * Compare roles for equality against a constant instead.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BAD = /\brole\s*\??\.?\s*(?:\?\.)?(includes|startsWith|endsWith|indexOf|match)\s*\(/;
const ROOT = 'src';
const findings = [];

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.tsx?$/.test(p)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      // A role that is legitimately a LIST may use includes(); the smell is
      // calling it ON the role itself.
      if (BAD.test(line)) findings.push(`${p}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
}
walk(ROOT);

if (findings.length) {
  console.error('Substring matching on a role name — compare to a constant instead:\n');
  findings.forEach(f => console.error('  ' + f));
  console.error('\nRenaming a role silently breaks these. See tools/no-substring-roles.mjs\n');
  process.exit(1);
}
console.log(`ok    no substring role checks in ${ROOT}`);
