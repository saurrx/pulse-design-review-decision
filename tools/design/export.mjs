/**
 * Export a design record: the portable patch, the class report and a dry run
 * of the patch in a disposable worktree of production.
 *
 *   node tools/design/export.mjs DSN-0007 [--base upstream/main] [--no-dry-run]
 *
 * Rules (AGENTS.md, path classes): protected or off-limits changes refuse the
 * export; build-impact and behaviour-impact changes are flagged for approval;
 * review-support changes never enter the patch; the branch must reference at
 * least one story. The dry run applies the patch three-way in a temporary
 * worktree at the record's production base and at the latest upstream head and
 * runs production's own gates there, then removes the worktree.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { classify, PATCH_CLASSES } from "./paths.mjs";

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const id = process.argv[2];
if (!id || !/^DSN-\d{4}$/.test(id)) { console.error("usage: node tools/design/export.mjs DSN-0007"); process.exit(2); }
const args = process.argv.slice(3);
// The branch is diffed against the DESIGN main (production plus tooling); the dry run targets the
// production commit that design main was last synced to, and the latest upstream head.
const baseRef = args.includes("--base") ? args[args.indexOf("--base") + 1] : "main";
const dir = path.resolve("changes", id);
fs.mkdirSync(dir, { recursive: true });

sh("git fetch -q upstream");
const mergeBase = sh(`git merge-base HEAD ${baseRef}`);
const head = sh("git rev-parse HEAD");
const upstreamHead = sh("git rev-parse upstream/main");
const productionBase = sh(`git merge-base ${baseRef} upstream/main`);
const changed = sh(`git diff --name-only ${mergeBase} HEAD`).split("\n").filter(Boolean);
const byClass = {};
for (const f of changed) (byClass[classify(f)] ??= []).push(f);

const report = { id, designBase: mergeBase, productionBase, head, upstreamHead, classes: byClass, flags: [], refused: [] };
if (byClass.offLimits?.length) report.refused.push(`off-limits files changed: ${byClass.offLimits.join(", ")}`);
if (byClass.protected?.length) report.refused.push(`protected infrastructure changed: ${byClass.protected.join(", ")}`);
if (byClass.unclassified?.length) report.refused.push(`unclassified paths, add them to tools/design/paths.mjs: ${byClass.unclassified.join(", ")}`);
if (byClass.buildImpact?.length) report.flags.push("build-impact approval required");
if (byClass.behaviourImpact?.length) report.flags.push("behaviour-impact approval required");
const patchFiles = changed.filter((f) => PATCH_CLASSES.has(classify(f)));
if (!patchFiles.length) report.refused.push("no portable change on this branch");

// Story coverage: every changed portable component must be imported, directly or transitively, by a referenced story.
const stories = sh("git ls-files design/stories").split("\n").filter(Boolean);
const importsOf = (file) => { try { return [...fs.readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]); } catch { return []; } };
const resolveImport = (from, spec) => {
  let p = spec.startsWith("@/") ? path.join("src", spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
  if (!p) return null;
  for (const c of [p, p + ".tsx", p + ".ts", path.join(p, "index.tsx"), path.join(p, "index.ts")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c.split(path.sep).join("/");
  return null;
};
const reach = new Map();
const walk = (file, seen = new Set()) => { if (seen.has(file)) return seen; seen.add(file); for (const s of importsOf(file)) { const r = resolveImport(file, s); if (r && r.startsWith("src/")) walk(r, seen); } return seen; };
for (const s of stories) reach.set(s, walk(s));
const uncovered = patchFiles.filter((f) => /\.(tsx?|jsx?)$/.test(f) && f.startsWith("src/") && ![...reach.values()].some((set) => set.has(f)));
if (uncovered.length) report.refused.push(`changed components covered by no story: ${uncovered.join(", ")}`);
report.coveredBy = Object.fromEntries(patchFiles.filter((f) => f.startsWith("src/")).map((f) => [f, stories.filter((s) => reach.get(s)?.has(f))]));

fs.writeFileSync(path.join(dir, "classes.json"), JSON.stringify(report, null, 2) + "\n");
if (report.refused.length) { console.error("export refused:\n - " + report.refused.join("\n - ")); process.exit(1); }

// The patch: portable paths only, squashed, three-way capable (full index lines).
const patch = sh(`git diff --full-index --binary ${mergeBase} HEAD -- ${patchFiles.map((f) => `'${f}'`).join(" ")}`);
fs.writeFileSync(path.join(dir, `${id.toLowerCase()}.patch`), patch + "\n");
console.log(`patch: ${patchFiles.length} file(s), classes ${Object.entries(byClass).map(([k, v]) => `${k}=${v.length}`).join(" ")}${report.flags.length ? ", flags: " + report.flags.join("; ") : ""}`);

// Dry run in a disposable production worktree at the merge base and at the latest upstream head.
if (!args.includes("--no-dry-run")) {
  const results = [];
  for (const [label, ref] of [["recorded production base", productionBase], ["latest upstream head", upstreamHead]]) {
    const wt = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "pulse-dryrun-"));
    try {
      sh(`git worktree add -q --detach ${wt} ${ref}`);
      const apply = spawnSync("git", ["apply", "--3way", "--index", path.join(dir, `${id.toLowerCase()}.patch`)], { cwd: wt, encoding: "utf8" });
      let gates = "skipped";
      if (apply.status === 0) {
        fs.symlinkSync(path.resolve("node_modules"), path.join(wt, "node_modules"));
        const run = (c) => spawnSync("npm", ["run", c], { cwd: wt, encoding: "utf8" }).status === 0;
        gates = ["typecheck", "lint:roles", "build"].map((c) => `${c}=${run(c) ? "ok" : "FAIL"}`).join(" ");
      }
      results.push({ label, ref: ref.slice(0, 7), applied: apply.status === 0, conflicts: apply.status === 0 ? "" : (apply.stderr || "").split("\n").filter((l) => /conflict|error/i.test(l)).slice(0, 5).join(" | "), gates });
    } finally {
      spawnSync("git", ["worktree", "remove", "--force", wt], { encoding: "utf8" });
    }
  }
  fs.writeFileSync(path.join(dir, "drift.txt"), results.map((r) => `${r.label} ${r.ref}: ${r.applied ? "applied" : "DID NOT APPLY " + r.conflicts}; gates ${r.gates}`).join("\n") + "\n");
  for (const r of results) console.log(`dry run at ${r.label} ${r.ref}: ${r.applied ? "applied" : "DID NOT APPLY"}; gates ${r.gates}`);
  if (results.some((r) => !r.applied || /FAIL/.test(r.gates))) process.exit(1);
}
console.log(`record folder: changes/${id}`);
