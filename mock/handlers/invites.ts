import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { mulberry32, seedFrom, uuid } from "../runtime/prng";
import { currentUser } from "./scope";
import type { Invite, RoleName } from "../runtime/types";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const code = (rng: () => number) => Array.from({ length: 10 }, () => CROCKFORD[Math.floor(rng() * 32)]).join("");
const shareLinkFor = (clientId: string | null) => getDb().invites.find((i) => i.email === "*" && i.client_id === clientId && i.status === "PENDING") ?? null;
const view = (i: Invite | null) => i ? { id: i.id, code: i.code, url: `${typeof location !== "undefined" ? location.origin : ""}/i/${i.code}`, active: i.status === "PENDING" && Date.parse(i.expires_at) > clock.now(), expires_at: i.expires_at, role: i.role, client_id: i.client_id } : null;

export const inviteHandlers = [
  route("post", "/v1/invites", async ({ body }) => {
    const b = (await body()) as { role?: RoleName; emails?: string | string[]; client_id?: string };
    const db = getDb(); const u = currentUser();
    const emails = (Array.isArray(b.emails) ? b.emails : String(b.emails ?? "").split(/[,\s]+/)).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!emails.length) return { status: 400, body: { message: "At least one email is required." } };
    const clientId = b.client_id ?? (b.role === "CASE_OWNER" || b.role === "PHOTON_ADMIN" ? null : u?.client_id ?? null);
    const rng = mulberry32(seedFrom(emails.join(",") + clock.now()));
    const created = emails.map((email) => {
      const inv: Invite = { id: uuid(rng), email, role: b.role ?? "INVENTOR", client_id: clientId, code: code(rng), status: "PENDING", invited_by_id: u?.id ?? "", expires_at: clock.daysAhead(14), accepted_at: null, revoked_at: null, created_at: clock.iso() };
      db.invites.push(inv);
      if (!db.users.some((x) => x.email === email)) db.users.push({ id: uuid(rng), email, name: email.split("@")[0], role: inv.role, status: "INVITED", client_id: clientId, assigned_client_ids: [], phone: null, country_code: null, country_name: null, address: null, notification_prefs: { reviewDecisions: true, informationRequests: true, filingUpdates: true }, last_login_at: null, created_at: clock.iso(), updated_at: clock.iso() });
      return { ...inv, link: `/i/${inv.code}` };
    });
    touched();
    return { status: 201, body: { invites: created, links: created.map((c) => ({ email: c.email, link: c.link })) } };
  }),
  route("get", "/v1/invites/share-link", ({ url }) => {
    const u = currentUser();
    const cid = url.searchParams.get("client_id") ?? u?.client_id ?? null;
    const existing = shareLinkFor(cid);
    return view(existing) ?? { id: null, code: null, url: null, active: false, expires_at: null };
  }),
  route("post", "/v1/invites/share-link/regenerate", ({ url }) => {
    const db = getDb(); const u = currentUser();
    const cid = url.searchParams.get("client_id") ?? u?.client_id ?? null;
    for (const i of db.invites) if (i.email === "*" && i.client_id === cid && i.status === "PENDING") { i.status = "REVOKED"; i.revoked_at = clock.iso(); }
    const rng = mulberry32(seedFrom(`share|${cid}|${clock.now()}`));
    const inv: Invite = { id: uuid(rng), email: "*", role: "INVENTOR", client_id: cid, code: code(rng), status: "PENDING", invited_by_id: u?.id ?? "", expires_at: clock.daysAhead(365), accepted_at: null, revoked_at: null, created_at: clock.iso() };
    db.invites.push(inv); touched();
    return view(inv)!;
  }),
  route("delete", "/v1/invites/:id", ({ params }) => {
    const db = getDb();
    const inv = db.invites.find((i) => i.id === params.id);
    if (!inv) return { status: 404, body: { message: "Invite not found." } };
    inv.status = "REVOKED"; inv.revoked_at = clock.iso(); touched();
    return { ok: true };
  }),
];
