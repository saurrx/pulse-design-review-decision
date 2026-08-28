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

const Index = lazy(() => import("./pages/Index"));
const IdeasPage = lazy(() => import("./pages/IdeasPage"));
const IdeaDetailsPage = lazy(() => import("./pages/IdeaDetailsPage"));
const IdeaDraftPage = lazy(() => import("./pages/IdeaDraftPage"));
const PatentsPage = lazy(() => import("./pages/PatentsPage"));
const DueDatesPage = lazy(() => import("./pages/DueDatesPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));
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

const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center" />
);

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
                  <Route path="/actions" element={<ActionsPage />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
          </BackgroundAnalysisProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
};

export default App;
