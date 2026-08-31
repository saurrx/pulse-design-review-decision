import React, { useRef, useState } from "react";
import { track, useTrackOnce } from "@/lib/analytics";
import { ROLE_LABEL } from "@/lib/roles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Copy, Download, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
  allowedDomain?: string;
  onInvited?: () => void;
  adminOnly?: boolean;
};

const ClientInviteDialog: React.FC<ClientInviteDialogProps> = ({
  open,
  onOpenChange,
  clientId,
  clientName = "this client",
  allowedDomain = "",
  onInvited,
  adminOnly = false,
}) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"email" | "share">("email");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"INVENTOR" | "LEGAL_COUNSEL">("INVENTOR");
  const [linkCopied, setLinkCopied] = useState(false);
  const qrCodeRef = useRef<SVGSVGElement>(null);
  const domain = allowedDomain.split("@").pop() || "company.com";
  // The dialog opened. Against invite_created / share_link_copied this is the
  // "opened it and sent nothing" number, which is the only way to see an admin
  // who could not work out which of the two invite modes they needed.
  useTrackOnce("invite_dialog_opened", { client_id: clientId }, open);
  const effectiveRole = adminOnly ? "LEGAL_COUNSEL" : role;

  const { data: inviteLinkData } = useQuery({
    queryKey: ["client_invite_link", clientId],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/clients/${clientId}/invite-link`);
      return response.data.data;
    },
    enabled: open && !!clientId,
  });

  const inviteMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.post(`/api/v1/clients/${clientId}/invite-user`, {
        email: email.trim(),
        role: effectiveRole,
      }),
    onSuccess: () => {
      toast.success(`${ROLE_LABEL[effectiveRole] ?? "Inventor"} invitation sent`);
      setEmail("");
      setRole("INVENTOR");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      onInvited?.();
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Could not send invitation"),
  });

  const regenerateMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.post(`/api/v1/clients/${clientId}/invite-link`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
      toast.success("A new secure invite link was generated");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.delete(`/api/v1/clients/${clientId}/invite-link/${inviteLinkData?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_invite_link", clientId] });
      toast.success("Invite link deactivated");
    },
  });

  const inviteLink = inviteLinkData?.token
    ? `${window.location.origin}/i/${inviteLinkData.token}`
    : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    // The link is a credential and never travels — only that one was taken.
    track("share_link_copied", { client_id: clientId });
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
          (blob) => (blob ? resolve(blob) : reject(new Error("QR conversion failed"))),
          "image/png",
        );
      };
      image.onerror = reject;
      image.src = svgUrl;
    });

  const copyQr = async () => {
    try {
      const blob = await qrCodeBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("QR code copied as an image");
    } catch {
      toast.error("Your browser could not copy the QR image");
    }
  };

  const downloadQr = async () => {
    try {
      const blob = await qrCodeBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${clientName}-inventor-invite.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the QR code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white dark:bg-neutral-950">
        <DialogHeader>
          <DialogTitle>{adminOnly ? "Invite administrator" : "Invite people"}</DialogTitle>
          <DialogDescription>
            {adminOnly
              ? `Send a verified administrator invitation to the ${clientName} workspace.`
              : `Add people to the ${clientName} client workspace.`}
          </DialogDescription>
        </DialogHeader>

        {!adminOnly && <div className="mt-2 grid grid-cols-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <button onClick={() => setMode("email")} className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${mode === "email" ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500"}`}>Email invitation</button>
          <button onClick={() => setMode("share")} className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${mode === "share" ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500"}`}>Share link</button>
        </div>}

        {adminOnly || mode === "email" ? (
          <div className="space-y-5 pt-3">
            <div>
              <label htmlFor="client-invite-email" className="text-sm font-medium">Email address</label>
              <input id="client-invite-email" autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={`name@${domain}`} className="mt-2 h-10 w-full rounded-md border border-neutral-300 bg-transparent px-3 text-sm outline-none transition-colors focus:border-[#F9B418] focus:ring-2 focus:ring-[#F9B418]/20 dark:border-neutral-700" />
            </div>
            {!adminOnly && <div>
              <p className="text-sm font-medium">Access role</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setRole("INVENTOR")} className={`rounded-lg border p-3 text-left transition-colors ${role === "INVENTOR" ? "border-[#F9B418] bg-[#F9B418]/10" : "border-neutral-200 dark:border-neutral-700"}`}><span className="block text-sm font-semibold">Inventor</span><span className="mt-1 block text-xs text-neutral-500">Submit and track ideas</span></button>
                <button type="button" onClick={() => setRole("LEGAL_COUNSEL")} className={`rounded-lg border p-3 text-left transition-colors ${role === "LEGAL_COUNSEL" ? "border-[#F9B418] bg-[#F9B418]/10" : "border-neutral-200 dark:border-neutral-700"}`}><span className="block text-sm font-semibold">Administrator</span><span className="mt-1 block text-xs text-neutral-500">Manage the client workspace</span></button>
              </div>
            </div>}
            {(adminOnly || role === "LEGAL_COUNSEL") && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Administrator invitations are email-only so the recipient’s identity can be verified before privileged access is granted.</p>}
            <Button onClick={() => inviteMutation.mutate()} disabled={!email.trim() || inviteMutation.isPending} className="w-full bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">{inviteMutation.isPending ? "Sending invitation…" : `Send ${effectiveRole === "LEGAL_COUNSEL" ? "administrator" : "inventor"} invitation`}</Button>
          </div>
        ) : (
          <div className="pt-4">
            {inviteLinkData?.active ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div><p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Inventor access</p><p className="mt-1 text-xs text-emerald-800 dark:text-emerald-400">Anyone with this link can join as an inventor. Administrator access is never granted through shared links.</p></div>
                  <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                </div>
                <div className="grid gap-5 sm:grid-cols-[190px_1fr] sm:items-center">
                  <div className="mx-auto rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"><QRCodeSVG ref={qrCodeRef} value={inviteLink} size={164} level="M" marginSize={4} bgColor="#ffffff" fgColor="#171717" title={`QR code for ${clientName} inventor invitation`} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Shareable invite link</p>
                    <p className="mt-1 text-xs text-neutral-500">Restricted to {domain}.</p>
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900"><code className="block break-all text-xs leading-5 text-neutral-700 dark:text-neutral-300">{inviteLink}</code></div>
                    <Button onClick={copyLink} className="mt-3 w-full bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">{linkCopied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}{linkCopied ? "Invite link copied" : "Copy invite link"}</Button>
                    <div className="mt-2 grid grid-cols-2 gap-2"><Button onClick={copyQr} variant="outline"><Copy className="mr-1.5 h-4 w-4" />Copy QR</Button><Button onClick={downloadQr} variant="outline"><Download className="mr-1.5 h-4 w-4" />Download QR</Button></div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 divide-x rounded-lg border border-neutral-200 py-3 text-center dark:border-neutral-700">
                  <div><p className="text-xs uppercase tracking-wider text-neutral-500">Validity</p><p className="mt-1 text-xs font-semibold">Never expires</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-neutral-500">Joined</p><p className="mt-1 text-xs font-semibold">{inviteLinkData.uses}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-neutral-500">Created by</p><p className="mt-1 truncate px-2 text-xs font-semibold">{inviteLinkData.createdBy}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
                  <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => window.confirm("Generate a new link? The current QR code and link will stop working immediately.") && regenerateMutation.mutate()} disabled={regenerateMutation.isPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Regenerate</Button><Button size="sm" variant="ghost" onClick={() => window.confirm("Deactivate this invite link? Anyone who has it will no longer be able to join.") && deactivateMutation.mutate()} disabled={deactivateMutation.isPending} className="text-red-600 hover:bg-red-50 hover:text-red-700"><Ban className="mr-1.5 h-3.5 w-3.5" />Deactivate</Button></div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
                <Ban className="mx-auto h-7 w-7 text-neutral-400" />
                <p className="mt-3 text-sm font-semibold">Invite link is inactive</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-neutral-500">Generate a new opaque link before sharing. The previous link can no longer be redeemed.</p>
                <div className="mx-auto mt-4 flex w-fit items-center gap-2"><Button onClick={() => regenerateMutation.mutate()} className="bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">Generate new link</Button></div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClientInviteDialog;
