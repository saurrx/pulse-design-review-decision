import { route } from "../runtime/registry";
import { getDb } from "../runtime/db";
import { currentUser } from "./scope";

/**
 * V0-only routes for behaviours the backend does not have yet. Each is declared
 * in mock/proposed-routes.json with its backend finding, and answers only when
 * the scenario sets flags.v0; the Legacy reference tier gets the empty answer
 * the real backend would not even have a route for.
 */
export const v0Handlers = [
  // BF-3: the activation and reminder outbox a scenario's state implies. Photon roles see every tenant; a client persona sees its own workspace; a person sees their own mail.
  route("get", "/v1/emails/outbox", ({ url }) => {
    const db = getDb(); const u = currentUser();
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    if (!db.flags.v0 || !db.emails) return { status: 200, body: { data: [] } };
    const clientOf = (userId: string) => db.users.find((x) => x.id === userId)?.client_id ?? null;
    const mine = db.emails.filter((e) => u.role === "PHOTON_ADMIN" || (u.role === "CASE_OWNER" && u.assigned_client_ids.includes(clientOf(e.to_user_id) ?? "")) || (u.role === "LEGAL_COUNSEL" && clientOf(e.to_user_id) === u.client_id) || e.to_user_id === u.id);
    const kind = url.searchParams.get("kind");
    return { status: 200, body: { data: kind ? mine.filter((e) => e.kind === kind) : mine } };
  }),
];
