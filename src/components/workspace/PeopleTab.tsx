import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import API_CONFIG from "@/lib/apiConfig";
import useUserCookie from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [localUsers, setLocalUsers] = useState<any[]>(Array.isArray(users) ? users : []);

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
      toast.success("Member role updated");
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Could not update member role"),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => API_CONFIG.delete(`/api/v1/users/${userId}`),
    onSuccess: (_, userId) => {
      setLocalUsers((current) => current.filter((person) => String(person.id) !== userId));
      toast.success("Member removed");
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
      toast.success("Member reactivated");
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
        <Button onClick={() => setInviteOpen(true)} className="gap-2 bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]">
          <UserPlus className="h-4 w-4" /> Invite people
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] shadow-[0_18px_45px_-38px_rgba(17,16,60,0.45)] dark:border-[#cccccc20] dark:bg-neutral-900">
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
                <Badge variant="outline">{person.role === "LEGAL_COUNSEL" ? "Administrator" : person.role === "TECH_COMMITTEE" ? "IP Committee" : "Inventor"}</Badge>
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
                  <td className="px-5 py-4"><select value={["LEGAL_COUNSEL", "TECH_COMMITTEE"].includes(person.role) ? person.role : "INVENTOR"} onChange={(event) => changeRole(person, event.target.value as "INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL")} disabled={person.id === user?.id} className="h-8 rounded-md border border-neutral-200 bg-transparent px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"><option value="INVENTOR">Inventor</option><option value="TECH_COMMITTEE">IP Committee</option><option value="LEGAL_COUNSEL">Administrator</option></select></td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive(person) ? "text-emerald-700" : "text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${isActive(person) ? "bg-emerald-500" : "bg-amber-500"}`} />{isActive(person) ? "Active" : person.suspended ? "Disabled" : "Invited"}</span></td>
                  <td className="px-5 py-4 text-right">{person.id === user?.id ? <span className="text-xs text-neutral-400">You</span> : person.suspended ? <Button variant="ghost" size="sm" onClick={() => reactivateMutation.mutate(String(person.id))} className="text-emerald-700 hover:bg-emerald-50">Reactivate</Button> : <Button variant="ghost" size="icon" onClick={() => removeMember(person)} className="text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ClientInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} clientId={clientId} clientName={clientName} allowedDomain={allowedDomain} />
    </div>
  );
};

export default PeopleTab;
