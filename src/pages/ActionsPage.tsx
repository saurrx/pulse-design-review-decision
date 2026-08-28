import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import IHCActionsContent from "@/components/actions/IHCActionsContent";
import OCActionsContent from "@/components/actions/OCActionsContent";
import useUserCookie from "@/hooks/use-auth";
import { isOutsideCounselRole } from "@/lib/roleAccess";

const ActionsPage: React.FC = () => {
  const { user } = useUserCookie();
  const isOC = isOutsideCounselRole(user?.role);

  return (
    <DashboardLayout>
      {isOC ? <OCActionsContent /> : <IHCActionsContent />}
    </DashboardLayout>
  );
};

export default ActionsPage;
