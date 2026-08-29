import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import EvaluationProgress from "@/components/ideas/EvaluationProgress";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Inbox,
  MoreHorizontal,
  PenLine,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import API_CONFIG from "@/lib/apiConfig";
import useUserCookie from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PatentNoveltyReport from "@/components/ideas/ShowScoreReport";
import {
  ProductChip,
  type ProductChipTone,
} from "@/components/ui/product-chip";

type QueueView = "review" | "updates" | "counsel" | "all";
type DetailTab = "brief" | "activity" | "submission" | "aiReport";
type DecisionDialog = "request" | "decline" | null;

type Idea = {
  id: string;
  reference_number?: string;
  title: string;
  summary?: string;
  about?: string;
  status: string;
  score?: number | null;
  submission_date?: string;
  sent_to_ip_committee_at?: string;
  updatedAt?: string;
  created_by?: string | { name?: string; email?: string };
  client?: { name?: string };
  IdeaInventor?: Array<{
    id: string;
    inventor?: { id?: string; name?: string; email?: string };
  }>;
  IdeaFiles?: Array<{ id: string; original_name?: string; file_path?: string }>;
};

type Draft = {
  id: string;
  title?: string;
  updatedAt?: string;
  sent_to_ihc_at?: string;
  ihc_sent?: boolean;
  api_evaluation_id?: string;
  meta_data?: Array<{
    id: string;
    title: string;
    questions: Array<{
      id: string;
      text: string;
      answer?: string;
    }>;
  }>;
  CheckDraftSoreLog?: Array<{
    score?: number;
    score_meta_data?: {
      id?: string;
      status?: string;
      score?: number;
      recommendations?: string[];
      priorArt?: Array<{
        url?: string;
        title?: string;
        abstract?: string;
        publicationNumber?: string;
        assignee?: string;
        year?: string | number;
        publicationDate?: string;
      }>;
      scoringResult?: {
        summary?: string;
        confidenceLevel?: string;
        closestMatches?: Array<{
          title?: string;
          publicationNumber?: string;
          analysis?: string;
          keySimilarities?: string[];
        }>;
      };
    };
  }>;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    tone: ProductChipTone;
  }
> = {
  UNDER_REVIEW: {
    label: "Decision needed",
    tone: "warning",
  },
  SENT_TO_IHC: {
    label: "Decision needed",
    tone: "warning",
  },
  UPDATE_REQUEST: {
    label: "Waiting on inventor",
    tone: "info",
  },
  SEND_TO_OC: {
    label: "Sent to Photon Legal",
    tone: "info",
  },
  FILED: {
    label: "Filed",
    tone: "success",
  },
  IN_DRAFT: {
    label: "Draft",
    tone: "neutral",
  },
  REJECT_BY_IHC: {
    label: "Declined",
    tone: "danger",
  },
  REJECT_BY_OC: {
    label: "Declined by counsel",
    tone: "danger",
  },
};

const ideaDate = (idea: Idea) =>
  idea.sent_to_ip_committee_at || idea.submission_date || idea.updatedAt;

const ageInDays = (idea: Idea) => {
  const value = ideaDate(idea);
  if (!value) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(value)));
};

const submitterName = (idea: Idea) =>
  typeof idea.created_by === "string"
    ? idea.created_by
    : idea.created_by?.name || idea.created_by?.email || "Unknown inventor";

const formatDate = (value?: string) =>
  value ? format(new Date(value), "MMM d, yyyy") : "Not recorded";

const formatScore10 = (score?: number | null) =>
  score == null ? "—" : (score / 10).toFixed(1);

const StatusTag = ({ status }: { status: string }) => {
  const meta = STATUS_META[status] || STATUS_META.IN_DRAFT;
  const isPhotonTransfer = status === "SEND_TO_OC";
  return (
    <ProductChip
      kind="status"
      tone={meta.tone}
      marker={!isPhotonTransfer}
      icon={isPhotonTransfer ? <ArrowUpRight className="h-3.5 w-3.5" /> : undefined}
    >
      {meta.label}
    </ProductChip>
  );
};

const ProvenanceTag = ({ ai = false }: { ai?: boolean }) => (
  <ProductChip
    kind="metadata"
    tone="neutral"
    icon={ai ? <Sparkles className="h-3.5 w-3.5" /> : undefined}
  >
    {ai ? "AI evaluated" : "Inventor submitted"}
  </ProductChip>
);

type LifecycleStage = {
  label: string;
  detail?: string;
  state: "complete" | "current" | "upcoming";
};

