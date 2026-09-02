import React from "react";
import type { Decorator, Loader } from "@storybook/react-vite";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BackgroundAnalysisProvider } from "@/contexts/BackgroundAnalysisContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { SCENARIOS, DEFAULT_SCENARIO } from "../../mock/scenarios";
import { resetDb, getDb } from "../../mock/runtime/db";
import { clock, installFakeDate } from "../../mock/runtime/clock";
import { clearProductionStorage, clearSessionCookie, writeSessionCookie } from "../../mock/runtime/session";

/**
 * The story harness. A story names a scenario, a persona (by role or email)
 * and a route; the loader rebuilds the store, clears every production storage
 * key, writes the session cookie, pins the clock and stubs the browser
 * dialogs; the decorator mounts production's provider tree with a memory
 * router and only the story's own route under the real layout, plus a
 * catch-all that renders a navigation marker. There is no second route table.
 */
import type { Db } from "../../mock/runtime/types";

export type PulseParams = {
  scenario?: string;
  persona?: string;       // email, or a role name resolved inside the scenario's personas
  /** The location to open, e.g. "/ideas", or a function of the seeded store so a story can pick a record by state. */
  route?: string | ((db: Db) => string);
  path?: string;          // the route pattern if it has params, e.g. "/ideas/:id"
  layout?: "dashboard" | "public";
  retry?: boolean | number;
  clock?: string;
  /** Per-story adjustments to the seeded store, applied before the cookie is written. */
  prepare?: (db: Db) => void;
};

export const VIEWPORTS = {
  pulse1024: { name: "Desktop floor 1024", styles: { width: "1024px", height: "768px" }, type: "desktop" as const },
  pulse1280: { name: "Laptop 1280", styles: { width: "1280px", height: "720px" }, type: "desktop" as const },
  pulse1440: { name: "Review 1440", styles: { width: "1440px", height: "900px" }, type: "desktop" as const },
};

const stubs: { prompt?: typeof window.prompt; confirm?: typeof window.confirm } = {};
function stubDialogs() {
  if (!stubs.prompt) { stubs.prompt = window.prompt; stubs.confirm = window.confirm; }
  window.prompt = () => "Stubbed by the story harness";
  window.confirm = () => true;
}
function restoreDialogs() {
  if (stubs.prompt) window.prompt = stubs.prompt;
  if (stubs.confirm) window.confirm = stubs.confirm;
}

export const pulseLoader: Loader = async ({ parameters }) => {
  const p = (parameters.pulse ?? {}) as PulseParams;
  const scenario = SCENARIOS[p.scenario ?? DEFAULT_SCENARIO] ?? SCENARIOS[DEFAULT_SCENARIO];
  clock.set(p.clock ?? scenario.clock);
  installFakeDate();
  document.body.removeAttribute("data-story-ready");
  clearProductionStorage();
  clearSessionCookie();
  resetDb(scenario, { persist: false, fresh: true });
  const db = getDb();
  p.prepare?.(db);
  const persona = p.persona ?? (p.layout === "public" ? null : scenario.defaultPersona);
  if (persona) {
    const byRole = (list: typeof db.users) => list.find((u) => u.role === persona);
    const user = db.users.find((u) => u.email === persona) ?? byRole(db.users.filter((u) => scenario.personas.includes(u.email))) ?? byRole(db.users);
    if (!user) throw new Error(`[harness] no persona "${persona}" in scenario ${scenario.name}`);
    writeSessionCookie(user, db);
  }
  stubDialogs();
  const route = typeof p.route === "function" ? p.route(db) : p.route ?? "/";
  return { scenario: scenario.name, persona, route };
};

const NavMarker = () => {
  const loc = useLocation();
  return <div data-testid="navigated-to" data-pathname={loc.pathname} style={{ padding: 24, font: "13px ui-monospace, monospace" }}>navigated to {loc.pathname}{loc.search}</div>;
};

/** Flips `data-story-ready` on body once fonts are loaded and the chrome has had two frames to attach its portal slots. */
const ReadyMarker = () => {
  React.useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) document.body.setAttribute("data-story-ready", "1"); })));
    return () => { cancelled = true; document.body.removeAttribute("data-story-ready"); restoreDialogs(); };
  }, []);
  return null;
};

export const withPulse: Decorator = (Story, ctx) => {
  const p = (ctx.parameters.pulse ?? {}) as PulseParams;
  const route = (ctx.loaded as { route?: string }).route ?? (typeof p.route === "string" ? p.route : "/");
  const pattern = p.path ?? (typeof p.route === "string" ? route.split("?")[0] : route.split("?")[0]);
  const retry = p.retry ?? false;
  const client = React.useMemo(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnMount: false, refetchOnReconnect: false, staleTime: 5 * 60 * 1000, retry } },
  }), [ctx.id, retry]);
  const story = <><Story /><ReadyMarker /></>;
  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId="inert">
        <QueryClientProvider client={client}>
          <BackgroundAnalysisProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <MemoryRouter initialEntries={[route]}>
                <React.Suspense fallback={<div data-testid="story-suspense" />}>
                  <Routes>
                    {p.layout === "public"
                      ? <Route path={pattern} element={story} />
                      : <Route element={<DashboardLayout />}><Route path={pattern} element={story} /></Route>}
                    <Route path="*" element={<NavMarker />} />
                  </Routes>
                </React.Suspense>
              </MemoryRouter>
            </TooltipProvider>
          </BackgroundAnalysisProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
};
