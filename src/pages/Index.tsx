import React, { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  PortfolioMotion,
  IdeaPipeline,
  PortfolioComposition,
  MyIdeas,
  NeedsReview,
} from "../components/dashboard/DashboardStats";
import IdeaSubmissionModal from "../components/ideas/IdeaSubmissionModal";
import { useNavigate } from "react-router-dom";
import PatentWorldMap from "../components/PatentWorldMap";
import TopInventors from "../components/TopInventors";
import TimelineAndEvents from "../components/TimelineAndEvents";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { Dialog, DialogContentNoClose } from "@/components/ui/dialog";
import useUserCookie from "@/hooks/use-auth";
import moment from "moment";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import { Plus } from "lucide-react";

const DAY_MS = 86400000;

const Index = () => {
  const { theme } = useTheme();
  const { user } = useUserCookie();
  const navigate = useNavigate();
  const isOC = isOutsideCounselRole(user?.role);
  const isInventor = user?.role === "INVENTOR";
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(30);
  const [isPatentDialogOpen, setIsPatentDialogOpen] = useState(false);
  const [selectedMotionClientIds, setSelectedMotionClientIds] = useState<
    string[] | null
  >(null);
  const [selectedPipelineClientIds, setSelectedPipelineClientIds] = useState<
    string[] | null
  >(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { isLoading, data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get("/api/v1/dashboard");
        if (response.status === 200) {
          return response?.data;
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    },
  });

  // Full idea list for this tenant — the action bar and inventor ranking are
  // derived client-side from submission timestamps and statuses.
  const {
    isLoading: isLoadingIdeas,
    data: ideasData,
    refetch: refetchIdeas,
  } = useQuery({
    queryKey: ["dashboard_ideas"],
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          "/api/v1/idea/fetch-by-user?page=1&limit=100"
        );
        if (response.status === 200) return response?.data;
      } catch (error) {
        console.error("Error fetching ideas:", error);
      }
    },
  });

  // Inventor roster, used to detect inventors with zero submissions.
  const { data: inventorsData } = useQuery({
    queryKey: ["dashboard_inventors", user?.client_id],
    enabled: !isOC && !!user?.client_id,
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          `/api/v1/clients/fetch-all-inventors/${user?.client_id}`
        );
        if (response.status === 200) return response?.data;
      } catch (error) {
        console.error("Error fetching inventors:", error);
      }
    },
  });

  const {
    isLoading: isFetchingDueDates,
    data: dueDatesData,
    refetch,
  } = useQuery({
    queryKey: ["all_due_dates", month, year, currentPage, itemsPerPage],
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/patent/fetch/upcoming-due-dates?month=${month}&year=${year}`
      );
      if (response.status === 200) {
        return response?.data;
      }
    },
    refetchOnMount: true,
  });

  // Patent list for this tenant — used to attribute filed patents per inventor
  // on the Top Inventors card (admin view only).
  const { data: patentsData } = useQuery({
    queryKey: ["dashboard_patents", user?.client_id],
    enabled: !!user?.client_id && !isInventor && !isOC,
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          `/api/v1/patent/fetch-all-patents/client/${user?.client_id}?limit=500`
        );
        return response?.data;
      } catch (error) {
        console.error("Error fetching patents:", error);
        return { data: [] };
      }
    },
  });

  /* -------- derived: review queue + inventor engagement (client-side) -------- */

  const ideas: any[] = React.useMemo(
    () => (Array.isArray(ideasData?.data) ? ideasData.data : []),
    [ideasData]
  );

  const motionClientMetrics: any[] = React.useMemo(
    () =>
      Array.isArray(data?.data?.client_metrics)
        ? data.data.client_metrics
        : [],
    [data],
  );

  const filteredMotion = React.useMemo(() => {
    if (selectedMotionClientIds == null) {
      return {
        ideas30: Number(data?.data?.ideas_last_30_days) || 0,
        filings90: Number(data?.data?.patents_filed_last_90_days) || 0,
        series: data?.data?.weekly_series,
      };
    }

    const selected = motionClientMetrics.filter((client) =>
      selectedMotionClientIds.includes(client.id),
    );
    const weekCount = Math.max(
      13,
      ...selected.map((client) => client.weekly_series?.length || 0),
    );

    return {
      ideas30: selected.reduce(
        (sum, client) => sum + Number(client.ideas_last_30_days || 0),
        0,
      ),
      filings90: selected.reduce(
        (sum, client) =>
          sum + Number(client.patents_filed_last_90_days || 0),
        0,
      ),
      series: Array.from({ length: weekCount }, (_, index) => ({
        day: selected[0]?.weekly_series?.[index]?.day || `W${index + 1}`,
        ideas: selected.reduce(
          (sum, client) =>
            sum + Number(client.weekly_series?.[index]?.ideas || 0),
          0,
        ),
        filings: selected.reduce(
          (sum, client) =>
            sum + Number(client.weekly_series?.[index]?.filings || 0),
          0,
        ),
        filing_levels: selected.flatMap((client) => {
          const point = client.weekly_series?.[index];
          return Array.isArray(point?.filing_levels)
            ? point.filing_levels
            : Array.from({ length: Number(point?.filings) || 0 }, () => 0);
        }),
      })),
    };
  }, [data, motionClientMetrics, selectedMotionClientIds]);

  // Inventor scope: only ideas this user created or is listed on, newest first.
  const myIdeas = React.useMemo(() => {
    if (!isInventor || !user?.id) return [];
    return ideas
      .filter(
        (i) =>
          i.created_by_id === user.id ||
          i.IdeaInventor?.some((x: any) => x?.inventor?.id === user.id),
      )
      .sort(
        (a, b) =>
          new Date(b.submission_date || 0).getTime() -
          new Date(a.submission_date || 0).getTime(),
      );
  }, [ideas, isInventor, user?.id]);

  // The statuses that mean "waiting on the viewer" differ by role: outside
  // Counsel reviews ideas sent to Photon Legal; the client committee reviews new submissions.
  const pendingStatuses = isOC
    ? ["SEND_TO_OC"]
    : ["UNDER_REVIEW", "SENT_TO_IHC"];

  // Review queue for the admin dashboard: oldest first, with wait times.
  const queueStartedAt = (idea: any) =>
    isOC
      ? idea.sent_to_ip_committee_at || idea.submission_date
      : idea.submission_date;
  const reviewQueue = React.useMemo(
    () =>
      ideas
        .filter((i) => pendingStatuses.includes(i.status))
        .sort(
          (a, b) =>
            new Date(queueStartedAt(a) || 0).getTime() -
            new Date(queueStartedAt(b) || 0).getTime(),
        )
        .map((i) => ({
          id: i.id,
          title: i.title,
          secondary: isOC
            ? i.client?.name || "Unknown client"
            : typeof i.created_by === "string"
              ? i.created_by
              : i.created_by?.name,
          score: i.score,
          waitingDays: Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(queueStartedAt(i)).getTime()) / DAY_MS,
            ),
          ),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ideas, isOC],
  );

  const filteredPipeline = React.useMemo(() => {
    if (selectedPipelineClientIds == null) {
      return {
        submitted: ideas.filter((i) => i.status !== "IN_DRAFT").length,
        reviewPending: reviewQueue.length,
        sentToOC: ideas.filter((idea) => idea.status === "SEND_TO_OC").length,
        filed: ideas.filter((idea) => idea.status === "FILED").length,
        granted: Number(data?.data?.granted_patents) || 0,
      };
    }

    const selected = motionClientMetrics.filter((client) =>
      selectedPipelineClientIds.includes(client.id),
    );
    const total = (key: string) =>
      selected.reduce(
        (sum, client) => sum + Number(client.pipeline?.[key] || 0),
        0,
      );

    return {
      submitted: total("submitted"),
      reviewPending: total("review_pending"),
      sentToOC: total("sent_to_oc"),
      filed: total("filed"),
      granted: total("granted"),
    };
  }, [
    data,
    ideas,
    motionClientMetrics,
    reviewQueue.length,
    selectedPipelineClientIds,
  ]);
  const laterStageCount = ideas.filter(
    (i) => i.status !== "IN_DRAFT" && !pendingStatuses.includes(i.status),
  ).length;

  const reviewStatusParam = pendingStatuses.join(",");
  const goToPipelineStage = (stage: string) => {
    if (stage === "granted") {
      navigate("/patents?status=ACTIVE_GRANTED");
      return;
    }
    const map: Record<string, string | null> = {
      submitted: null,
      review: reviewStatusParam,
      sent_to_oc: "SEND_TO_OC",
      filed: "FILED",
    };
    const status = map[stage];
    navigate(status ? `/ideas?status=${status}` : "/ideas");
  };

  const derived = React.useMemo(() => {
    const pending = ideas.filter((i) => pendingStatuses.includes(i.status));
    const oldestWaitDays = pending.length
      ? Math.max(
          ...pending.map((i) =>
            Math.floor(
              (Date.now() - new Date(i.submission_date).getTime()) / DAY_MS
            )
          )
        )
      : null;

    const perInventor = new Map<string, { id: string; name: string; count: number }>();
    ideas.forEach((i) => {
      const people =
        i.IdeaInventor?.length > 0
          ? i.IdeaInventor.map((x: any) => x.inventor).filter(Boolean)
          : [{ id: i.created_by_id, name: i.created_by }];
      people.forEach((p: any) => {
        if (!p?.id) return;
        const cur = perInventor.get(p.id) ?? { id: p.id, name: p.name, count: 0 };
        cur.count += 1;
        perInventor.set(p.id, cur);
      });
    });

    const ranked = [...perInventor.values()].sort((a, b) => b.count - a.count);
    const roster: any[] = Array.isArray(inventorsData?.data)
      ? inventorsData.data
      : [];
    // TODO(backend): no team grouping exists on inventors — quiet-inventor
    // detection is per person; switch to teams when a `team` field lands.
    const quiet = roster
      .filter((u) => !perInventor.has(u.id))
      .map((u) => ({ id: u.id, name: u.name }));

    return {
      pendingCount: pending.length,
      oldestWaitDays,
      ranked,
      activeInventorCount: perInventor.size,
      quietInventors: quiet,
    };
  }, [ideas, inventorsData, isOC]);

  // Merge all-time idea counts with filed-patent attribution per
  // inventor. Patents only carry inventor names, so match on name.
  const inventorEntries = React.useMemo(() => {
    const patents: any[] = Array.isArray(patentsData?.data)
      ? patentsData.data
      : [];
    const filedByName = new Map<string, number>();
    patents.forEach((p) =>
      (p.inventors || []).forEach((name: string) => {
        filedByName.set(name, (filedByName.get(name) ?? 0) + 1);
      })
    );
    const entries: { id?: string; name: string; ideas: number; patents: number }[] = derived.ranked.map((r) => ({
      id: r.id,
      name: r.name,
      ideas: r.count,
      patents: filedByName.get(r.name) ?? 0,
    }));
    // Inventors with filed patents but no ideas still belong on
    // the Patents tab.
    filedByName.forEach((count, name) => {
      if (!entries.some((e) => e.name === name))
        entries.push({ name, ideas: 0, patents: count });
    });
    return entries;
  }, [derived.ranked, patentsData]);

  const handleNudge = (inventor?: { id: string; name: string }) => {
    // TODO(backend): no nudge/reminder endpoint exists yet — wire this to the
    // invite/notification flow when it lands.
    toast.success(
      inventor
        ? `Nudge sent to ${inventor.name}`
        : `Nudge sent to ${derived.quietInventors.length || "all"} inactive inventor${
            derived.quietInventors.length === 1 ? "" : "s"
          }`
    );
  };

  const totalPatents = Number(data?.data?.total_patents) || 0;
  return (
    <DashboardLayout
      header={{
        primaryAction: isInventor
          ? {
              label: "New disclosure",
              icon: <Plus className="h-4 w-4" />,
              onClick: () => setIsSubmitModalOpen(true),
            }
          : undefined,
      }}
    >
      <div className="mx-auto w-full max-w-[1680px] px-6 pb-24 pt-6 lg:px-8 md:pb-8">
        <div className="mb-6 grid grid-cols-12 gap-6">
          {isInventor ? (
            <>
              <div className="col-span-12 xl:col-span-8">
                <MyIdeas
                  ideas={myIdeas}
                  onSubmit={() => setIsSubmitModalOpen(true)}
                  onOpenIdea={(id) => navigate(`/ideas/${id}`)}
                  onViewAll={() => navigate("/ideas")}
                  onOpenPatent={(patentId) => navigate(`/patents/${patentId}`)}
                  onSendIdea={async (id) => {
                    try {
                      await API_CONFIG.post(
                        `/api/v1/idea/send-latest-draft-to-ihc/${id}`,
                        {},
                      );
                      toast.success("Sent to the IP Committee");
                      refetchIdeas();
                    } catch {
                      toast.error("Failed to send");
                    }
                  }}
                />
              </div>
              <div className="col-span-12 xl:col-span-4">
                <IdeaPipeline
                  title="My pipeline"
                  submitted={myIdeas.filter((i) => i.status !== "IN_DRAFT").length}
                  reviewPending={myIdeas.filter((i) => ["UNDER_REVIEW", "SENT_TO_IHC"].includes(i.status)).length}
                  sentToOC={myIdeas.filter((i) => i.status === "SEND_TO_OC").length}
                  filed={myIdeas.filter((i) => i.status === "FILED").length}
                  granted={myIdeas.filter((i) => i.IdeaPatentLink?.some((l: any) => l?.patent?.status === "GRANTED")).length}
                />
              </div>
            </>
          ) : (
            <>
              {/* The review workload is the primary admin surface. */}
              <div className="col-span-12 xl:col-span-8">
                <NeedsReview
                  rows={reviewQueue}
                  laterCount={laterStageCount}
                  title={isOC ? "Awaiting action" : undefined}
                  showScore={!isOC}
                  waitingLabel={isOC ? "awaiting" : "waiting"}
                  onOpen={(id) => navigate(`/ideas/${id}`)}
                  onReviewAll={
                    isOC
                      ? undefined
                      : () => navigate(`/ideas?status=${reviewStatusParam}`)
                  }
                />
              </div>
              <div className="col-span-12 xl:col-span-4">
                <IdeaPipeline
                  submitted={filteredPipeline.submitted}
                  reviewPending={filteredPipeline.reviewPending}
                  sentToOC={filteredPipeline.sentToOC}
                  filed={filteredPipeline.filed}
                  granted={filteredPipeline.granted}
                  clientOptions={
                    isOC
                      ? motionClientMetrics.map((client) => ({
                          id: client.id,
                          name: client.name,
                        }))
                      : []
                  }
                  selectedClientIds={selectedPipelineClientIds}
                  onClientSelectionChange={
                    isOC ? setSelectedPipelineClientIds : undefined
                  }
                  onStageClick={goToPipelineStage}
                />
              </div>

              {/* Portfolio context stays secondary to decisions. */}
              <div className="col-span-12 h-[384px] xl:col-span-8">
                <PortfolioMotion
                  ideasLabel="Ideas received"
                  ideas30={filteredMotion.ideas30}
                  filings90={filteredMotion.filings90}
                  series={filteredMotion.series}
                  clientOptions={
                    isOC
                      ? motionClientMetrics.map((client) => ({
                          id: client.id,
                          name: client.name,
                        }))
                      : []
                  }
                  selectedClientIds={selectedMotionClientIds}
                  onClientSelectionChange={
                    isOC ? setSelectedMotionClientIds : undefined
                  }
                />
              </div>
              <div className="col-span-12 h-[384px] xl:col-span-4">
                <TopInventors
                  inventors={
                    isOC
                      ? data?.data?.top_clients?.map((k: any, ik: number) => ({
                          name: k?.client?.name,
                          country: "",
                          count: k?.total_patents,
                          avatar: ik + 1,
                        }))
                      : undefined
                  }
                  entries={isOC ? undefined : inventorEntries}
                  onOpenInventor={(e) =>
                    navigate(`/ideas?search=${encodeURIComponent(e.name)}`)
                  }
                  subtitle={isOC ? "By patent count" : undefined}
                  notYetActive={isOC ? [] : derived.quietInventors}
                  onNudge={handleNudge}
                />
              </div>
            </>
          )}

          {/* Portfolio intelligence */}
          <div className="col-span-12 xl:col-span-4">
            <PortfolioComposition
              total={totalPatents}
              granted={Number(data?.data?.granted_patents) || 0}
              pending={Number(data?.data?.pending_patents) || 0}
              inactive={
                Number(
                  data?.data?.inactive_patents ?? data?.data?.rejected_patents,
                ) || 0
              }
            />
          </div>
          <div className="col-span-12 xl:col-span-8">
            <div className="relative z-10 h-full overflow-hidden rounded-2xl">
              <PatentWorldMap
                totalPatents={totalPatents}
                isPatentDialogOpen={isPatentDialogOpen}
                setIsPatentDialogOpen={() =>
                  setIsPatentDialogOpen(!isPatentDialogOpen)
                }
              />
            </div>
          </div>
        </div>

        {/* Due dates — admin surface; inventors have no deadline ownership */}
        {!isInventor && (
        <div className="mb-5">
          <TimelineAndEvents
              dueDates={dueDatesData?.data}
              isLoading={isFetchingDueDates}
              pagination={dueDatesData?.pagination}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              setMonth={setMonth}
              setYear={setYear}
              refetch={refetch}
            />
        </div>
        )}

      </div>

      {isInventor && (
        <IdeaSubmissionModal
          open={isSubmitModalOpen}
          onOpenChange={setIsSubmitModalOpen}
          refetchIdeas={refetchIdeas}
        />
      )}

      {/* Client Mode Modal */}
      {isPatentDialogOpen && (
        <Dialog open={isPatentDialogOpen} onOpenChange={setIsPatentDialogOpen}>
          <DialogContentNoClose
            className={`lg:max-w-[1440px] max-w-[400px] md:max-w-[700px] rounded-xl h-[90vh] backdrop-blur-xl border ${
              theme === "dark"
                ? "bg-black/90 border-[#cccccc20]"
                : "bg-white/95 border-neutral-200"
            }`}
          >
            <PatentWorldMap
              totalPatents={totalPatents}
              isPatentDialogOpen={isPatentDialogOpen}
              setIsPatentDialogOpen={() =>
                setIsPatentDialogOpen(!isPatentDialogOpen)
              }
            />
          </DialogContentNoClose>
        </Dialog>
      )}
    </DashboardLayout>
  );
};

export default Index;
