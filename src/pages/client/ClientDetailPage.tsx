import React, { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ClientDetails, {
  ClientDetailsRef,
} from "@/components/clients/ClientDetails";
import ClientTabs from "@/components/clients/ClientTabs";
import ClientLogo from "@/components/clients/ClientLogo";
import { useParams, Navigate } from "react-router-dom";
import { User, Pen, X, Save, Globe2, BriefcaseBusiness } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { useTheme } from "@/hooks/useTheme";
import useUserCookie from "@/hooks/use-auth";
import { isOutsideCounselRole } from "@/lib/roleAccess";

const ClientDetailPage: React.FC = () => {
  const { theme } = useTheme();
  const { clientId } = useParams();
  const { user } = useUserCookie();
  // A case owner's reach comes from assignment rows, and the session carries
  // them. Off-assignment: the page is read-only and the one action is asking
  // for access — which notifies every Photon admin through the audited flow,
  // instead of a button that 403s.
  const isUnassignedCaseOwner =
    user?.role === "CASE_OWNER" &&
    !((user as any)?.assigned_client_ids ?? []).includes(clientId);
  const requestAccessMutation = useMutation({
    mutationFn: async () =>
      (await API_CONFIG.post(`/api/v1/clients/${clientId}/request-access`))?.data,
    onSuccess: () => toast.success("Access requested — the Photon admins have been notified."),
    onError: () => toast.error("Couldn't send the request. Try again."),
  });
  const isCaseOwner = user?.role === "CASE_OWNER";
  const assignedClientIds: string[] = Array.isArray(user?.assigned_client_ids)
    ? user.assigned_client_ids
    : [];
  const canViewClient =
    user?.role === "PHOTON_ADMIN" ||
    (isCaseOwner && !!clientId && assignedClientIds.includes(clientId));
  const [isEditMode, setIsEditMode] = useState(false);
  const [isClientModeModalOpen, setIsClientModeModalOpen] = useState(false);
  const [isOwnerDialogOpen, setIsOwnerDialogOpen] = useState(false);
  const clientDetailsRef = useRef<ClientDetailsRef>(null);
  const queryClient = useQueryClient();

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
    enabled: !!clientId && !!user && canViewClient,
    refetchOnMount: true,
  });

  const { data: accessData } = useQuery({
    queryKey: ["case-owners"],
    queryFn: async () => {
      const response = await API_CONFIG.get("/api/v1/case-owners");
      return response.data.data;
    },
    enabled: user?.role === "PHOTON_ADMIN",
  });
  const caseOwners = (accessData?.owners || []).filter(
    (member: any) => member.role === "CASE_OWNER",
  );
  const assignedOwner = isCaseOwner
    ? user
    : caseOwners.find((owner: any) =>
        owner.assigned_client_ids?.includes(clientId),
      );

  const ownerMutation = useMutation({
    mutationFn: async (owner: any) =>
      API_CONFIG.put(`/api/v1/case-owners/${owner.id}/assignments`, {
        clientIds: Array.from(
          new Set([...(owner.assigned_client_ids || []), clientId]),
        ),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-owners"] });
      setIsOwnerDialogOpen(false);
      toast.success("Case Owner updated");
    },
  });

  const { mutate: loginAsClient, isPending: isLoggingInAsClient } = useMutation(
    {
      mutationKey: ["login_as_client", clientId],
      mutationFn: async () => {
        try {
          const response = await API_CONFIG.post(
            `/api/v1/auth/login-as-client/${clientId}`,
          );

          // Handle response structure
          const userData = response?.data?.data?.user || response?.data?.user;

          if (userData) {
            // Save original admin user info before switching to client mode
            // (admin token is saved server-side as pl_admin_token HttpOnly cookie)
            const originalAdminUser = Cookies.get("pl_user");

            if (originalAdminUser) {
              sessionStorage.setItem("pl_original_admin_user", originalAdminUser);
              sessionStorage.setItem("pl_client_mode", "true");
            }

            // Update pl_user cookie with client user data
            // (pl_access_token is set server-side as HttpOnly cookie)
            Cookies.remove("pl_user", { path: "/" });
            Cookies.set("pl_user", JSON.stringify(userData), { secure: true, sameSite: "lax", path: "/" });

            toast.success("Entered client mode successfully");

            // Force a full page reload
            window.location.replace("/");
          } else {
            console.error("Missing user in response");
            toast.error("Invalid response from server");
          }
          return response?.data;
        } catch (error: any) {
          console.error("Error logging in as client", error);
          toast.error(
            error?.response?.data?.message || "Error entering client mode"
          );
          throw error;
        }
      },
    },
  );

  const handleProceedToClientMode = () => {
    if (clientId) {
      loginAsClient();
    }
  };

     // Case owners may only open clients explicitly assigned to their session.
     const allowedRoles = ["PHOTON_ADMIN", "CASE_OWNER"];
     if (!user) {
       return <Loader />;
     }
     if (user && !allowedRoles.includes(user.role)) {
       return <Navigate to="/" replace />;
     }
     if (user && !canViewClient) {
       return <Navigate to="/clients" replace />;
     }

  return (
    <DashboardLayout
      className="relative"
      header={{
        title: !isFetching && clientData?.data?.name
          ? clientData.data.name
          : "Client workspace",
        back: { label: "Back to clients", to: "/clients" },
        actions:
          isOutsideCounselRole(user?.role) ? (
            isEditMode ? (
              <>
                <button
                  onClick={() => setIsEditMode(false)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--pulse-line)] px-3 text-sm font-medium text-[var(--pulse-ink-secondary)] transition-colors hover:border-[var(--pulse-line-strong)] hover:text-[var(--pulse-ink)]"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
                <button
                  onClick={async () => {
                    await clientDetailsRef.current?.saveChanges();
                  }}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--pulse-brand)] px-3 text-sm font-semibold text-[var(--pulse-ink)] transition-colors hover:bg-[var(--pulse-brand-hover)]"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">Save changes</span>
                </button>
              </>
            ) : (
              <>
                {isUnassignedCaseOwner ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg"
                    disabled={requestAccessMutation.isPending}
                    onClick={() => requestAccessMutation.mutate()}
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden lg:inline">
                      {requestAccessMutation.isPending ? "Requesting…" : "Request access"}
                    </span>
                  </Button>
                ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => setIsClientModeModalOpen(true)}
                >
                  <User className="h-4 w-4" />
                  <span className="hidden lg:inline">View as client</span>
                </Button>
                )}
                {user?.role === "PHOTON_ADMIN" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => setIsEditMode(true)}
                >
                  <Pen className="h-4 w-4" />
                  <span className="hidden lg:inline">Edit client</span>
                </Button>
                )}
              </>
            )
          ) : null,
      }}
    >
      <div className="pulse-product-page h-full dark:bg-[#0a0a0a]">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
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
        {/* Client identity summary */}
        <div
          className={`relative z-10 flex-shrink-0 ${
            theme === "dark"
              ? "bg-neutral-950"
              : "bg-[var(--pulse-canvas)]"
          }`}
        >
          <div className="mx-auto w-full max-w-[1440px] px-5 pt-6 md:px-8">
            <div className="rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] p-4">
              <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-white p-2 text-lg font-bold text-amber-700">
                <ClientLogo
                  client={clientData?.data}
                  className="max-h-11 max-w-12 object-contain"
                  fallbackClassName="text-sm font-semibold text-amber-700"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`font-sans text-lg font-semibold tracking-[-0.015em] ${theme === "dark" ? "text-zinc-200" : "text-[var(--pulse-ink)]"}`}>{!isFetching && clientData?.data?.name}</div>
                  <span className="rounded-lg border border-[var(--pulse-success)]/20 bg-[var(--pulse-success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--pulse-success)]">Active client</span>
                </div>
                <p className="mt-1 max-w-2xl truncate text-sm text-neutral-500">{clientData?.data?.about}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" />{clientData?.data?.allowed_domain?.split("@").pop()}</span>
                  <button onClick={() => user?.role === "PHOTON_ADMIN" && setIsOwnerDialogOpen(true)} className="inline-flex items-center gap-1.5 font-medium text-neutral-700 hover:text-amber-700"><BriefcaseBusiness className="h-3.5 w-3.5" />Case Owner: {assignedOwner?.name || "Not assigned"}{user?.role === "PHOTON_ADMIN" && <span className="text-amber-700">Change</span>}</button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
        <div
          className={`flex-1 !overflow-y-auto ${
            theme === "dark" ? "bg-transparent" : "bg-neutral-50"
          }`}
        >
          {isLoading && !clientData ? (
            <Loader />
          ) : (
            <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 py-6 md:px-8">
              {isEditMode ? (
                <div className="mx-auto max-w-3xl">
                  <ClientDetails
                    ref={clientDetailsRef}
                    clientData={clientData?.data}
                    clientId={clientId ?? ""}
                    refetchClientData={refetchClientData}
                    isEditMode={isEditMode}
                    onSaveComplete={() => {
                      setIsEditMode(false);
                    }}
                    onCancel={() => {
                      setIsEditMode(false);
                    }}
                  />
                </div>
              ) : (
                  <ClientTabs
                    clientId={clientId ?? ""}
                    clientData={clientData?.data}
                    caseOwnerName={assignedOwner?.name}
                    onChangeCaseOwner={user?.role === "PHOTON_ADMIN" ? () => setIsOwnerDialogOpen(true) : undefined}
                    canManageTeam={user?.role === "PHOTON_ADMIN"}
                    clientTeam={clientData?.data?.User}
                    patentFileHistory={clientData?.data?.PatentFileHistory}
                  />
              )}
            </div>
          )}
        </div>

        <Dialog open={isOwnerDialogOpen} onOpenChange={setIsOwnerDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>Change Case Owner</DialogTitle>
              <DialogDescription>Select the Case Owner who should have access to {clientData?.data?.name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              {caseOwners.map((owner: any) => (
                <button
                  key={owner.id}
                  onClick={() => ownerMutation.mutate(owner)}
                  disabled={ownerMutation.isPending}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${assignedOwner?.id === owner.id ? "border-[#F9B418] bg-amber-50" : "border-neutral-200 hover:border-neutral-300"}`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">{owner.name?.charAt(0) || owner.email?.charAt(0)}</span>
                  <span className="flex-1"><span className="block text-sm font-semibold text-neutral-900">{owner.name}</span><span className="block text-xs text-neutral-500">{owner.email}</span></span>
                  {assignedOwner?.id === owner.id && <span className="text-xs font-medium text-amber-700">Current</span>}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Client Mode Modal */}
        {isClientModeModalOpen && (
          <Dialog
            open={isClientModeModalOpen}
            onOpenChange={setIsClientModeModalOpen}
          >
            <DialogContent
              className={`sm:max-w-lg max-w-md backdrop-blur-xl border ${
                theme === "dark"
                  ? "bg-black/90 border-[#cccccc20]"
                  : "bg-white/95 border-neutral-200"
              }`}
            >
              <DialogHeader className="flex flex-col gap-2 text-center sm:text-left">
                <DialogTitle
                  className={`text-xl leading-none font-semibold flex items-center gap-2 ${
                    theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                  }`}
                >
                  <User className="w-5 h-5 text-[#F9B418]" />
                  Enter Client Mode
                </DialogTitle>
                <DialogDescription
                  className={`text-sm ${
                    theme === "dark" ? "text-zinc-500" : "text-neutral-600"
                  }`}
                >
                  You are entering client mode for{" "}
                  {!isFetching && clientData?.data?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div
                  className={`p-4 rounded-lg border bg-[#F9B418]/10 border-[#F9B418]/30 ${
                    theme === "dark" ? "text-zinc-200" : "text-neutral-800"
                  }`}
                >
                  <p className="mb-3 font-medium">
                    Before proceeding, please ensure:
                  </p>
                  <ul className="space-y-2 list-disc list-inside">
                    <li>
                      You have proper authorization to access this client's
                      account
                    </li>
                    <li>You understand the restricted view limitations</li>
                    <li>All actions taken will be logged for audit purposes</li>
                    <li>
                      You will only access information necessary for client
                      support
                    </li>
                  </ul>
                </div>
                <p
                  className={`text-sm ${
                    theme === "dark" ? "text-zinc-500" : "text-neutral-600"
                  }`}
                >
                  Client Mode provides a limited view of the platform as the
                  client would see it, with certain administrative features
                  disabled.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsClientModeModalOpen(false)}
                    className={`flex-1 px-4 py-2.5 rounded-md text-sm transition-all border ${
                      theme === "dark"
                        ? "bg-zinc-900 border-[#cccccc20] text-zinc-200 hover:bg-[#cccccc30]"
                        : "bg-neutral-100 border-neutral-200 text-neutral-700 hover:bg-neutral-200"
                    }`}
                    disabled={isLoggingInAsClient}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProceedToClientMode}
                    disabled={isLoggingInAsClient}
                    className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all bg-[#F9B418] hover:bg-[#F9B418]/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingInAsClient ? "Processing..." : "Proceed"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ClientDetailPage;
