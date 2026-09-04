import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import { Dialog, DialogContentNoClose } from "@/components/ui/dialog";
import PatentWorldMap from "@/components/PatentWorldMap";
import TopInventors, { type InventorEntry } from "@/components/TopInventors";
import { IdeaPipeline, NeedsReview } from "@/components/dashboard/DashboardStats";
import { StatStrip, type StatGroupSpec } from "@/components/dashboard/StatStrip";

/**
 * The Workspace Admin's Overview (DSN-0002, product-context/surfaces/workspace-admin-dashboard.md).
 *
 * Two jobs in one glance: what needs a decision, and whether the invention
 * program is moving. Row 1 is five scoped numbers, each a link to the list it
 * counts. Row 2 is the company portfolio (Patents worldwide, kept by founder
 * override) and Top inventors (kept by founder override). Row 3 is the queue,
 * Review Inventor Ideas, with the page's only primary button, and the pipeline.
 *
 * The strip's aggregates come from /v1/dashboard as backend finding BF-5; the
 * mock serves them for V0 scenarios and the record is conceptual until the
 * backend does. Nothing here is counted in the browser from a paged list: when
 * an aggregate is missing the box shows a dash and says it is not available.
 */

const DAY_MS = 86400000;
const AGING_THRESHOLD_DAYS = 30;
// The review statuses in the old dialect the adapter translates; the same
// literal the Review queue link and the sidebar badge use.
const REVIEW_STATUS = "UNDER_REVIEW,SENT_TO_IHC";
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Aggregates = {
  awaiting_review?: number;
  oldest_waiting_days?: number | null;
  actions_due_30_days?: number;
  next_action_due_at?: string | null;
  submitted_this_quarter?: number;
  submitted_last_quarter?: number;
  quarter_start?: string;
  quarter_end?: string;
  patents_filed_this_quarter?: number;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const delta = (now: number | null, before: number | null) => {
  if (now === null || before === null) return { text: "not available yet", spoken: "not available yet" };
  const d = now - before;
  if (d === 0) return { text: "no change vs last quarter", spoken: "no change against last quarter" };
  return { text: `${d > 0 ? "+" : "−"}${Math.abs(d)} vs last quarter`, spoken: `${d > 0 ? "up" : "down"} ${Math.abs(d)} against last quarter` };
};

const WorkspaceAdminOverview = () => {
  const navigate = useNavigate();
  const { user } = useUserCookie();
  const { theme } = useTheme();
  const [isPatentDialogOpen, setIsPatentDialogOpen] = useState(false);

  const scope = user ? `${user.id}:${user.role}:${user.client_id ?? "none"}` : null;
  const ready = !!scope;

  const { isLoading: isDashboardLoading, isError: isDashboardError, data, refetch: refetchDashboard } = useQuery({
    queryKey: ["dashboard", scope],
    enabled: ready,
    queryFn: async () => (await API_CONFIG.get("/api/v1/dashboard"))?.data,
  });
  const { data: pipelineData, isLoading: isPipelineLoading, isError: isPipelineError, refetch: refetchPipeline } = useQuery({
    queryKey: ["dashboard_pipeline", scope],
    enabled: ready,
    queryFn: async () => (await API_CONFIG.get("/api/v1/idea/pipeline"))?.data,
  });
  const { isLoading: isQueueLoading, isError: isQueueError, data: ideasData, refetch: refetchIdeas } = useQuery({
    queryKey: ["dashboard_ideas", scope, false],
    enabled: ready,
    queryFn: async () => (await API_CONFIG.get(`/api/v1/idea/fetch-by-user?page=1&limit=100&status=${REVIEW_STATUS}`))?.data,
  });

  const d = data?.data ?? {};
  const w: Aggregates = d.workspace ?? {};
  const pipeline = pipelineData?.data;

  const reviewQueue = React.useMemo(() => {
    const ideas: any[] = Array.isArray(ideasData?.data) ? ideasData.data : [];
    return ideas
      .filter((i) => ["UNDER_REVIEW", "SENT_TO_IHC"].includes(i.status))
      .sort((a, b) => new Date(a.submission_date || 0).getTime() - new Date(b.submission_date || 0).getTime())
      .map((i) => ({
        id: i.id,
        title: i.title,
        secondary: typeof i.created_by === "string" ? i.created_by : i.created_by?.name,
        score: i.score,
        waitingDays: Math.max(0, Math.floor((Date.now() - new Date(i.submission_date).getTime()) / DAY_MS)),
      }));
  }, [ideasData]);

  /* ------------------------------ the strip ------------------------------ */
  const awaiting = num(w.awaiting_review) ?? num(pipeline?.reviewPending) ?? (ideasData ? reviewQueue.length : null);
  const oldest = num(w.oldest_waiting_days) ?? (reviewQueue.length ? Math.max(...reviewQueue.map((r) => r.waitingDays)) : null);
  const actionsDue = num(w.actions_due_30_days);
  const nextDue = w.next_action_due_at ? new Date(w.next_action_due_at) : null;
  const submittedQ = num(w.submitted_this_quarter);
  const submittedPrev = num(w.submitted_last_quarter);
  const trend = delta(submittedQ, submittedPrev);
  const totalPatents = num(d.total_patents);
  const granted = num(d.granted_patents);
  const pendingPatents = num(d.pending_patents);
  const filedQ = num(w.patents_filed_this_quarter);
  const quarterTitle = w.quarter_start && w.quarter_end
    ? `Calendar quarter, ${LONG_DATE.format(new Date(w.quarter_start))} to ${LONG_DATE.format(new Date(w.quarter_end))}`
    : "Calendar quarter";
  const unavailable = isDashboardError;

  const groups: StatGroupSpec[] = [
    {
      key: "workspace",
      overline: "Your workspace",
      boxes: [
        {
          key: "awaiting", label: "Awaiting review", rule: awaiting ? "amber" : "neutral",
          value: unavailable ? null : awaiting,
          qualifier: unavailable ? "not available" : awaiting ? `oldest ${oldest ?? 0}d` : "nothing waiting",
          qualifierSpoken: unavailable ? "not available" : awaiting ? `oldest ${oldest ?? 0} days` : "nothing waiting",
          to: `/ideas?status=${REVIEW_STATUS}`, title: "Ideas awaiting your decision, oldest first",
        },
        {
          key: "actions", label: "Actions due · 30 days", rule: actionsDue ? "red" : "neutral",
          value: unavailable ? null : actionsDue,
          qualifier: unavailable ? "not available" : actionsDue === null ? "not available yet" : actionsDue && nextDue ? `next ${DATE.format(nextDue)}` : "None due in 30 days",
          qualifierSpoken: unavailable ? "not available" : actionsDue === null ? "not available yet" : actionsDue && nextDue ? `next due ${LONG_DATE.format(nextDue)}` : "none due in 30 days",
          to: "/due-dates", title: "Actions with a date in the next 30 days",
        },
        {
          key: "submitted", label: "Submitted this quarter", rule: "navy",
          value: unavailable ? null : submittedQ,
          qualifier: unavailable ? "not available" : submittedQ === 0 ? (submittedPrev ? trend.text : "No submissions yet this quarter") : trend.text,
          qualifierSpoken: unavailable ? "not available" : submittedQ === 0 ? (submittedPrev ? trend.spoken : "no submissions yet this quarter") : trend.spoken,
          to: "/ideas?date=quarter", title: quarterTitle,
        },
      ],
    },
    {
      key: "portfolio",
      overline: "Company portfolio",
      boxes: [
        {
          key: "patents", label: "Total patents", rule: totalPatents ? "green" : "neutral",
          value: unavailable ? null : totalPatents,
          qualifier: unavailable ? "not available" : totalPatents ? (filedQ === null ? "company portfolio" : `${filedQ} filed this quarter`) : "No patents added yet",
          qualifierSpoken: unavailable ? "not available" : totalPatents ? (filedQ === null ? "company portfolio" : `${filedQ} filed this quarter`) : "no patents added yet",
          to: "/patents", title: "The company patent portfolio",
        },
        {
          key: "granted", label: "Granted", rule: "neutral",
          value: unavailable ? null : granted,
          qualifier: unavailable ? "not available" : totalPatents ? `${pendingPatents ?? 0} pending` : "No patents added yet",
          qualifierSpoken: unavailable ? "not available" : totalPatents ? `${pendingPatents ?? 0} pending` : "no patents added yet",
          to: "/patents?status=ACTIVE_GRANTED", title: "Granted patents; pending are applied or in examination",
        },
      ],
    },
  ];

  /* ------------------------------ the panels ------------------------------ */
  // The jurisdiction list is a BF-5 aggregate; without it the subtitle states the total alone.
  const jurisdictions: Array<{ jurisdiction: string; count: number }> | null = Array.isArray(d.patents_by_jurisdiction) ? d.patents_by_jurisdiction : null;
  const mapSubtitle = unavailable
    ? "Not loaded"
    : totalPatents
      ? `${totalPatents} patent${totalPatents === 1 ? "" : "s"}${jurisdictions ? ` · ${jurisdictions.length} jurisdiction${jurisdictions.length === 1 ? "" : "s"}` : ""}`
      : "No patents added yet";

  const topInventors = d.top_inventors as { this_quarter?: InventorEntry[]; all_time?: InventorEntry[] } | undefined;
  const periods = { thisQuarter: topInventors?.this_quarter ?? [], allTime: topInventors?.all_time ?? [] };

  const goToPipelineStage = (stage: string) => {
    if (stage === "granted") { navigate("/patents?status=ACTIVE_GRANTED"); return; }
    const map: Record<string, string | null> = { submitted: null, review: REVIEW_STATUS, sent_to_oc: "SEND_TO_OC", filed: "FILED" };
    const status = map[stage];
    navigate(status ? `/ideas?status=${status}` : "/ideas");
  };

  const strip = isDashboardLoading && !unavailable ? (
    <section aria-label="Overview" aria-busy="true" className="flex flex-col gap-4 xl:grid xl:grid-cols-5">
      {[0, 1, 2, 3, 4].map((k) => (
        <div key={k} className="flex flex-col gap-2">
          {/* The group overline's height, so the boxes land where they will stay. */}
          <span className="h-[14px] w-24 rounded bg-[var(--pulse-surface-subtle)]" aria-hidden="true" style={{ visibility: k === 0 || k === 3 ? "visible" : "hidden" }} />
          <div className="min-h-[108px] animate-pulse rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)]" />
        </div>
      ))}
    </section>
  ) : (
    <StatStrip groups={groups} />
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[1680px] px-6 pb-24 pt-6 lg:px-8 md:pb-8">
        <div className="mb-6">{strip}</div>
        {unavailable && (
          <div role="status" className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-4 py-3 text-[13px] text-[var(--pulse-ink-secondary)]">
            <span>The overview numbers could not be loaded. The queue below still loads on its own.</span>
            <button type="button" onClick={() => refetchDashboard()} className="rounded-lg border border-[var(--pulse-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--pulse-ink)] hover:bg-[var(--pulse-surface-subtle)]">
              Retry
            </button>
          </div>
        )}
        <div className="grid grid-cols-12 gap-6">
          <section aria-label="Patents worldwide" className="col-span-12 h-[384px] xl:col-span-8">
            <div className="relative z-10 h-full overflow-hidden rounded-2xl">
              <PatentWorldMap
                totalPatents={totalPatents ?? 0}
                height={384}
                isPatentDialogOpen={isPatentDialogOpen}
                setIsPatentDialogOpen={() => setIsPatentDialogOpen(!isPatentDialogOpen)}
                v0={{ title: "Patents worldwide", subtitle: mapSubtitle, heading: "h2", onOpenJurisdiction: (j: string) => navigate(`/patents?jurisdiction=${encodeURIComponent(j)}`) }}
              />
            </div>
          </section>
          <section aria-label="Top inventors" className="col-span-12 h-[384px] xl:col-span-4">
            <TopInventors
              onOpenInventor={(e) => navigate(`/ideas?search=${encodeURIComponent(e.name)}`)}
              v0={{
                periods,
                empty: topInventors
                  ? { text: "No submissions this quarter yet.", linkLabel: "Workspace › People", onLink: () => navigate("/workspace") }
                  : { text: "Not available yet.", linkLabel: "Workspace › People", onLink: () => navigate("/workspace") },
                loading: isDashboardLoading || !ready,
                error: unavailable ? { onRetry: () => refetchDashboard() } : undefined,
              }}
            />
          </section>
          <section aria-label="Review Inventor Ideas" className="col-span-12 xl:col-span-8">
            <NeedsReview
              rows={reviewQueue}
              laterCount={0}
              title="Review Inventor Ideas"
              onOpen={(id) => navigate(`/ideas/${id}`)}
              onReviewAll={() => navigate(`/ideas?status=${REVIEW_STATUS}`)}
              onViewAll={() => navigate(`/ideas?status=${REVIEW_STATUS}`)}
              hasError={isQueueError}
              onRetry={() => refetchIdeas()}
              v0={{
                loading: isQueueLoading || !ready,
                agingThresholdDays: AGING_THRESHOLD_DAYS,
                empty: { text: "Nothing waiting for your review.", linkLabel: "Workspace › People" },
                onEmptyLink: () => navigate("/workspace"),
              }}
            />
          </section>
          <section aria-label="Idea pipeline" className="col-span-12 xl:col-span-4">
            <IdeaPipeline
              heading="h2"
              periodLabel="All time"
              submitted={Number(pipeline?.submitted) || 0}
              reviewPending={Number(pipeline?.reviewPending) || 0}
              sentToOC={Number(pipeline?.sentToPhoton) || 0}
              filed={Number(pipeline?.filed) || 0}
              granted={Number(pipeline?.granted) || 0}
              oldestWaitingDays={oldest}
              loading={isPipelineLoading || !ready}
              onStageClick={goToPipelineStage}
              hasError={isPipelineError}
              onRetry={() => refetchPipeline()}
            />
          </section>
        </div>
      </div>

      {isPatentDialogOpen && (
        <Dialog open={isPatentDialogOpen} onOpenChange={setIsPatentDialogOpen}>
          <DialogContentNoClose
            className={`lg:max-w-[1440px] max-w-[400px] md:max-w-[700px] rounded-xl h-[90vh] backdrop-blur-xl border ${
              theme === "dark" ? "bg-black/90 border-[#cccccc20]" : "bg-white/95 border-neutral-200"
            }`}
          >
            <PatentWorldMap
              totalPatents={totalPatents ?? 0}
              isPatentDialogOpen={isPatentDialogOpen}
              setIsPatentDialogOpen={() => setIsPatentDialogOpen(!isPatentDialogOpen)}
              v0={{ title: "Patents worldwide", subtitle: mapSubtitle, heading: "h2", onOpenJurisdiction: (j: string) => navigate(`/patents?jurisdiction=${encodeURIComponent(j)}`) }}
            />
          </DialogContentNoClose>
        </Dialog>
      )}
    </>
  );
};

export default WorkspaceAdminOverview;
