import Cookies from "js-cookie";
import type { Db, User } from "./types";

/**
 * The session as the app sees it. Production writes the login response's user
 * into the readable `pl_user` cookie and reads role and scope from it; the
 * HttpOnly tokens matter only to the real API. So a mock session is this
 * cookie plus the login endpoint answering with the same shape.
 * Shape: pulse-backend auth.service presentUser().
 */
export function presentUser(u: User, db: Db) {
  const client = u.client_id ? db.clients.find((c) => c.id === u.client_id) ?? null : null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    phone: null,
    country_code: null,
    country_name: null,
    address: null,
    notification_prefs: { reviewDecisions: true, informationRequests: true, filingUpdates: true },
    client_id: u.client_id,
    clientId: u.client_id,
    organization_name: client?.name ?? (u.client_id ? undefined : "Photon Legal"),
    client: client ? { id: client.id, name: client.name, logo_file: null } : null,
    assigned_client_ids: u.assigned_client_ids,
  };
}

export const COOKIE = "pl_user";

export function readSessionUser(): { id: string; email: string; role: string; client_id?: string | null } | null {
  const raw = Cookies.get(COOKIE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function writeSessionCookie(u: User, db: Db) {
  Cookies.set(COOKIE, JSON.stringify(presentUser(u, db)), { sameSite: "lax", path: "/" });
}

export function clearSessionCookie() {
  Cookies.remove(COOKIE, { path: "/" });
  Cookies.remove(COOKIE);
}

/** Every production storage key the app writes; cleared before a story renders. */
export const PRODUCTION_STORAGE_KEYS = {
  local: ["theme", "pulse-sidebar-collapsed", "pl-timeline-view", "analysisDraftID", "selectedDraftID"],
  localPrefixes: ["run-bg-score-", "pulse-review-viewed:", "topInventorsMetric:", "pulse-patents-columns"],
  session: ["pl_client_mode", "pl_original_admin_user", "pl_chunk_reloaded"],
};

export function clearProductionStorage() {
  try {
    for (const k of PRODUCTION_STORAGE_KEYS.local) localStorage.removeItem(k);
    for (const k of Object.keys(localStorage)) if (PRODUCTION_STORAGE_KEYS.localPrefixes.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    for (const k of PRODUCTION_STORAGE_KEYS.session) sessionStorage.removeItem(k);
  } catch { /* storage unavailable */ }
}

export type Selection = { scenario: string; persona: string | null };
const SELECTION_KEY = "pulse-design.selection";

/** Query string wins, then the remembered choice, then the scenario default. */
export function readSelection(defaultScenario: string): Selection {
  const q = new URLSearchParams(location.search);
  const fromQuery = q.get("scenario");
  const personaQuery = q.get("persona") ?? q.get("role");
  if (fromQuery) {
    const sel = { scenario: fromQuery, persona: personaQuery };
    writeSelection(sel);
    return sel;
  }
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { scenario: defaultScenario, persona: null };
}
export function writeSelection(sel: Selection) {
  try { localStorage.setItem(SELECTION_KEY, JSON.stringify(sel)); } catch { /* ignore */ }
}
