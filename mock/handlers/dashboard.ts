import { route } from "../runtime/registry";
import { getDb } from "../runtime/db";
import { clock } from "../runtime/clock";
import { currentUser, visibleIdeas } from "./scope";
import { allPatents, scopeFor, q } from "../runtime/store";

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
    return {
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
