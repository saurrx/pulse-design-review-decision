import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { uuid, mulberry32, seedFrom } from "../runtime/prng";
import { currentUser } from "./scope";
import { allDueDates, dueDateById, paginate, patentById, q, qi, scopeFor } from "../runtime/store";
import { templatesFor } from "../scenarios/templates";
import type { ActionRequest } from "../runtime/types";

/**
 * Two axes, as in production: the client's submission state (DRAFT, SUBMITTED,
 * UPDATED) and Photon's queue status (NEW, ACKNOWLEDGED, IN_PROGRESS,
 * COMPLETED, DECLINED). The client side lists pending due dates with any
 * request attached; Photon's queue lists submitted requests across clients.
 */
const days = (iso: string) => Math.ceil((Date.parse(iso) - clock.now()) / 86_400_000);
const clientRow = (dd: ReturnType<typeof allDueDates>[number]) => {
  const db = getDb();
  const p = patentById(dd.patent_id);
  const a = db.actionRequests.find((x) => x.due_date_id === dd.id);
  const t = a?.template_id ? db.actionTemplates.find((x) => x.id === a.template_id) : null;
  return {
    id: a?.id ?? null, due_date_id: dd.id, title: dd.title, event_type: dd.event_type, due_at: dd.due_at, daysRemaining: days(dd.due_at), client_id: dd.client_id,
    patent: p ? { id: p.id, title: p.title, application_number: p.application_number, jurisdiction: p.jurisdiction, status: p.status } : null,
    instruction: a?.instruction ?? null, template_id: a?.template_id ?? null, template: t ? { id: t.id, label: t.label, category: t.category, requires_countries: t.requires_countries, requires_note: t.requires_note } : null,
    submission_state: a?.submission_state ?? null, status: a?.status ?? "NO_ACTION", selected_countries: a?.selected_countries ?? [], version: a?.version ?? null, note: a?.note ?? null, requested_at: a?.requested_at ?? null,
  };
};

