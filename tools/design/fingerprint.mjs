/**
 * The behavioural fingerprint. Path classes cannot see inside a file, and
 * Pulse keeps real behaviour inside its screens. For a file, extract the
 * literals that carry behaviour: API method and path literals (ternary arms
 * included, the way qa/map/generate.mjs reads them), request body keys,
 * query and mutation keys, navigation destinations, role and status literals,
 * cookie and storage keys, exported component props, and conditionals that
 * depend on a role or a capability. Compare two revisions; a difference
 * escalates a record to behaviour-impact approval, it never fails by itself.
 *
 *   node tools/design/fingerprint.mjs <base> <head> [files...]   # diff
 *   node tools/design/fingerprint.mjs --self-test                # prove it bites
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const ENUMS = JSON.parse(fs.readFileSync("contract/backend.json", "utf8")).enums;
const VOCAB = new Set(Object.values(ENUMS).flat().concat(["INVENTOR", "TECH_COMMITTEE", "LEGAL_COUNSEL", "CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN", "IN_DRAFT", "UNDER_REVIEW", "SENT_TO_IHC", "UPDATE_REQUEST", "REJECT_BY_IHC", "REJECT_BY_OC", "SEND_TO_OC", "ACTIVE_GRANTED", "ACTIVE_APPLIED", "ACTIVE_EXAMINATION", "INACTIVE_EXPIRED", "INACTIVE_WITHDRAWN", "INACTIVE_REJECTED", "INACTIVE_ABANDONED", "INACTIVE_NONPAYMENT"]));

export function fingerprint(src) {
  const f = { api: new Set(), bodyKeys: new Set(), queryKeys: new Set(), navigation: new Set(), vocabulary: new Set(), storage: new Set(), props: new Set(), permission: new Set() };
  // API calls: API_CONFIG.<verb>( ... ) with every string literal in the argument list, and rawApi/axios/fetch.
  for (const m of src.matchAll(/\b(?:API_CONFIG|rawApi|axios|real)\.(get|post|put|patch|delete)\s*\(([\s\S]*?)\)\s*[;,)]/g)) {
    const verb = m[1].toUpperCase();
    for (const lit of m[2].matchAll(/["'`]([^"'`]*\/(?:api\/)?v1\/[^"'`]*)["'`]/g)) f.api.add(`${verb} ${lit[1].replace(/\$\{[^}]+\}/g, "{x}")}`);
    // Body keys: object literal keys in the second argument.
    const body = m[2].split(",").slice(1).join(",");
    for (const k of body.matchAll(/[{,]\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) f.bodyKeys.add(k[1]);
  }
  for (const m of src.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)) f.api.add(`FETCH ${m[1]}`);
  for (const m of src.matchAll(/queryKey:\s*\[([^\]]*)\]/g)) f.queryKeys.add(m[1].replace(/\s+/g, ""));
  for (const m of src.matchAll(/invalidateQueries\(\s*\{\s*queryKey:\s*\[([^\]]*)\]/g)) f.queryKeys.add("invalidate:" + m[1].replace(/\s+/g, ""));
  for (const m of src.matchAll(/\bnavigate\(\s*["'`]([^"'`]+)["'`]/g)) f.navigation.add(m[1]);
  for (const m of src.matchAll(/\bto=\{?["'`]([^"'`]+)["'`]/g)) f.navigation.add(m[1]);
  for (const m of src.matchAll(/window\.location\.(?:assign|replace)\(\s*["'`]([^"'`]+)["'`]/g)) f.navigation.add(m[1]);
  for (const m of src.matchAll(/window\.location\.href\s*=\s*["'`]([^"'`]+)["'`]/g)) f.navigation.add(m[1]);
  for (const m of src.matchAll(/["'`]([A-Z][A-Z_]{3,})["'`]/g)) if (VOCAB.has(m[1])) f.vocabulary.add(m[1]);
  for (const m of src.matchAll(/\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g)) f.storage.add(m[1]);
  for (const m of src.matchAll(/Cookies\.(?:get|set|remove)\(\s*["'`]([^"'`]+)["'`]/g)) f.storage.add("cookie:" + m[1]);
  for (const m of src.matchAll(/(?:export\s+)?(?:interface|type)\s+(\w*Props)\s*=?\s*\{([\s\S]*?)\n\}/g)) for (const k of m[2].matchAll(/^\s*(\w+)\??:/gm)) f.props.add(`${m[1]}.${k[1]}`);
  for (const line of src.split("\n")) if (/\b(role\s*===|role\s*!==|\.role\b.*(===|!==|includes)|isOutsideCounselRole\(|isOCAdminRole\(|canReadDocket\(|assigned_client_ids|PHOTON_ROLES|CLIENT_ROLES)/.test(line)) f.permission.add(line.trim().replace(/\s+/g, " ").slice(0, 120));
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, [...v].sort()]));
}

export function diffFingerprints(a, b) {
  const out = {};
  for (const k of Object.keys(b)) {
    const A = new Set(a[k] ?? []), B = new Set(b[k] ?? []);
    const added = [...B].filter((x) => !A.has(x)), removed = [...A].filter((x) => !B.has(x));
    if (added.length || removed.length) out[k] = { added, removed };
  }
  return out;
}

const show = (rev, file) => { try { return execSync(`git show ${rev}:${file}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };

export function fingerprintChanges(base, head, files) {
  const report = {};
  for (const f of files) {
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    const d = diffFingerprints(fingerprint(show(base, f)), fingerprint(show(head, f)));
    if (Object.keys(d).length) report[f] = d;
  }
  return report;
}

if (process.argv[1] && process.argv[1].endsWith("fingerprint.mjs")) {
  if (process.argv.includes("--self-test")) {
    const before = `const go = () => navigate("/ideas"); const q = useQuery({ queryKey: ["ideas", id] }); if (role === "INVENTOR") x(); API_CONFIG.post("/api/v1/idea/create", { title, body });`;
    const after = `const go = () => navigate("/patents"); const q = useQuery({ queryKey: ["ideas", id] }); if (role === "INVENTOR") x(); API_CONFIG.post("/api/v1/idea/create", { title, body, priority: true });`;
    const d = diffFingerprints(fingerprint(before), fingerprint(after));
    const ok = d.navigation?.added?.includes("/patents") && d.bodyKeys?.added?.includes("priority");
    console.log(ok ? "fingerprint: bites (a planted navigation change and a new body key were detected)" : "fingerprint: FAILED to detect a planted change " + JSON.stringify(d));
    process.exit(ok ? 0 : 1);
  }
  const [base, head, ...files] = process.argv.slice(2);
  const list = files.length ? files : execSync(`git diff --name-only ${base} ${head}`, { encoding: "utf8" }).split("\n").filter(Boolean);
  const r = fingerprintChanges(base, head, list);
  console.log(Object.keys(r).length ? JSON.stringify(r, null, 2) : "no behavioural fingerprint changes");
}
