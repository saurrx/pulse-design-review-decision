import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { uuid, mulberry32, seedFrom } from "../runtime/prng";
import { currentUser } from "./scope";
import { allDueDates, allPatents, dueDateById, overrideDueDate, overridePatent, paginate, patentById, q, qi, scopeFor } from "../runtime/store";
import type { DueDate, Patent } from "../runtime/types";

const dueSummary = (d: DueDate) => ({ id: d.id, patent_id: d.patent_id, client_id: d.client_id, event_type: d.event_type, title: d.title, due_at: d.due_at, status: d.status, created_at: d.created_at, updated_at: d.updated_at });
const ideaLinkFor = (p: Patent) => {
  const db = getDb();
  const link = (db as unknown as { links?: Array<{ idea_id: string; patent_id: string }> }).links?.find((l) => l.patent_id === p.id);
  const idea = link && db.ideas.find((i) => i.id === link.idea_id);
  if (!idea) return null;
  const inventors = db.inventors.filter((x) => x.idea_id === idea.id).map((x) => ({ inventor: (() => { const u = db.users.find((y) => y.id === x.inventor_id); return u ? { id: u.id, name: u.name, email: u.email } : null; })() }));
  return { idea: { id: idea.id, title: idea.title, inventors } };
};
/** The list row as pulse-backend returns it: the patent, its next pending due date, and the idea link with inventors. */
const listRow = (p: Patent) => {
  const next = allDueDates([p.client_id]).filter((d) => d.patent_id === p.id && d.status === "PENDING").sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
  const client = getDb().clients.find((c) => c.id === p.client_id);
  return { ...p, due_dates: next ? [dueSummary(next)] : [], idea_link: ideaLinkFor(p), client: client ? { id: client.id, name: client.name } : null };
};

const scoped = (url: URL) => {
  const u = currentUser();
  const scope = scopeFor(u);
  const cid = q(url, "client_id");
  if (cid && scope && !scope.includes(cid)) return { scope: [] as string[], u };
  return { scope: cid ? [cid] : scope, u };
};

