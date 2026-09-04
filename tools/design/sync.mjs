/**
 * Sync the design main from production. The script, not a merge attribute, is
 * the control for the instruction files:
 *   1. save the design-owned instruction files;
 *   2. merge upstream/main;
 *   3. restore the design-owned versions;
 *   4. sanitise and copy production's instructions into contract/;
 *   5. fail if the design CLAUDE.md preamble changed;
 *   6. record the upstream instruction diff in the sync commit.
 * The manifest and lockfile are reconciled, never regenerated: production's
 * manifest changes come in through the merge and the lock is refreshed with a
 * lock-only install; tools/design/gates.mjs compares the resolved graph.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const OWNED = ["CLAUDE.md", "AGENTS.md", ".claude/rules/design.md", ".claude/rules/protected.md", ".claude/rules/product-context.md", "CODEOWNERS", ".gitattributes", ".gitignore", ".gitlab-ci.yml", ".storybook/main.ts", ".storybook/manager.ts", ".storybook/preview.tsx", "vitest.config.ts", "vercel.json"];
const DESIGN_SCRIPTS = ["dev:design", "build:design", "preview:design", "storybook:build", "test:stories", "test:fidelity", "test:v0"];
const DESIGN_DEV_DEPS = ["@storybook/addon-docs", "msw", "msw-storybook-addon"];
const args = process.argv.slice(2);
const upstream = args.find((a) => !a.startsWith("--")) ?? "upstream/main";
const dryRun = args.includes("--dry-run");

const preambleOf = (text) => { const m = text.match(/<!-- preamble:start[^>]*-->([\s\S]*?)<!-- preamble:end -->/); return m ? m[1].trim() : null; };
const sanitise = (text) => text.split("\n").map((l) => (/password|passwd|PulseDemo|@acme\.test|@globex\.test|owner\/cover\/admin\/founder|demo accounts?:?/i.test(l) ? "[line removed by the design-repo sync: operational credential or account reference]" : l)).join("\n");

if (sh("git status --porcelain --untracked-files=no")) { console.error("working tree has uncommitted changes"); process.exit(2); }
try { sh(`git fetch -q ${upstream.split("/")[0]}`); } catch { /* a local ref, nothing to fetch */ }
const before = sh("git rev-parse HEAD"); const target = sh(`git rev-parse ${upstream}`);
if (sh(`git merge-base --is-ancestor ${target} HEAD; echo $?`) === "0") { console.log("already up to date with " + upstream); process.exit(0); }

const saved = Object.fromEntries(OWNED.filter((f) => fs.existsSync(f)).map((f) => [f, fs.readFileSync(f, "utf8")]));
const savedPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const preamble = preambleOf(saved["CLAUDE.md"] ?? "");
const previousCopy = fs.existsSync("contract/production-CLAUDE.md") ? fs.readFileSync("contract/production-CLAUDE.md", "utf8") : "";

const merge = spawnSync("git", ["merge", "--no-commit", "--no-ff", "-X", "theirs", target], { encoding: "utf8" });
// Owned files always come back as ours, whatever the merge did.
for (const [f, text] of Object.entries(saved)) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); sh(`git add -- '${f}'`); }

// package.json is production-owned with a small, explicit design augmentation.
// Reapply only those entries after the merge so upstream removals and upgrades
// still arrive while the design commands and mock tooling cannot disappear.
const mergedPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
mergedPackage.scripts ??= {};
mergedPackage.devDependencies ??= {};
if (savedPackage.engines) mergedPackage.engines = savedPackage.engines;
for (const key of DESIGN_SCRIPTS) if (savedPackage.scripts?.[key]) mergedPackage.scripts[key] = savedPackage.scripts[key];
for (const key of DESIGN_DEV_DEPS) if (savedPackage.devDependencies?.[key]) mergedPackage.devDependencies[key] = savedPackage.devDependencies[key];
fs.writeFileSync("package.json", JSON.stringify(mergedPackage, null, 2) + "\n");
sh("git add package.json");
const remaining = sh("git diff --name-only --diff-filter=U");
if (remaining) { console.error("conflicts left for a human:\n" + remaining); process.exit(1); }

// Production instructions, sanitised, into contract/, with the diff recorded.
const prodClaude = sanitise(sh(`git show ${target}:CLAUDE.md`));
fs.writeFileSync("contract/production-CLAUDE.md", prodClaude);
sh("git add contract/production-CLAUDE.md");
const changedRule = previousCopy !== prodClaude;
// A line-level change report, dependency-free: lines only in the new copy (+) and lines only in the old (-).
const lineDiff = (a, b) => { const A = a.split("\n"), B = b.split("\n"); const inA = new Set(A), inB = new Set(B); return [...B.filter((l) => !inA.has(l) && l.trim()).map((l) => "+ " + l), ...A.filter((l) => !inB.has(l) && l.trim()).map((l) => "- " + l)].slice(0, 200).join("\n"); };
const ruleDiff = changedRule ? lineDiff(previousCopy, prodClaude) : "";

if (preambleOf(fs.readFileSync("CLAUDE.md", "utf8")) !== preamble || !preamble) { console.error("design CLAUDE.md preamble changed or missing; refusing"); process.exit(1); }

// Manifest reconcile: production's package.json changes came through the merge; refresh the lock without touching the resolved tree.
if (sh(`git diff --name-only ${before} ${target} -- package.json`)) {
  const lock = spawnSync("npm", ["install", "--package-lock-only", "--no-audit", "--no-fund"], { encoding: "utf8" });
  if (lock.status !== 0) { console.error("lock-only install failed:\n" + lock.stderr); process.exit(1); }
  sh("git add package.json package-lock.json");
}

const summary = `Sync from ${upstream} ${target.slice(0, 7)}\n\n${sh(`git log --oneline ${before}..${target} | head -40`)}\n\nProduction instruction file: ${changedRule ? "CHANGED, read the diff below" : "unchanged"}\n${ruleDiff}\n`;
if (dryRun) { console.log(summary); sh("git merge --abort"); console.log("dry run: merge aborted"); process.exit(0); }
fs.writeFileSync(".git/SYNC_MSG", summary);
sh("git commit -q -F .git/SYNC_MSG");
console.log(summary.split("\n").slice(0, 6).join("\n"));
console.log(`synced: ${before.slice(0, 7)} -> ${sh("git rev-parse --short HEAD")}`);
