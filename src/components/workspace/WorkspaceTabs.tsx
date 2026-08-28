import React, { useRef, useState } from "react";
import { Building2, Pen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CaseOwnersTab from "@/components/workspace/CaseOwnersTab";
import OrganizationDetails from "@/components/workspace/OrganizationDetails";
import PeopleTab from "@/components/workspace/PeopleTab";
import useUserCookie from "@/hooks/use-auth";
import API_CONFIG from "@/lib/apiConfig";
import {
  getClientInitials,
  getClientLogoSrc,
} from "@/lib/clientBranding";

type WorkspaceTabsProps = {
  clientDetails: any;
  clientId: string;
  refetchClientData?: () => void;
};

const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  clientDetails,
  clientId,
  refetchClientData,
}) => {
  const { user } = useUserCookie();
  const [editOpen, setEditOpen] = useState(false);
  const saveAboutRef = useRef<(() => void) | null>(null);
  const cancelAboutRef = useRef<(() => void) | null>(null);

  if (user?.role === "PHOTON_ADMIN") {
    return <CaseOwnersTab />;
  }

  const clientName = clientDetails?.name || "Client workspace";
  const allowedDomain =
    clientDetails?.allowed_domain?.split("@").pop() || "No domain configured";
  const clientLogoSrc = getClientLogoSrc(
    {
      id: clientDetails?.id || clientId,
      name: clientName,
      logo_file: clientDetails?.logo_file,
    },
    String(API_CONFIG.defaults.baseURL || ""),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] p-5 shadow-[var(--pulse-shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)]">
            {clientLogoSrc ? (
              <img
                src={clientLogoSrc}
                alt={`${clientName} logo`}
                className="h-full w-full object-contain p-1.5"
                crossOrigin="use-credentials"
              />
            ) : (
              <span className="text-sm font-semibold text-[var(--pulse-ink)]">
                {getClientInitials(clientName)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-[var(--pulse-ink-muted)]" />
              <h2 className="truncate text-base font-semibold text-[var(--pulse-ink)]">
                {clientName}
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--pulse-ink-secondary)]">
              {allowedDomain}
            </p>
            {clientDetails?.about && (
              <p className="mt-1 max-w-3xl truncate text-xs text-[var(--pulse-ink-muted)]" title={clientDetails.about}>
                {clientDetails.about}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setEditOpen(true)}
          className="shrink-0 gap-2"
        >
          <Pen className="h-4 w-4" /> Edit workspace
        </Button>
      </section>

      <PeopleTab
        users={clientDetails?.User}
        allowedDomain={clientDetails?.allowed_domain}
        clientId={clientId}
        clientName={clientName}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto bg-white dark:bg-neutral-950">
          <DialogHeader>
            <DialogTitle>Edit workspace</DialogTitle>
            <DialogDescription>
              Update the organization information shown to workspace members.
            </DialogDescription>
          </DialogHeader>
          <OrganizationDetails
            refetchClientData={refetchClientData}
            clientDetails={clientDetails}
            clientId={clientId}
            isEditMode
            setIsEditMode={(editing) => {
              if (!editing) setEditOpen(false);
            }}
            saveAboutRef={saveAboutRef}
            cancelAboutRef={cancelAboutRef}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                cancelAboutRef.current?.();
                setEditOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveAboutRef.current?.()}
              className="bg-[var(--pulse-brand)] text-[var(--pulse-ink)] hover:bg-[var(--pulse-brand-hover)]"
            >
              Save workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkspaceTabs;