export const actionHandlers = [
  route("get", "/v1/actions/templates", ({ url }) => (getDb().flags.v0 && currentUser()?.role === "INVENTOR" ? { status: 403, body: { message: "Actions are not part of an inventor's workspace." } } : templatesFor(q(url, "event_type") ?? ""))),
  route("get", "/v1/actions/queue", ({ url }) => {
    const db = getDb(); const u = currentUser();
    if (!u || !["CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN"].includes(u.role)) return { status: 403, body: { message: "Photon Legal only." } };
    const scope = scopeFor(u);
    let rows = db.actionRequests.filter((a) => a.submission_state !== "DRAFT" && (scope === null || scope.includes(a.client_id)));
    const cid = q(url, "client_id"); if (cid) rows = rows.filter((a) => a.client_id === cid);
    const rs = q(url, "request_status"); if (rs) rows = rows.filter((a) => a.status === rs);
    const search = (q(url, "search") ?? "").trim().toLowerCase();
    const hydrate = (a: ActionRequest) => { const dd = dueDateById(a.due_date_id); const p = dd && patentById(dd.patent_id); const t = a.template_id ? db.actionTemplates.find((x) => x.id === a.template_id) : null; const c = db.clients.find((x) => x.id === a.client_id); return { ...a, due_date: dd ? { id: dd.id, title: dd.title, event_type: dd.event_type, due_at: dd.due_at, status: dd.status, patent: p ? { id: p.id, title: p.title, application_number: p.application_number } : null } : null, template: t ? { id: t.id, label: t.label, category: t.category } : null, client: c ? { id: c.id, name: c.name } : null, requested_by: (() => { const r = db.users.find((x) => x.id === a.requested_by_id); return r ? { id: r.id, name: r.name } : null; })() }; };
    let out = rows.map(hydrate);
    if (search) out = out.filter((r) => `${r.due_date?.patent?.title ?? ""} ${r.due_date?.patent?.application_number ?? ""} ${r.instruction ?? ""} ${r.client?.name ?? ""}`.toLowerCase().includes(search));
    const filter = q(url, "filter"); const now = clock.iso();
    if (filter === "overdue") out = out.filter((r) => r.due_date && r.due_date.due_at < now);
    else if (filter === "upcoming") out = out.filter((r) => r.due_date && r.due_date.due_at >= now);
    const sort = q(url, "sort");
    out.sort((a, b) => sort === "client" ? String(a.client?.name).localeCompare(String(b.client?.name)) : String(a.due_date?.due_at ?? "").localeCompare(String(b.due_date?.due_at ?? "")));
    const page = qi(url, "page", 1), limit = Math.min(200, qi(url, "limit", 50));
    return out.slice((page - 1) * limit, page * limit);
  }),
  route("get", "/v1/actions", ({ url }) => {
    const u = currentUser();
    if (getDb().flags.v0 && u?.role === "INVENTOR") return { status: 403, body: { message: "Actions are not part of an inventor's workspace." } }; // BF-4, V0 scenarios only
    const scope = scopeFor(u);
    const cid = q(url, "client_id");
    const ids = cid ? (scope === null || scope.includes(cid) ? [cid] : []) : scope;
    let rows = allDueDates(ids).filter((d) => d.status === "PENDING").sort((a, b) => a.due_at.localeCompare(b.due_at));
    const search = (q(url, "search") ?? "").trim().toLowerCase();
    if (search) rows = rows.filter((d) => { const p = patentById(d.patent_id); return `${d.title} ${p?.title ?? ""} ${p?.application_number ?? ""}`.toLowerCase().includes(search); });
    const page = paginate(rows, qi(url, "page", 1), Math.min(200, qi(url, "limit", 25)));
    return { ...page, data: page.data.map(clientRow) };
  }),
  route("post", "/v1/actions/submit-all", () => {
    const db = getDb(); const u = currentUser();
    if (!u || u.role !== "LEGAL_COUNSEL") return { status: 403, body: { message: "Only in-house counsel can instruct Photon Legal." } };
    let n = 0;
    for (const a of db.actionRequests) if (a.client_id === u.client_id && a.submission_state === "DRAFT") { a.submission_state = "SUBMITTED"; a.status = "NEW"; a.requested_at = clock.iso(); a.updated_at = clock.iso(); n++; }
    touched();
    return { submitted: n };
  }),
  route("patch", "/v1/actions/:id", async ({ params, body }) => {
    // The client chooses an instruction for a pending due date (a draft until submit-all). `:id` is the
    // request id, or the due date id when no request exists yet, which is how the backend's decide reads it.
    const b = (await body()) as { due_date_id?: string; template_id?: string; instruction?: string; selected_countries?: string[]; note?: string };
    const db = getDb(); const u = currentUser();
    const existing = db.actionRequests.find((x) => x.id === params.id);
    const dd = dueDateById(String(existing?.due_date_id ?? b.due_date_id ?? params.id));
    if (!u || !dd) return { status: 404, body: { message: "Due date not found." } };
    const t = db.actionTemplates.find((x) => x.id === b.template_id);
    if (t?.requires_countries && !(b.selected_countries?.length)) return { status: 400, body: { message: "Select at least one country." } };
    if (t?.requires_note && !b.note?.trim()) return { status: 400, body: { message: "A note is required for this instruction." } };
    let a = db.actionRequests.find((x) => x.due_date_id === dd.id);
    if (!a) { a = { id: uuid(mulberry32(seedFrom(dd.id + clock.now()))), client_id: dd.client_id, due_date_id: dd.id, template_id: null, instruction: null, selected_countries: [], status: "NO_ACTION", submission_state: "DRAFT", version: 1, note: null, requested_by_id: u.id, requested_at: clock.iso(), updated_at: clock.iso() }; db.actionRequests.push(a); }
    else if (a.submission_state === "SUBMITTED") { a.submission_state = "UPDATED"; a.version += 1; }
    a.template_id = t?.id ?? null; a.instruction = b.instruction ?? t?.label ?? null; a.selected_countries = b.selected_countries ?? []; a.note = b.note ?? null; a.updated_at = clock.iso();
    touched();
    return a;
  }),
  route("patch", "/v1/actions/:id/request-status", async ({ params, body }) => {
    const b = (await body()) as { status?: string };
    const db = getDb(); const u = currentUser();
    const a = db.actionRequests.find((x) => x.id === params.id);
    if (!a) return { status: 404, body: { message: "Action not found." } };
    if (!u || !["CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN"].includes(u.role)) return { status: 403, body: { message: "Photon Legal only." } };
    const order = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED"];
    const next = String(b.status);
    if (!order.includes(next)) return { status: 400, body: { message: "Unknown status." } };
    if (order.indexOf(next) < order.indexOf(a.status)) return { status: 409, body: { message: "The queue is forward-only." } };
    a.status = next as ActionRequest["status"]; a.updated_at = clock.iso();
    if (next === "COMPLETED") { const dd = dueDateById(a.due_date_id); if (dd) db.dueDateOverrides[dd.id] = { ...(db.dueDateOverrides[dd.id] ?? {}), status: "COMPLETED" }; }
    touched();
    return a;
  }),
  route("post", "/v1/actions/:id/resolve", async ({ params, body }) => {
    const b = (await body()) as { status?: string; note?: string };
    const db = getDb();
    const a = db.actionRequests.find((x) => x.id === params.id);
    if (!a) return { status: 404, body: { message: "Action not found." } };
    if (b.status === "DECLINED" && !b.note?.trim()) return { status: 400, body: { message: "A note is required to decline." } };
    a.status = b.status === "DECLINED" ? "DECLINED" : "COMPLETED"; a.note = b.note ?? a.note; a.updated_at = clock.iso(); touched();
    return a;
  }),
];
