import { readUserCookie } from "@/lib/auth";
import React, { useEffect, useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import OrganizationDetails from "@/components/workspace/OrganizationDetails";
import WorkspaceTabs from "@/components/workspace/WorkspaceTabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams, Navigate } from "react-router-dom";
import API_CONFIG from "@/lib/apiConfig";
import Loader from "@/components/Loader";
import Cookies from "js-cookie";
import useUserCookie from "@/hooks/use-auth";
import { Pen, X, Save } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const WorkspacePage: React.FC = () => {
  const { theme } = useTheme();
  const [clientId, setClientId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const saveAboutRef = useRef<(() => void) | null>(null);
  const saveProfileRef = useRef<(() => void) | null>(null);
  const cancelProfileRef = useRef<(() => void) | null>(null);
  const cancelAboutRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();
  const { user } = useUserCookie();
  const [searchParams] = useSearchParams();
  const activeTab =
    searchParams.get("tab") || (user?.role === "PHOTON_ADMIN" ? "people" : "profile");
  const isProfileTabActive = activeTab === "profile";
  const isPersonalProfile =
    user?.role === "INVENTOR" || user?.role === "CASE_OWNER";

  useEffect(() => {
    const client_id = readUserCookie()?.client_id ?? null;

    if (client_id) {
      setClientId(client_id);
    }
  }, []);

  const {
    data: clientData,
    isLoading,
    isError,
    error,
    isFetching,
    refetch: refetchClientData,
  } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/clients/${clientId}`);

      if (response.status === 200) {
        return response?.data;
      }
    },
    enabled: !!clientId && !isPersonalProfile,
    refetchOnMount: true,
  });

  // Only allow workspace access for admin roles
  const allowedRoles = ["PHOTON_ADMIN", "LEGAL_COUNSEL"];
  if (user && !allowedRoles.includes(user.role) && !isProfileTabActive) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout
      header={{
        actions: isProfileTabActive ? (
          isEditMode ? (
            <>
              <button
                onClick={() => {
                  cancelAboutRef.current?.();
                  cancelProfileRef.current?.();
                  setIsEditMode(false);
                }}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  theme === "dark"
                    ? "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-300"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
              <button
                onClick={() => {
                  saveProfileRef.current?.();
                  saveAboutRef.current?.();
                }}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--pulse-brand)] px-3 text-sm font-semibold text-[var(--pulse-ink)] transition-colors hover:bg-[var(--pulse-brand-hover)]"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Save</span>
              </button>
            </>
          ) : user?.role !== "PHOTON_ADMIN" ? (
            <button
              onClick={() => setIsEditMode(true)}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                theme === "dark"
                  ? "border-white/10 text-neutral-400 hover:border-[#F9B418]/50 hover:text-[#F9B418]"
                  : "border-neutral-200 text-neutral-600 hover:border-[#F9B418] hover:text-[#F9B418]"
              }`}
            >
              <Pen className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Edit profile</span>
            </button>
          ) : null
        ) : null,
      }}
    >
      <div className="pulse-product-page flex-1 flex flex-col overflow-hidden">
        {/* Animated Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {theme === "dark" ? (
          <>
            {/* Yellow Gradient Blob */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.4) 0%, rgba(245, 166, 35, 0) 70%)",
                top: "-10%",
                right: "10%",
                animationDelay: "0s",
              }}
            />
            {/* Cyan Gradient Blob */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 70%)",
                bottom: "10%",
                left: "5%",
                animationDelay: "2s",
              }}
            />
            {/* Purple Gradient Blob */}
            <div
              className="absolute w-[550px] h-[550px] rounded-full opacity-15 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0) 70%)",
                top: "40%",
                left: "30%",
                animationDelay: "4s",
              }}
            />
          </>
        ) : (
          <>
            {/* Yellow Gradient Blob - Light */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.2) 0%, rgba(245, 166, 35, 0) 70%)",
                top: "-10%",
                right: "10%",
                animationDelay: "0s",
              }}
            />
            {/* Cyan Gradient Blob - Light */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0) 70%)",
                bottom: "10%",
                left: "5%",
                animationDelay: "2s",
              }}
            />
            {/* Pink Gradient Blob - Light */}
            <div
              className="absolute w-[550px] h-[550px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)",
                top: "40%",
                left: "30%",
                animationDelay: "4s",
              }}
            />
          </>
        )}
      </div>
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div
            className={`flex-1 ${
              theme === "dark" ? "bg-neutral-950" : "bg-[var(--pulse-canvas)]"
            }`}
          >
            <div className="h-[90vh] overflow-auto px-4 pb-10 pt-6 md:px-8">
              {user?.role !== "PHOTON_ADMIN" &&
              ((isLoading && !isPersonalProfile) ||
              (!clientId && !clientData && !isPersonalProfile)) ? (
                <Loader />
              ) : (
                <div className={`mx-auto w-full ${user?.role === "PHOTON_ADMIN" ? "max-w-[1440px]" : isPersonalProfile ? "max-w-[960px]" : "grid max-w-[1440px] grid-cols-1 gap-4 md:gap-6 lg:grid-cols-4 lg:items-start"}`}>
                  {user?.role !== "PHOTON_ADMIN" && !isPersonalProfile && <div className="lg:col-span-1 lg:sticky -top-20">
                    <OrganizationDetails
                      refetchClientData={refetchClientData}
                      clientDetails={clientData?.data}
                      clientId={clientId ?? ""}
                      isEditMode={isEditMode}
                      setIsEditMode={setIsEditMode}
                      saveAboutRef={saveAboutRef}
                      cancelAboutRef={cancelAboutRef}
                    />
                  </div>}

                  <div className={user?.role === "PHOTON_ADMIN" || isPersonalProfile ? "w-full" : "lg:col-span-3"}>
                    <div
                      dir="ltr"
                      data-orientation="horizontal"
                      data-slot="tabs"
                      className="flex flex-col gap-2 w-full"
                    >
                      <WorkspaceTabs
                        clientDetails={clientData?.data}
                        clientId={clientId ?? ""}
                        isEditMode={isEditMode}
                        setIsEditMode={setIsEditMode}
                        saveProfileRef={saveProfileRef}
                        cancelProfileRef={cancelProfileRef}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WorkspacePage;
