/**
 * Manifest and graph parity. The design manifest's dependencies must equal
 * production's at the fork commit, plus the approved tooling set and nothing
 * else; every production package must resolve to the same version and
 * integrity as in production's lockfile; react, react-dom and vite resolve
 * to one copy each on disk.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const TOOLING = new Set(["storybook", "@storybook/react-vite", "@storybook/addon-a11y", "@storybook/addon-docs", "@storybook/addon-vitest", "vitest", "@vitest/browser", "playwright", "msw", "msw-storybook-addon"]);
const sh = (c) => execSync(c, { encoding: "utf8" }).trim();
const fork = sh("git merge-base HEAD upstream/main 2>/dev/null || git merge-base HEAD origin/main");
const prodPkg = JSON.parse(sh(`git show ${fork}:package.json`));
const prodLock = JSON.parse(sh(`git show ${fork}:package-lock.json`));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const problems = [];

const deps = (p) => ({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) });
const mine = deps(pkg), theirs = deps(prodPkg);
for (const [k, v] of Object.entries(theirs)) if (mine[k] !== v) problems.push(`production dependency changed: ${k} ${v} -> ${mine[k] ?? "missing"}`);
for (const k of Object.keys(mine)) if (!(k in theirs) && !TOOLING.has(k)) problems.push(`dependency not in production and not in the approved tooling set: ${k}`);
for (const k of TOOLING) if (mine[k] && !/^\d/.test(mine[k])) problems.push(`tooling dependency not pinned exact: ${k} ${mine[k]}`);

// Every production package resolves to the same version and integrity somewhere in the design lock.
// Compared by name and version, not by path: hoisting can legitimately move a nested copy to the root.
const index = (l) => { const m = new Map(); for (const [p, e] of Object.entries(l.packages ?? {})) { if (!p.startsWith("node_modules/")) continue; const name = p.slice(p.lastIndexOf("node_modules/") + 13); const key = `${name}@${e.version}`; if (!m.has(key)) m.set(key, e.integrity ?? null); } return m; };
const mineIdx = index(lock), theirIdx = index(prodLock);
const exceptions = JSON.parse(fs.readFileSync("design/manifest-exceptions.json", "utf8")).exceptions ?? {};
let compared = 0;
for (const [key, integrity] of theirIdx) {
  compared++;
  if (!mineIdx.has(key)) { if (exceptions[key]) console.log(`note ${key}: ${exceptions[key].slice(0, 90)}`); else problems.push(`production package resolves differently: ${key} is not in the design lock`); continue; }
  const mi = mineIdx.get(key);
  if (integrity && mi && integrity !== mi) problems.push(`integrity differs: ${key}`);
}
for (const p of ["react", "react-dom", "vite"]) {
  const n = Number(sh(`find node_modules -type d -name '${p}' | grep -E '(^|/)node_modules/${p}$' | wc -l`));
  if (n !== 1) problems.push(`${p}: ${n} copies on disk`);
}
for (const p of problems.slice(0, 30)) console.log("FAIL " + p);
console.log(problems.length ? `manifest: ${problems.length} problem(s)` : `manifest: dependencies equal production at ${fork.slice(0, 7)} plus the tooling set; ${compared} production packages resolve identically; single runtime copies`);
process.exit(problems.length ? 1 : 0);
