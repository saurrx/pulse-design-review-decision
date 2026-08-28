import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  FileText,
  Lock,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import API_CONFIG from "@/lib/apiConfig";
import ideaDraftQuestions from "@/lib/IdeaDraftQuestion";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import CoInventorsField from "@/components/ideas/CoInventorsField";

/**
 * Sectioned copilot workspace for the inventor draft flow. Converts the
 * Q&A questionnaire into named accordion sections with per-field AI assist,
 * a live preliminary patentability signal, autosave, and an always-enabled
 * finish CTA. Storage stays on the existing draft meta_data schema — the
 * redesign only re-skins how those answers are collected.
 */

type Provenance = "ai" | "edited" | "you";

// Sentence-case labels + helper copy per question id; `core` marks the
// novelty conception field (coached, never AI-drafted).
const FIELD_META: Record<
  string,
  { label: string; helper: string; required?: boolean; core?: boolean }
> = {
  bg1: {
    label: "Technological field",
    helper:
      "The area your invention belongs to — e.g. battery systems, network security.",
    required: true,
  },
  bg2: {
    label: "Related existing solutions",
    helper: "Products, patents, or papers that already tackle this space.",
  },
  prob1: {
    label: "The problem you solve",
    helper: "The specific pain or limitation your invention addresses.",
    required: true,
  },
  prob2: {
    label: "Why current solutions fall short",
    helper: "What today's approaches can't do, or do too slowly or expensively.",
  },
  sol1: {
    label: "How it works",
    helper: "The core mechanism, in plain language.",
    required: true,
  },
  sol2: {
    label: "Key components or steps",
    helper: "The main parts or stages that make it work.",
  },
  adv1: {
    label: "What makes it different",
    helper:
      "In your own words — what sets this apart from everything else.",
    required: true,
    core: true,
  },
  adv2: {
    label: "Cost, efficiency, or performance benefits",
    helper: "Measurable gains over existing approaches.",
  },
  imp1: {
    label: "How it would be used in practice",
    helper: "Where and how the invention gets deployed.",
  },
  imp2: {
    label: "Resources needed",
    helper: "People, equipment, or budget required to build it.",
  },
};

const SECTION_TITLES: Record<string, string> = {
  background: "Background",
  problem: "Problem",
  solution: "Solution",
  advantages: "Novelty",
  implementation: "Application",
};

const COACH_PROMPTS = [
  "What's different from existing approaches?",
  "What surprised you when it first worked?",
  "What would a competitor find hardest to copy?",
];

const PROVENANCE_CHIP: Record<
  Provenance,
  { label: string; marker: string; text: string }
> = {
  ai: { label: "AI-drafted", marker: "#4351C0", text: "#333F99" },
  edited: { label: "Edited", marker: "#F9B418", text: "#7E5A00" },
  you: { label: "Written by you", marker: "#1E7B4D", text: "#155C3B" },
};

const ProvenanceChip = ({ p }: { p: Provenance }) => {
  const meta = PROVENANCE_CHIP[p];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-0.5"
      style={{ backgroundColor: `${meta.marker}14` }}
    >
      <span
        className="h-[6px] w-[6px] shrink-0"
        style={{ backgroundColor: meta.marker }}
      />
      <span
        className="font-mono text-xs font-semibold uppercase tracking-[0.05em]"
        style={{ color: meta.text }}
      >
        {meta.label}
      </span>
    </span>
  );
};

// Lightweight event sink — the demo logs; production wires this to the
// analytics pipeline.
const track = (event: string, payload: Record<string, unknown>) =>
  console.info("[track]", event, payload);

