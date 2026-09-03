/**
 * No credential anywhere in the tree, and no outside host named outside the
 * inert-reference allow list. Inherited files legitimately name hosts in
 * contracts, metadata and docs; that is fine as long as nothing executes a
 * request to them, which the worker and the runners enforce separately.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const allow = new Set(Object.keys(JSON.parse(fs.readFileSync("design/inert-hosts.json", "utf8")).hosts));
const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !/\.(png|woff2|ico|svg|jpg|lockb)$/.test(f) && !f.startsWith("qa/conformance/baseline") && f !== "package-lock.json");
const CREDENTIAL = [/PulseDemo/, /pulse-dev-password/, /password\s*[:=]\s*["'][^"'\n]{4,}["']/i, /(api|secret|private)[_-]?key\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/i, /PRIVATE-TOKEN:\s*[A-Za-z0-9_\-]{10,}/, /gho_[A-Za-z0-9]{20,}/, /glpat-[A-Za-z0-9_\-]{10,}/];
const ALLOWED_PATTERN_FILES = new Set(["tools/design/sync.mjs", "tools/design/credentials.mjs"]);
const problems = [];
const hostsSeen = new Map();
for (const f of files) {
  let text; try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (!ALLOWED_PATTERN_FILES.has(f)) for (const re of CREDENTIAL) { const m = text.match(re); if (m) problems.push(`${f}: credential-like text "${m[0].slice(0, 40)}"`); }
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?/gi)) {
    const host = m[1].toLowerCase();
    const ok = [...allow].some((a) => host === a || host.endsWith("." + a));
    if (!ok) hostsSeen.set(host, (hostsSeen.get(host) ?? []).concat(f));
  }
}
for (const [host, where] of hostsSeen) problems.push(`host ${host} not in design/inert-hosts.json (${[...new Set(where)].slice(0, 3).join(", ")})`);
for (const p of problems) console.log("FAIL " + p);
console.log(problems.length ? `credentials: ${problems.length} problem(s)` : `credentials: no credential in ${files.length} tracked files; every named host is registered as inert`);
process.exit(problems.length ? 1 : 0);
