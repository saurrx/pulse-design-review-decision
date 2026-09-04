import { route } from "../runtime/registry";
import { getDb } from "../runtime/db";
import { clock } from "../runtime/clock";
import { currentUser, visibleIdeas } from "./scope";
import { allDueDates, allPatents, scopeFor, q } from "../runtime/store";
import type { Idea, Patent } from "../runtime/types";

const DAY = 86_400_000;
const quarterStart = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1); };
const previousQuarterStart = (t: number) => { const d = new Date(quarterStart(t)); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 3, 1); };
const monthStart = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
const yearStart = (t: number) => Date.UTC(new Date(t).getUTCFullYear(), 0, 1);
const within = (iso: string | null | undefined, from: number, to: number) => !!iso && Date.parse(iso) >= from && Date.parse(iso) < to;

/** BF-5: workspace-scoped dashboard aggregates (mock/proposed-fields.json). Names only; identifiers are for links, never for reading. */
function v0Aggregates(ideas: Idea[], patents: Patent[], scope: string[] | null) {
  const db = getDb();
  const now = clock.now();
  const qStart = quarterStart(now), pStart = previousQuarterStart(now), mStart = monthStart(now), yStart = yearStart(now);
  const pending = ideas.filter((i) => i.state === "LEGAL_REVIEW" || i.state === "TECH_REVIEW");
  const waitDays = (i: Idea) => Math.max(0, Math.floor((now - Date.parse(i.submitted_at ?? i.created_at)) / DAY));
  const due = allDueDates(scope).filter((d) => d.status === "PENDING" && Date.parse(d.due_at) >= now).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const due30 = due.filter((d) => Date.parse(d.due_at) < now + 30 * DAY);
  const submittedIn = (from: number, to: number) => ideas.filter((i) => within(i.submitted_at, from, to));
  const pipeline = (rows: Idea[]) => {
    const count = (...states: Idea["state"][]) => rows.filter((idea) => states.includes(idea.state)).length;
    const waiting = rows.filter((idea) => idea.state === "LEGAL_REVIEW" || idea.state === "TECH_REVIEW");
    return {
      submitted: count("TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"),
      reviewPending: waiting.length,
      sentToPhoton: count("SENT_TO_PHOTON"),
      filed: count("FILED"),
      granted: 0,
      oldestWaitingDays: waiting.length ? Math.max(...waiting.map(waitDays)) : null,
    };
  };
  const rank = (rows: Idea[], filed: Patent[]) => {
    const per = new Map<string, { id: string; name: string; ideas: number; patents: number }>();
    const bump = (id: string, key: "ideas" | "patents") => { const u = db.users.find((x) => x.id === id); if (!u) return; const e = per.get(id) ?? { id, name: u.name, ideas: 0, patents: 0 }; e[key]++; per.set(id, e); };
    for (const i of rows) { const people = db.inventors.filter((x) => x.idea_id === i.id).map((x) => x.inventor_id); for (const id of people.length ? people : [i.author_id]) bump(id, "ideas"); }
    for (const p of filed) for (const name of p.inventors) { const u = db.users.find((x) => x.name === name && x.role === "INVENTOR"); if (u) bump(u.id, "patents"); }
    return [...per.values()].sort((a, b) => b.ideas - a.ideas || b.patents - a.patents || a.name.localeCompare(b.name));
  };
  const byJ = new Map<string, number>();
  for (const p of patents) byJ.set(p.jurisdiction, (byJ.get(p.jurisdiction) ?? 0) + 1);
  return {
    workspace: {
      awaiting_review: pending.length,
      oldest_waiting_days: pending.length ? Math.max(...pending.map(waitDays)) : null,
      actions_due_30_days: due30.length,
      next_action_due_at: due30[0]?.due_at ?? null,
      submitted_this_quarter: submittedIn(qStart, now + DAY).length,
      submitted_last_quarter: submittedIn(pStart, qStart).length,
      quarter_start: new Date(qStart).toISOString().slice(0, 10),
      quarter_end: new Date(Date.UTC(new Date(qStart).getUTCFullYear(), new Date(qStart).getUTCMonth() + 3, 0)).toISOString().slice(0, 10),
      patents_filed_this_quarter: patents.filter((p) => within(p.filing_date, qStart, now + DAY)).length,
      idea_pipeline: {
        this_quarter: pipeline(submittedIn(qStart, now + DAY)),
        last_quarter: pipeline(submittedIn(pStart, qStart)),
        all_time: pipeline(ideas.filter((idea) => !!idea.submitted_at)),
      },
    },
    top_inventors: {
      this_month: rank(submittedIn(mStart, now + DAY), patents.filter((p) => within(p.filing_date, mStart, now + DAY))),
      this_quarter: rank(submittedIn(qStart, now + DAY), patents.filter((p) => within(p.filing_date, qStart, now + DAY))),
      last_quarter: rank(submittedIn(pStart, qStart), patents.filter((p) => within(p.filing_date, pStart, qStart))),
      this_year: rank(submittedIn(yStart, now + DAY), patents.filter((p) => within(p.filing_date, yStart, now + DAY))),
      all_time: rank(ideas.filter((i) => !!i.submitted_at), patents),
    },
    patents_by_jurisdiction: [...byJ.entries()].map(([jurisdiction, count]) => ({ jurisdiction, count })).sort((a, b) => b.count - a.count),
  };
}

