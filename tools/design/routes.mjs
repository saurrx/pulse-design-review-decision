/**
 * The mock-route guard, statically: every `route("method", "/v1/...")` in
 * mock/handlers must exist in the pinned backend route map or be declared in
 * mock/proposed-routes.json; and every route the frontend can reach (from
 * qa/map/frontend.json plus the direct callers) must be served by a handler.
 */
import fs from "node:fs";
import path from "node:path";

const canon = (p) => p.replace(/:(\w+)/g, "{id}").replace(/\{[a-zA-Z]+\}/g, "{id}");
const key = (m, p) => `${m.toUpperCase()} ${canon(p)}`;
const backend = JSON.parse(fs.readFileSync("contract/backend.json", "utf8"));
const proposed = JSON.parse(fs.readFileSync("mock/proposed-routes.json", "utf8"));
const known = new Set(backend.routes.map((r) => key(r.method, r.path)));
const declared = new Map(proposed.map((r) => [key(r.method, r.path), r.reason]));

const served = new Map();
for (const f of fs.readdirSync("mock/handlers").filter((f) => f.endsWith(".ts"))) {
  const src = fs.readFileSync(path.join("mock/handlers", f), "utf8");
  for (const m of src.matchAll(/route\(\s*"(get|post|put|patch|delete)"\s*,\s*"([^"]+)"/g)) served.set(key(m[1], m[2]), `${f}`);
}
const unknown = [...served.keys()].filter((k) => !known.has(k) && !declared.has(k));
const proposedHits = [...served.keys()].filter((k) => declared.has(k));

// Reachable routes: the static map's v1 targets with the adapter's translated verbs, plus the direct callers the map cannot see.
const fe = JSON.parse(fs.readFileSync("qa/map/frontend.json", "utf8"));
const verbFor = (oldMethod, v1) => {
  // The adapter rewrites some verbs; mirror the known translations (see src/lib/realAdapter.ts).
  if (/\/drafts\/\{id\}\/evaluate$/.test(v1)) return "POST";
  if (/\/actions\/\{id\}\/request-status$/.test(v1)) return "PATCH";
  if (/\/clients\/\{id\}$/.test(v1) && oldMethod === "DELETE") return "PATCH";
  if (/\/clients\/\{id\}$/.test(v1) && oldMethod === "PUT") return "PATCH";
  if (/\/(ideas|patents|users|drafts)\/\{id\}$/.test(v1) && (oldMethod === "PUT" || oldMethod === "POST")) return "PATCH";
  if (/\/due-dates\/\{id\}$/.test(v1)) return "PATCH";
  if (/\/patents$/.test(v1) && oldMethod === "POST") return "GET"; // the shadowed rule: Add patent is sent as a GET
  return oldMethod;
};
const reachable = new Set();
for (const r of fe.routes) for (const c of r.calls ?? []) for (const v of c.v1 ?? []) reachable.add(`${verbFor(c.method.toUpperCase(), v)} ${canon(v)}`);
for (const k of ["POST /v1/files/presign-upload", "PUT /v1/files/{id}/content", "GET /v1/files/{id}/download", "GET /v1/files/{id}/raw", "POST /v1/auth/refresh", "DELETE /v1/ideas/{id}", "DELETE /v1/drafts/{id}", "DELETE /v1/invites/{id}", "DELETE /v1/files/{id}", "DELETE /v1/users/{id}", "POST /v1/ideas/{id}/inventors/{id}", "DELETE /v1/ideas/inventor-credits/{id}"]) reachable.add(k);
const unserved = [...reachable].filter((k) => known.has(k) && !served.has(k));

console.log(`handlers: ${served.size} served, ${known.size} in the backend map, ${reachable.size} reachable by the frontend`);
for (const k of unknown) console.log(`UNKNOWN  ${k}  (${served.get(k)}) not in contract/backend.json and not declared in mock/proposed-routes.json`);
for (const k of proposedHits) console.log(`PROPOSED ${k}: ${declared.get(k)}`);
for (const k of unserved) console.log(`UNSERVED ${k}: the frontend can reach it and no handler answers`);
const bad = unknown.length + unserved.length;
console.log(bad ? `routes: ${bad} problem(s)` : "routes: every handler is a real route and every reachable route is served");
process.exit(bad ? 1 : 0);
