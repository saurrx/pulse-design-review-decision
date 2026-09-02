import { getDb, touched } from "./db";
import { generatePortfolio } from "../scenarios/portfolio";
import type { DueDate, Patent, User } from "./types";

/** Reads over the generated portfolio plus the store's runtime rows and overrides. */
export function scopeFor(u: User | null): string[] | null {
  if (!u) return [];
  if (u.role === "PHOTON_ADMIN" || u.role === "PHOTON_SUPERADMIN") return null;
  if (u.role === "CASE_OWNER") return u.assigned_client_ids;
  return u.client_id ? [u.client_id] : [];
}
const inScope = (scope: string[] | null, clientId: string) => scope === null || scope.includes(clientId);

function generated(clientId: string) {
  const db = getDb();
  const spec = db.portfolios[clientId];
  const client = db.clients.find((c) => c.id === clientId);
  if (!spec || !client) return null;
  return generatePortfolio(client, spec);
}

const withPatentOverride = (p: Patent): Patent => { const o = getDb().patentOverrides[p.id]; return o ? { ...p, ...o } : p; };
const withDueOverride = (d: DueDate): DueDate => { const o = getDb().dueDateOverrides[d.id]; return o ? { ...d, ...o } : d; };

export function allPatents(scope: string[] | null): Patent[] {
  const db = getDb();
  const ids = scope ?? db.clients.map((c) => c.id);
  const out: Patent[] = [];
  for (const cid of ids) {
    const g = generated(cid);
    if (g) for (const p of g.patents) out.push(withPatentOverride(p));
  }
  for (const p of db.patents) if (inScope(scope, p.client_id)) out.push(withPatentOverride(p));
  return out.filter((p) => !p.deleted_at);
}

export function patentById(id: string): Patent | null {
  const db = getDb();
  const own = db.patents.find((p) => p.id === id);
  if (own) return withPatentOverride(own);
  for (const cid of Object.keys(db.portfolios)) { const g = generated(cid); const p = g?.byId.get(id); if (p) return withPatentOverride(p); }
  return null;
}

export function allDueDates(scope: string[] | null): DueDate[] {
  const db = getDb();
  const ids = scope ?? db.clients.map((c) => c.id);
  const out: DueDate[] = [];
  for (const cid of ids) { const g = generated(cid); if (g) for (const d of g.dueDates) out.push(withDueOverride(d)); }
  for (const d of db.dueDates) if (inScope(scope, d.client_id)) out.push(withDueOverride(d));
  return out;
}

export function dueDateById(id: string): DueDate | null {
  const db = getDb();
  const own = db.dueDates.find((d) => d.id === id);
  if (own) return withDueOverride(own);
  for (const cid of Object.keys(db.portfolios)) { const g = generated(cid); const d = g?.dueById.get(id); if (d) return withDueOverride(d); }
  return null;
}

export function overridePatent(id: string, patch: Partial<Patent>) { const db = getDb(); db.patentOverrides[id] = { ...(db.patentOverrides[id] ?? {}), ...patch, updated_at: new Date().toISOString() }; touched(); return patentById(id)!; }
export function overrideDueDate(id: string, patch: Partial<DueDate>) { const db = getDb(); db.dueDateOverrides[id] = { ...(db.dueDateOverrides[id] ?? {}), ...patch, updated_at: new Date().toISOString() }; touched(); return dueDateById(id)!; }

export const paginate = <T,>(rows: T[], page: number, limit: number) => ({ data: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) } });
export const q = (url: URL, name: string) => url.searchParams.get(name);
export const qi = (url: URL, name: string, d: number) => { const v = Number(url.searchParams.get(name)); return Number.isFinite(v) && v > 0 ? v : d; };
