import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/hooks/useTheme";
import API_CONFIG from "@/lib/apiConfig";
import { MAX_FILE_SIZE } from "@/utils/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, BriefcaseBusiness, CalendarDays, Check, CircleAlert, CircleCheck, CircleX, Copy, Download, FileText, Globe2, Hash, History, Plus, RefreshCw, TrendingUp, Upload, UserPlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import AddPatentModal from "./AddPatentModal";
import DuplicatePatentsModal from "./DuplicatePatentsModal";

type OverviewTabProps = {
  clientTeam: any[];
  patentFileHistory: any[];
  clientId: string;
  clientData: any;
  caseOwnerName?: string;
  onChangeCaseOwner?: () => void;
  canManageTeam?: boolean;
};

const OverviewTab: React.FC<OverviewTabProps> = ({ clientTeam = [], patentFileHistory = [], clientId, clientData, caseOwnerName, onChangeCaseOwner, canManageTeam }) => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [showAddPatentModal, setShowAddPatentModal] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicatePatents, setDuplicatePatents] = useState<any[]>([]);
  const [excelDuplicateEntries, setExcelDuplicateEntries] = useState<any[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [totalPatentImported, setTotalPatentImported] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"email" | "share">("email");
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL">("INVENTOR");
  const [referencePrefix, setReferencePrefix] = useState(
    clientData?.idea_reference_prefix || "IRN",
  );
  const qrCodeRef = useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    setReferencePrefix(clientData?.idea_reference_prefix || "IRN");
  }, [clientData?.idea_reference_prefix]);

  const { data: metricsData } = useQuery({
    queryKey: ["client_metrics", clientId],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/clients/patent-metrics/${clientId}`);
      return response.status === 200 ? response.data : undefined;
    },
  });

  const { data: inviteLinkData } = useQuery({
    queryKey: ["client_invite_link", clientId],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/clients/${clientId}/invite-link`);
      return response.data.data;
    },
    enabled: !!canManageTeam,
  });

  const { mutate: uploadPatentFile, isPending: isUploadingPatentFile } = useMutation({
    mutationKey: ["upload_patent_file", clientId],
    mutationFn: async (file: File) => {
      const { s3UploadForImport } = await import("@/lib/api-service/s3Upload");
      const uploaded = await s3UploadForImport(file, "patent");
      const response = await API_CONFIG.post("/api/v1/patent/import", {
        key: uploaded.key, client_id: clientId, originalName: uploaded.originalName,
        size: uploaded.size, contentType: uploaded.contentType,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      toast.success("Portfolio uploaded successfully");
      const patentData = data?.data;
      if (patentData) {
        setDuplicatePatents(patentData.duplicate_patents || []);
        setExcelDuplicateEntries(patentData.excel_duplicate_entries || []);
        setErrorCount(patentData.error_count || 0);
        setSuccessCount(patentData.success_count || 0);
        setTotalPatentImported(patentData.data?.length || 0);
        setDuplicateModalOpen(true);
      }
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client_metrics", clientId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "An error occurred while uploading the file"),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => API_CONFIG.post(`/api/v1/clients/${clientId}/invite-user`, { email: inviteEmail.trim(), role: inviteRole }),
    onSuccess: () => {
      toast.success(`${ROLE_LABEL[inviteRole] ?? "Inventor"} invitation sent`);
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("INVENTOR");
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Could not send invitation"),
  });

  const regenerateInviteMutation = useMutation({
    mutationFn: async () => API_CONFIG.post(`/api/v1/clients/${clientId}/invite-link`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
      toast.success("A new secure invite link was generated");
    },
  });

  const deactivateInviteMutation = useMutation({
    mutationFn: async () => API_CONFIG.delete(`/api/v1/clients/${clientId}/invite-link/${inviteLinkData?.token}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
      toast.success("Invite link deactivated");
    },
  });

  const referenceSettingsMutation = useMutation({
    mutationFn: async (prefix: string) =>
      API_CONFIG.put(`/api/v1/clients/${clientId}/reference-settings`, {
        prefix,
      }),
    onSuccess: (response: any) => {
      const savedPrefix = response?.data?.data?.idea_reference_prefix;
      if (savedPrefix) setReferencePrefix(savedPrefix);
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_ideas"] });
      toast.success("Idea reference format updated");
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message || "Could not update the reference format",
      ),
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size >= MAX_FILE_SIZE) {
      toast.error("File must be less than 1GB");
      return;
    }
    uploadPatentFile(file);
    event.target.value = "";
  };

  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "—";
  const panelClass = theme === "dark" ? "border-[#cccccc20] bg-neutral-900" : "border-[var(--pulse-line)] bg-[var(--pulse-surface)] shadow-[0_18px_45px_-38px_rgba(17,16,60,0.45)]";
  const inventorInviteLink = inviteLinkData?.token ? `${window.location.origin}/i/${inviteLinkData.token}` : "";
  const copyInventorInvite = async () => {
    await navigator.clipboard.writeText(inventorInviteLink);
    setInviteLinkCopied(true);
    toast.success("Inventor invite link copied");
    window.setTimeout(() => setInviteLinkCopied(false), 2000);
  };
  const qrCodeBlob = () => new Promise<Blob>((resolve, reject) => {
    const svg = qrCodeRef.current;
    if (!svg) return reject(new Error("QR unavailable"));
    const source = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const svgUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
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
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("QR conversion failed")), "image/png");
    };
    image.onerror = reject;
    image.src = svgUrl;
  });
  const copyQrCode = async () => {
    try {
      const blob = await qrCodeBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("QR code copied as an image");
    } catch {
      toast.error("Your browser could not copy the QR image");
    }
  };
  const downloadQrCode = async () => {
    try {
      const blob = await qrCodeBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${clientData?.name || "client"}-inventor-invite.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the QR code");
    }
  };
  const metrics = [
    { label: "Total patents", value: metricsData?.data?.total_patents ?? 0, icon: TrendingUp, color: "text-[var(--pulse-data-primary)]" },
    { label: "Granted", value: metricsData?.data?.granted_patents ?? 0, icon: CircleCheck, color: "text-[var(--pulse-success)]" },
    { label: "Pending", value: metricsData?.data?.pending_patents ?? 0, icon: CircleAlert, color: "text-[#A86F00]" },
    { label: "Inactive", value: metricsData?.data?.inactive_patents ?? metricsData?.data?.rejected_patents ?? 0, icon: CircleX, color: "text-[var(--pulse-data-risk)]" },
  ];

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--pulse-ink)] dark:text-zinc-300">Patent portfolio</h3>
          <p className="mt-1 text-xs text-neutral-500">Current patent position for this client</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`rounded-2xl border p-5 ${panelClass}`}>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-neutral-500"><Icon className={`h-4 w-4 ${color}`} />{label}</div>
              <p className={`text-3xl font-semibold tracking-[-0.03em] ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={`rounded-2xl border p-6 ${panelClass}`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-[var(--pulse-data-primary)]" />
              <h3 className="text-sm font-semibold text-[var(--pulse-ink)] dark:text-zinc-300">
                Idea reference numbering
              </h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Choose the client-specific prefix used for new idea references.
              Existing references stay unchanged.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Reference prefix
              <Input
                name="idea_reference_prefix"
                value={referencePrefix}
                onChange={(event) =>
                  setReferencePrefix(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                className="h-9 w-32 font-mono uppercase"
                aria-label="Idea reference prefix"
              />
            </label>
            <div className="grid gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Next reference preview
              <div className="flex h-9 min-w-28 items-center rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-3 font-mono text-sm font-semibold text-[var(--pulse-ink)]">
                {(referencePrefix || "IRN")}
                {String(clientData?.idea_reference_next_number || 1).padStart(2, "0")}
              </div>
            </div>
            <Button
              size="sm"
              disabled={
                referencePrefix.length < 2 ||
                referencePrefix === clientData?.idea_reference_prefix ||
                referenceSettingsMutation.isPending
              }
              onClick={() => referenceSettingsMutation.mutate(referencePrefix)}
              className="h-9 bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]"
            >
              {referenceSettingsMutation.isPending ? "Saving…" : "Save format"}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section className={`rounded-2xl border p-6 lg:col-span-2 ${panelClass}`}>
          <div className="mb-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--pulse-ink)] dark:text-zinc-300">Patent data</h3>
              <p className="mt-1 text-xs text-neutral-500">Import a portfolio file or add an individual patent</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {patentFileHistory.length > 0 && <Button variant="outline" size="sm" onClick={() => setHistoryDialogOpen(true)}><History className="mr-1.5 h-4 w-4" />Import history</Button>}
              <input id="data-upload" type="file" className="hidden" accept=".xls,.xlsx,.csv" onChange={handleFileUpload} disabled={isUploadingPatentFile} />
              <Button asChild variant="outline" size="sm"><label htmlFor="data-upload" className="cursor-pointer"><Upload className="mr-1.5 h-4 w-4" />{isUploadingPatentFile ? "Uploading…" : "Upload portfolio"}</label></Button>
              <Button size="sm" onClick={() => setShowAddPatentModal(true)} className="bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]"><Plus className="mr-1.5 h-4 w-4" />Add patent</Button>
            </div>
          </div>

          {patentFileHistory.length > 0 ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-[#cccccc20] dark:bg-neutral-800">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-lg bg-white p-2 shadow-sm dark:bg-neutral-900"><FileText className="h-5 w-5 text-neutral-500" /></div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{patentFileHistory[0]?.file_name}</p>
                  <p className="mt-1 truncate text-xs text-neutral-500">Latest import · {formatDate(patentFileHistory[0]?.createdAt)}{patentFileHistory[0]?.User?.name || patentFileHistory[0]?.user?.email ? ` · ${patentFileHistory[0]?.User?.name || patentFileHistory[0]?.user?.email}` : ""}</p>
                </div>
              </div>
              <a href={`${API_CONFIG.defaults?.baseURL || ""}/patent/${patentFileHistory[0]?.file_name}`} className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-white" aria-label="Download latest portfolio"><Download className="h-4 w-4" /></a>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 px-5 py-8 text-center dark:border-neutral-700"><FileText className="mx-auto mb-2 h-6 w-6 text-neutral-400" /><p className="text-sm font-medium">No portfolio file imported</p><p className="mt-1 text-xs text-neutral-500">Upload Excel or CSV to add this client’s patent records.</p></div>
          )}
        </section>

        <aside className={`rounded-2xl border p-6 ${panelClass}`}>
          <h3 className="text-sm font-semibold text-[var(--pulse-ink)] dark:text-zinc-300">Client details</h3>
          <dl className="mt-5 space-y-5">
            <div><dt className="flex items-center gap-2 text-xs text-neutral-500"><Globe2 className="h-4 w-4" />Email domain</dt><dd className="mt-1 text-sm font-medium">{clientData?.allowed_domain?.split("@").pop() || "—"}</dd></div>
            <div><dt className="flex items-center gap-2 text-xs text-neutral-500"><CalendarDays className="h-4 w-4" />Client since</dt><dd className="mt-1 text-sm font-medium">{clientData?.createdAt ? new Date(clientData.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</dd></div>
            <div><dt className="flex items-center gap-2 text-xs text-neutral-500"><BriefcaseBusiness className="h-4 w-4" />Case owner</dt><dd className="mt-1 flex items-center justify-between gap-3 text-sm font-medium"><span>{caseOwnerName || "Not assigned"}</span>{onChangeCaseOwner && <button onClick={onChangeCaseOwner} className="text-xs font-semibold text-amber-700 hover:text-amber-800">Change</button>}</dd></div>
            <div><dt className="text-xs text-neutral-500">Status</dt><dd className="mt-1"><Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Active</Badge></dd></div>
          </dl>
        </aside>
      </div>

      <section className={`overflow-hidden rounded-2xl border ${panelClass}`}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 dark:border-[#cccccc20]">
          <div><h3 className="text-sm font-semibold text-[var(--pulse-ink)] dark:text-zinc-300">Client team</h3><p className="mt-1 text-xs text-neutral-500">People with access to this client workspace</p></div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{clientTeam.length} members</Badge>
            {canManageTeam && <Button size="sm" onClick={() => setInviteDialogOpen(true)} className="bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]"><UserPlus className="mr-1.5 h-4 w-4" />Invite people</Button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/60"><tr><th className="px-6 py-3 font-semibold">Team member</th><th className="px-6 py-3 font-semibold">Email</th><th className="px-6 py-3 font-semibold">Role</th><th className="px-6 py-3 font-semibold">Status</th></tr></thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-[#cccccc20]">
              {clientTeam.map((member, index) => {
                const name = member?.name || member?.email?.split("@")[0] || "User";
                const initials = name.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();
                return <tr key={member?.id || member?.email || index} className="text-sm">
                  <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{initials}</span><span className="font-medium">{name}</span></div></td>
                  <td className="px-6 py-4 text-neutral-500">{member?.email || "—"}</td>
                  <td className="px-6 py-4"><Badge variant="outline">{ROLE_LABEL[member?.role] ?? "Inventor"}</Badge></td>
                  <td className="px-6 py-4">{member?.active === false ? <span className="inline-flex items-center gap-1.5 text-sm text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Invited</span> : <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-xl bg-white dark:bg-neutral-950">
          <DialogHeader>
            <DialogTitle>Invite people</DialogTitle>
            <DialogDescription>Add people to the {clientData?.name} client workspace.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-900">
            <button onClick={() => setInviteMode("email")} className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${inviteMode === "email" ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500"}`}>Email invitation</button>
            <button onClick={() => setInviteMode("share")} className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${inviteMode === "share" ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500"}`}>Share link</button>
          </div>

          {inviteMode === "email" ? (
            <div className="space-y-5 pt-3">
              <div>
                <label htmlFor="team-email" className="text-sm font-medium">Email address</label>
                <input id="team-email" autoFocus type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={`name@${clientData?.allowed_domain?.split("@").pop() || "company.com"}`} className="mt-2 h-10 w-full rounded-md border border-neutral-300 bg-transparent px-3 text-sm outline-none transition-colors focus:border-[#F9B418] focus:ring-2 focus:ring-[#F9B418]/20 dark:border-neutral-700" />
              </div>
              <div>
                <p className="text-sm font-medium">Access role</p>
                {/* IP Committee was assignable in the People tab and rendered
                    as a badge, but could not be invited — the only way into the
                    role was to invite someone as an inventor and change it
                    afterwards. */}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setInviteRole("INVENTOR")} className={`rounded-lg border p-3 text-left transition-colors ${inviteRole === "INVENTOR" ? "border-[#F9B418] bg-[#F9B418]/10" : "border-neutral-200 dark:border-neutral-700"}`}><span className="block text-sm font-semibold">Inventor</span><span className="mt-1 block text-xs text-neutral-500">Submit and track ideas</span></button>
                  <button type="button" onClick={() => setInviteRole("TECH_COMMITTEE")} className={`rounded-lg border p-3 text-left transition-colors ${inviteRole === "TECH_COMMITTEE" ? "border-[#F9B418] bg-[#F9B418]/10" : "border-neutral-200 dark:border-neutral-700"}`}><span className="block text-sm font-semibold">IP Committee</span><span className="mt-1 block text-xs text-neutral-500">Review before legal</span></button>
                  <button type="button" onClick={() => setInviteRole("LEGAL_COUNSEL")} className={`rounded-lg border p-3 text-left transition-colors ${inviteRole === "LEGAL_COUNSEL" ? "border-[#F9B418] bg-[#F9B418]/10" : "border-neutral-200 dark:border-neutral-700"}`}><span className="block text-sm font-semibold">Administrator</span><span className="mt-1 block text-xs text-neutral-500">Manage the client workspace</span></button>
                </div>
              </div>
              {inviteRole === "LEGAL_COUNSEL" && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Administrator invitations are email-only so the recipient’s identity can be verified before privileged access is granted.</p>}
              <Button onClick={() => inviteMutation.mutate()} disabled={!inviteEmail.trim() || inviteMutation.isPending} className="w-full bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">{inviteMutation.isPending ? "Sending invitation…" : `Send ${inviteRole === "LEGAL_COUNSEL" ? "administrator" : "inventor"} invitation`}</Button>
            </div>
          ) : (
            <div className="pt-4">
              {inviteLinkData?.active ? <>
                <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div><p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Inventor access</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-400">Anyone with this link can join as an inventor. Administrator access is never granted through shared links.</p></div>
                  <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                </div>
                <div className="grid gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
                  <div className="mx-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <QRCodeSVG ref={qrCodeRef} value={inventorInviteLink} size={164} level="M" marginSize={4} bgColor="#ffffff" fgColor="#171717" title={`QR code for ${clientData?.name} inventor invitation`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Shareable invite link</p>
                    <p className="mt-1 text-xs text-neutral-500">Restricted to {clientData?.allowed_domain?.split("@").pop() || "the client’s approved domain"}.</p>
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900"><code className="block break-all text-xs leading-5 text-neutral-700 dark:text-neutral-300">{inventorInviteLink}</code></div>
                    <Button onClick={copyInventorInvite} className="mt-3 w-full bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">{inviteLinkCopied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}{inviteLinkCopied ? "Invite link copied" : "Copy invite link"}</Button>
                    <div className="mt-2 grid grid-cols-2 gap-2"><Button onClick={copyQrCode} variant="outline"><Copy className="mr-1.5 h-4 w-4" />Copy QR</Button><Button onClick={downloadQrCode} variant="outline"><Download className="mr-1.5 h-4 w-4" />Download QR</Button></div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 divide-x rounded-lg border border-neutral-200 py-3 text-center dark:border-neutral-700">
                  <div><p className="text-xs uppercase tracking-wider text-neutral-500">Validity</p><p className="mt-1 text-xs font-semibold">Never expires</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-neutral-500">Joined</p><p className="mt-1 text-xs font-semibold">{inviteLinkData.uses}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-neutral-500">Created by</p><p className="mt-1 truncate px-2 text-xs font-semibold">{inviteLinkData.createdBy}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                  <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => window.confirm("Generate a new link? The current QR code and link will stop working immediately.") && regenerateInviteMutation.mutate()} disabled={regenerateInviteMutation.isPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Regenerate</Button><Button size="sm" variant="ghost" onClick={() => window.confirm("Deactivate this invite link? Anyone who has it will no longer be able to join.") && deactivateInviteMutation.mutate()} disabled={deactivateInviteMutation.isPending} className="text-red-600 hover:bg-red-50 hover:text-red-700"><Ban className="mr-1.5 h-3.5 w-3.5" />Deactivate</Button></div>
                </div>
              </> : <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700"><Ban className="mx-auto h-7 w-7 text-neutral-400" /><p className="mt-3 text-sm font-semibold">Invite link is inactive</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-neutral-500">Generate a new opaque link before sharing. The previous link can no longer be redeemed.</p><div className="mx-auto mt-4 flex w-fit items-center gap-2"><Button onClick={() => regenerateInviteMutation.mutate()} className="bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">Generate new link</Button></div></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl dark:bg-neutral-950">
          <DialogHeader><DialogTitle>Portfolio import history</DialogTitle><DialogDescription>Previous patent portfolio uploads for this client.</DialogDescription></DialogHeader>
          <div className="mt-3 max-h-[380px] space-y-3 overflow-auto">
            {patentFileHistory.map((file) => <div key={file?.id} className="flex items-center gap-3 rounded-lg border p-4"><FileText className="h-5 w-5 text-neutral-400" /><div className="min-w-0"><p className="truncate text-sm font-medium">{file?.file_name}</p><p className="mt-1 text-xs text-neutral-500">{formatDate(file?.createdAt)} · {file?.User?.name || file?.user?.email || "Unknown"}</p></div></div>)}
          </div>
        </DialogContent>
      </Dialog>

      <DuplicatePatentsModal open={duplicateModalOpen} onOpenChange={(open) => { setDuplicateModalOpen(open); if (!open) queryClient.invalidateQueries({ queryKey: ["client", clientId] }); }} duplicatePatents={duplicatePatents} excelDuplicateEntries={excelDuplicateEntries} errorCount={errorCount} successCount={successCount} totalPatentImported={totalPatentImported} />
      {showAddPatentModal && <AddPatentModal open={showAddPatentModal} onOpenChange={setShowAddPatentModal} clientId={clientId} onAdded={() => { queryClient.invalidateQueries({ queryKey: ["client", clientId] }); queryClient.invalidateQueries({ queryKey: ["client_metrics", clientId] }); }} />}
    </div>
  );
};

export default OverviewTab;