/** The dashboard as pulse-backend's misc controller returns it, over the visible portfolio. */
export const dashboardHandlers = [
  route("get", "/v1/dashboard", ({ url }) => {
    const db = getDb(); const u = currentUser();
    const cid = q(url, "client_id");
    const scope = cid ? [cid] : scopeFor(u);
    const ideas = visibleIdeas(db, u).filter((i) => !cid || i.client_id === cid);
    const patents = allPatents(scope);
    const n = (...s: string[]) => patents.filter((p) => s.includes(p.status)).length;
    const since = (d: number) => clock.now() - d * 86_400_000;
    const weekly = Array.from({ length: 8 }, (_, k) => { const start = clock.now() - (8 - k) * 7 * 86_400_000, end = start + 7 * 86_400_000; return { week: new Date(start).toISOString().slice(0, 10), ideas: ideas.filter((i) => i.submitted_at && Date.parse(i.submitted_at) >= start && Date.parse(i.submitted_at) < end).length, patents: patents.filter((p) => p.filing_date && Date.parse(p.filing_date) >= start && Date.parse(p.filing_date) < end).length }; });
    const clients = db.clients.filter((c) => scope === null || scope.includes(c.id));
    // BF-5 (V0 scenarios only, DSN-0002): the workspace-scoped aggregates the
    // Workspace Admin dashboard's stat strip, Top inventors and jurisdiction
    // list read. Declared in mock/proposed-fields.json; the legacy tier gets
    // the answer the backend gives today.
    const v0 = db.flags.v0 ? v0Aggregates(ideas, patents, scope) : {};
    return {
      ...v0,
      pipeline: null,
      patents: { granted: n("GRANTED"), applied: n("APPLIED"), examination: n("EXAMINATION"), inactive: n("EXPIRED", "WITHDRAWN", "REJECTED", "ABANDONED", "NONPAYMENT"), total: patents.length },
      top_clients: clients.map((c) => ({ id: c.id, name: c.name, total_patents: patents.filter((p) => p.client_id === c.id).length })).sort((a, b) => b.total_patents - a.total_patents).slice(0, 5),
      client_metrics: clients.map((c) => ({ client_id: c.id, name: c.name, ideas_last_30_days: ideas.filter((i) => i.client_id === c.id && i.submitted_at && Date.parse(i.submitted_at) >= since(30)).length, patents_filed_last_90_days: patents.filter((p) => p.client_id === c.id && p.filing_date && Date.parse(p.filing_date) >= since(90)).length, weekly_series: weekly })),
      weekly_series: weekly,
      ideas_last_30_days: ideas.filter((i) => i.submitted_at && Date.parse(i.submitted_at) >= since(30)).length,
      patents_filed_last_90_days: patents.filter((p) => p.filing_date && Date.parse(p.filing_date) >= since(90)).length,
    };
  }),
];