const lifecycleStagesForIdea = (idea: Idea): LifecycleStage[] => {
  const currentStage =
    idea.status === "GRANTED"
      ? 4
      : idea.status === "FILED"
        ? 3
        : idea.status === "SEND_TO_OC"
          ? 2
          : ["UNDER_REVIEW", "SENT_TO_IHC", "UPDATE_REQUEST", "REJECT_BY_IHC", "REJECT_BY_OC"].includes(idea.status)
            ? 1
            : 0;

  const stageDetails = [
    formatDate(idea.submission_date),
    idea.status === "UPDATE_REQUEST"
      ? "With inventor"
      : ["REJECT_BY_IHC", "REJECT_BY_OC"].includes(idea.status)
        ? "Review closed"
        : currentStage === 1
          ? "Decision needed"
          : undefined,
    currentStage === 2 ? "In progress" : undefined,
    currentStage < 3 ? "Usually 1 to 3 months" : undefined,
    undefined,
  ];
  const labels = [
    "Submitted",
    "Under review",
    "Sent to Photon Legal",
    "Filed",
    "Granted",
  ];

  return labels.map((label, index) => ({
    label,
    detail: stageDetails[index],
    state:
      index < currentStage || (idea.status === "GRANTED" && index === 4)
        ? "complete"
        : index === currentStage
          ? "current"
          : "upcoming",
  }));
};

