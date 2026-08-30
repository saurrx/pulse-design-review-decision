import React from "react";
import { lazy, Suspense, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BackgroundAnalysisProvider } from "@/contexts/BackgroundAnalysisContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import ProtectedRoutes from "./lib/ProtectedRoutes";
import DesktopOnlyGate from "./components/DesktopOnlyGate";
import PublicRoutes from "./lib/PublicRoutes";
import { PostHogProvider } from "@posthog/react";
import { posthog, analyticsEnabled, beforeSend } from "@/lib/analytics";

// Init once, at module scope, and ONLY behind the fail-closed env gate. When the
// gate is off (dev/local/preview, or no key) init never runs, so every
// posthog.capture is an uninitialised no-op and NOTHING is sent — the
// `<PostHogProvider>` below still mounts safely with the inert client.
// NO session replay (disable_session_recording) is the load-bearing privacy line
// for unfiled disclosures; before_send is the denylist + route-id-normalise belt.
if (analyticsEnabled()) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
    defaults: "2026-05-30",
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    autocapture: true,
    enable_heatmaps: true,
    capture_pageview: "history_change",
    disable_session_recording: true,
    person_profiles: "identified_only",
    before_send: beforeSend,
  });
}

const Index = lazy(() => import("./pages/Index"));
const IdeasPage = lazy(() => import("./pages/IdeasPage"));
const IdeaDetailsPage = lazy(() => import("./pages/IdeaDetailsPage"));
const IdeaDraftPage = lazy(() => import("./pages/IdeaDraftPage"));
const PatentsPage = lazy(() => import("./pages/PatentsPage"));
const DueDatesPage = lazy(() => import("./pages/DueDatesPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ClientsPage = lazy(() => import("./pages/client/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/client/ClientDetailPage"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const Login = lazy(() => import("./pages/auth/Login"));
const AssistantPage = lazy(() => import("./pages/client/AssistantPage"));
const ActionsPage = lazy(() => import("./pages/ActionsPage"));
const Invite = lazy(() => import("./pages/auth/Invite"));
const Signup = lazy(() => import("./pages/auth/Signup"));

/**
 * Route-transition chrome. Every page is React.lazy, so EVERY navigation used
 * to paint a full-viewport EMPTY div while the chunk loaded — the app felt
 * hung on slow links, and after a redeploy (stale chunk hash) it stayed blank
 * forever because nothing caught the failed import. Three pieces fix that:
 *
 *  - TopLoader: the thin animated bar at the very top, the pattern YouTube/
 *    GitHub use — motion without layout shift, visible on every transition.
 *  - PageFallback now shows the bar plus a quiet spinner instead of nothing.
 *  - RouteErrorBoundary catches a rejected lazy import and reloads ONCE per
 *    navigation (the standard recovery for a stale-deploy chunk miss; see
 *    also the vite:preloadError listener in main.tsx).
 */
const TopLoader = () => (
  <div className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent" aria-hidden>
    <div
      className="h-full w-2/5 rounded-full bg-[#F9B418] motion-safe:animate-[pulse-slide_1.1s_ease-in-out_infinite]"
      style={{ boxShadow: "0 0 8px rgba(249,180,24,.7)" }}
    />
    <style>{`@keyframes pulse-slide{0%{transform:translateX(-100%)}60%{transform:translateX(160%)}100%{transform:translateX(260%)}}`}</style>
  </div>
);

const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <TopLoader />
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-[#F9B418] motion-reduce:animate-none" aria-label="Loading" />
  </div>
);

class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) {
    const msg = String(err);
    // A dynamically imported chunk that no longer exists = a deploy happened
    // under this tab. Reload once to pick up the new manifest.
    if (/Failed to fetch dynamically imported|Importing a module script failed|ChunkLoadError/.test(msg)
        && !sessionStorage.getItem("pl_chunk_reloaded")) {
      sessionStorage.setItem("pl_chunk_reloaded", "1");
      window.location.reload();
    }
  }
  render() {
    if (this.state.failed) return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 text-sm text-neutral-600">
        <p>This page failed to load — usually a new version was just deployed.</p>
        <button className="rounded border px-3 py-1.5" onClick={() => { sessionStorage.removeItem("pl_chunk_reloaded"); window.location.reload(); }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: 5 * 60 * 1000, // 5 minutes default stale time
      },
    },
  }));

  return (
    <PostHogProvider client={posthog}>
    <ThemeProvider>
      {/* A Google OAuth *client ID* is public — it ships in the bundle either
          way — but hardcoding it means every environment shares one OAuth
          client, and staging cannot have its own authorised origins. The
          literal stays as the fallback so behaviour is unchanged when the env
          var is unset. It must match GOOGLE_CLIENT_ID on the API, which
          verifies the token audience. */}
      <GoogleOAuthProvider
        clientId={
          (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
          "376798389820-em6eve9874gue4qkvq9dnod98tvjnc15.apps.googleusercontent.com"
        }
      >
        <QueryClientProvider client={queryClient}>
          <BackgroundAnalysisProvider>
            <TooltipProvider>
              <DesktopOnlyGate />
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <RouteErrorBoundary>
              <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route element={<PublicRoutes />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/invite" element={<Invite />} />
                  <Route path="/i/:inviteCode" element={<Invite />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                </Route>

                <Route element={<ProtectedRoutes />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route
                    path="/clients/:clientId"
                    element={<ClientDetailPage />}
                  />
                  <Route path="/ideas" element={<IdeasPage />} />
                  <Route path="/assistant" element={<AssistantPage />} />
                  <Route path="/ideas/:id" element={<IdeaDetailsPage />} />
                  <Route path="/ideas/:id/draft" element={<IdeaDraftPage />} />
                  <Route path="/patents" element={<PatentsPage />} />
                  <Route path="/patents/:patentId" element={<PatentsPage />} />
                  <Route path="/due-dates" element={<DueDatesPage />} />
                  <Route path="/workspace" element={<WorkspacePage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/actions" element={<ActionsPage />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </RouteErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
          </BackgroundAnalysisProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
    </PostHogProvider>
  );
};

export default App;
