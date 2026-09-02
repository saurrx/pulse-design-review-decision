import { http, HttpResponse, passthrough, type HttpHandler, type DefaultBodyType } from "msw";
import backend from "../../contract/backend.json";
import proposed from "../proposed-routes.json";
import { routeKey } from "./canon";
import { getDb } from "./db";

/**
 * Every handler registers under `METHOD /v1/...` canonicalised the way Atlas
 * does. A key that is not in the pinned backend route map is refused at
 * registration unless it is declared in mock/proposed-routes.json, in which
 * case every hit is recorded so the chip can show "needs backend" and the
 * record is marked conceptual. That is the whole enforcement of "no backend
 * changes" at runtime; tools/design/gates.mjs applies the same rule in CI.
 */
type Route = { method: string; path: string };
const KNOWN = new Set((backend as { routes: Route[] }).routes.map((r) => routeKey(r.method, r.path)));
const PROPOSED = new Map((proposed as Array<{ method: string; path: string; reason: string }>).map((r) => [routeKey(r.method, r.path), r.reason]));

export const stats = {
  unhandled: [] as string[],
  blocked: [] as string[],
  proposedHits: [] as string[],
  served: 0,
};

type Method = "get" | "post" | "put" | "patch" | "delete";
export type Ctx = { params: Record<string, string | readonly string[]>; url: URL; body: () => Promise<DefaultBodyType>; request: Request };
export type Result = DefaultBodyType | { status: number; body?: DefaultBodyType };

const isStatusResult = (r: unknown): r is { status: number; body?: DefaultBodyType } =>
  typeof r === "object" && r !== null && "status" in r && typeof (r as { status: unknown }).status === "number" && Object.keys(r as object).every((k) => k === "status" || k === "body");

export function route(method: Method, path: string, resolve: (ctx: Ctx) => Result | Promise<Result>): HttpHandler {
  const key = routeKey(method, path);
  if (!KNOWN.has(key) && !PROPOSED.has(key)) {
    throw new Error(`[pulse-design] handler for a route the backend does not have: ${key}. Declare it in mock/proposed-routes.json if the design needs it.`);
  }
  return http[method](path, async ({ params, request }) => {
    if (PROPOSED.has(key)) stats.proposedHits.push(key);
    stats.served++;
    // Scenario flags: latency for loading states, and a failing-writes mode for error states.
    let flags: { latencyMs?: number; mutationsFail?: boolean } = {};
    try { flags = getDb().flags ?? {}; } catch { /* no store yet */ }
    if (flags.latencyMs) await new Promise((r) => setTimeout(r, flags.latencyMs));
    if (flags.mutationsFail && method !== "get") return HttpResponse.json({ message: "This change could not be saved. Please try again." }, { status: 400 });
    const ctx: Ctx = {
      params,
      url: new URL(request.url),
      request,
      body: async () => { try { return (await request.clone().json()) as DefaultBodyType; } catch { return {}; } },
    };
    const r = await resolve(ctx);
    if (isStatusResult(r)) return r.body === undefined ? new HttpResponse(null, { status: r.status }) : HttpResponse.json(r.body, { status: r.status });
    return HttpResponse.json(r);
  });
}

/**
 * Egress and the unhandled rule, as the LAST handler:
 *  - same-origin, not /v1: pass through (Vite modules, assets, the worker script);
 *  - /v1 with no handler: 501 and a recorded miss, which the gates fail on;
 *  - any other host: a network error. Nothing leaves the machine.
 */
export const EGRESS_ALLOW: string[] = [];

/**
 * One legacy call site still targets the old API host directly (the draft-files
 * download). It is not a /v1 route, so it lives outside the registry guard as
 * an explicit exception; the redesign must not depend on it.
 */
export function legacyHandlers(): HttpHandler[] {
  return [http.get("https://api-pulse.photonlegal.com/api/v1/idea/download-draft-files/:id", () =>
    new HttpResponse(new Blob(["mock archive"], { type: "application/zip" }), { status: 200, headers: { "content-type": "application/zip" } }))];
}
export function egressHandler(): HttpHandler {
  return http.all("*", ({ request }) => {
    const u = new URL(request.url);
    if (typeof location !== "undefined" && u.origin === location.origin) {
      if (!u.pathname.startsWith("/v1")) return passthrough();
      const miss = `${request.method} ${u.pathname}`;
      stats.unhandled.push(miss);
      console.error(`[pulse-design] no mock handler for ${miss}`);
      return HttpResponse.json({ message: `No mock handler for ${miss}` }, { status: 501 });
    }
    if (EGRESS_ALLOW.includes(u.host)) return passthrough();
    stats.blocked.push(u.host);
    console.error(`[pulse-design] blocked request to ${u.host}`);
    return HttpResponse.error();
  });
}
