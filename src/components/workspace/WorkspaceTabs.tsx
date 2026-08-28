import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PeopleTab from "@/components/workspace/PeopleTab";
import CaseOwnersTab from "@/components/workspace/CaseOwnersTab";
import ProfileTab from "@/components/workspace/ProfileTab";
import useUserCookie from "@/hooks/use-auth";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";

type WorkspaceTabsProps = {
  clientDetails: any;
  clientId: string;
  isEditMode?: boolean;
  setIsEditMode?: (value: boolean) => void;
  saveProfileRef?: React.MutableRefObject<(() => void) | null>;
  cancelProfileRef?: React.MutableRefObject<(() => void) | null>;
};

const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  clientDetails,
  clientId,
  isEditMode = false,
  setIsEditMode,
  saveProfileRef,
  cancelProfileRef,
}) => {
  const { theme } = useTheme();
  const { user } = useUserCookie();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  
  // Set default tab to "profile" if none is specified in URL
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ['profile', 'people'].includes(tabFromUrl)
      ? tabFromUrl 
      : user?.role === "PHOTON_ADMIN" ? 'people' : 'profile'
  );

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  // Sync with URL params if they change externally
  useEffect(() => {
    if (tabFromUrl && ['profile', 'people'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (!tabFromUrl && user?.role === "PHOTON_ADMIN") {
      setActiveTab("people");
    } else if (tabFromUrl === "business-scope") {
      setActiveTab("profile");
      setSearchParams({ tab: "profile" }, { replace: true });
    }
  }, [tabFromUrl, user?.role]);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-20 md:mb-0">
      {user?.role !== "INVENTOR" && user?.role !== "TECH_COMMITTEE" && user?.role !== "CASE_OWNER" && <TabsList className={`text-muted-foreground items-center flex justify-start p-1 rounded-xl h-auto mb-3 ${user?.role === "PHOTON_ADMIN" ? "w-full sm:w-fit sm:min-w-[360px]" : "w-full"} ${theme === 'dark' ? 'bg-white/[0.03] border border-white/[0.08]' : 'bg-black/[0.02] border border-black/[0.08]'}`}>
        {user?.role === "PHOTON_ADMIN" && (
          <TabsTrigger
            value="people"
            className={`font-sans inline-flex flex-1 items-center justify-center gap-1.5 h-9 px-4 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all border text-zinc-600 border-transparent dark:text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.05] dark:hover:text-zinc-300 dark:hover:bg-white/[0.05] data-[state=active]:bg-black/[0.08] data-[state=active]:text-zinc-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#F9B418] dark:data-[state=active]:text-black focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4'}`}
          >
            Manage Access
          </TabsTrigger>
        )}

        <TabsTrigger
          value="profile"
          className={`font-sans inline-flex flex-1 items-center justify-center gap-1.5 h-9 px-4 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all border text-zinc-600 border-transparent dark:text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.05] dark:hover:text-zinc-300 dark:hover:bg-white/[0.05] data-[state=active]:bg-black/[0.08] data-[state=active]:text-zinc-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#F9B418] dark:data-[state=active]:text-black focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4'}`}          >
          Your Profile
        </TabsTrigger>
        
        {user?.role !== "INVENTOR" && user?.role !== "TECH_COMMITTEE" && user?.role !== "PHOTON_ADMIN" && (
          <TabsTrigger
            value="people"
            className={`font-sans inline-flex flex-1 items-center justify-center gap-1.5 h-9 px-4 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all border text-zinc-600 border-transparent dark:text-zinc-400 hover:text-zinc-700 hover:bg-black/[0.05] dark:hover:text-zinc-300 dark:hover:bg-white/[0.05] data-[state=active]:bg-black/[0.08] data-[state=active]:text-zinc-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#F9B418] dark:data-[state=active]:text-black focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4'}`}
          >
            People
          </TabsTrigger>
        )}

      </TabsList>}

     
      <TabsContent value="profile" className="flex-1 outline-none mt-0">
        <ProfileTab
          clientDetails={clientDetails}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          saveProfileRef={saveProfileRef}
          cancelProfileRef={cancelProfileRef}
        />
      </TabsContent>
      
      
      <TabsContent value="people" className="flex-1 outline-none mt-0 space-y-6">
        {user?.role === "PHOTON_ADMIN" ? (
          <CaseOwnersTab />
        ) : (
          <PeopleTab
            users={clientDetails?.User}
            allowedDomain={clientDetails?.allowed_domain}
            clientId={clientId}
            clientName={clientDetails?.name}
          />
        )}
      </TabsContent>

      </Tabs>
  );
};

export default WorkspaceTabs;
