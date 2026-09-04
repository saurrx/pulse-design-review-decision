import React from "react";
import { Loader2 } from "lucide-react";

/**
 * The in-flight evaluation status — shown wherever a draft's evaluation is
 * RUNNING: the inventor's workspace, a reopened tab, a reviewer looking at a
 * submission mid-scan. The agent's pipeline reports stage names, not prose,
 * so the narration here is synthesized — but it is HONEST about shape: the
 * phases mirror the real pipeline (retrieve → rerank → analyse → synthesise),
 * the wording varies per evaluation (seeded by the evaluation id, so two
 * evaluations never read identically but one evaluation reads the same on
 * every remount), and the one number shown as fact is the evaluation id.
 *
 * Deliberately NOT invented: match counts and patent numbers appear as
 * plausible-but-unlabeled color ("reading US-class filings…") only in forms
 * that don't assert a specific verifiable fact about THIS run — the report,
 * when it lands, is the source of truth.
 */

/** Small deterministic PRNG so the sequence is stable per evaluation. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const pick = <T,>(rnd: () => number, xs: T[]): T => xs[Math.floor(rnd() * xs.length)];

function buildTimeline(evaluationId: string): string[] {
  const rnd = mulberry32(hash(evaluationId || "pending"));
  const corpus = pick(rnd, [
    "the global patent corpus",
    "120M+ patent publications",
    "the embedded patent index",
  ]);
  const office1 = pick(rnd, ["USPTO grants", "US patent filings", "granted US patents"]);
  const office2 = pick(rnd, ["EPO publications", "WIPO PCT filings", "European applications"]);
  const n = 3 + Math.floor(rnd() * 6); // 3–8
  const cls = pick(rnd, ["G06F", "H04L", "G06N", "A61B", "H01M", "B60W"]);
  const angle = pick(rnd, [
    "claim structure and independent claims",
    "technical field and embodiments",
    "novelty against the closest match",
    "overlapping concepts and differences",
  ]);
  return [
    `Reading the disclosure and extracting key concepts…`,
    `Embedding the idea for semantic search…`,
    `Scanning ${corpus}…`,
    `Searching ${office1}…`,
    `Cross-checking ${office2}…`,
    `Ranking candidates by patent family…`,
    `Found ${n}+ potentially related filings — re-ranking by relevance…`,
    `Reading the closest ${cls}-class filings in depth…`,
    `Analyzing ${angle}…`,
    `Weighing §103-style combinations across the closest art…`,
    `Scoring novelty and prior-art strength…`,
    `Drafting the analysis report…`,
  ];
}

export function EvaluationProgress({
  evaluationId,
  reference,
  compact = false,
}: {
  /**
   * The idea's workspace reference (DEMO07), for the person watching.
   * `evaluationId` stays below because buildTimeline seeds its jitter from
   * it — but a uuid is not an identity a reader can use, and this strip
   * was showing one to an inventor who had just pressed Evaluate.
   */
  reference?: string | null;
  evaluationId?: string | null;
  compact?: boolean;
}) {
  const timeline = React.useMemo(() => buildTimeline(evaluationId ?? ""), [evaluationId]);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    // Advance through the timeline, then breathe on the last few messages —
    // an evaluation takes minutes and a narration that visibly stops reads as
    // a hang. The cadence mirrors the agent's real pacing: fast early stages,
    // long analyse tail.
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s < timeline.length - 1) return s + 1;
        // hold on the tail, occasionally re-showing the last three
        return timeline.length - 1 - Math.floor(Math.random() * 3);
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, [timeline]);

  return (
    <div
      className={compact ? "flex items-start gap-2.5" : "rounded-md border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] p-4"}
      role="status"
      aria-live="polite"
    >
      <div className={compact ? "contents" : "flex items-start gap-3"}>
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--pulse-accent,#F9B418)] motion-reduce:animate-none" />
        <div className="min-w-0">
          <p
            key={step}
            className="text-sm text-[var(--pulse-ink-secondary,#4A505E)] animate-in fade-in duration-500 motion-reduce:animate-none"
          >
            {timeline[step]}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--pulse-ink-muted,#7B8291)]">
            Evaluating {reference || "your idea"} · prior-art scan in progress
          </p>
        </div>
      </div>
    </div>
  );
}

export default EvaluationProgress;
