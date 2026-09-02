import { route } from "../runtime/registry";
import { getDb } from "../runtime/db";
import { clock } from "../runtime/clock";
import { currentUser, visibleIdeas } from "./scope";

/** Enough of the dashboard and portfolio surface for the post-login landing to render honestly (empty portfolio, real idea counts). */
const pagination = (total: number, page = 1, limit = 25) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

export const dashboardHandlers = [
  route("get", "/v1/dashboard", () => {
    const db = getDb(); const u = currentUser();
    const ideas = visibleIdeas(db, u);
    const since30 = clock.now() - 30 * 86_400_000;
    const weeks = Array.from({ length: 8 }, (_, k) => ({ week: new Date(clock.now() - (7 - k) * 7 * 86_400_000).toISOString().slice(0, 10), ideas: ideas.filter((i) => i.submitted_at && Math.floor((clock.now() - Date.parse(i.submitted_at)) / (7 * 86_400_000)) === 7 - k).length, patents: 0 }));
    return {
      pipeline: null,
      patents: { granted: 0, applied: 0, examination: 0, inactive: 0, total: 0 },
      top_clients: db.clients.map((c) => ({ id: c.id, name: c.name, total_patents: 0 })),
      client_metrics: [],
      weekly_series: weeks,
      ideas_last_30_days: ideas.filter((i) => i.submitted_at && Date.parse(i.submitted_at) >= since30).length,
      patents_filed_last_90_days: 0,
    };
  }),
  route("get", "/v1/due-dates", () => ({ data: [], pagination: pagination(0) })),
  route("get", "/v1/patents/stats", () => ({ total: 0, granted: 0, applied: 0, examination: 0, inactive: 0, byJurisdiction: [] })),
  route("get", "/v1/patents/tags", () => []),
  route("get", "/v1/patents", ({ url }) => ({ data: [], pagination: pagination(0, Number(url.searchParams.get("page") ?? 1), Number(url.searchParams.get("limit") ?? 20)) })),
  route("get", "/v1/clients", () => getDb().clients.map((c) => ({ ...c, users: [], _count: { patents: 0, ideas: getDb().ideas.filter((i) => i.client_id === c.id).length, users: getDb().users.filter((u) => u.client_id === c.id).length } }))),
  route("get", "/v1/clients/:id", ({ params }) => {
    const db = getDb();
    const c = db.clients.find((x) => x.id === params.id);
    if (!c) return { status: 404, body: { message: "Client not found." } };
    return { ...c, about: null, users: db.users.filter((u) => u.client_id === c.id).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status })), _count: { patents: 0, ideas: db.ideas.filter((i) => i.client_id === c.id).length, users: db.users.filter((u) => u.client_id === c.id).length } };
  }),
];
