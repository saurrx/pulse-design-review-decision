import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { uuid, mulberry32, seedFrom } from "../runtime/prng";
import { currentUser } from "./scope";
import { allPatents, scopeFor } from "../runtime/store";
import type { Client, User } from "../runtime/types";

const counts = (c: Client) => { const db = getDb(); return { patents: allPatents([c.id]).length, ideas: db.ideas.filter((i) => i.client_id === c.id).length, users: db.users.filter((u) => u.client_id === c.id && u.status !== "SUSPENDED").length }; };
const member = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, last_login_at: u.last_login_at, created_at: u.created_at });
const view = (c: Client, withUsers = true) => ({ ...c, logo_file: c.logo_file_id ? { id: c.logo_file_id } : null, users: withUsers ? getDb().users.filter((u) => u.client_id === c.id).map(member) : [], _count: counts(c) });
const photon = (u: User | null) => !!u && ["CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN"].includes(u.role);

export const clientHandlers = [
  route("get", "/v1/clients", () => {
    const db = getDb(); const u = currentUser();
    const scope = scopeFor(u);
    return db.clients.filter((c) => (scope === null || scope.includes(c.id)) && (photon(u) || c.is_active)).map((c) => view(c));
  }),
  route("post", "/v1/clients", async ({ body }) => {
    const b = (await body()) as { name?: string; domain?: string; admin_emails?: string[]; has_tech_committee?: boolean };
    const db = getDb(); const u = currentUser();
    if (!u || !["PHOTON_ADMIN", "PHOTON_SUPERADMIN"].includes(u.role)) return { status: 403, body: { message: "Only a Photon admin can onboard a client." } };
    if (!b.name?.trim()) return { status: 400, body: { message: "A name is required." } };
    if (b.domain && db.clients.some((c) => c.domain === b.domain)) return { status: 409, body: { message: "A client with this domain already exists." } };
    const rng = mulberry32(seedFrom(b.name + clock.now()));
    const c: Client = { id: uuid(rng), name: b.name.trim(), domain: b.domain ?? "", has_tech_committee: Boolean(b.has_tech_committee), idea_reference_prefix: b.name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "IRN", type: "POTENTIAL", plan: "FREE", is_active: true, about: null, logo_file_id: null, created_at: clock.iso(), updated_at: clock.iso() };
    db.clients.push(c);
    for (const email of b.admin_emails ?? []) db.users.push({ id: uuid(rng), email, name: email.split("@")[0], role: "LEGAL_COUNSEL", status: "INVITED", client_id: c.id, assigned_client_ids: [], phone: null, country_code: null, country_name: null, address: null, notification_prefs: { reviewDecisions: true, informationRequests: true, filingUpdates: true }, last_login_at: null, created_at: clock.iso(), updated_at: clock.iso() });
    touched();
    return { status: 201, body: view(c) };
  }),
  route("get", "/v1/case-owners", () => {
    const db = getDb();
    const owners = db.users.filter((u) => u.role === "CASE_OWNER").map((u) => ({ ...member(u), assigned_client_ids: u.assigned_client_ids, clients: u.assigned_client_ids.map((id) => { const c = db.clients.find((x) => x.id === id); const a = db.access.find((x) => x.user_id === u.id && x.client_id === id && !x.revoked_at); return c ? { id: c.id, name: c.name, kind: a?.kind ?? "ASSIGNMENT", is_primary: a?.is_primary ?? false, expires_at: a?.expires_at ?? null, reason: a?.reason ?? null } : null; }).filter(Boolean), patentCount: allPatents(u.assigned_client_ids).length, activeIdeas: db.ideas.filter((i) => u.assigned_client_ids.includes(i.client_id) && i.state !== "FILED").length }));
    return { owners, clients: db.clients.map((c) => ({ id: c.id, name: c.name, domain: c.domain })) };
  }),
  route("put", "/v1/case-owners/:id/assignments", async ({ params, body }) => {
    const b = (await body()) as { client_ids?: string[]; kind?: "ASSIGNMENT" | "TEMPORARY" | "STEP_IN"; reason?: string; expires_at?: string };
    const db = getDb(); const u = currentUser();
    if (!u || !["PHOTON_ADMIN", "PHOTON_SUPERADMIN"].includes(u.role)) return { status: 403, body: { message: "Only a Photon admin grants access." } };
    const owner = db.users.find((x) => x.id === params.id && x.role === "CASE_OWNER");
    if (!owner) return { status: 404, body: { message: "Case owner not found." } };
    const ids = (b.client_ids ?? []).filter((id) => db.clients.some((c) => c.id === id));
    if ((b.kind === "TEMPORARY" || b.kind === "STEP_IN") && !b.reason?.trim()) return { status: 400, body: { message: "A reason is required for temporary or step-in access." } };
    for (const a of db.access) if (a.user_id === owner.id && !ids.includes(a.client_id)) a.revoked_at = clock.iso();
    const rng = mulberry32(seedFrom(owner.id + clock.now()));
    for (const id of ids) if (!db.access.some((a) => a.user_id === owner.id && a.client_id === id && !a.revoked_at)) db.access.push({ id: uuid(rng), user_id: owner.id, client_id: id, kind: b.kind ?? "ASSIGNMENT", is_primary: false, reason: b.reason ?? null, expires_at: b.expires_at ?? null, granted_at: clock.iso(), revoked_at: null });
    owner.assigned_client_ids = ids; owner.updated_at = clock.iso(); touched();
    return { id: owner.id, assigned_client_ids: ids };
  }),
  route("get", "/v1/clients/:id", ({ params }) => {
    const db = getDb(); const u = currentUser();
    const c = db.clients.find((x) => x.id === params.id);
    if (!c) return { status: 404, body: { message: "Client not found." } };
    const scope = scopeFor(u);
    if (scope !== null && !scope.includes(c.id)) return { status: 403, body: { message: "You do not have access to this client." } };
    return view(c);
  }),
  route("patch", "/v1/clients/:id", async ({ params, body }) => {
    const b = (await body()) as Partial<Client>;
    const db = getDb();
    const c = db.clients.find((x) => x.id === params.id);
    if (!c) return { status: 404, body: { message: "Client not found." } };
    for (const k of ["name", "domain", "about", "logo_file_id", "idea_reference_prefix", "is_active", "has_tech_committee", "type", "plan"] as const) if (b[k] !== undefined) (c as Record<string, unknown>)[k] = b[k];
    c.updated_at = clock.iso(); touched();
    return view(c);
  }),
  route("post", "/v1/clients/:id/request-access", ({ params }) => {
    const db = getDb(); const u = currentUser();
    if (!db.clients.some((x) => x.id === params.id)) return { status: 404, body: { message: "Client not found." } };
    if (!u || u.role !== "CASE_OWNER") return { status: 403, body: { message: "Only a case owner requests access." } };
    return { status: 202, body: { requested: true, client_id: params.id, message: "Your request has been sent to the Photon admin." } };
  }),
  route("patch", "/v1/users/:id", async ({ params, body }) => {
    const b = (await body()) as Partial<User> & { profile_image?: string; role?: User["role"] };
    const db = getDb(); const me = currentUser();
    const u = db.users.find((x) => x.id === params.id);
    if (!u) return { status: 404, body: { message: "User not found." } };
    if (b.status === "SUSPENDED" && me?.id === u.id) return { status: 400, body: { message: "You cannot suspend yourself." } };
    for (const k of ["name", "phone", "country_code", "country_name", "address", "notification_prefs", "status", "role"] as const) if (b[k] !== undefined) (u as Record<string, unknown>)[k] = b[k];
    u.updated_at = clock.iso(); touched();
    return member(u);
  }),
  route("delete", "/v1/users/:id", ({ params }) => {
    const db = getDb(); const me = currentUser();
    const u = db.users.find((x) => x.id === params.id);
    if (!u) return { status: 404, body: { message: "User not found." } };
    if (me?.id === u.id) return { status: 400, body: { message: "You cannot remove yourself." } };
    u.status = "SUSPENDED"; u.updated_at = clock.iso(); touched();
    return { ok: true, status: "SUSPENDED" };
  }),
];
