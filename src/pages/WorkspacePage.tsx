import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import DashboardLayout from "@/components/DashboardLayout";
import ProductPage from "@/components/layout/ProductPage";
import Loader from "@/components/Loader";
import WorkspaceTabs from "@/components/workspace/WorkspaceTabs";
import useUserCookie from "@/hooks/use-auth";
import { readUserCookie } from "@/lib/auth";
import API_CONFIG from "@/lib/apiConfig";

// Workspace administration only. Everyone else (inventor, committee, case
// owner) now has a standalone /profile page instead of a profile tab here.
const WORKSPACE_ADMIN_ROLES = ["PHOTON_ADMIN", "LEGAL_COUNSEL"];

const WorkspacePage: React.FC = () => {
  const { user } = useUserCookie();
  const [clientId, setClientId] = useState<string | null>(null);
  const isWorkspaceAdmin = !!user && WORKSPACE_ADMIN_ROLES.includes(user.role);

  useEffect(() => {
    setClientId(readUserCookie()?.client_id ?? null);
  }, []);

  const {
    data: clientData,
    isLoading,
    refetch: refetchClientData,
  } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const response = await API_CONFIG.get(`/api/v1/clients/${clientId}`);
      return response.status === 200 ? response.data : undefined;
    },
    enabled: !!clientId && isWorkspaceAdmin,
    refetchOnMount: true,
  });

  if (user && !isWorkspaceAdmin) {
    return <Navigate to="/profile" replace />;
  }

  // PHOTON_ADMIN lands on the case-owner access view, which is not client
  // scoped, so it must not wait on the client query.
  const needsClient = user?.role !== "PHOTON_ADMIN";

  return (
    <DashboardLayout>
      <ProductPage maxWidth="max-w-[1440px]">
        {needsClient && (isLoading || !clientId) ? (
          <Loader />
        ) : (
          <WorkspaceTabs
            clientDetails={clientData?.data}
            clientId={clientId ?? ""}
            refetchClientData={refetchClientData}
          />
        )}
      </ProductPage>
    </DashboardLayout>
  );
};

export default WorkspacePage;