const ReviewLifecycleTimeline = ({ idea }: { idea: Idea }) => {
  const stages = lifecycleStagesForIdea(idea);

  return (
    <div
      className="mt-5 grid"
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
      aria-label="Idea lifecycle"
    >
      {stages.map((stage, index) => (
        <div key={`${stage.label}-${index}`} className="relative min-w-0 pr-4 last:pr-0">
          <div className="relative flex h-5 items-center">
            {index < stages.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-5 right-0 top-1/2 -translate-y-1/2 ${
                  stage.state === "complete"
                    ? "h-px bg-[var(--pulse-success)]"
                    : "border-t border-dashed border-[var(--pulse-line-strong)]"
                }`}
              />
            )}
            <span
              className={`relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                stage.state === "complete"
                  ? "bg-[var(--pulse-success)] text-white"
                  : stage.state === "current"
                    ? "bg-[var(--pulse-brand)] ring-4 ring-[var(--pulse-brand-soft)]"
                    : "border border-[var(--pulse-line-strong)] bg-white"
              }`}
            >
              {stage.state === "complete" && <Check className="h-3 w-3" />}
            </span>
          </div>
          <p className="mt-2 truncate text-[13px] font-semibold text-[var(--pulse-ink-secondary)]">{stage.label}</p>
          {stage.detail && <p className="mt-0.5 truncate text-xs text-[var(--pulse-ink-muted)]">{stage.detail}</p>}
        </div>
      ))}
    </div>
  );
};

const EmptyQueue = ({ search }: { search: boolean }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
    <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--pulse-surface-subtle)] text-[var(--pulse-ink-muted)]">
      {search ? <Search className="h-5 w-5" /> : <Check className="h-5 w-5" />}
    </span>
    <h2 className="text-base font-semibold">
      {search ? "No matching disclosures" : "This queue is clear"}
    </h2>
    <p className="mt-1 max-w-xs text-sm text-[var(--pulse-ink-muted)]">
      {search
        ? "Try a different title, inventor, or status."
        : "There are no items requiring attention in this view."}
    </p>
  </div>
);

const ReviewQueueWorkspace = () => {
  const queryClient = useQueryClient();
  const [view, setView] = React.useState<QueueView>("review");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detailTab, setDetailTab] = React.useState<DetailTab>("brief");
  const [decisionDialog, setDecisionDialog] =
    React.useState<DecisionDialog>(null);
  const [decisionNote, setDecisionNote] = React.useState("");
  const [lastViewedAt, setLastViewedAt] = React.useState<string | null>(null);

  const {
    data: response,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["pulse-review-workspace"],
    refetchOnMount: true,
    queryFn: async () =>
      (
        await API_CONFIG.get(
          "/api/v1/idea/fetch-by-user?page=1&limit=100&sort=submission_date&order=asc",
        )
      )?.data,
  });

  const ideas: Idea[] = Array.isArray(response?.data) ? response.data : [];
  const { user: sessionUser } = useUserCookie();
  const isCommittee = sessionUser?.role === "TECH_COMMITTEE";
  // One stage, one queue. The committee acts at TECH_REVIEW (UNDER_REVIEW in
  // the old dialect); counsel acts at LEGAL_REVIEW (SENT_TO_IHC). Counsel's
  // queue used to ALSO list committee-stage ideas, and every decision on one
  // died with a 403 ('You cannot review at this stage.') because the server
  // derives the needed capability from the idea's state — the queue was
  // showing counsel work that was never theirs. For a client without a tech
  // committee, ideas go straight to LEGAL_REVIEW, so nothing is lost.
  const reviewStatuses = React.useMemo(
    () => (isCommittee ? ["UNDER_REVIEW"] : ["SENT_TO_IHC"]),
    [isCommittee],
  );

  const counts = React.useMemo(
    () => ({
      review: ideas.filter((idea) =>
        reviewStatuses.includes(idea.status),
      ).length,
      updates: ideas.filter((idea) => idea.status === "UPDATE_REQUEST").length,
      counsel: ideas.filter((idea) => idea.status === "SEND_TO_OC").length,
      all: ideas.length,
    }),
    [ideas, reviewStatuses],
  );
  const showClientName = React.useMemo(
    () =>
      new Set(ideas.map((idea) => idea.client?.name).filter(Boolean)).size > 1,
    [ideas],
  );

  const filteredIdeas = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const byView = ideas.filter((idea) => {
      if (view === "review")
        return reviewStatuses.includes(idea.status);
      if (view === "updates") return idea.status === "UPDATE_REQUEST";
      if (view === "counsel") return idea.status === "SEND_TO_OC";
      return true;
    });
    return byView
      .filter((idea) => {
        if (!query) return true;
        return [
          idea.title,
          idea.summary,
          submitterName(idea),
          idea.status,
        ].some((value) => String(value || "").toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aTime = new Date(ideaDate(a) || 0).getTime();
        const bTime = new Date(ideaDate(b) || 0).getTime();
        return aTime - bTime;
      });
  }, [ideas, search, view]);

  React.useEffect(() => {
    if (!filteredIdeas.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredIdeas.some((idea) => idea.id === selectedId)) {
      setSelectedId(filteredIdeas[0].id);
    }
  }, [filteredIdeas, selectedId]);

  const selectedIdea =
    filteredIdeas.find((idea) => idea.id === selectedId) || null;
  const selectedQueueIndex = filteredIdeas.findIndex(
    (idea) => idea.id === selectedId,
  );
  const nextQueueId =
    filteredIdeas[selectedQueueIndex + 1]?.id ||
    filteredIdeas[selectedQueueIndex - 1]?.id ||
    null;

  const { data: draftsResponse, isPending: draftsPending } = useQuery({
    queryKey: ["pulse-review-drafts", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () =>
      (await API_CONFIG.get(`/api/v1/idea/fetch-drafts/${selectedId}`))?.data,
  });

  React.useEffect(() => {
    const nextIdea = filteredIdeas[selectedQueueIndex + 1];
    if (!nextIdea) return;
    void queryClient.prefetchQuery({
      queryKey: ["pulse-review-drafts", nextIdea.id],
      queryFn: async () =>
        (await API_CONFIG.get(`/api/v1/idea/fetch-drafts/${nextIdea.id}`))
          ?.data,
      staleTime: 30_000,
    });
  }, [filteredIdeas, queryClient, selectedQueueIndex]);
  const drafts: Draft[] = Array.isArray(draftsResponse?.data)
    ? draftsResponse.data
    : [];
  const reviewDraft = [...drafts].sort(
    (a, b) =>
      new Date(b.updatedAt || 0).getTime() -
    new Date(a.updatedAt || 0).getTime(),
  )[0];
  const evaluationReport =
    reviewDraft?.CheckDraftSoreLog?.at(-1)?.score_meta_data;

  // A reviewer often opens a submission WHILE the agent is still scanning —
  // there is no report yet, but there is an evaluation id. Poll its status;
  // when it completes (the agent's webhook has already persisted the score by
  // then, F-029), refetch the drafts so the report appears in place.
  const awaitingEvaluation = Boolean(reviewDraft?.api_evaluation_id) && !evaluationReport?.scoringResult;
  const { data: liveEvaluation } = useQuery({
    queryKey: ["pulse-review-evaluation", reviewDraft?.id],
    enabled: awaitingEvaluation && Boolean(reviewDraft?.id),
    refetchInterval: awaitingEvaluation ? 5000 : false,
    queryFn: async () =>
      (await API_CONFIG.get(`/api/v1/idea/fetch-score/${reviewDraft!.id}`))?.data,
  });
  const evaluationRunning = liveEvaluation?.data?.status === "RUNNING";
  const liveEvaluationId =
    liveEvaluation?.data?.report?.evaluationId ?? reviewDraft?.api_evaluation_id ?? null;
  React.useEffect(() => {
    if (awaitingEvaluation && liveEvaluation?.data?.status === "COMPLETE") {
      void queryClient.invalidateQueries({ queryKey: ["pulse-review-drafts", selectedId] });
    }
  }, [awaitingEvaluation, liveEvaluation?.data?.status, queryClient, selectedId]);
  const priorArtReferences = React.useMemo(() => {
    const scoreMeta = evaluationReport;
    const references = scoreMeta?.priorArt || [];
    const matches = scoreMeta?.scoringResult?.closestMatches || [];
    const byPublication = new Map<
      string,
      (typeof references)[number] & { overlap?: string }
    >();

    references.forEach((reference) => {
      const key = reference.publicationNumber || reference.title || reference.url;
      if (!key) return;
      byPublication.set(key, { ...reference });
    });
    matches.forEach((match) => {
      const key = match.publicationNumber || match.title;
      if (!key) return;
      const existing = byPublication.get(key) || {
        title: match.title,
        publicationNumber: match.publicationNumber,
      };
      byPublication.set(key, {
        ...existing,
        overlap:
          match.analysis || match.keySimilarities?.join(" · ") || undefined,
      });
    });

    return Array.from(byPublication.values())
      .map((reference) => ({
        ...reference,
        year:
          reference.year ||
          (reference.publicationDate
            ? new Date(reference.publicationDate).getFullYear()
            : undefined),
        overlap:
          reference.overlap ||
          reference.abstract ||
          "The evaluation identified related technical subject matter.",
      }))
      .slice(0, 3);
  }, [evaluationReport]);

  React.useEffect(() => {
    if (!selectedId) return;
    const storageKey = `pulse-review-viewed:${selectedId}`;
    const previous = localStorage.getItem(storageKey);
    setLastViewedAt(previous);
    const timer = window.setTimeout(
      () => localStorage.setItem(storageKey, new Date().toISOString()),
      800,
    );
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key !== "j" && event.key !== "k") return;
      event.preventDefault();
      const index = filteredIdeas.findIndex((idea) => idea.id === selectedId);
      const nextIndex =
        event.key === "j"
          ? Math.min(filteredIdeas.length - 1, index + 1)
          : Math.max(0, index - 1);
      setSelectedId(filteredIdeas[nextIndex]?.id || null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredIdeas, selectedId]);

  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pulse-review-workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["pulse-review-count"] }),
      queryClient.invalidateQueries({ queryKey: ["fetch_ideas"] }),
    ]);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIdea || !reviewDraft)
        throw new Error("A submitted draft is required before approval.");
      return API_CONFIG.post(`/api/v1/idea/send-to-oc/${reviewDraft.id}/oc`, {
        instructions: "Approved by in-house counsel",
      });
    },
    onSuccess: async () => {
      toast.success("Approved and sent to Photon Legal");
      setSelectedId(nextQueueId);
      await refreshWorkspace();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIdea) throw new Error("No disclosure selected.");
      return API_CONFIG.post(
        `/api/v1/idea/add-update-request/${selectedIdea.id}`,
        {
          note: decisionNote.trim(),
          inventors:
            selectedIdea.IdeaInventor?.map((entry) => entry.inventor?.id).filter(
              Boolean,
            ) || [],
        },
      );
    },
    onSuccess: async () => {
      toast.success("Update requested from the inventor");
      setDecisionDialog(null);
      setDecisionNote("");
      setSelectedId(nextQueueId);
      await refreshWorkspace();
    },
    onError: () => toast.error("Unable to request an update"),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIdea) throw new Error("No disclosure selected.");
      return API_CONFIG.post(
        `/api/v1/idea/reject-from-ihc/${selectedIdea.id}`,
        { reject_reason: decisionNote.trim() },
      );
    },
    onSuccess: async () => {
      toast.success("Disclosure declined");
      setDecisionDialog(null);
      setDecisionNote("");
      setSelectedId(nextQueueId);
      await refreshWorkspace();
    },
    onError: () => toast.error("Unable to decline this disclosure"),
  });

  React.useEffect(() => {
    const handleDecisionShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (
        !selectedIdea ||
        !(isCommittee ? selectedIdea.status === "UNDER_REVIEW" : selectedIdea.status === "SENT_TO_IHC")
      ) {
        return;
      }

      if (event.key.toLowerCase() === "u" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setDecisionDialog("request");
        return;
      }

      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        reviewDraft &&
        !approveMutation.isPending
      ) {
        event.preventDefault();
        approveMutation.mutate();
      }
    };

    window.addEventListener("keydown", handleDecisionShortcut);
    return () => window.removeEventListener("keydown", handleDecisionShortcut);
  }, [approveMutation, reviewDraft, selectedIdea]);

  const draftChangedSinceLastView = Boolean(
    reviewDraft?.updatedAt &&
      lastViewedAt &&
      new Date(reviewDraft.updatedAt).getTime() > new Date(lastViewedAt).getTime(),
  );

  if (isPending) {
    return (
      <div className="flex h-full flex-col p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-[#e9e9e4]" />
        <div className="mt-8 grid flex-1 grid-cols-[420px_minmax(0,1fr)] gap-4">
          <div className="animate-pulse rounded-xl border border-[var(--pulse-line)] bg-white" />
          <div className="animate-pulse rounded-xl border border-[var(--pulse-line)] bg-white" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-md rounded-xl border border-[#dfb6b2] bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">The review queue could not load</h1>
          <p className="mt-2 text-sm text-[var(--pulse-ink-muted)]">
            Your work is safe. Refresh the page or try again in a moment.
          </p>
        </div>
      </div>
    );
  }

  const views: Array<{ value: QueueView; label: string; count: number }> = [
    { value: "review", label: "Review", count: counts.review },
    { value: "updates", label: "With inventor", count: counts.updates },
    { value: "counsel", label: "With Photon Legal", count: counts.counsel },
    { value: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-[720px] flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 gap-4 px-6 py-6 lg:px-8">
        <section className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-white shadow-[0_1px_2px_rgba(20,20,16,0.04)] xl:w-[420px]">
          <div className="border-b border-[var(--pulse-line)] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pulse-ink-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title or inventor"
                className="h-10 w-full rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] pl-9 pr-9 text-sm outline-none transition focus:border-[var(--pulse-line-strong)] focus:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--pulse-ink-muted)] hover:bg-[#ecece7] hover:text-[var(--pulse-ink)]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center gap-0.5 overflow-hidden" aria-label="Queue views">
              {views.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setView(item.value)}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    view === item.value
                      ? "bg-[var(--pulse-ink)] text-white"
                      : "text-[var(--pulse-ink-muted)] hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]"
                  }`}
                >
                  {item.label} <span className="ml-0.5 tabular-nums opacity-75">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-[var(--pulse-line)] px-4 py-2 text-xs text-[var(--pulse-ink-muted)]">
            <span>{filteredIdeas.length} ideas · oldest first</span>
            <span><kbd className="rounded border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-1.5 py-0.5 font-sans">J</kbd> <kbd className="rounded border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-1.5 py-0.5 font-sans">K</kbd> to move</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {filteredIdeas.length === 0 ? (
              <EmptyQueue search={Boolean(search)} />
            ) : (
              filteredIdeas.map((idea) => {
                const selected = selectedId === idea.id;
                const age = ageInDays(idea);
                return (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(idea.id);
                      setDetailTab("brief");
                    }}
                    className={`group relative w-full border-b border-[var(--pulse-line)] px-4 py-3 text-left transition-colors last:border-b-0 ${
                      selected
                        ? "bg-[var(--pulse-surface-subtle)]"
                        : "hover:bg-[var(--pulse-surface-subtle)]"
                    }`}
                  >
                    {selected && <span className="absolute inset-y-0 left-0 w-[2px] bg-[#0C0C0C]" />}
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs font-medium uppercase text-[var(--pulse-ink-muted)]">
                        {idea.reference_number || idea.id}
                      </span>
                      <span className="text-right text-xs font-medium tabular-nums text-[var(--pulse-ink-secondary)]">
                        {age}d
                      </span>
                    </div>
                    <h2 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-[var(--pulse-ink)]">
                      {idea.title}
                    </h2>
                    {showClientName && idea.client?.name && (
                      <p className="mt-1.5 truncate text-xs text-[var(--pulse-ink-muted)]">
                        {idea.client.name}
                      </p>
                    )}
                    {view === "all" && (
                      <div className="mt-2">
                        <StatusTag status={idea.status} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-white shadow-[0_1px_2px_rgba(20,20,16,0.04)]">
          {!selectedIdea ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <Inbox className="mx-auto h-8 w-8 text-[var(--pulse-ink-muted)]" />
                <h2 className="mt-4 text-lg font-semibold">Select a disclosure</h2>
                <p className="mt-1 text-sm text-[var(--pulse-ink-muted)]">
                  Its evidence and decision history will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--pulse-line)] px-6 pt-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold uppercase text-[var(--pulse-ink-muted)]">
                        {selectedIdea.id}
                      </span>
                      <StatusTag status={selectedIdea.status} />
                    </div>
                    <h2 className="mt-3 max-w-4xl text-[22px] font-semibold leading-7 tracking-[-0.02em]">
                      {selectedIdea.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--pulse-ink-muted)]">
                      <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" />{submitterName(selectedIdea)}</span>
                      <span>Submitted {formatDate(selectedIdea.submission_date)}</span>
                      <span>{selectedIdea.IdeaInventor?.length || 1} inventor{(selectedIdea.IdeaInventor?.length || 1) === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <Link
                    to={`/ideas/${selectedIdea.id}`}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--pulse-line)] bg-white px-3 text-sm font-semibold text-[var(--pulse-ink-secondary)] transition-colors hover:border-[var(--pulse-line-strong)] hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]"
                    aria-label={`Open full record for ${selectedIdea.title}`}
                  >
                    <FileText className="h-4 w-4" />
                    Full record
                  </Link>
                </div>

                <div className="mt-5 flex items-center gap-5">
                  {([
                    ["brief", "Summary"],
                    ["submission", "Submission"],
                    ["aiReport", "AI Evaluation Report"],
                    ["activity", "Activity"],
                  ] as Array<[DetailTab, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDetailTab(value)}
                      className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
                        detailTab === value
                          ? "border-[var(--pulse-ink)] text-[var(--pulse-ink)]"
                          : "border-transparent text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--pulse-surface-subtle)] p-6">
                {detailTab === "brief" && (
                  <div className="mx-auto max-w-4xl space-y-5">
                    {draftChangedSinceLastView && (
                    <div className="rounded-xl border border-[#b7bedf] bg-[var(--pulse-info-soft)] p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[var(--pulse-info)] shadow-sm">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold">Draft changed since your previous review</h3>
                          <p className="mt-1 text-sm text-[var(--pulse-ink-secondary)]">
                            The current draft was updated {formatDate(reviewDraft?.updatedAt)}. Review the revised content before deciding.
                          </p>
                        </div>
                      </div>
                    </div>
                    )}

                    <article className="rounded-xl border border-[var(--pulse-line)] bg-white p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Invention summary</p>
                          <h3 className="mt-2 text-lg font-semibold">What the inventor says is new</h3>
                        </div>
                        <ProvenanceTag />
                      </div>
                      <p className="mt-4 text-base leading-7 text-[var(--pulse-ink-secondary)]">
                        {selectedIdea.summary || "No short summary was provided."}
                      </p>
                      <div className="my-5 h-px bg-[var(--pulse-line)]" />
                      <h4 className="text-sm font-semibold">Problem and proposed mechanism</h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--pulse-ink-secondary)]">
                        {selectedIdea.about || "No detailed description was provided."}
                      </p>
                    </article>

                    <article className="rounded-xl border border-[var(--pulse-line)] bg-white p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Evaluation evidence</p>
                          <h3 className="mt-2 text-lg font-semibold">Closest prior art</h3>
                          <p className="mt-1 text-sm text-[var(--pulse-ink-muted)]">The most relevant references returned by the evaluation.</p>
                        </div>
                        <ProvenanceTag ai />
                      </div>
                      {priorArtReferences.length ? (
                        <div className="mt-5 divide-y divide-[var(--pulse-line)] border-y border-[var(--pulse-line)]">
                          {priorArtReferences.map((reference, index) => (
                            <div key={reference.publicationNumber || reference.title || index} className="grid grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] gap-6 py-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="font-mono text-xs font-semibold text-[var(--pulse-info)]">{reference.publicationNumber || `Reference ${index + 1}`}</span>
                                  <span className="text-xs text-[var(--pulse-ink-muted)]">{reference.assignee || "Assignee unavailable"}{reference.year ? ` · ${reference.year}` : " · Year unavailable"}</span>
                                </div>
                                <p className="mt-1.5 text-sm font-semibold text-[var(--pulse-ink)]">{reference.title || "Untitled patent reference"}</p>
                              </div>
                              <p className="text-sm leading-5 text-[var(--pulse-ink-secondary)]"><span className="font-semibold text-[var(--pulse-ink)]">Overlap: </span>{reference.overlap}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 border border-dashed border-[var(--pulse-line-strong)] bg-[var(--pulse-surface-subtle)] p-5 text-sm text-[var(--pulse-ink-muted)]">No prior-art references were returned by this evaluation.</div>
                      )}
                    </article>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-[var(--pulse-line)] bg-white p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Evaluation signal</p>
                            <p className="mt-2 text-3xl font-semibold tabular-nums">
                              {formatScore10(selectedIdea.score)}
                              <span className="ml-1 text-base font-medium text-[var(--pulse-ink-muted)]">/10</span>
                            </p>
                          </div>
                          <ProvenanceTag ai />
                        </div>
                        <p className="mt-3 text-sm text-[var(--pulse-ink-muted)]">
                          A review aid, not a filing recommendation. Inspect the evidence before deciding.
                        </p>
                      </div>
                      <div className="rounded-xl border border-[var(--pulse-line)] bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Review readiness</p>
                        <div className="mt-3 text-sm">
                          <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-[var(--pulse-ink-muted)]" />Submitted draft</span><span className={`font-semibold ${reviewDraft ? "text-[var(--pulse-success)]" : "text-[var(--pulse-danger)]"}`}>{reviewDraft ? "Available" : "Missing"}</span></div>
                          <p className="mt-3 border-t border-[var(--pulse-line)] pt-3 text-xs leading-5 text-[var(--pulse-ink-muted)]">{reviewDraft ? "The submitted draft is available. Approval is enabled." : "Approval is blocked until the inventor submits a draft."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === "submission" && (
                  <article className="mx-auto max-w-4xl rounded-xl border border-[var(--pulse-line)] bg-white p-6">
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--pulse-line)] pb-5">
                      <div>
                        <h3 className="text-lg font-semibold">Inventor submission</h3>
                      </div>
                      <ProvenanceTag />
                    </div>

                    <div className="py-6">
                      <section className="border-b border-[var(--pulse-line)] pb-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Title</p>
                        <p className="mt-2 text-base font-semibold text-[var(--pulse-ink)]">{selectedIdea.title}</p>
                      </section>

                      {reviewDraft?.meta_data?.length ? (
                        <div>
                          {reviewDraft.meta_data.map((section) => (
                            <section key={section.id} className="border-b border-[var(--pulse-line)] py-5">
                              <h4 className="text-[15px] font-semibold leading-[22px] text-[#0C0C0C]">{section.title}</h4>
                              <div className="mt-4 space-y-5">
                                {section.questions.map((question) => (
                                  <div key={question.id}>
                                    <p className="text-[13px] font-medium leading-[18px] text-[#727272]">{question.text}</p>
                                    <p className={`mt-1 text-sm leading-[1.7] ${question.answer?.trim() ? "text-[#0C0C0C]" : "italic text-[var(--pulse-ink-muted)]"}`}>
                                      {question.answer?.trim() || "No answer provided."}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-5 border-b border-[var(--pulse-line)] py-5">
                          <section>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">What is new</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--pulse-ink-secondary)]">{selectedIdea.summary || "No short summary was provided."}</p>
                          </section>
                          <section>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Problem and proposed mechanism</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--pulse-ink-secondary)]">{selectedIdea.about || "No detailed description was provided."}</p>
                          </section>
                        </div>
                      )}

                      <section className="grid grid-cols-2 gap-6 pt-5">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Inventors</p>
                          <div className="mt-2 space-y-1 text-sm text-[var(--pulse-ink-secondary)]">
                            {(selectedIdea.IdeaInventor?.length
                              ? selectedIdea.IdeaInventor
                              : [{ id: "submitter", inventor: { name: submitterName(selectedIdea) } }]
                            ).map((entry) => <p key={entry.id}>{entry.inventor?.name || "Named inventor"}</p>)}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Attachments</p>
                          <div className="mt-2 space-y-1 text-sm text-[var(--pulse-ink-secondary)]">
                            {selectedIdea.IdeaFiles?.length
                              ? selectedIdea.IdeaFiles.map((file) => <p key={file.id}>{file.original_name || "Attachment"}</p>)
                              : <p>No attachments submitted.</p>}
                          </div>
                        </div>
                      </section>
                    </div>
                  </article>
                )}

                {detailTab === "aiReport" && (
                  <div className="mx-auto max-w-4xl">
                    {evaluationReport?.scoringResult ? (
                      <section className="overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-white">
                        <div className="flex items-center justify-between gap-4 border-b border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-5 py-3">
                          <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-secondary)]">Patent Analysis Report</h3>
                          <ProvenanceTag ai />
                        </div>
                        <div className="p-6">
                          <PatentNoveltyReport
                            embedded
                            title={selectedIdea.title}
                            api_evaluation_id={evaluationReport.id || reviewDraft?.api_evaluation_id || ""}
                            scoringResult={{
                              ...evaluationReport.scoringResult,
                              closestMatches:
                                evaluationReport.scoringResult.closestMatches || [],
                              recommendations: evaluationReport.recommendations || [],
                            } as any}
                            priorArt={(evaluationReport.priorArt || []) as any}
                            report={evaluationReport as any}
                          />
                        </div>
                      </section>
                    ) : evaluationRunning ? (
                      <div className="rounded-xl border border-[var(--pulse-line)] bg-white p-6">
                        <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-secondary)]">Patent Analysis in progress</h3>
                        <div className="mt-4">
                          <EvaluationProgress evaluationId={liveEvaluationId} />
                        </div>
                        <p className="mt-3 text-xs text-[var(--pulse-ink-muted)]">The report appears here the moment the scan completes — no refresh needed.</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--pulse-line-strong)] bg-white p-8 text-center">
                        <Sparkles className="mx-auto h-5 w-5 text-[var(--pulse-ink-muted)]" />
                        <h3 className="mt-3 text-sm font-semibold">AI evaluation is not available</h3>
                        <p className="mt-1 text-sm text-[var(--pulse-ink-muted)]">This submission does not yet have a completed Patent Analysis Report.</p>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === "activity" && (
                  <div className="mx-auto max-w-4xl rounded-xl border border-[var(--pulse-line)] bg-white p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Lifecycle</p>
                    <h3 className="mt-2 text-lg font-semibold">Review progress</h3>
                    <ReviewLifecycleTimeline idea={selectedIdea} />

                    <div className="mt-8 border-t border-[var(--pulse-line)] pt-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">Audit trail</p>
                      <h3 className="mt-2 text-lg font-semibold">Recorded activity</h3>
                      <div className="mt-6 space-y-0">
                      {[
                        reviewDraft?.updatedAt && { title: "Draft updated", detail: reviewDraft.title || "Current draft", date: reviewDraft.updatedAt, icon: FileText },
                        selectedIdea.sent_to_ip_committee_at && { title: "Sent for committee review", detail: "Ready for an in-house counsel decision", date: selectedIdea.sent_to_ip_committee_at, icon: ArrowRight },
                        selectedIdea.submission_date && { title: "Disclosure submitted", detail: `Submitted by ${submitterName(selectedIdea)}`, date: selectedIdea.submission_date, icon: PenLine },
                      ].filter(Boolean).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((event: any, index) => {
                        const Icon = event.icon;
                        return (
                          <div key={`${event.title}-${event.date}`} className="relative flex gap-4 pb-6 last:pb-0">
                            {index < 2 && <span className="absolute left-[15px] top-8 h-[calc(100%-20px)] w-px bg-[var(--pulse-line)]" />}
                            <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--pulse-line)] bg-white"><Icon className="h-4 w-4 text-[var(--pulse-ink-muted)]" /></span>
                            <div className="min-w-0 pt-0.5"><p className="text-sm font-semibold">{event.title}</p><p className="mt-0.5 text-sm text-[var(--pulse-ink-muted)]">{event.detail}</p><p className="mt-1 font-mono text-xs text-[var(--pulse-ink-muted)]">{format(new Date(event.date), "MMM d, yyyy · h:mm a")}</p></div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 z-20 flex min-h-16 shrink-0 items-center justify-end gap-4 border-t border-[var(--pulse-line)] bg-white px-6 py-3 [box-shadow:0_-8px_24px_rgba(17,16,60,0.04)]">
                {(draftsPending || !reviewDraft) && (
                  <p className="mr-auto text-xs text-[var(--pulse-ink-muted)]">
                    {draftsPending
                      ? "Checking the submitted record…"
                      : "Approval is unavailable until a draft is submitted."}
                  </p>
                )}
                {!isCommittee && selectedIdea.status === "UNDER_REVIEW" && (
                  <p className="rounded-lg border border-dashed border-[var(--pulse-line-strong)] bg-[var(--pulse-surface-subtle)] px-4 py-2.5 text-sm text-[var(--pulse-ink-muted)]">
                    Under Tech Committee review — it reaches your queue once the committee sends it on.
                  </p>
                )}
                {(isCommittee ? selectedIdea.status === "UNDER_REVIEW" : selectedIdea.status === "SENT_TO_IHC") && (
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--pulse-line)] bg-white text-[var(--pulse-ink-secondary)] hover:border-[var(--pulse-line-strong)] hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]" aria-label="More decision actions" title="More decision actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => setDecisionDialog("decline")} className="text-[var(--pulse-danger)] focus:bg-[var(--pulse-danger-soft)] focus:text-[var(--pulse-danger)]">
                          Decline idea
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button type="button" onClick={() => setDecisionDialog("request")} className="h-10 whitespace-nowrap rounded-lg border border-[var(--pulse-line)] bg-white px-4 text-sm font-semibold text-[var(--pulse-ink-secondary)] hover:border-[var(--pulse-line-strong)] hover:text-[var(--pulse-ink)]" aria-keyshortcuts="U" title="Request update (U)">Request Update from Inventor</button>
                    <button type="button" onClick={() => approveMutation.mutate()} disabled={!reviewDraft || approveMutation.isPending} className="inline-flex h-10 min-w-[180px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--pulse-brand)] px-4 text-sm font-semibold text-[var(--pulse-ink)] shadow-[0_1px_0_rgba(0,0,0,0.1)] hover:bg-[var(--pulse-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50" aria-keyshortcuts="Control+Enter Meta+Enter" title={reviewDraft ? `${isCommittee ? "Send to Legal Counsel" : "Send to Photon Legal"} (⌘/Ctrl+Enter)` : "A submitted draft is required"}>{approveMutation.isPending ? "Sending…" : isCommittee ? "Send to Legal Counsel" : "Send to Photon Legal"}<ArrowRight className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={decisionDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionDialog(null);
            setDecisionNote("");
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-xl border-[var(--pulse-line)] bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-[var(--pulse-line)] p-6 text-left">
            <DialogTitle className="text-xl font-semibold tracking-[-0.01em]">
              {decisionDialog === "request" ? "Request an update" : "Decline disclosure"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-5 text-[var(--pulse-ink-muted)]">
              {decisionDialog === "request"
                ? "Explain exactly what is missing so the inventor can respond without reconstructing the review."
                : "Record a clear reason. This becomes part of the decision history."}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <label htmlFor="decision-note" className="text-sm font-semibold">
              {decisionDialog === "request" ? "What needs clarification?" : "Reason for declining"}
            </label>
            <Textarea
              id="decision-note"
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              placeholder={decisionDialog === "request" ? "For example: clarify how the heater traces are patterned and attach the latest test results." : "Explain why this disclosure should not proceed."}
              className="mt-2 min-h-32 rounded-lg border-[var(--pulse-line)] bg-white text-sm leading-6 focus-visible:ring-[var(--pulse-focus)]"
              autoFocus
            />
            <p className="mt-2 text-xs text-[var(--pulse-ink-muted)]">Be specific and use plain language. The inventor will see this verbatim.</p>
          </div>
          <DialogFooter className="border-t border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] p-4">
            <button type="button" onClick={() => setDecisionDialog(null)} className="h-10 rounded-lg px-4 text-sm font-semibold text-[var(--pulse-ink-secondary)] hover:bg-white">Cancel</button>
            <button
              type="button"
              disabled={!decisionNote.trim() || requestUpdateMutation.isPending || declineMutation.isPending}
              onClick={() => decisionDialog === "request" ? requestUpdateMutation.mutate() : declineMutation.mutate()}
              className={`h-10 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${decisionDialog === "request" ? "bg-[var(--pulse-brand)] text-[var(--pulse-ink)] hover:bg-[var(--pulse-brand-hover)]" : "bg-[var(--pulse-danger)] text-white hover:brightness-95"}`}
            >
              {requestUpdateMutation.isPending || declineMutation.isPending
                ? "Saving…"
                : decisionDialog === "request"
                  ? "Send request"
                  : "Decline disclosure"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewQueueWorkspace;
