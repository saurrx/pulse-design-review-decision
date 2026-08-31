import React from "react";
import { useTrackOnce } from "@/lib/analytics";
import BlockedRedirect from "@/lib/BlockedRedirect";
import DashboardLayout from "@/components/DashboardLayout";
import IHCActionsContent from "@/components/actions/IHCActionsContent";
import OCActionsContent from "@/components/actions/OCActionsContent";
import useUserCookie from "@/hooks/use-auth";
import { canReadDocket, isOutsideCounselRole } from "@/lib/roleAccess";

const ActionsPage: React.FC = () => {
  const { user } = useUserCookie();
  const isOC = isOutsideCounselRole(user?.role);
  // Only for someone the docket is actually FOR — an inventor is redirected two
  // lines down, and counting that bounce as a view would flatter the number with
  // the very people the screen refuses.
  useTrackOnce("docket_viewed", {}, !!user && canReadDocket(user.role));

  // The operations docket is the whole client portfolio — every patent's
  // deadlines and the instruction standing against each. The sidebar has never
  // offered it to an inventor, but the URL was reachable by typing it, and the
  // API answered: an inventor who could see one patent was served 104 rows of
  // colleagues' application numbers (F-026). The backend now refuses this with
  // a 403 on `docket:read`; this redirect is so the product says no first,
  // rather than rendering a screen that can only fill with errors.
  if (user && !canReadDocket(user.role)) {
    return <BlockedRedirect from="/actions" to="/" />;
  }

  return (
    <DashboardLayout>
      {isOC ? <OCActionsContent /> : <IHCActionsContent />}
    </DashboardLayout>
  );
};

export default ActionsPage;
