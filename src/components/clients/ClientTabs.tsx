import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OverviewTab from "@/components/clients/OverviewTab";
import PatentsTab from "@/components/clients/PatentsTab";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";

type ClientTabsProps = {
  clientTeam: any[];
  clientId: string;
  clientData: any;
  caseOwnerName?: string;
  onChangeCaseOwner?: () => void;
  canManageTeam?: boolean;
};

const ClientTabs: React.FC<ClientTabsProps> = ({
  clientTeam,
  clientId,
  clientData,
  caseOwnerName,
  onChangeCaseOwner,
  canManageTeam,
}) => {
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");

  // Set default tab to "overview" if none is specified in URL
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ["overview", "patents"].includes(tabFromUrl)
      ? tabFromUrl
      : "overview"
  );

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", value);
      return next;
    });
  };

  // Sync with URL params if they change externally
  useEffect(() => {
    if (
      tabFromUrl &&
      ["overview", "patents"].includes(tabFromUrl)
    ) {
      setActiveTab(tabFromUrl);
    } else {
      setActiveTab("overview");
    }
  }, [tabFromUrl]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="w-full min-w-0"
    >
      <TabsList
        className={`text-muted-foreground items-center flex w-full sm:w-fit sm:min-w-[300px] justify-start p-1 rounded-sm h-auto mb-5 border ${
          theme === "dark"
            ? "bg-zinc-900 border border-[#cccccc20]"
            : "bg-black/[0.02] border border-black/[0.08]"
        } min-w-0`}
      >
        <TabsTrigger
          value="overview"
          className={`${
            theme === "dark"
              ? "data-[state=active]:!bg-[#F9B418] data-[state=active]:!text-zinc-900 data-[state=active]:!border-transparent text-zinc-400 hover:text-zinc-400 hover:bg-[#cccccc20]"
              : "data-[state=active]:!bg-black/[0.08] data-[state=active]:!text-zinc-600 data-[state=active]:!border-transparent text-zinc-600 hover:text-zinc-700 hover:bg-black/[0.05]"
          } inline-flex flex-1 items-center justify-center gap-1.5 border border-transparent py-1 whitespace-nowrap h-9 px-4 rounded-xs transition-all text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0  min-w-0`}
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="patents"
          className={`${
            theme === "dark"
              ? "data-[state=active]:!bg-[#F9B418] data-[state=active]:!text-zinc-900 data-[state=active]:!border-transparent text-zinc-400 hover:text-zinc-400 hover:bg-[#cccccc20]"
              : "data-[state=active]:!bg-black/[0.08] data-[state=active]:!text-zinc-600 data-[state=active]:!border-transparent text-zinc-600 hover:text-zinc-700 hover:bg-black/[0.05]"
          } inline-flex flex-1 items-center justify-center gap-1.5 border border-transparent py-1 whitespace-nowrap h-9 px-4 rounded-xs transition-all text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0  min-w-0`}
        >
          Patents
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0 min-w-0">
        <OverviewTab
          clientTeam={clientTeam}
          clientId={clientId}
          clientData={clientData}
          caseOwnerName={caseOwnerName}
          onChangeCaseOwner={onChangeCaseOwner}
          canManageTeam={canManageTeam}
        />
      </TabsContent>

      <TabsContent value="patents" className="mt-0 min-w-0">
        <PatentsTab />
      </TabsContent>
    </Tabs>
  );
};

export default ClientTabs;
