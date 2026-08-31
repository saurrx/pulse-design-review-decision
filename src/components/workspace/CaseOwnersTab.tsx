import React, { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Search,
  UserPlus,
} from "lucide-react";
import { toast } from "@/lib/toast";
import API_CONFIG from "@/lib/apiConfig";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientSummary = {
  id: string;
  name: string;
  patentCount: number;
  activeIdeas: number;
};

type CaseOwner = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  verified: boolean;
  role: "PHOTON_ADMIN" | "CASE_OWNER";
  assigned_client_ids: string[];
  clients: ClientSummary[];
  activeMatters: number;
};

const CaseOwnersTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState<CaseOwner | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [accessKind, setAccessKind] = useState<"ASSIGNMENT" | "TEMPORARY" | "STEP_IN">("ASSIGNMENT");
  const [accessReason, setAccessReason] = useState("");
  const [accessExpiry, setAccessExpiry] = useState("");
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerClients, setNewOwnerClients] = useState<string[]>([]);
  const [newMemberRole, setNewMemberRole] = useState<"CASE_OWNER" | "PHOTON_ADMIN">("CASE_OWNER");

  const { data, isLoading } = useQuery({
    queryKey: ["case-owners"],
    queryFn: async () => {
      const response = await API_CONFIG.get("/api/v1/case-owners");
      return response.data.data as {
        owners: CaseOwner[];
        clients: ClientSummary[];
      };
    },
  });

  const owners = data?.owners || [];
  const clients = data?.clients || [];

  const clientOwner = useMemo(() => {
    const lookup = new Map<string, CaseOwner>();
    owners
      .filter((member) => member.role === "CASE_OWNER")
      .forEach((caseOwner) =>
        caseOwner.assigned_client_ids.forEach((clientId) =>
          lookup.set(clientId, caseOwner),
        ),
      );
    return lookup;
  }, [owners]);

  const visibleOwners = owners.filter((caseOwner) =>
    `${caseOwner.name} ${caseOwner.email} ${caseOwner.clients.map((c) => c.name).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (!owner) return;
    const refreshedOwner = owners.find((item) => item.id === owner.id);
    if (refreshedOwner) setOwner(refreshedOwner);
  }, [owners, owner?.id]);

  const assignmentMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.put(`/api/v1/case-owners/${owner?.id}/assignments`, {
        clientIds: selectedClientIds,
        ...(accessKind !== "ASSIGNMENT" ? {
          kind: accessKind,
          reason: accessReason,
          expires_at: accessExpiry ? new Date(accessExpiry).toISOString() : undefined,
        } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-owners"] });
      toast.success("Client assignments updated");
      setOwner(null);
    },
    onError: () => toast.error("Could not update client assignments"),
  });

  const addOwnerMutation = useMutation({
    mutationFn: async () =>
      API_CONFIG.post("/api/v1/case-owners/invite", {
        name: newOwnerName,
        email: newOwnerEmail,
        role: newMemberRole,
        clientIds: newMemberRole === "CASE_OWNER" ? newOwnerClients : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-owners"] });
      toast.success(newMemberRole === "PHOTON_ADMIN" ? "Administrator invited" : "Case Owner invited");
      setShowAddOwner(false);
      setNewOwnerName("");
      setNewOwnerEmail("");
      setNewOwnerClients([]);
      setNewMemberRole("CASE_OWNER");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Could not invite Case Owner"),
  });

  const openAssignments = (caseOwner: CaseOwner) => {
    // Opened, not saved — case_owner_assignments_saved already covers the write.
    // The gap between the two is the drawer people back out of.
    track("case_owner_assignments_opened");
    setOwner(caseOwner);
    setSelectedClientIds(caseOwner.assigned_client_ids || []);
    setClientSearch("");
  };

  const toggleClient = (id: string, target: "manage" | "new") => {
    const current = target === "manage" ? selectedClientIds : newOwnerClients;
    const next = current.includes(id)
      ? current.filter((clientId) => clientId !== id)
      : [...current, id];
    target === "manage" ? setSelectedClientIds(next) : setNewOwnerClients(next);
  };

  if (isLoading) {
    return <div className="rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] p-10 text-center text-sm text-[var(--pulse-ink-muted)]">Loading access…</div>;
  }

  return (
    <div className="space-y-5 py-3 font-sans">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="font-sans text-xl font-bold text-neutral-900">Manage Access</h2>
          <p className="mt-1 text-sm text-neutral-500">Add administrators and control which clients each Case Owner can access.</p>
        </div>
        <Button
          onClick={() => setShowAddOwner(true)}
          className="h-10 gap-2 bg-[#F9B418] text-black hover:bg-[#E7A615]"
        >
          <UserPlus className="h-4 w-4" /> Add team member
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] shadow-[0_18px_45px_-38px_rgba(17,16,60,0.45)]">
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members or clients…" className="h-10 pl-9" />
          </div>
          <span className="text-xs text-neutral-500">{visibleOwners.length} member{visibleOwners.length === 1 ? "" : "s"}</span>
        </div>
        <div className="divide-y divide-neutral-100 md:hidden">
          {visibleOwners.map((caseOwner) => (
            <div key={caseOwner.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                    {caseOwner.name?.charAt(0) || caseOwner.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{caseOwner.name}</p>
                    <p className="truncate text-xs text-neutral-500">{caseOwner.email}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${caseOwner.role === "PHOTON_ADMIN" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                  {caseOwner.role === "PHOTON_ADMIN" ? "OC Admin" : "Case Owner"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {caseOwner.role === "PHOTON_ADMIN" ? (
                  <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">All clients</span>
                ) : caseOwner.clients.length ? (
                  <>
                    {caseOwner.clients.slice(0, 3).map((client) => <span key={client.id} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">{client.name}</span>)}
                    {caseOwner.clients.length > 3 && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">+{caseOwner.clients.length - 3} more</span>}
                  </>
                ) : (
                  <span className="text-xs font-medium text-amber-700">No clients assigned</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${caseOwner.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${caseOwner.active ? "bg-emerald-500" : "bg-neutral-400"}`} />
                  {caseOwner.active ? "Active" : "Invited"}
                </span>
                {caseOwner.role === "CASE_OWNER" ? (
                  <Button variant="outline" size="sm" onClick={() => openAssignments(caseOwner)} className="gap-1.5">Manage clients <ChevronRight className="h-3.5 w-3.5" /></Button>
                ) : (
                  <span className="text-xs text-neutral-400">Full access</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px]">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-5 py-3">Team Member</th>
                <th className="px-5 py-3">Client Access</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visibleOwners.map((caseOwner) => {
                return (
                  <tr key={caseOwner.id} className="hover:bg-neutral-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">{caseOwner.name?.charAt(0) || caseOwner.email.charAt(0).toUpperCase()}</span>
                        <div><p className="text-sm font-semibold text-neutral-900">{caseOwner.name}</p><p className="text-xs text-neutral-500">{caseOwner.email}</p></div>
                      </div>
                    </td>
                    <td className="max-w-[420px] px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {caseOwner.role === "PHOTON_ADMIN" ? <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">All clients</span> : caseOwner.clients.length ? caseOwner.clients.slice(0, 2).map((client) => <span key={client.id} className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700">{client.name}</span>) : <span className="text-xs font-medium text-amber-700">No clients assigned</span>}
                        {caseOwner.role === "CASE_OWNER" && caseOwner.clients.length > 2 && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">+{caseOwner.clients.length - 2} more</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${caseOwner.role === "PHOTON_ADMIN" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>{caseOwner.role === "PHOTON_ADMIN" ? "OC Admin" : "Case Owner"}</span></td>
                    <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${caseOwner.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${caseOwner.active ? "bg-emerald-500" : "bg-neutral-400"}`} />{caseOwner.active ? "Active" : "Invited"}</span></td>
                    <td className="px-5 py-4 text-right">{caseOwner.role === "CASE_OWNER" ? <Button variant="outline" size="sm" onClick={() => openAssignments(caseOwner)} className="gap-1.5">Manage clients <ChevronRight className="h-3.5 w-3.5" /></Button> : <span className="text-xs text-neutral-400">Full access</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!owner} onOpenChange={(open) => !open && setOwner(null)}>
        <SheetContent className="flex w-full flex-col bg-white p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-5"><SheetTitle className="font-sans">Manage clients — {owner?.name}</SheetTitle><SheetDescription>Select the clients this Case Owner can access. Reassigning a client transfers primary ownership.</SheetDescription></SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients…" className="pl-9" /></div>
            <div className="mb-3 text-xs"><span className="font-semibold text-neutral-700">{selectedClientIds.length} clients selected</span></div>
            {/* One setting for the whole assignment, so it lives above the list.
                It used to be rendered inside each client <button>: eighty-odd
                copies of the same control, all writing one piece of state and
                fighting each other, and interactive elements nested in a button
                so changing the access type also toggled that client. */}
            <div className="mb-4 space-y-2 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <label htmlFor="access-kind" className="text-xs font-medium text-neutral-500">Access type</label>
                <select id="access-kind" value={accessKind} onChange={(e) => setAccessKind(e.target.value as any)}
                  className="h-8 rounded-md border border-neutral-200 bg-transparent px-2 text-xs dark:border-neutral-700">
                  <option value="ASSIGNMENT">Permanent assignment</option>
                  <option value="TEMPORARY">Temporary</option>
                  <option value="STEP_IN">Step-in cover</option>
                </select>
              </div>
              {accessKind !== "ASSIGNMENT" && (
                <div className="flex items-center gap-2">
                  <input value={accessReason} onChange={(e) => setAccessReason(e.target.value)}
                    placeholder="Reason (required)"
                    className="h-8 flex-1 rounded-md border border-neutral-200 bg-transparent px-2 text-xs dark:border-neutral-700" />
                  <input type="date" value={accessExpiry} onChange={(e) => setAccessExpiry(e.target.value)}
                    className="h-8 rounded-md border border-neutral-200 bg-transparent px-2 text-xs dark:border-neutral-700" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              {clients.filter((client) => client.name.toLowerCase().includes(clientSearch.toLowerCase())).map((client) => {
                const selected = selectedClientIds.includes(client.id);
                const existingOwner = clientOwner.get(client.id);
                const reassigned = selected && existingOwner && existingOwner.id !== owner?.id;
                return <button key={client.id} onClick={() => toggleClient(client.id, "manage")} className={`w-full rounded-xl border p-4 text-left transition-colors ${selected ? "border-[#F9B418] bg-amber-50" : "border-neutral-200 hover:border-neutral-300"}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-[#F9B418] bg-[#F9B418] text-black" : "border-neutral-300 bg-white"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><div className="flex-1"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-neutral-900">{client.name}</p><span className="text-xs text-neutral-500">{client.patentCount} patents · {client.activeIdeas} active ideas</span></div>{reassigned && <p className="mt-2 text-xs font-medium text-amber-700">Currently owned by {existingOwner.name} — saving will reassign it.</p>}</div></div></button>;
              })}
            </div>
          </div>
          <SheetFooter className="border-t px-6 py-4"><Button variant="outline" onClick={() => setOwner(null)}>Cancel</Button><Button disabled={assignmentMutation.isPending} onClick={() => assignmentMutation.mutate()} className="bg-[#F9B418] text-black hover:bg-[#E7A615]">{assignmentMutation.isPending ? "Saving…" : `Save ${selectedClientIds.length} assignments`}</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={showAddOwner} onOpenChange={setShowAddOwner}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader><DialogTitle className="font-sans">Add team member</DialogTitle><DialogDescription>Invite an OC Admin or Case Owner to the Photon Legal workspace.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-600">Name</label><Input value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="Full name" /></div>
            <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-600">Email</label><Input value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="name@photonlegal.com" /></div>
            <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-600">Role</label><div className="grid grid-cols-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1"><button onClick={() => setNewMemberRole("CASE_OWNER")} className={`rounded-md px-3 py-2 text-sm font-medium ${newMemberRole === "CASE_OWNER" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}>Case Owner</button><button onClick={() => setNewMemberRole("PHOTON_ADMIN")} className={`rounded-md px-3 py-2 text-sm font-medium ${newMemberRole === "PHOTON_ADMIN" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}>OC Admin</button></div><p className="mt-2 text-xs text-neutral-500">{newMemberRole === "PHOTON_ADMIN" ? "OC Admins automatically have access to all clients." : "Case Owners only see clients assigned to them."}</p></div>
            {newMemberRole === "CASE_OWNER" && <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-wider text-neutral-600">Initial client access</label><span className="text-xs text-neutral-500">{newOwnerClients.length} selected</span></div><div className="max-h-56 space-y-2 overflow-y-auto">{clients.map((client) => { const selected = newOwnerClients.includes(client.id); const existingOwner = clientOwner.get(client.id); return <button key={client.id} onClick={() => toggleClient(client.id, "new")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selected ? "border-[#F9B418] bg-amber-50" : "border-neutral-200"}`}><span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-[#F9B418] bg-[#F9B418]" : "border-neutral-300"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span><span className="flex-1 text-sm font-medium text-neutral-800">{client.name}</span>{existingOwner && <span className="text-xs text-neutral-500">{existingOwner.name}</span>}</button>; })}</div></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddOwner(false)}>Cancel</Button><Button disabled={!newOwnerName.trim() || !newOwnerEmail.trim() || addOwnerMutation.isPending} onClick={() => addOwnerMutation.mutate()} className="gap-2 bg-[#F9B418] text-black hover:bg-[#E7A615]"><BriefcaseBusiness className="h-4 w-4" />{addOwnerMutation.isPending ? "Sending…" : `Invite ${newMemberRole === "PHOTON_ADMIN" ? "OC Admin" : "Case Owner"}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseOwnersTab;