export const patentHandlers = [
  route("get", "/v1/patents/stats", ({ url }) => {
    const { scope } = scoped(url);
    const rows = allPatents(scope);
    const n = (...s: Patent["status"][]) => rows.filter((p) => s.includes(p.status)).length;
    const byJ = new Map<string, { jurisdiction: string; count: number; granted: number; pending: number }>();
    for (const p of rows) { const e = byJ.get(p.jurisdiction) ?? { jurisdiction: p.jurisdiction, count: 0, granted: 0, pending: 0 }; e.count++; if (p.status === "GRANTED") e.granted++; if (p.status === "APPLIED" || p.status === "EXAMINATION") e.pending++; byJ.set(p.jurisdiction, e); }
    return { total: rows.length, granted: n("GRANTED"), applied: n("APPLIED"), examination: n("EXAMINATION"), inactive: n("EXPIRED", "WITHDRAWN", "REJECTED", "ABANDONED", "NONPAYMENT"), byJurisdiction: [...byJ.values()].sort((a, b) => b.count - a.count) };
  }),
  route("get", "/v1/patents/tags", ({ url }) => {
    const { scope } = scoped(url);
    return [...new Set(allPatents(scope).flatMap((p) => p.tags))].sort();
  }),
  route("get", "/v1/patents/export", ({ url }) => {
    const { scope } = scoped(url);
    const rows = allPatents(scope);
    const esc = (v: unknown) => { const s = String(v ?? ""); return /^[=+\-@]/.test(s) ? `'${s}` : s; };
    const csv = ["application_number,title,jurisdiction,status,filing_date,grant_date,tags", ...rows.map((p) => [p.application_number, p.title, p.jurisdiction, p.status, p.filing_date?.slice(0, 10), p.grant_date?.slice(0, 10), p.tags.join("|")].map((v) => `"${esc(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    return new Response(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=patents.csv" } }) as unknown as { status: number };
  }),
  route("get", "/v1/patents/import-history", ({ url }) => {
    const db = getDb();
    const cid = q(url, "client_id");
    return db.imports.filter((i) => !cid || i.client_id === cid).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((i) => ({ ...i, file: db.files.find((f) => f.id === i.file_id) ?? null, imported_by: (() => { const u = db.users.find((x) => x.id === i.imported_by_id); return u ? { id: u.id, name: u.name } : null; })() }));
  }),
  route("post", "/v1/patents/import", async ({ body }) => {
    const b = (await body()) as { file_id?: string; client_id?: string };
    const db = getDb(); const u = currentUser();
    const file = db.files.find((f) => f.id === b.file_id);
    if (!file) return { status: 400, body: { message: "Upload the sheet first, then import it." } };
    const cid = b.client_id ?? u?.client_id;
    const client = db.clients.find((c) => c.id === cid);
    if (!client) return { status: 400, body: { message: "A client is required." } };
    const trouble = Boolean(db.flags?.importTrouble);
    const rng = mulberry32(seedFrom(file.id));
    const created: Patent[] = [];
    const rows = trouble ? 94 : 12;
    for (let i = 0; i < (trouble ? 61 : 12); i++) {
      created.push({ id: uuid(rng), client_id: client.id, title: `Imported filing ${i + 1} from ${file.original_name}`, application_number: `IMP/${String(1000 + i)}`, jurisdiction: ["US", "EP", "IN"][i % 3], status: i % 4 === 0 ? "GRANTED" : "APPLIED", filing_date: clock.daysAgo(400 + i * 7), grant_date: i % 4 === 0 ? clock.daysAgo(60 + i) : null, tags: ["imported"], abstract: null, assignee_original: client.name, current_assignee: client.name, inventors: [], simple_family_members: [], ipc_all_versions: [], priority_details: null, additional_notes: null, current_status: null, prn: null, oc: null, next_steps_gpo: [], next_steps_legal: [], status_timeline_history: [], deleted_at: null, created_at: clock.iso(), updated_at: clock.iso() });
    }
    db.patents.push(...created);
    const dues = created.slice(0, Math.floor(created.length / 2)).map((p, k) => ({ id: uuid(rng), patent_id: p.id, client_id: client.id, event_type: "Annuity Payment Due", title: "Annuity Payment Due", due_at: clock.daysAhead(30 + k * 11), status: "PENDING" as const, created_at: clock.iso(), updated_at: clock.iso() }));
    db.dueDates.push(...dues);
    const result = { id: uuid(rng), client_id: client.id, file_id: file.id, status: (trouble ? "PARTIAL" : "COMPLETED") as "PARTIAL" | "COMPLETED", rows_total: rows, created_count: created.length, updated_count: trouble ? 9 : 0, unchanged_count: trouble ? 5 : 0, failed_count: trouble ? 19 : 0, due_dates_created: dues.length, duplicate_in_file: trouble ? 7 : 0, unmapped_columns: trouble ? ["Docket Ref", "Old Status"] : [], errors: trouble ? [{ row: 14, message: "Application number is empty." }, { row: 22, message: "Filing date is not a date: 'tbd'." }, { row: 57, message: "Jurisdiction 'XX' is not recognised." }] : [], completed_at: clock.iso(), created_at: clock.iso(), imported_by_id: u?.id ?? "" };
    db.imports.push(result); touched();
    return { ...result, success_count: created.length, updated: trouble ? [{ application_number: "IMP/1003", changes: { status: { from: "APPLIED", to: "GRANTED" } } }] : [], duplicates: trouble ? [{ application_number: "IMP/1010", rows: [10, 17] }] : [], deadlines: dues.length };
  }),
  route("get", "/v1/patents", ({ url }) => {
    const { scope } = scoped(url);
    let rows = allPatents(scope);
    const search = (q(url, "search") ?? "").trim().toLowerCase();
    if (search) rows = rows.filter((p) => `${p.title} ${p.application_number ?? ""} ${p.inventors.join(" ")}`.toLowerCase().includes(search));
    const status = q(url, "status"); if (status) rows = rows.filter((p) => p.status === status);
    const tag = q(url, "tag"); if (tag) rows = rows.filter((p) => p.tags.includes(tag));
    const jur = q(url, "jurisdiction"); if (jur) rows = rows.filter((p) => p.jurisdiction === jur);
    const sort = q(url, "sort") ?? "filing_date"; const order = q(url, "order") === "asc" ? 1 : -1;
    rows.sort((a, b) => order * String((a as never)[sort] ?? "").localeCompare(String((b as never)[sort] ?? "")));
    const limit = Math.min(100, qi(url, "limit", 20));
    return paginate(rows.map(listRow), qi(url, "page", 1), limit);
  }),
  route("post", "/v1/patents", async ({ body }) => {
    const b = (await body()) as Partial<Patent> & { client_id?: string };
    const db = getDb(); const u = currentUser();
    const cid = b.client_id ?? u?.client_id;
    const client = db.clients.find((c) => c.id === cid);
    if (!client) return { status: 400, body: { message: "A client is required." } };
    if (!b.title?.trim()) return { status: 400, body: { message: "A title is required." } };
    if (b.application_number && allPatents(null).some((p) => p.application_number === b.application_number)) return { status: 409, body: { message: "A patent with this application number already exists." } };
    const p: Patent = { id: uuid(mulberry32(seedFrom(String(b.title) + clock.now()))), client_id: client.id, title: b.title.trim(), application_number: b.application_number ?? null, jurisdiction: b.jurisdiction ?? "US", status: b.status ?? "APPLIED", filing_date: b.filing_date ?? null, grant_date: b.grant_date ?? null, tags: b.tags ?? [], abstract: b.abstract ?? null, assignee_original: client.name, current_assignee: client.name, inventors: b.inventors ?? [], simple_family_members: [], ipc_all_versions: [], priority_details: null, additional_notes: null, current_status: null, prn: null, oc: null, next_steps_gpo: [], next_steps_legal: [], status_timeline_history: [], deleted_at: null, created_at: clock.iso(), updated_at: clock.iso() };
    db.patents.push(p); touched();
    return { status: 201, body: p };
  }),
  route("get", "/v1/patents/:id", ({ params }) => {
    const p = patentById(params.id as string);
    if (!p) return { status: 404, body: { message: "Patent not found." } };
    const db = getDb();
    const dues = allDueDates([p.client_id]).filter((d) => d.patent_id === p.id).sort((a, b) => a.due_at.localeCompare(b.due_at)).map((d) => ({ ...dueSummary(d), action: db.actionRequests.find((a) => a.due_date_id === d.id) ?? null }));
    return { ...p, due_dates: dues, idea_link: ideaLinkFor(p), files: db.files.filter((f) => f.category === `patent:${p.id}`) };
  }),
  route("patch", "/v1/patents/:id", async ({ params, body }) => {
    const b = (await body()) as Partial<Patent> & { publication_country?: string; application_date?: string };
    const p = patentById(params.id as string);
    if (!p) return { status: 404, body: { message: "Patent not found." } };
    const patch: Partial<Patent> = {};
    for (const k of ["title", "application_number", "jurisdiction", "status", "filing_date", "grant_date", "tags", "abstract", "additional_notes", "prn", "oc", "next_steps_gpo", "next_steps_legal", "inventors"] as const) if (b[k] !== undefined) (patch as Record<string, unknown>)[k] = b[k];
    if (b.publication_country) patch.jurisdiction = b.publication_country;
    if (b.application_date) patch.filing_date = b.application_date;
    return overridePatent(p.id, patch);
  }),
  route("delete", "/v1/patents/:id", ({ params }) => {
    const p = patentById(params.id as string);
    if (!p) return { status: 404, body: { message: "Patent not found." } };
    overridePatent(p.id, { deleted_at: clock.iso() });
    return { ok: true, restore_until: clock.daysAhead(30) };
  }),
  route("post", "/v1/patents/:id/restore", ({ params }) => {
    const db = getDb();
    const o = db.patentOverrides[params.id as string];
    if (!o?.deleted_at) return { status: 404, body: { message: "Nothing to restore." } };
    return overridePatent(params.id as string, { deleted_at: null });
  }),

  // Due dates: the docket.
  route("get", "/v1/due-dates", ({ url }) => {
    if (getDb().flags.v0 && currentUser()?.role === "INVENTOR") return { status: 403, body: { message: "Due dates are not part of an inventor's workspace." } }; // BF-4, V0 scenarios only
    const { scope } = scoped(url);
    let rows = allDueDates(scope);
    const from = q(url, "from"); const to = q(url, "to");
    if (from) rows = rows.filter((d) => d.due_at >= from);
    if (to) rows = rows.filter((d) => d.due_at < to);
    const now = clock.iso();
    const filter = q(url, "filter");
    if (filter === "overdue") rows = rows.filter((d) => d.status === "PENDING" && d.due_at < now);
    else if (filter === "upcoming") rows = rows.filter((d) => d.status === "PENDING" && d.due_at >= now);
    else if (filter === "dueToday") rows = rows.filter((d) => d.due_at.slice(0, 10) === now.slice(0, 10));
    else if (filter === "completed") rows = rows.filter((d) => d.status === "COMPLETED");
    const search = (q(url, "search") ?? "").trim().toLowerCase();
    const patents = new Map<string, Patent | null>();
    const patentOf = (d: DueDate) => { if (!patents.has(d.patent_id)) patents.set(d.patent_id, patentById(d.patent_id)); return patents.get(d.patent_id); };
    if (search) rows = rows.filter((d) => { const p = patentOf(d); return `${d.title} ${p?.title ?? ""} ${p?.application_number ?? ""}`.toLowerCase().includes(search); });
    const sort = q(url, "sort") ?? "due_at"; const order = q(url, "order") === "desc" ? -1 : 1;
    rows.sort((a, b) => order * (sort === "title" ? a.title.localeCompare(b.title) : a.due_at.localeCompare(b.due_at)));
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === "0" ? Math.min(5000, rows.length || 1) : Math.min(200, qi(url, "limit", 25));
    const page = paginate(rows, qi(url, "page", 1), limit);
    const db = getDb();
    return { ...page, data: page.data.map((d) => { const p = patentOf(d); const client = db.clients.find((c) => c.id === d.client_id); return { ...dueSummary(d), is_overdue: d.status === "PENDING" && d.due_at < now, patent: p ? { id: p.id, title: p.title, application_number: p.application_number, jurisdiction: p.jurisdiction, status: p.status, filing_date: p.filing_date, client: client ? { id: client.id, name: client.name } : null } : null, action: db.actionRequests.find((a) => a.due_date_id === d.id) ?? null }; }) };
  }),
  route("patch", "/v1/due-dates/:id", async ({ params, body }) => {
    const b = (await body()) as { status?: string };
    const d = dueDateById(params.id as string);
    if (!d) return { status: 404, body: { message: "Due date not found." } };
    const status = b.status === "OPEN" ? "PENDING" : b.status;
    if (status !== "PENDING" && status !== "COMPLETED") return { status: 400, body: { message: "Status must be COMPLETED or PENDING; MISSED is derived." } };
    return overrideDueDate(d.id, { status });
  }),
  route("post", "/v1/due-dates/:id/remind", ({ params }) => {
    const db = getDb();
    const d = dueDateById(params.id as string);
    if (!d) return { status: 404, body: { message: "Due date not found." } };
    const last = db.remindersAt[d.id];
    if (last && clock.now() - Date.parse(last) < 24 * 3_600_000) return { status: 429, body: { message: "A reminder was sent in the last 24 hours." } };
    db.remindersAt[d.id] = clock.iso(); touched();
    return { sent: true, queued: true, next_allowed_at: new Date(clock.now() + 24 * 3_600_000).toISOString() };
  }),
];