const savedLabel = (savedAt: Date | null) => {
  if (!savedAt) return null;
  const mins = Math.floor((Date.now() - savedAt.getTime()) / 60000);
  if (mins < 1) return "Saved just now";
  if (mins < 60) return `Saved ${mins}m ago`;
  const isToday = savedAt.toDateString() === new Date().toDateString();
  return isToday
    ? `Saved at ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : `Saved ${savedAt.toLocaleDateString([], { month: "short", day: "numeric" })}`;
};

const DraftWorkspace = ({ ideaId }: { ideaId?: string }) => {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const navigate = useNavigate();
  const { user } = useUserCookie();
  const queryClient = useQueryClient();
  const location = useLocation();
  const draftId = new URLSearchParams(location.search).get("draftId") || "";

  const [sections, setSections] = useState<any[]>([]);
  const [provenance, setProvenance] = useState<Record<string, Provenance>>({});
  const [openSection, setOpenSection] = useState<string>("background");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [, forceTick] = useState(0);
  const [autofillRan, setAutofillRan] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // One AI proposal per field, shown as a card until inserted or discarded.
  const [proposals, setProposals] = useState<Record<string, string>>({});
  const [finishNote, setFinishNote] = useState<string | null>(null);
  const [showCoInvPrompt, setShowCoInvPrompt] = useState(false);
  const [draftingField, setDraftingField] = useState<string | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  // Score lifecycle: polling flag while the pipeline runs, one-time CTA
  // pulse at 100%, and staleness once fields change after a score exists.
  const [scoringActive, setScoringActive] = useState(false);
  const [pulseNow, setPulseNow] = useState(false);
  const [dirtySinceScore, setDirtySinceScore] = useState(false);
  const pulsedRef = useRef(false);
  const scoreAnnouncedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const loadedRef = useRef(false);

  // Tick every 30s so "Saved 2m ago" stays honest.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const { data: draftData } = useQuery({
    queryKey: ["single_draft", draftId],
    enabled: !!draftId,
    queryFn: async () =>
      (await API_CONFIG.get(`/api/v1/idea/single-draft/${draftId}`))?.data,
  });

  const { data: ideaData } = useQuery({
    queryKey: ["workspace_idea", ideaId],
    enabled: !!ideaId,
    queryFn: async () =>
      (await API_CONFIG.get(`/api/v1/idea/fetch/${ideaId}`))?.data,
  });

  const idea = ideaData?.data;

  useEffect(() => {
    if (draftData && !loadedRef.current) {
      loadedRef.current = true;
      // Fall back to the default questionnaire when a draft has no (or
      // empty) meta_data, so the workspace never renders without sections.
      const meta =
        Array.isArray(draftData?.data?.meta_data) &&
        draftData.data.meta_data.length > 0
          ? draftData.data.meta_data
          : ideaDraftQuestions;
      setSections(JSON.parse(JSON.stringify(meta)));
      const prov: Record<string, Provenance> = {};
      (Array.isArray(draftData?.data?.meta_data) ? draftData.data.meta_data : []).forEach((s: any) =>
        s.questions.forEach((q: any) => {
          if (q.provenance) prov[q.id] = q.provenance;
          else if (q.answer?.trim()) prov[q.id] = "you";
        }),
      );
      setProvenance(prov);
      if (draftData?.data?.updatedAt) setSavedAt(new Date(draftData.data.updatedAt));
      const log = draftData?.data?.CheckDraftSoreLog?.[0];
      if (
        log?.createdAt &&
        draftData?.data?.updatedAt &&
        new Date(draftData.data.updatedAt).getTime() >
          new Date(log.createdAt).getTime() + 2000
      ) {
        setDirtySinceScore(true);
      }
    }
  }, [draftData]);

  /* ------------------------------ derived state ------------------------------ */

  const answers = useMemo(() => {
    const m: Record<string, string> = {};
    sections.forEach((s) => s.questions.forEach((q: any) => (m[q.id] = q.answer)));
    return m;
  }, [sections]);

  const attachments: any[] = idea?.IdeaFiles ?? [];

  const sectionComplete = useCallback(
    (sectionId: string) => {
      if (sectionId === "attachments") return attachments.length > 0;
      const s = sections.find((x) => x.id === sectionId);
      return !!s && s.questions.every((q: any) => q.answer?.trim());
    },
    [sections, attachments.length],
  );

  const sectionHasContent = useCallback(
    (sectionId: string) => {
      if (sectionId === "attachments") return attachments.length > 0;
      const s = sections.find((x) => x.id === sectionId);
      return !!s && s.questions.some((q: any) => q.answer?.trim());
    },
    [sections, attachments.length],
  );

  const outline = [
    ...sections.map((s) => ({ id: s.id, title: SECTION_TITLES[s.id] || s.title })),
    { id: "attachments", title: "Attachments" },
  ];

  const sectionsWithContent = outline.filter((o) => sectionHasContent(o.id)).length;

  const requiredIds = Object.keys(FIELD_META).filter((k) => FIELD_META[k].required);
  const missingRequired = requiredIds.filter((id) => !answers[id]?.trim());
  const incompleteSections = [
    ...new Set(
      missingRequired.map(
        (id) => sections.find((s) => s.questions.some((q: any) => q.id === id))?.id,
      ),
    ),
  ].filter(Boolean) as string[];

  // 10% baseline for a titled draft; the rest tracks answered fields.
  const totalFields = Object.keys(FIELD_META).length;
  const answered = Object.keys(FIELD_META).filter((id) => answers[id]?.trim()).length;
  const completion = Math.min(
    100,
    10 + Math.round((answered / totalFields) * 90),
  );

  const anyContent = answered > 0;
  const slimBanner = autofillRan || anyContent;

  /* --------------------------------- saving --------------------------------- */

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(
    (next: any[], prov: Record<string, Provenance>, pct: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const meta = next.map((s) => ({
            ...s,
            questions: s.questions.map((q: any) => ({
              ...q,
              provenance: prov[q.id] ?? null,
            })),
          }));
          await API_CONFIG.post(`/api/v1/idea/update/draft/${draftId}`, {
            meta_data: meta,
            completion_percentage: pct,
          });
          setSavedAt(new Date());
        } catch {
          toast.error("Autosave failed");
        }
      }, 800);
    },
    [draftId],
  );

  const setAnswer = (qid: string, value: string, viaAI = false) => {
    if (scored) setDirtySinceScore(true);
    setSections((prev) => {
      const next = prev.map((s) => ({
        ...s,
        questions: s.questions.map((q: any) =>
          q.id === qid ? { ...q, answer: value } : q,
        ),
      }));
      setProvenance((pp) => {
        const prior = pp[qid];
        const nextProv: Record<string, Provenance> = {
          ...pp,
          [qid]: viaAI
            ? "ai"
            : prior === "ai" || prior === "edited"
              ? "edited"
              : "you",
        };
        const answeredNext = next.reduce(
          (n, s) => n + s.questions.filter((q: any) => q.answer?.trim()).length,
          0,
        );
        persist(
          next,
          nextProv,
          Math.min(100, 10 + Math.round((answeredNext / totalFields) * 90)),
        );
        return nextProv;
      });
      return next;
    });
  };

  /* ----------------------------- autofill pipeline ----------------------------- */

  const runAutofill = async (payload: { file?: File; text?: string }) => {
    setIsAutofilling(true);
    try {
      // Existing pipeline; provenance is inventor-provided source material.
      const res = await API_CONFIG.post("/api/v1/idea/analyze-document", {
        source: "inventor-provided",
        file_name: payload.file?.name ?? null,
        text: payload.text ?? null,
      });
      const filled: any[] = res?.data?.data ?? [];
      setSections((prev) => {
        const next = prev.map((s) => {
          const src = filled.find((f) => f.id === s.id);
          return {
            ...s,
            questions: s.questions.map((q: any) => {
              const fq = src?.questions?.find((x: any) => x.id === q.id);
              // Never overwrite what the inventor already wrote.
              return q.answer?.trim() || !fq?.answer ? q : { ...q, answer: fq.answer };
            }),
          };
        });
        setProvenance((pp) => {
          const nextProv = { ...pp };
          next.forEach((s) =>
            s.questions.forEach((q: any) => {
              if (q.answer?.trim() && !pp[q.id]) nextProv[q.id] = "ai";
            }),
          );
          const answeredNext = next.reduce(
            (n, s) => n + s.questions.filter((q: any) => q.answer?.trim()).length,
            0,
          );
          persist(
            next,
            nextProv,
            Math.min(100, 10 + Math.round((answeredNext / totalFields) * 90)),
          );
          return nextProv;
        });
        return next;
      });
      setAutofillRan(true);
      toast.success("Draft pre-filled — review and edit each section");
    } catch {
      toast.error("Autofill failed");
    } finally {
      setIsAutofilling(false);
      setPasteOpen(false);
      setPasteText("");
    }
  };

  /* ------------------------------ per-field AI ------------------------------ */

  const draftField = async (qid: string, questionText: string) => {
    setDraftingField(qid);
    try {
      const res = await API_CONFIG.post(`/api/v1/idea/draft-field/${draftId}`, {
        question_id: qid,
        question_text: questionText,
        context: {
          title: idea?.title,
          answers,
        },
      });
      const text = res?.data?.data?.text;
      if (text) setProposals((p) => ({ ...p, [qid]: text }));
    } catch {
      toast.error("Couldn't draft this field");
    } finally {
      setDraftingField(null);
    }
  };

  /* ------------------------------- full score ------------------------------- */

  const { data: scoreData } = useQuery({
    queryKey: ["draft_score", draftId],
    enabled: !!draftId,
    refetchInterval: scoringActive ? 1500 : false,
    queryFn: async () =>
      (await API_CONFIG.get(`/api/v1/idea/fetch-score/${draftId}`))?.data,
  });
  const scoreRaw = scoreData?.data?.score;
  const scoreMeta = scoreData?.data?.score_meta_data;
  const scored = typeof scoreRaw === "number";
  const score10 = scored ? scoreRaw / 10 : null;
  const weakestSectionId: string =
    scoreMeta?.coaching?.weakest_section || "problem";
  const strengthenTips: string[] = scoreMeta?.coaching?.suggestions ?? [];

  useEffect(() => {
    if (scored && scoringActive) {
      setScoringActive(false);
      setDirtySinceScore(false);
    }
    if (scored && !scoreAnnouncedRef.current) {
      scoreAnnouncedRef.current = true;
      track("score_completed", { draftId, score: scoreRaw });
    }
  }, [scored, scoringActive, draftId, scoreRaw]);

  /* ---------------------------- preliminary signal ---------------------------- */

  const { data: signalData } = useQuery({
    queryKey: ["preliminary_signal", draftId, sectionsWithContent],
    enabled: !!draftId && sectionsWithContent >= 2,
    // Section completion changes at typing cadence; keep refreshes calm.
    staleTime: 15000,
    queryFn: async () =>
      (
        await API_CONFIG.get(
          `/api/v1/idea/preliminary-signal/${draftId}?sections=${sectionsWithContent}`,
        )
      )?.data,
  });
  const signal = signalData?.data;

  /* -------------------------------- attachments -------------------------------- */

  const { mutate: uploadAttachment } = useMutation({
    mutationFn: async (files: File[]) => {
      await API_CONFIG.post(`/api/v1/idea/upload-idea-file/${ideaId}`, {
        files: files.map((f) => ({ originalName: f.name, key: f.name })),
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workspace_idea", ideaId] }),
    onError: () => toast.error("Upload failed"),
  });

  /* --------------------------------- finish --------------------------------- */

  const { mutate: startScoring, isPending: isScoring } = useMutation({
    mutationFn: async () => {
      await API_CONFIG.get(`/api/v1/idea/check-score/${draftId}`);
    },
    onSuccess: () => {
      scoreAnnouncedRef.current = false;
      queryClient.setQueryData(["draft_score", draftId], null);
      setScoringActive(true);
      track("scoring_started", { draftId });
    },
    onError: () => toast.error("Failed to start scoring"),
  });

  const { mutate: sendToCommittee, isPending: isSending } = useMutation({
    mutationFn: async () => {
      await API_CONFIG.post(
        `/api/v1/idea/send-to-ihc/${draftId}/${user?.client_id}`,
        { stale: dirtySinceScore },
      );
    },
    onSuccess: () => {
      track("sent_to_committee", {
        draftId,
        score: scoreRaw,
        stale: dirtySinceScore,
      });
      toast.success("Sent to the IP Committee");
      navigate(`/ideas/${ideaId}`);
    },
    onError: () => toast.error("Failed to send"),
  });

  const coInventorCount = (idea?.IdeaInventor || []).filter(
    (x: any) => x?.inventor?.id !== user?.id,
  ).length;

  const scrollToSection = (id: string) => {
    setOpenSection(id);
    setTimeout(
      () => sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const handleFinish = () => {
    if (missingRequired.length > 0) {
      setFinishNote(
        `${incompleteSections.length} section${incompleteSections.length === 1 ? "" : "s"} to go — or upload a document and we'll pre-fill them.`,
      );
      scrollToSection(incompleteSections[0]);
      return;
    }
    setFinishNote(null);
    startScoring();
  };

  const handleSend = () => {
    if (coInventorCount === 0 && !showCoInvPrompt) {
      setShowCoInvPrompt(true);
      return;
    }
    setShowCoInvPrompt(false);
    sendToCommittee();
  };

  // One-time CTA pulse the moment required completion hits 100% (state B).
  const requiredComplete = missingRequired.length === 0;
  useEffect(() => {
    if (requiredComplete && !scored && loadedRef.current && !pulsedRef.current) {
      pulsedRef.current = true;
      setPulseNow(true);
      const t = setTimeout(() => setPulseNow(false), 1400);
      return () => clearTimeout(t);
    }
  }, [requiredComplete, scored]);

  /* ---------------------------------- tokens ---------------------------------- */

  const ink = dark ? "text-neutral-100" : "text-[#0C0C0C]";
  const muted = dark ? "text-neutral-500" : "text-[#727272]";
  const card = dark
    ? "border-[#cccccc20] bg-[#0e0e0e]"
    : "border-[#E8E8E8] bg-white";
  const fieldCls = `w-full resize-y rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-[#F9B418] ${
    dark
      ? "border-white/10 text-neutral-100 placeholder:text-neutral-500"
      : "border-[#E8E8E8] text-neutral-900 placeholder:text-neutral-400"
  }`;

  /* ---------------------------------- render ---------------------------------- */

  return (
    <div className={`pulse-product-page flex h-screen flex-col font-sans ${dark ? "bg-black" : "bg-[var(--pulse-canvas)]"}`}>
      {/* ---- Header ---- */}
      <div
        className={`flex items-center justify-between gap-6 border-b px-6 py-4 ${
          dark ? "border-[#cccccc20] bg-[#0a0a0a]" : "border-[#E8E8E8] bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <span className={`block truncate text-lg font-semibold tracking-[-0.015em] ${ink}`}>
              {idea?.title || "Draft"}
            </span>
            <span className={`text-xs ${muted}`}>
              Draft submission
              {savedAt && (
                <span className="ml-2 normal-case">· {savedLabel(savedAt)}</span>
              )}
            </span>
          </div>
        </div>
        <div className="max-w-[360px]">
          <CoInventorsField ideaId={ideaId} />
        </div>
      </div>

      {/* ---- Body ---- */}
      <div className="flex flex-1 gap-6 overflow-hidden px-6 py-6">
        {/* Left rail: progress + outline */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="mb-4">
            <div className={`mb-1 flex justify-between text-xs ${muted}`}>
              <span className="font-medium uppercase tracking-[0.05em]">Completion</span>
              <span className="font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                {completion}%
              </span>
            </div>
            <div className={`h-1.5 w-full rounded-full ${dark ? "bg-neutral-800" : "bg-neutral-200"}`}>
              <div
                className="h-1.5 rounded-full bg-[#F9B418] transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
          <nav className="space-y-0.5">
            {outline.map((o) => {
              const done = sectionComplete(o.id);
              const active = openSection === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => scrollToSection(o.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] transition-colors ${
                    active
                      ? `font-semibold ${ink} ${dark ? "bg-white/5" : "bg-white"}`
                      : `${muted} hover:${ink}`
                  }`}
                >
                  {o.id === "attachments" && !done ? (
                    // Optional section: no required-looking empty circle.
                    <span className="w-4 shrink-0" />
                  ) : (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        done
                          ? "border-[#1E7B4D] bg-[#1E7B4D]"
                          : dark
                            ? "border-neutral-700"
                            : "border-[#C8C8C8]"
                      }`}
                    >
                      {done && <Check className="h-3 w-3 text-white" />}
                    </span>
                  )}
                  <span className="flex-1">{o.title}</span>
                  {o.id === "attachments" && (
                    <span className={`text-xs ${muted}`}>optional</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main column */}
        <main className="min-w-0 flex-1 overflow-y-auto pb-28 pr-1">
          {/* Autofill banner */}
          {slimBanner ? (
            <div
              className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${card}`}
            >
              <span className={`text-[13px] ${muted}`}>
                <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-[#F9B418]" />
                {autofillRan
                  ? "Draft pre-filled from your material — review each section."
                  : "Have a write-up? Pre-fill the rest of this draft."}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`text-[13px] font-medium underline-offset-2 hover:underline ${ink}`}
                  disabled={isAutofilling}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setPasteOpen((v) => !v)}
                  className={`text-[13px] font-medium underline-offset-2 hover:underline ${ink}`}
                  disabled={isAutofilling}
                >
                  Paste text
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-[#F9B418]/60 bg-[#F9B418]/5 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#F9B418]" />
                <div className="min-w-0 flex-1">
                  <div className={`text-base font-semibold ${ink}`}>
                    Start from what you already have
                  </div>
                  <p className={`mt-0.5 text-[13px] ${muted}`}>
                    Upload a document or paste text and we'll pre-fill the
                    sections below. Review and edit before submission.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isAutofilling}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#F9B418] px-3.5 py-2 text-[13px] font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      {isAutofilling ? "Analyzing..." : "Upload document"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasteOpen((v) => !v)}
                      disabled={isAutofilling}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        dark
                          ? "border-white/15 text-neutral-300 hover:border-white/30"
                          : "border-[#C8C8C8] text-[#444444] hover:bg-[#F5F5F5]"
                      }`}
                    >
                      Paste text
                    </button>
                  </div>
                  <p className={`mt-2 text-xs ${muted}`}>
                    Supported: PDF, DOC, DOCX, PPTX
                  </p>
                </div>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.pptx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runAutofill({ file: f });
              e.target.value = "";
            }}
          />
          {pasteOpen && (
            <div className={`mb-5 rounded-xl border p-4 ${card}`}>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste anything — an email, meeting notes, a rough description. We'll structure it for you."
                className={fieldCls}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasteOpen(false)}
                  className={`px-3 py-1.5 text-[13px] font-medium ${muted} hover:${ink}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!pasteText.trim() || isAutofilling}
                  onClick={() => runAutofill({ text: pasteText.trim() })}
                  className="rounded-xl bg-[#F9B418] px-3.5 py-1.5 text-[13px] font-semibold text-[#0C0C0C] hover:bg-[#DA9700] disabled:opacity-50"
                >
                  {isAutofilling ? "Analyzing..." : "Pre-fill from text"}
                </button>
              </div>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-3">
            {sections.map((s) => {
              const open = openSection === s.id;
              const done = sectionComplete(s.id);
              return (
                <section
                  key={s.id}
                  ref={(el) => (sectionRefs.current[s.id] = el as HTMLDivElement | null)}
                  className={`rounded-xl border ${card}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenSection(open ? "" : s.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`text-base font-semibold ${ink}`}>
                        {SECTION_TITLES[s.id] || s.title}
                      </span>
                      {done && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1E7B4D]">
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#727272] transition-transform ${open ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {open && (
                    <div className="space-y-5 px-5 pb-5">
                      {s.questions.map((q: any) => {
                        const meta: {
                          label: string;
                          helper: string;
                          required?: boolean;
                          core?: boolean;
                        } = FIELD_META[q.id] ?? { label: q.text, helper: "" };
                        return (
                          <div key={q.id}>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <label
                                htmlFor={`f-${q.id}`}
                                className={`text-[13px] font-medium ${ink}`}
                              >
                                {meta.label}
                                {meta.required && (
                                  <span className={`ml-1 font-normal ${muted}`}>
                                    (required)
                                  </span>
                                )}
                              </label>
                            </div>
                            <p className={`mb-1.5 text-xs ${muted}`}>
                              {meta.helper}
                            </p>
                            {meta.core && (
                              <div
                                className={`mb-2 rounded-xl border px-3 py-2.5 text-xs ${card} ${muted}`}
                              >
                                <ul className="list-disc space-y-1 pl-4">
                                  {COACH_PROMPTS.map((p) => (
                                    <li key={p}>{p}</li>
                                  ))}
                                </ul>
                                <div className="mt-2 flex items-center gap-1.5">
                                  <Lock className="h-3 w-3 shrink-0" />
                                  In your own words — this is the record of your
                                  conception, so AI won't write it for you.
                                </div>
                              </div>
                            )}
                            <div className="relative">
                              <textarea
                                id={`f-${q.id}`}
                                rows={3}
                                value={q.answer}
                                onChange={(e) => {
                                  setAnswer(q.id, e.target.value);
                                  e.target.style.height = "auto";
                                  e.target.style.height = `${e.target.scrollHeight + 2}px`;
                                }}
                                ref={(el) => {
                                  // Grow to fit pre-filled/AI content on mount.
                                  if (el && el.scrollHeight > el.clientHeight) {
                                    el.style.height = `${el.scrollHeight + 2}px`;
                                  }
                                }}
                                placeholder="Type here..."
                                className={`${fieldCls} ${meta.core ? "" : "pb-9"}`}
                              />
                              {!meta.core && (
                                <button
                                  type="button"
                                  disabled={draftingField === q.id}
                                  onClick={() => draftField(q.id, q.text)}
                                  className={`absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                    dark
                                      ? "bg-[#0e0e0e] text-neutral-300 hover:bg-white/10"
                                      : "bg-white text-[#444444] hover:bg-[#F5F5F5]"
                                  }`}
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-[#F9B418]" />
                                  {draftingField === q.id
                                    ? "Suggesting..."
                                    : "Suggest"}
                                </button>
                              )}
                            </div>
                            {proposals[q.id] && (
                              <div className="mt-2 rounded-xl bg-[#4351C0]/[0.06] px-3 py-2.5">
                                <div className="mb-1 flex items-center gap-1.5">
                                  <Sparkles className="h-3 w-3 text-[#4351C0]" />
                                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-[#333F99]">
                                    Suggestion
                                  </span>
                                </div>
                                <p className={`text-[13px] leading-relaxed ${ink}`}>
                                  {proposals[q.id]}
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnswer(q.id, proposals[q.id], true);
                                      setProposals((p) => {
                                        const n = { ...p };
                                        delete n[q.id];
                                        return n;
                                      });
                                    }}
                                    className="rounded-xl bg-[#F9B418] px-3 py-1 text-xs font-semibold text-[#0C0C0C] hover:bg-[#DA9700]"
                                  >
                                    Insert
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProposals((p) => {
                                        const n = { ...p };
                                        delete n[q.id];
                                        return n;
                                      })
                                    }
                                    className={`px-2 py-1 text-xs font-medium ${muted} hover:underline`}
                                  >
                                    Discard
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Attachments */}
            <section
              ref={(el) => (sectionRefs.current["attachments"] = el as HTMLDivElement | null)}
              className={`rounded-xl border ${card}`}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenSection(openSection === "attachments" ? "" : "attachments")
                }
                aria-expanded={openSection === "attachments"}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <span className={`text-base font-semibold ${ink}`}>
                    Attachments
                  </span>
                  {attachments.length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1E7B4D]">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#727272] transition-transform ${
                    openSection === "attachments" ? "" : "-rotate-90"
                  }`}
                />
              </button>
              {openSection === "attachments" && (
                <div className="space-y-3 px-5 pb-5">
                  <p className={`text-xs ${muted}`}>
                    Diagrams, test data, or write-ups that support the
                    disclosure.
                  </p>
                  {attachments.map((f: any) => (
                    <div
                      key={f.id}
                      className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm ${
                        dark ? "border-white/10" : "border-[#E8E8E8]"
                      } ${ink}`}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-[#727272]" />
                      <span className="truncate">{f.original_name}</span>
                    </div>
                  ))}
                  <input
                    ref={attachInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length)
                        uploadAttachment(Array.from(e.target.files));
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => attachInputRef.current?.click()}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                      dark
                        ? "border-white/15 text-neutral-300 hover:border-white/30"
                        : "border-[#C8C8C8] text-[#444444] hover:bg-[#F5F5F5]"
                    }`}
                  >
                    <Plus className="h-4 w-4" /> Add files
                  </button>
                </div>
              )}
            </section>
          </div>
        </main>

        {/* Right rail: preliminary signal */}
        <aside className="hidden w-60 shrink-0 xl:block">
          <div className={`rounded-xl border p-4 ${card}`}>
            <div
              className={`text-xs font-medium uppercase tracking-[0.05em] ${muted}`}
            >
              {scored ? "Patentability score" : "Patentability signal"}
            </div>
            {scored ? (
              <>
                <div
                  className={`mt-2 text-2xl font-semibold ${ink}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {Math.round(scoreRaw)}
                  <span className={`ml-1 text-sm font-normal ${muted}`}>
                    /100
                  </span>
                </div>
                {dirtySinceScore && (
                  <span
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-2 py-0.5"
                    style={{ backgroundColor: "#F9B41814" }}
                  >
                    <span className="h-[6px] w-[6px] bg-[#F9B418]" />
                    <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-[#7E5A00]">
                      Scored before your latest edits
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/ideas/${ideaId}`)}
                  className={`mt-2 block text-xs font-medium underline-offset-2 hover:underline ${ink}`}
                >
                  View full report →
                </button>
              </>
            ) : scoringActive ? (
              <p className={`mt-2 text-xs leading-relaxed ${muted}`}>
                Scoring your draft — this takes a few seconds…
              </p>
            ) : (
              <>
                {signal ? (
                  <>
                    <div className={`mt-2 text-xl font-semibold ${ink}`}>
                      {signal.band}
                    </div>
                    <p className={`mt-1 text-xs ${muted}`}>
                      based on {signal.sections_with_content} of{" "}
                      {signal.total_sections} sections
                    </p>
                  </>
                ) : (
                  <p className={`mt-2 text-xs leading-relaxed ${muted}`}>
                    Fill in any two sections and we'll show an early read on
                    patentability.
                  </p>
                )}
                {requiredComplete && (
                  <p className={`mt-2 text-xs font-medium ${ink}`}>
                    You're done — get your full score.
                  </p>
                )}
                <p
                  className={`mt-3 border-t pt-2 text-xs ${muted} ${dark ? "border-[#cccccc20]" : "border-[#F5F5F5]"}`}
                >
                  The full score out of 100 is calculated when you finish.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ---- Footer CTA ---- */}
      <div
        className={`fixed bottom-0 left-0 z-20 w-full border-t px-6 py-3 md:left-auto md:w-[calc(100vw-16rem)] ${
          dark ? "border-[#cccccc20] bg-[#0a0a0a]" : "border-[#E8E8E8] bg-white"
        }`}
      >
        {/* Low-score coaching panel (state C, score < 4) */}
        {scored && score10! < 4 && strengthenTips.length > 0 && (
          <div
            className={`mb-3 rounded-xl border px-4 py-3 ${
              dark ? "border-[#cccccc20] bg-[#0e0e0e]" : "border-[#E8E8E8] bg-[#FAFAFA]"
            }`}
          >
            <div className={`text-[13px] font-semibold ${ink}`}>
              What would strengthen this
            </div>
            <ul className={`mt-1 list-disc space-y-0.5 pl-4 text-xs ${muted}`}>
              {strengthenTips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-[13px]">
            {showCoInvPrompt ? (
              <span className={`flex flex-wrap items-center gap-2 ${ink}`}>
                Anyone else contribute? Add co-inventors in the header above.
                <button
                  type="button"
                  onClick={handleSend}
                  className="font-medium underline underline-offset-2"
                >
                  Skip
                </button>
              </span>
            ) : scored ? (
              score10! >= 7 ? (
                <span className={ink}>
                  Strong signal. Send it to the committee.
                </span>
              ) : score10! >= 4 ? (
                <span className={muted}>
                  Send to committee{" "}
                  <button
                    type="button"
                    onClick={() => scrollToSection(weakestSectionId)}
                    className={`font-medium underline underline-offset-2 ${ink}`}
                  >
                    or strengthen it first
                  </button>
                </span>
              ) : (
                <span className={muted}>
                  A low score never blocks sending — but strengthening first
                  usually pays off.
                </span>
              )
            ) : finishNote ? (
              <span className={muted}>{finishNote}</span>
            ) : (
              <span className={muted}>
                Autosaves as you type
                {savedAt ? ` · ${savedLabel(savedAt)}` : ""}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {scored && dirtySinceScore && (
              <button
                type="button"
                onClick={() => startScoring()}
                disabled={isScoring || scoringActive}
                className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                  dark
                    ? "border-white/15 text-neutral-300 hover:border-white/30"
                    : "border-[#C8C8C8] text-[#444444] hover:bg-[#F5F5F5]"
                }`}
              >
                {scoringActive ? "Scoring..." : "Re-run score"}
              </button>
            )}

            {!scored ? (
              <button
                type="button"
                onClick={handleFinish}
                disabled={isScoring || scoringActive}
                className={`rounded-xl bg-[#F9B418] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-all hover:bg-[#DA9700] disabled:opacity-60 ${
                  pulseNow
                    ? "shadow-[0_0_0_6px_rgba(249,180,24,0.35)]"
                    : "shadow-none"
                }`}
                style={{ transition: "box-shadow 0.6s ease" }}
              >
                {isScoring || scoringActive
                  ? "Scoring..."
                  : "Finish and get score"}
              </button>
            ) : score10! < 4 ? (
              <>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    dark
                      ? "border-white/15 text-neutral-300 hover:border-white/30"
                      : "border-[#C8C8C8] text-[#444444] hover:bg-[#F5F5F5]"
                  }`}
                >
                  {isSending ? "Sending..." : "Send to IP Committee"}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(weakestSectionId)}
                  className="rounded-xl bg-[#F9B418] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700]"
                >
                  Improve my draft
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="rounded-xl bg-[#F9B418] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send to IP Committee"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftWorkspace;
