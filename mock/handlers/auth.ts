import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { mulberry32, seedFrom, uuid } from "../runtime/prng";
import { presentUser, readSessionUser } from "../runtime/session";
import { currentUser } from "./scope";

/**
 * Non-authentication scenarios never return an accidental 401: the app's refresh
 * interceptor would clear the cookie and bounce to /login. The login endpoint
 * refuses an unknown email on purpose, because that is the login screen's own
 * failure state; the auth/failures scenario (flags.authFails) makes every
 * authentication call fail deliberately.
 */
const failing = () => Boolean(getDb().flags?.authFails);
const slim = (u: { id: string; email: string; role: string; client_id: string | null }) => ({ id: u.id, email: u.email, role: u.role, clientId: u.client_id });

export const authHandlers = [
  route("post", "/v1/auth/login", async ({ body }) => {
    const b = (await body()) as { email?: string; password?: string };
    const db = getDb();
    const u = db.users.find((x) => x.email.toLowerCase() === String(b.email ?? "").trim().toLowerCase());
    if (failing() || !u || !b.password || u.status === "SUSPENDED") return { status: 401, body: { message: u?.status === "SUSPENDED" ? "This account has been disabled." : "Invalid email or password." } };
    if (u.status === "INVITED") return { status: 403, body: { message: "Accept your invitation first." } };
    u.last_login_at = clock.iso(); touched();
    return { user: presentUser(u, db) };
  }),
  route("post", "/v1/auth/google", () => {
    const db = getDb();
    const u = db.users.find((x) => x.role === "INVENTOR")!;
    return failing() ? { status: 401, body: { message: "Google sign-in failed." } } : { user: presentUser(u, db) };
  }),
  route("post", "/v1/auth/signup", async ({ body }) => {
    const b = (await body()) as { email?: string; password?: string; name?: string };
    const db = getDb();
    const email = String(b.email ?? "").trim().toLowerCase();
    const domain = email.split("@")[1] ?? "";
    const client = db.clients.find((c) => c.domain === domain && c.is_active);
    if (!email || !b.password) return { status: 400, body: { message: "Email and password are required." } };
    if (!client) return { status: 403, body: { message: "Your organisation is not onboarded on Pulse yet." } };
    if (db.users.some((x) => x.email === email)) return { status: 409, body: { message: "An account with this email already exists." } };
    const rng = mulberry32(seedFrom(email));
    const u = { id: uuid(rng), email, name: b.name ?? email.split("@")[0], role: "INVENTOR" as const, status: "ACTIVE" as const, client_id: client.id, assigned_client_ids: [], phone: null, country_code: null, country_name: null, address: null, notification_prefs: { reviewDecisions: true, informationRequests: true, filingUpdates: true }, last_login_at: clock.iso(), created_at: clock.iso(), updated_at: clock.iso() };
    db.users.push(u); touched();
    return { status: 201, body: { user: presentUser(u, db) } };
  }),
  route("get", "/v1/auth/me", () => {
    const u = currentUser();
    if (failing() || !u) return { status: 401, body: { message: failing() ? "Session expired. Sign in again." : "Not signed in." } };
    return { ...presentUser(u, getDb()), view: false };
  }),
  route("post", "/v1/auth/refresh", () => {
    if (failing()) return { status: 401, body: { message: "Session expired. Sign in again." } };
    const u = currentUser();
    const s = readSessionUser();
    const who = u ?? (s ? { id: s.id, email: s.email, role: s.role, client_id: s.client_id ?? null } : null);
    if (!who) return { status: 401, body: { message: "Session expired. Sign in again." } };
    return { user: slim(who) };
  }),
  route("post", "/v1/auth/logout", () => ({ ok: true })),
  route("post", "/v1/auth/logout-all", () => ({ ok: true, sessions_revoked: 2 })),
  route("post", "/v1/auth/change-password", async ({ body }) => {
    const b = (await body()) as { current_password?: string; new_password?: string };
    if (!b.current_password || !b.new_password) return { status: 400, body: { message: "Both passwords are required." } };
    if (String(b.new_password).length < 8) return { status: 400, body: { message: "The new password must be at least 8 characters." } };
    return { ok: true, sessions_revoked: 1 };
  }),
  route("post", "/v1/auth/password-reset/request", () => ({ sent: true })),
  route("post", "/v1/auth/password-reset/complete", async ({ body }) => {
    const b = (await body()) as { token?: string; password?: string };
    if (!b.token || !b.password) return { status: 400, body: { message: "The reset link is invalid or has expired." } };
    const db = getDb(); const u = db.users.find((x) => x.role === "INVENTOR")!;
    return { user: slim(u) };
  }),
  route("post", "/v1/auth/invite/verify-share", async ({ body }) => {
    const b = (await body()) as { code?: string; email?: string };
    const db = getDb();
    const inv = db.invites.find((i) => i.code === b.code && i.status === "PENDING");
    if (!inv) return { status: 404, body: { message: "This invitation link is no longer valid." } };
    const client = db.clients.find((c) => c.id === inv.client_id);
    const email = String(b.email ?? "").toLowerCase();
    if (client && email && !email.endsWith("@" + client.domain)) return { status: 403, body: { message: `Only ${client.domain} addresses can join ${client.name}.` } };
    return { ok: true, existing: db.users.some((x) => x.email === email), organization_name: client?.name ?? "Photon Legal" };
  }),
  route("post", "/v1/auth/view-as/:clientId", ({ params }) => {
    const db = getDb();
    const counsel = db.users.find((x) => x.client_id === params.clientId && x.role === "LEGAL_COUNSEL");
    if (!counsel) return { status: 404, body: { message: "Client not found." } };
    const client = db.clients.find((c) => c.id === counsel.client_id);
    return { user: { ...presentUser(counsel, db), client: client ? { id: client.id, name: client.name, logo_file: client.logo_file_id ? { id: client.logo_file_id } : null } : null, view_as: true } };
  }),
  route("post", "/v1/auth/view-as/exit", () => {
    const db = getDb();
    const admin = db.users.find((x) => x.role === "PHOTON_ADMIN")!;
    return { user: presentUser(admin, db) };
  }),
];
