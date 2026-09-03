/**
 * The design fork's gate runner. Runs every check the spike exit criteria name,
 * in order, and prints a checklist. Exit 1 if any required gate fails; the
 * isolation probe is informational and reports whether parallel story tests
 * would be safe.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const results = [];
// --only <substring> (repeatable) runs the matching gates and skips the rest; the inline checks at the end always run.
const only = process.argv.slice(2).flatMap((a, i, all) => (a === "--only" && all[i + 1] ? [all[i + 1].toLowerCase()] : []));
const run = (name, cmd, args, opts = {}) => {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o))) { console.log(`skip ${name}`); return true; }
  const started = Date.now();
  const { informational, ...spawnOpts } = opts;
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...spawnOpts, env: { ...process.env, CI: "1", ...(opts.env ?? {}) } });
  const ok = r.status === 0;
  let tail = (r.stdout + r.stderr).trim().split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 160);
  if (!ok) {
    // The two-line tail hides a crash; keep the whole output where a human can read it.
    const logDir = path.join("node_modules", ".cache", "gates");
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, name.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60) + ".log");
    fs.writeFileSync(logFile, `$ ${cmd} ${args.join(" ")}\nexit ${r.status} signal ${r.signal}\n\n${r.stdout}\n${r.stderr}`);
    tail += ` | full output: ${logFile}`;
  }
  results.push({ name, ok, informational: !!opts.informational, secs: ((Date.now() - started) / 1000).toFixed(0), tail });
  console.log(`${ok ? "ok  " : opts.informational ? "info" : "FAIL"} ${name} (${results.at(-1).secs}s) ${ok ? "" : tail}`);
  return ok;
};

run("typecheck", "npm", ["run", "typecheck"]);
run("lint:roles", "npm", ["run", "lint:roles"]);
run("routes: every handler is real, every reachable route served", "node", ["tools/design/routes.mjs"]);
run("credentials and inert hosts", "node", ["tools/design/credentials.mjs"]);
run("manifest and graph parity", "node", ["tools/design/manifest.mjs"]);
run("fingerprint self-test (bites)", "node", ["tools/design/fingerprint.mjs", "--self-test"]);
run("tokens: generated outputs match src/styles/tokens.json", "node", ["tools/tokens.mjs", "--check"]);
run("fidelity: adapter boundary, OpenAPI bodies, state machine", "npm", ["run", "test:fidelity"]);
run("v0 semantic gate (four personas, one stage, coverage, exclusions, optional evaluation, badges, declared contracts)", "npm", ["run", "test:v0"]);
run("v0 coverage matrix rendered and current", "node", ["tools/design/v0-coverage.mjs"]);
run("build:design", "npm", ["run", "build:design"]);
run("storybook:build", "npm", ["run", "storybook:build"]);
run("test:stories (interaction, serial)", "npm", ["run", "test:stories"]);
run("shots (stable across two clean renders, no egress, matches baselines)", "node", ["tools/design/shots.mjs", "--twice"]);
run("a11y ratchet (no new fingerprints, zero in redesigned content)", "node", ["tools/design/a11y.mjs"]);
run("isolation probe (parallel stories safe?)", "node", ["tools/design/isolation.mjs"], { informational: true });

// The full app on the preview server: login, dashboard, review queue, a decision, persona switch, no egress.
const preview = spawnSync("sh", ["-c", "npx vite preview --config vite.design.config.ts --port 3700 --strictPort > /dev/null 2>&1 & echo $!"], { encoding: "utf8" });
const pid = Number(preview.stdout.trim());
spawnSync("sleep", ["3"]);
run("smoke (full app on mock)", "node", ["tools/design/smoke.mjs"]);
run("crawl (every persona, every page and detail route)", "node", ["tools/design/crawl.mjs"]);
const qaEnv = { ...process.env, QA_MOCK: "1", QA_BASE: "http://localhost:3700" };
run("qa invariant: desktop gate", "node", ["qa/invariant/desktop-gate.qa.mjs"], { env: qaEnv });
run("qa invariant: layout rules, 6 roles x 2 viewports", "node", ["qa/invariant/layout.qa.mjs", "--base", "http://localhost:3700"], { env: qaEnv });
run("qa invariant: no visible uuid", "node", ["qa/invariant/no-visible-uuid.qa.mjs", "--base", "http://localhost:3700"], { env: qaEnv });
run("qa conformance: structure against baseline-mock", "node", ["qa/conformance/structure.qa.mjs", "--base", "http://localhost:3700"], { env: qaEnv });
if (pid) process.kill(pid);

// Lockfile: a clean install reproduces the tree; one copy of react, react-dom and vite.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-lock-"));
fs.copyFileSync("package.json", path.join(tmp, "package.json")); fs.copyFileSync("package-lock.json", path.join(tmp, "package-lock.json"));
run("lockfile reproduces with npm ci", "npm", ["ci", "--no-audit", "--no-fund", "--ignore-scripts"], { cwd: tmp });
fs.rmSync(tmp, { recursive: true, force: true });
const copies = (p) => spawnSync("sh", ["-c", `find node_modules -type d -name '${p}' | grep -E '(^|/)node_modules/${p}$' | wc -l`], { encoding: "utf8" }).stdout.trim();
const single = ["react", "react-dom", "vite"].map((p) => [p, copies(p)]);
results.push({ name: "single runtime copies", ok: single.every(([, n]) => n === "1"), secs: "0", tail: single.map(([p, n]) => `${p}=${n}`).join(" ") });
console.log(`${results.at(-1).ok ? "ok  " : "FAIL"} single runtime copies ${results.at(-1).tail}`);

// Path classes: the exporter's rule table classifies the paths it must.
const cls = spawnSync("node", ["-e", `import("./tools/design/paths.mjs").then(m=>{const t={"src/components/x.tsx":"portable","src/lib/realAdapter.ts":"offLimits","mock/runtime/db.ts":"protected","mock/handlers/a.ts":"reviewSupport","design/stories/a.stories.tsx":"reviewSupport","qa/visual/baselines/a.png":"reviewSupport","index.html":"buildImpact","src/lib/roles.ts":"behaviourImpact","package.json":"protected"};const bad=Object.entries(t).filter(([f,c])=>m.classify(f)!==c);if(bad.length){console.error(bad);process.exit(1)}})`], { encoding: "utf8" });
results.push({ name: "path classes", ok: cls.status === 0, secs: "0", tail: cls.stderr.slice(0, 120) });
console.log(`${cls.status === 0 ? "ok  " : "FAIL"} path classes`);

const failed = results.filter((r) => !r.ok && !r.informational);
console.log(`\ngates: ${results.length - failed.length}/${results.length} passed${failed.length ? ", failed: " + failed.map((f) => f.name).join(", ") : ""}`);
process.exit(failed.length ? 1 : 0);
