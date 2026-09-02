import { route } from "../runtime/registry";
import { getDb } from "../runtime/db";
import { presentUser, readSessionUser } from "../runtime/session";
import { currentUser } from "./scope";

/**
 * Non-authentication scenarios never return an accidental 401: the app's refresh
 * interceptor would clear the cookie and bounce to /login. The login endpoint
 * refuses an unknown email on purpose, because that is the login screen's own
 * failure state; auth/failures scenarios (scaffold) add the rest.
 */
export const authHandlers = [
  route("post", "/v1/auth/login", async ({ body }) => {
    const b = (await body()) as { email?: string; password?: string };
    const db = getDb();
    const u = db.users.find((x) => x.email.toLowerCase() === String(b.email ?? "").trim().toLowerCase() && x.status === "ACTIVE");
    if (!u || !b.password) return { status: 401, body: { message: "Invalid email or password." } };
    return { user: presentUser(u, db) };
  }),
  route("get", "/v1/auth/me", () => {
    const u = currentUser();
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    return { ...presentUser(u, getDb()), view: false };
  }),
  route("post", "/v1/auth/refresh", () => {
    const u = currentUser();
    // Never 401 here outside an auth scenario: fall back to whoever the cookie names.
    const s = readSessionUser();
    const who = u ?? (s ? { id: s.id, email: s.email, role: s.role, client_id: s.client_id ?? null } : null);
    if (!who) return { status: 401, body: { message: "Session expired. Sign in again." } };
    return { user: { id: who.id, email: who.email, role: who.role, clientId: who.client_id ?? null } };
  }),
  route("post", "/v1/auth/logout", () => ({ ok: true })),
  route("post", "/v1/auth/logout-all", () => ({ ok: true, sessions_revoked: 1 })),
  route("post", "/v1/auth/view-as/:clientId", ({ params }) => {
    const db = getDb();
    const counsel = db.users.find((x) => x.client_id === params.clientId && x.role === "LEGAL_COUNSEL");
    if (!counsel) return { status: 404, body: { message: "Client not found." } };
    return { user: { ...presentUser(counsel, db), view_as: true } };
  }),
  route("post", "/v1/auth/view-as/exit", () => {
    const db = getDb();
    const admin = db.users.find((x) => x.role === "PHOTON_ADMIN")!;
    return { user: presentUser(admin, db) };
  }),
];
