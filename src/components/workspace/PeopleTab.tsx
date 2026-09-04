import React, { useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/roles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Copy, Download, Link2, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { isUuid } from "@/lib/realAdapter";
import useUserCookie from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ClientInviteDialog from "@/components/clients/ClientInviteDialog";

type PeopleTabProps = {
  users: any[];
  allowedDomain: string;
  clientId: string;
  clientName?: string;
};

const PeopleTab: React.FC<PeopleTabProps> = ({ users, allowedDomain, clientId, clientName }) => {
  const { user } = useUserCookie();
  const queryClient = useQueryClient();
  const qrCodeRef = useRef<SVGSVGElement>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [localUsers, setLocalUsers] = useState<any[]>(Array.isArray(users) ? users : []);
  const domain = allowedDomain?.split("@").pop() || "your company domain";

  const { data: inviteLinkData, isLoading: isLoadingInviteLink } = useQuery({
    queryKey: ["client_invite_link", clientId],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/clients/${clientId}/invite-link`);
      return response?.data?.data;
    },
    // A Photon user carries the "photon-legal" sentinel, not a client id, and
    // the API answers 400 for it — this fired on every load of the Photon
    // workspace, which has no invite link to show in the first place.
    enabled: isUuid(clientId),
  });

  const generateLinkMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.post(`/api/v1/clients/${clientId}/invite-link`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
    },
    onError: () => toast.error("Could not generate the link. Try again."),
  });

  // Regenerating REVOKES the live link server-side and mints a new one, so the
  // old URL and QR stop working — say that before doing it.
  const regenerateLinkMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.post(`/api/v1/clients/${clientId}/invite-link`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
    },
    onError: () => toast.error("Could not regenerate the link. Try again."),
  });

  const deactivateLinkMutation = useMutation({
    // The revoke route takes the invite's id, not its short code.
    mutationFn: async () =>
      API_CONFIG.delete(`/api/v1/clients/${clientId}/invite-link/${inviteLinkData?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
    },
    onError: () => toast.error("Could not deactivate the link. Try again."),
  });

  const inviteLink = inviteLinkData?.token
    ? `${window.location.origin}/i/${inviteLinkData.token}`
    : "";
  const joinedCount = Number(inviteLinkData?.uses) || 0;
  const expiryLabel = inviteLinkData?.expires_at
    ? `Expires ${new Date(inviteLinkData.expires_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })}`
    : "Expires in 14 days";
  const lastJoinedLabel = inviteLinkData?.lastUsedAt
    ? new Date(inviteLinkData.lastUsedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    toast.success("Inventor invite link copied");
    window.setTimeout(() => setLinkCopied(false), 2000);
  };

  const qrCodeBlob = () =>
    new Promise<Blob>((resolve, reject) => {
      const svg = qrCodeRef.current;
      if (!svg) return reject(new Error("QR unavailable"));
      const source = new XMLSerializer().serializeToString(svg);
      const image = new Image();
      const svgUrl = URL.createObjectURL(
        new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
      );
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Canvas unavailable"));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 24, 24, 464, 464);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("QR conversion failed")),
          "image/png",
        );
      };
      image.onerror = reject;
      image.src = svgUrl;
    });

  const copyQrImage = async () => {
    try {
      const blob = await qrCodeBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("QR image copied");
    } catch {
      toast.error("Your browser could not copy the QR image");
    }
  };

  const downloadQrImage = async () => {
    try {
      const blob = await qrCodeBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${clientName || "workspace"}-inventor-invite.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the QR image");
    }
  };

  useEffect(() => {
    setLocalUsers((Array.isArray(users) ? users : []).map((person) => ({
      ...person,
      status: Boolean(person.active && person.verified),
    })));
  }, [users]);

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) =>
      API_CONFIG.put(`/api/v1/auth/update-profile/${userId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Could not update member role"),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => API_CONFIG.delete(`/api/v1/users/${userId}`),
    onSuccess: (_, userId) => {
      setLocalUsers((current) => current.filter((person) => String(person.id) !== userId));
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Could not remove member"),
  });

  const changeRole = (person: any, role: "INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL") => {
    setLocalUsers((current) => current.map((item) => item.id === person.id ? { ...item, role } : item));
    updateRoleMutation.mutate({ userId: String(person.id), role });
  };

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) =>
      API_CONFIG.put(`/api/v1/auth/update-profile/${userId}`, { status: "ACTIVE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Could not reactivate member"),
  });

  const removeMember = (person: any) => {
    if (window.confirm(`Remove ${person.name || person.email} from this workspace?`)) {
      removeMutation.mutate(String(person.id));
    }
  };

  const displayName = (person: any) => person?.name || person?.email?.split("@")[0] || "Workspace member";
  const initials = (person: any) => displayName(person).split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();
  const isActive = (person: any) => person.status ?? Boolean(person.active && person.verified);

  return (
    <div className="space-y-5 py-3 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-sans text-xl font-bold text-neutral-900 dark:text-neutral-100">People</h2>
          <p className="mt-1 text-sm text-neutral-500">Manage who can access the {clientName || "client"} workspace.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} variant="outline" className="gap-2">
          <UserPlus className="h-4 w-4" /> Invite administrator
        </Button>
      </div>

      <section className="rounded-md border border-[var(--pulse-line)] bg-[var(--pulse-surface)] p-5 shadow-[var(--pulse-shadow-card)] dark:border-[#cccccc20] dark:bg-neutral-900">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          {inviteLinkData?.active ? (
            <>
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[var(--pulse-surface-subtle)] text-[var(--pulse-ink-secondary)]">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--pulse-ink)]">Invite inventors</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--pulse-ink-muted)]">
                      Anyone at {domain} with this link can join as an inventor. Administrator access is never granted through shared links.
                    </p>
                    {/* The link is NOT non-expiring: the API gives a share
                        link 14 days, because its lifetime is its blast radius
                        (F-008). Saying "non-expiring" here promised the one
                        thing the server refuses to do. */}
                    <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">
                      {expiryLabel}
                      {joinedCount > 0
                        ? ` · ${joinedCount} joined${lastJoinedLabel ? ` · Last joined ${lastJoinedLabel}` : ""}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex max-w-2xl overflow-hidden rounded-sm border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)]">
                  <code className="min-w-0 flex-1 truncate px-3 py-2.5 text-xs text-[var(--pulse-ink-secondary)]" title={inviteLink}>
                    {inviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="inline-flex shrink-0 items-center gap-1.5 border-l border-[var(--pulse-line)] bg-white px-3 text-xs font-semibold text-[var(--pulse-ink)] transition-colors hover:bg-[var(--pulse-surface-subtle)]"
                  >
                    {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {linkCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-md border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] p-3">
                <div className="rounded-sm border border-[var(--pulse-line)] bg-white p-1.5">
                  <QRCodeSVG
                    ref={qrCodeRef}
                    value={inviteLink}
                    size={88}
                    level="M"
                    marginSize={2}
                    bgColor="#FFFFFF"
                    fgColor="#171717"
                    title={`Shareable QR code for ${clientName || "workspace"} inventor invitation`}
                  />
                </div>
                <div className="flex flex-col items-start gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--pulse-ink)]">Share QR</p>
                  </div>
                  <Button onClick={downloadQrImage} size="sm" variant="outline" className="h-8 text-xs">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </Button>
                  <button type="button" onClick={copyQrImage} className="text-[11px] font-medium text-[var(--pulse-ink-secondary)] hover:text-[var(--pulse-ink)] hover:underline">
                    Copy image
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--pulse-line)] pt-4 lg:col-span-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={regenerateLinkMutation.isPending}
                  onClick={() =>
                    window.confirm(
                      "Generate a new link? The current link and QR code stop working immediately.",
                    ) && regenerateLinkMutation.mutate()
                  }
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  {regenerateLinkMutation.isPending ? "Regenerating…" : "Regenerate"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deactivateLinkMutation.isPending || !inviteLinkData?.id}
                  onClick={() =>
                    window.confirm(
                      "Deactivate this invite link? Anyone holding it can no longer join.",
                    ) && deactivateLinkMutation.mutate()
                  }
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                  {deactivateLinkMutation.isPending ? "Deactivating…" : "Deactivate"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-[var(--pulse-surface-subtle)] text-[var(--pulse-ink-secondary)]">
                  <Link2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--pulse-ink)]">Invite inventors</h3>
                  <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">Generate an inventor-only link for {domain}. It lasts 14 days and can be regenerated at any time.</p>
                </div>
              </div>
              <Button
                onClick={() => generateLinkMutation.mutate()}
                disabled={isLoadingInviteLink || generateLinkMutation.isPending}
                className="shrink-0 bg-[var(--pulse-brand)] text-[var(--pulse-ink)] hover:bg-[var(--pulse-brand-hover)]"
              >
                {isLoadingInviteLink ? "Loading…" : "Generate inventor link"}
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-[var(--pulse-line)] bg-[var(--pulse-surface)] shadow-[0_18px_45px_-38px_rgba(17,16,60,0.45)] dark:border-[#cccccc20] dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-[#cccccc20]">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#F9B418]" />
            <h3 className="font-sans text-sm font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">Workspace members</h3>
          </div>
          <Badge variant="secondary">{localUsers.length} members</Badge>
        </div>

        <div className="divide-y divide-neutral-100 md:hidden dark:divide-neutral-800">
          {localUsers.map((person) => (
            <div key={person.id || person.email} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{initials(person)}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName(person)}</p><p className="truncate text-xs text-neutral-500">{person.email}</p></div>
                </div>
                <Badge variant="outline">{ROLE_LABEL[person.role] ?? "Inventor"}</Badge>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive(person) ? "text-emerald-700" : "text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${isActive(person) ? "bg-emerald-500" : "bg-amber-500"}`} />{isActive(person) ? "Active" : person.suspended ? "Disabled" : "Invited"}</span>
                {person.id !== user?.id && <Button variant="ghost" size="sm" onClick={() => removeMember(person)} className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</Button>}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/60"><tr><th className="px-5 py-3 font-semibold">Team member</th><th className="px-5 py-3 font-semibold">Email</th><th className="px-5 py-3 font-semibold">Role</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {localUsers.map((person) => (
                <tr key={person.id || person.email} className="hover:bg-neutral-50/70 dark:hover:bg-white/[0.03]">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{initials(person)}</span><span className="font-semibold">{displayName(person)}</span></div></td>
                  <td className="px-5 py-4 text-neutral-500">{person.email}</td>
                  <td className="px-5 py-4"><Select value={["LEGAL_COUNSEL", "TECH_COMMITTEE"].includes(person.role) ? person.role : "INVENTOR"} onValueChange={(value) => changeRole(person, value as "INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL")} disabled={person.id === user?.id}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INVENTOR">Inventor</SelectItem><SelectItem value="TECH_COMMITTEE">Tech Committee</SelectItem><SelectItem value="LEGAL_COUNSEL">Administrator</SelectItem></SelectContent></Select></td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive(person) ? "text-emerald-700" : "text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${isActive(person) ? "bg-emerald-500" : "bg-amber-500"}`} />{isActive(person) ? "Active" : person.suspended ? "Disabled" : "Invited"}</span></td>
                  <td className="px-5 py-4 text-right">{person.id === user?.id ? <span className="text-xs text-neutral-400">You</span> : person.suspended ? <Button variant="ghost" size="sm" onClick={() => reactivateMutation.mutate(String(person.id))} className="text-emerald-700 hover:bg-emerald-50">Reactivate</Button> : <Button variant="ghost" size="icon" onClick={() => removeMember(person)} className="text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ClientInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} clientId={clientId} clientName={clientName} allowedDomain={allowedDomain} adminOnly />
    </div>
  );
};

export default PeopleTab;
