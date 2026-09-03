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
import { toast } from "@/lib/toast";
import EvaluationProgress from "@/components/ideas/EvaluationProgress";
import API_CONFIG from "@/lib/apiConfig";
import { extractDocumentText } from "@/lib/documentText";
import { track } from "@/lib/analytics";
import ideaDraftQuestions from "@/lib/IdeaDraftQuestion";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import CoInventorsField from "@/components/ideas/CoInventorsField";
import StatusTimeline from "@/components/ideas/StatusTimeline";

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

// Coarse size band — an enum, never the exact byte count.
const sizeBand = (bytes: number): string => {
  if (bytes < 100_000) return "xs";
  if (bytes < 1_000_000) return "s";
  if (bytes < 5_000_000) return "m";
  return "l";
};

// Novelty band from the 0–100 raw score — an enum, never the number itself, so
// it groups cleanly in a funnel and carries no disclosure signal.
const noveltyBand = (raw: unknown): string | undefined => {
  if (typeof raw !== "number") return undefined;
  if (raw >= 70) return "high";
  if (raw >= 40) return "moderate";
  return "low";
};

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
  // One review per field, shown as a card until dismissed. A review is a
  // VERDICT on what the inventor wrote — not a blob of text to accept blindly:
  // "this does not answer the question yet", "here is what is missing, and
  // here is a version with your own facts in it", or "this works, and here is
  // why". See pulse-backend draft-assist.ts.
  type FieldReview = { verdict: string; message: string; example?: string };
  const [proposals, setProposals] = useState<Record<string, FieldReview>>({});
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
      track("draft_opened", { idea_id: ideaId });
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

  // Readiness, reported in 10-point BANDS. The raw percentage moves on nearly
  // every keystroke; the band moves when the draft actually got further, which is
  // the only version of this that a retention or drop-off chart can read.
  const readinessBand = Math.floor(completion / 10) * 10;
  const bandRef = useRef<number | null>(null);
  useEffect(() => {
    if (!loadedRef.current) return;
    if (bandRef.current === readinessBand) return;
    // The first band after load is the starting point, not a change.
    const first = bandRef.current === null;
    bandRef.current = readinessBand;
    if (!first) track("draft_readiness_changed", { idea_id: ideaId, pct: readinessBand });
  }, [readinessBand, ideaId]);

  const anyContent = answered > 0;
  const slimBanner = autofillRan || anyContent;

  /* --------------------------------- saving --------------------------------- */

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The field whose edit triggered the pending save. Rides the SAME 800ms
  // debounce as the write itself, so a sentence typed into one box is one event
  // and not forty — a per-keystroke event here would be the loudest thing in the
  // whole project and would say nothing the autosave does not already say.
  const pendingFieldRef = useRef<string | null>(null);
  const saveNow = useCallback(
    async (next: any[], prov: Record<string, Provenance>, pct: number) => {
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
    },
    [draftId],
  );

  const persist = useCallback(
    (next: any[], prov: Record<string, Provenance>, pct: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const field = pendingFieldRef.current;
        pendingFieldRef.current = null;
        saveNow(next, prov, pct)
          .then(() => {
            // Field and section IDS, never the answer. Which boxes people fill,
            // and in what order, is the whole question behind the draft stall.
            if (field) {
              track("draft_field_saved", {
                idea_id: ideaId,
                field,
                section: next.find((sec) =>
                  sec.questions.some((q: any) => q.id === field),
                )?.id,
              });
            }
          })
          .catch(() => toast.error("Autosave failed"));
      }, 800);
    },
    [saveNow, ideaId],
  );

  const setAnswer = (qid: string, value: string, viaAI = false) => {
    if (scored) setDirtySinceScore(true);
    pendingFieldRef.current = qid;
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
      // A dropped file is read HERE and only its text travels — see
      // lib/documentText.ts on why the document itself never leaves the
      // machine.
      let source = (payload.text ?? "").trim();
      if (payload.file) {
        try {
          source = (await extractDocumentText(payload.file)).text;
          // Content-type + char count only — the extracted text never leaves the
          // browser and is NEVER put in an event.
          track("document_parsed", {
            idea_id: ideaId,
            content_type: payload.file.type || "unknown",
            char_count: source.length,
          });
        } catch (err: any) {
          toast.error(err?.message ?? "That file could not be read");
          return;
        }
      }
      if (source.length < 40) {
        toast.error("A few sentences at least — there has to be something to read.");
        return;
      }
      // The questionnaire's structure lives in the DRAFT, and the server fills
      // the questions it finds there — deliberately, so a client cannot rename
      // the novelty section to get it written. A draft nobody has typed into
      // yet has never been saved, so it carries no structure at all: save it
      // first, or the server correctly answers "no questionnaire to fill".
      await saveNow(sections, provenance, completion).catch(() => undefined);
      const res = await API_CONFIG.post(`/api/v1/idea/autofill/${draftId}`, { text: source });
      const filled: Record<string, string> = res?.data?.data?.answers ?? {};
      const filledCount = Object.keys(filled).length;
      if (!filledCount) {
        toast.error(
          res?.data?.data?.source === "unavailable"
            ? "The drafting assistant is unavailable right now — your text is safe, try again in a moment."
            : "Nothing in that text answered these questions. Try a fuller description.",
        );
        return;
      }
      setSections((prev) => {
        const next = prev.map((s) => ({
          ...s,
          questions: s.questions.map((q: any) =>
            // Never overwrite what the inventor already wrote.
            q.answer?.trim() || !filled[q.id] ? q : { ...q, answer: filled[q.id] },
          ),
        }));
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
      // Count of fields filled + the source kind — never the text or the answers.
      track("draft_autofill_used", {
        idea_id: ideaId,
        source: payload.file ? "document" : "paste",
        fields_filled: filledCount,
      });
      // Say what it did NOT do, in the same breath as what it did: novelty is
      // the one section the assistant will not write (draft-assist.ts).
      toast.success(
        `${filledCount} ${filledCount === 1 ? "section" : "sections"} pre-filled — review each one. Novelty is yours to write.`,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Could not pre-fill from that text",
      );
    } finally {
      setIsAutofilling(false);
      setPasteOpen(false);
      setPasteText("");
    }
  };

  /* ------------------------------ per-field AI ------------------------------ */

  const draftField = async (qid: string, _questionText: string) => {
    setDraftingField(qid);
    try {
      const res = await API_CONFIG.post(`/api/v1/idea/suggest-field/${draftId}`, {
        question_id: qid,
        // What is in the box right now — autosave may not have flushed yet.
        answer: answers?.[qid] ?? "",
      });
      const review = res?.data?.data;
      if (review?.message) setProposals((p) => ({ ...p, [qid]: review }));
      // Field id + the verdict ENUM only — never the answer text or the
      // suggestion message.
      track("draft_field_review_requested", {
        idea_id: ideaId,
        field: qid,
        verdict: review?.verdict,
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Couldn't review this answer",
      );
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
  const serverEvaluationStatus = scoreData?.data?.status as string | undefined;
  const runningEvaluationId =
    scoreData?.data?.report?.evaluationId ?? scoreData?.data?.report?.id ?? null;

  // The server, not component state, knows whether an evaluation is running —
  // scoringActive used to be set only by the button click, so closing the tab
  // mid-scan and reopening showed nothing while the agent kept working
  // (F-029's UX half). One poll answers RUNNING and this resumes the loop.
  useEffect(() => {
    if (serverEvaluationStatus === "RUNNING" && !scoringActive) setScoringActive(true);
  }, [serverEvaluationStatus, scoringActive]);
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
      // Enum band only — never the raw score number (a disclosure signal).
      track("evaluation_completed_viewed", {
        idea_id: ideaId,
        evaluation_id: runningEvaluationId ?? undefined,
        state: serverEvaluationStatus ?? "SUCCEEDED",
        novelty_band: noveltyBand(scoreRaw),
      });
    }
  }, [scored, scoringActive, draftId, scoreRaw, ideaId, runningEvaluationId, serverEvaluationStatus]);

  /* ---------------------------- preliminary signal ---------------------------- */

  // The rail follows what is WRITTEN, not how many boxes are non-empty. Keying
  // on the count meant editing a section never refreshed it, and — worse —
  // clearing every field left the previous read on screen, because the query
  // was disabled below two sections and react-query kept the last answer.
  // The key is a digest of the content, debounced so typing does not bill.
  const answersDigest = useMemo(() => {
    const body = sections
      .flatMap((s: any) => s.questions.map((q: any) => `${q.id}:${(q.answer ?? "").trim()}`))
      .join("|");
    // A cheap, stable 32-bit hash — this only has to change when the text does.
    let h = 0;
    for (let i = 0; i < body.length; i++) h = (Math.imul(31, h) + body.charCodeAt(i)) | 0;
    return `${body.length}:${h}`;
  }, [sections]);
  const [signalKey, setSignalKey] = useState(answersDigest);
  useEffect(() => {
    const t = setTimeout(() => setSignalKey(answersDigest), 1200);
    return () => clearTimeout(t);
  }, [answersDigest]);

  const { data: signalData } = useQuery({
    queryKey: ["preliminary_signal", draftId, signalKey],
    enabled: !!draftId,
    // The server caches identical content, so a re-ask after a round trip of
    // edits and undos costs nothing.
    staleTime: 15000,
    queryFn: async () =>
      (await API_CONFIG.get(`/api/v1/idea/preliminary-signal/${draftId}`))?.data,
  });
  const signal = signalData?.data;

  // The rail landed — record state/source enums only (both may be absent, in
  // which case sanitize drops them). Fires once per content digest.
  const railShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (signal && railShownRef.current !== signalKey) {
      railShownRef.current = signalKey;
      track("patentability_rail_shown", {
        idea_id: ideaId,
        state: signal?.state,
        source: signal?.source,
      });
    }
  }, [signal, signalKey, ideaId]);

  /* -------------------------------- attachments -------------------------------- */

  const { mutate: uploadAttachment } = useMutation({
    mutationFn: async (files: File[]) => {
      await API_CONFIG.post(`/api/v1/idea/upload-idea-file/${ideaId}`, {
        files: files.map((f) => ({ originalName: f.name, key: f.name })),
      });
    },
    onSuccess: (_data, files) => {
      // Metadata only: content-type + a coarse size band, never the filename or
      // the file contents.
      (files ?? []).forEach((f) =>
        track("file_uploaded", {
          idea_id: ideaId,
          content_type: f.type || "unknown",
          size_band: sizeBand(f.size),
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["workspace_idea", ideaId] });
    },
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
      track("evaluation_started", { idea_id: ideaId });
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
      track("idea_submitted", {
        idea_id: ideaId,
        kind: "submit",
        appeal_count: 0,
      });
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
    // "Send for review" was pressed. Fired here rather than on success, because
    // the gap between this and idea_submitted IS the submit stall — a person who
    // reaches this point and does not finish is the one worth knowing about.
    track("idea_submit_opened", { idea_id: ideaId });
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
    <div className={`pulse-product-page flex h-[calc(100dvh-4rem)] min-h-0 flex-col font-sans ${dark ? "bg-black" : "bg-[var(--pulse-canvas)]"}`}>
      {/* ---- Header ---- */}
      <div
        className={`border-b px-6 py-5 ${
          dark ? "border-[#cccccc20] bg-[#0a0a0a]" : "border-[#E8E8E8] bg-white"
        }`}
      >
        <div className="mx-auto w-full max-w-[1200px]">
          <div className={`text-sm ${muted}`}>
            Ideas <span className="mx-1.5">/</span>{" "}
            {/* The workspace reference (DEMO07), never the row id. A uuid
                cannot be read down a phone or matched to a paper file, and
                this is the first identity a new idea shows its author.
                `reference_number` is on the idea from the moment it is
                created — ideas.service writes it in the same insert. */}
            {idea?.reference_number || idea?.title || ""}
          </div>
          <h1 className={`mt-4 truncate text-2xl font-semibold tracking-[-0.025em] ${ink}`}>
            {idea?.title || "Working submission"}
          </h1>
          <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${muted}`}>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--pulse-line)] bg-white px-2.5 font-medium text-[#484E59]">
              <span className="h-[7px] w-[7px] bg-[#727272]" /> In draft
            </span>
            {savedAt && <span>· {savedLabel(savedAt)}</span>}
          </div>
        </div>
      </div>

      {idea && <StatusTimeline idea={idea} showStatusLine={false} showTimings={false} />}

      {/* ---- Body ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mx-auto w-full max-w-[1160px] px-6 py-8">
          {/* "Start from what you already have" — full width, in the row
              the "Keep building" banner used to occupy. It was capped at
              64% inside <main>, which is narrow for a card whose whole job
              is to be taken up before the questionnaire is touched. */}
        {slimBanner ? (
          <div
            className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${card}`}
          >
            <span className={`text-[13px] ${muted}`}>
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-[#F9B418]" />
              {autofillRan
                ? "Pre-filled from your material — review each section. Novelty is yours to write."
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
                  Read here in your browser: PDF, DOCX, TXT. For slides or
                  an old .doc, paste the text.
                </p>
              </div>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
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
              className={`ph-no-capture ${fieldCls}`}
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

          <div className="mt-6 flex flex-col items-start gap-6 lg:flex-row">
        {/* Left rail: progress + outline */}
        <aside className="hidden">
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
        <main className="w-full min-w-0 lg:w-[64%]">

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
                                className={`ph-no-capture ${fieldCls} ${meta.core ? "" : "pb-9"}`}
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
                                    ? "Reading..."
                                    : "Review this"}
                                </button>
                              )}
                            </div>
                            {proposals[q.id] && (() => {
                              const review = proposals[q.id];
                              // Three verdicts, three different things to show:
                              // a nudge with nothing to accept, a note plus a
                              // rewrite built from the inventor's own words, or
                              // a compliment that offers no edit at all.
                              const tone =
                                review.verdict === "good"
                                  ? { bg: "#1E7B4D", label: "Reads well" }
                                  : review.verdict === "unusable"
                                    ? { bg: "#B3261E", label: "Not there yet" }
                                    : review.verdict === "refused"
                                      ? { bg: "#7D7D7D", label: "Yours to write" }
                                      : review.verdict === "unavailable"
                                        ? { bg: "#7D7D7D", label: "Unavailable" }
                                        : { bg: "#4351C0", label: "One thing to add" };
                              const dismiss = () =>
                                setProposals((p) => {
                                  const n = { ...p };
                                  delete n[q.id];
                                  return n;
                                });
                              return (
                                <div
                                  className="ph-no-capture mt-2 rounded-xl px-3 py-2.5"
                                  style={{ backgroundColor: `${tone.bg}0F` }}
                                >
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" style={{ color: tone.bg }} />
                                    <span
                                      className="font-mono text-xs font-semibold uppercase tracking-[0.05em]"
                                      style={{ color: tone.bg }}
                                    >
                                      {tone.label}
                                    </span>
                                  </div>
                                  <p className={`text-[13px] leading-relaxed ${ink}`}>
                                    {review.message}
                                  </p>
                                  {review.example && (
                                    <div
                                      className={`mt-2 rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${
                                        dark
                                          ? "border-white/10 bg-white/[0.04] text-neutral-300"
                                          : "border-[#E8E8E8] bg-white text-[#444444]"
                                      }`}
                                    >
                                      {review.example}
                                    </div>
                                  )}
                                  <div className="mt-2 flex items-center gap-2">
                                    {review.example && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAnswer(q.id, review.example!, true);
                                          dismiss();
                                        }}
                                        className="rounded-xl bg-[#F9B418] px-3 py-1 text-xs font-semibold text-[#0C0C0C] hover:bg-[#DA9700]"
                                      >
                                        Replace my answer
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={dismiss}
                                      className={`px-2 py-1 text-xs font-medium ${muted} hover:underline`}
                                    >
                                      {review.example ? "Keep mine" : "Dismiss"}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
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
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-[36%]">
          <div className={`rounded-xl border p-5 ${card}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-medium uppercase tracking-[0.05em] ${muted}`}>
                  Submission readiness
                </div>
                <div className={`mt-1 text-sm font-semibold ${ink}`}>
                  {missingRequired.length === 0
                    ? "Ready for evaluation"
                    : `${missingRequired.length} required field${missingRequired.length === 1 ? "" : "s"} remaining`}
                </div>
              </div>
              <span className={`font-mono text-sm font-semibold ${ink}`}>{completion}%</span>
            </div>
            <div className={`mt-3 h-1.5 w-full rounded-full ${dark ? "bg-neutral-800" : "bg-neutral-200"}`}>
              <div
                className="h-1.5 rounded-full bg-[#F9B418] transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <nav className="mt-4 space-y-1">
              {outline.map((item) => {
                const done = sectionComplete(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--pulse-surface-subtle)] ${muted}`}
                  >
                    {item.id === "attachments" && !done ? (
                      <span className="w-4 shrink-0" />
                    ) : (
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                          done
                            ? "border-[#1E7B4D] bg-[#1E7B4D]"
                            : "border-[var(--pulse-line-strong)]"
                        }`}
                      >
                        {done && <Check className="h-3 w-3 text-white" />}
                      </span>
                    )}
                    <span className="flex-1">{item.title}</span>
                    {item.id === "attachments" && <span className="text-xs">optional</span>}
                  </button>
                );
              })}
            </nav>
          </div>

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
                  {score10?.toFixed(1)}
                  <span className={`ml-1 text-sm font-normal ${muted}`}>
                    /10
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
                {scoreMeta?.scoringResult?.summary && (
                  <p className={`mt-3 text-xs leading-relaxed ${muted}`}>
                    {scoreMeta.scoringResult.summary}
                  </p>
                )}
              </>
            ) : scoringActive ? (
              <div className="mt-2">
                <EvaluationProgress
                    compact
                    evaluationId={runningEvaluationId}
                    reference={idea?.reference_number}
                  />
              </div>
            ) : (
              <>
                {signal ? (
                  <>
                    {/* No grade before the search has run: the rail names the
                        FIELD it is reading and says something true about it.
                        Every number under here was either counted in this
                        workspace or comes from the fixed facts list — see
                        pulse-backend preliminary-signal.ts. */}
                    {signal.field && (
                      <div
                        className={`mt-2 font-mono text-[11px] uppercase tracking-[0.05em] ${muted}`}
                      >
                        {signal.field}
                      </div>
                    )}
                    <div className={`mt-1 text-[15px] font-semibold leading-snug ${ink}`}>
                      {signal.headline}
                    </div>
                    {signal.note && (
                      <p className={`mt-1.5 text-xs leading-relaxed ${muted}`}>
                        {signal.note}
                      </p>
                    )}
                    {(signal.facts ?? []).length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {(signal.facts as string[]).map((f, i) => (
                          <li
                            key={i}
                            className={`flex gap-2 text-[11px] leading-relaxed ${muted}`}
                          >
                            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[#F9B418]" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className={`mt-2 text-xs leading-relaxed ${muted}`}>
                    Write a couple of sections and this panel will read them
                    back to you.
                  </p>
                )}
                <p
                  className={`mt-3 border-t pt-2 text-xs ${muted} ${dark ? "border-[#cccccc20]" : "border-[#F5F5F5]"}`}
                >
                  The full score out of 10 is calculated when you finish.
                </p>
              </>
            )}
          </div>

          <div className={`rounded-xl border p-5 ${card}`}>
            <div className={`text-xs font-medium uppercase tracking-[0.05em] ${muted}`}>
              Contributors
            </div>
            <div className="mt-3">
              <CoInventorsField ideaId={ideaId} />
            </div>
          </div>
        </aside>
          </div>
        </div>
      </div>

      {/* ---- Footer CTA ---- */}
      <div
        className={`z-20 shrink-0 border-t px-6 py-3 ${
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
                  Strong signal. Send it for review.
                </span>
              ) : score10! >= 4 ? (
                <span className={muted}>
                  Send for review{" "}
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
                  : "Evaluate submission"}
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
                  {isSending ? "Sending..." : "Send for review"}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(weakestSectionId)}
                  className="rounded-xl bg-[#F9B418] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700]"
                >
                  Strengthen submission
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="rounded-xl bg-[#F9B418] px-5 py-2.5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send for review"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftWorkspace;
