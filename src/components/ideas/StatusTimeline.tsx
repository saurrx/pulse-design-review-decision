import React from "react";
import moment from "moment";
import { Check } from "lucide-react";

/**
 * Horizontal status stepper for the idea detail page (vertical below md/768px).
 * Renders every lifecycle shape — happy path, needs-more-info, and
 * not-proceeding — from the same five stops; no separate terminal component.
 */

const STOPS = [
  { key: "submitted", label: "Submitted" },
  { key: "review", label: "Under review" },
  { key: "oc", label: "Sent to Photon Legal" },
  { key: "filed", label: "Filed" },
  { key: "granted", label: "Granted" },
] as const;

// Typical time spent in each stage, shown as a hint on the stop immediately
// after the current one. Config, not per-idea data.
const TYPICAL_DURATIONS: Record<string, string> = {
  review: "usually 5 to 10 days",
  oc: "usually 2 to 4 weeks",
  filed: "usually 1 to 3 months",
  granted: "usually 1 to 3 years",
};

type Variant = "normal" | "needs_more_info" | "not_proceeding";

type Derived = {
  currentIndex: number;
  variant: Variant;
  /** Elapsed-time label on the current node, e.g. "in review 3d". */
  elapsedLabel: string | null;
  /** Plain-language line under the stepper. */
  statusLine: string;
};

const fmt = (iso: string) => moment(iso).format("MMM D");

// Map raw idea statuses onto a stop index + variant. Only submission_date is a
// real timestamp today; per-transition timestamps come back null until the
// backend records them.
const derive = (idea: any): Derived & { dates: (string | null)[] } => {
  const status = (idea?.status || "").toUpperCase();
  const submitted = idea?.submission_date || null;
  // TODO(backend): no transition timestamps exist on ideas (reviewed_at,
  // sent_to_oc_at, filed_at, granted_at). Stubbed as null — completed stops
  // without a real date render dateless rather than inventing one.
  const dates: (string | null)[] = [submitted, null, null, null, null];

  const map: Record<string, { i: number; variant: Variant }> = {
    IN_DRAFT: { i: 0, variant: "normal" },
    UNDER_REVIEW: { i: 1, variant: "normal" },
    SENT_TO_IHC: { i: 1, variant: "normal" },
    UPDATE_REQUEST: { i: 1, variant: "needs_more_info" },
    SEND_TO_OC: { i: 2, variant: "normal" },
    UPDATE_REQUEST_BY_OC: { i: 2, variant: "needs_more_info" },
    FILED: { i: 3, variant: "normal" },
    GRANTED: { i: 4, variant: "normal" },
    REJECT_BY_IHC: { i: 1, variant: "not_proceeding" },
    REJECTED: { i: 1, variant: "not_proceeding" },
    REJECT_BY_OC: { i: 2, variant: "not_proceeding" },
  };
  const { i, variant } = map[status] ?? { i: 0, variant: "normal" as Variant };

  // Elapsed time in the current stage. The stage-entry timestamp is the only
  // honest anchor; while transition timestamps are stubbed, fall back to
  // submission_date (the last real event) and skip the label deeper in the
  // pipeline where that would overstate the wait.
  const anchor = dates[i] ?? (i <= 1 ? submitted : null);
  const stageWord = [
    "in draft",
    "in review",
    "with Photon Legal",
    "filed",
    "granted",
  ][i];
  const elapsedLabel =
    variant === "normal" && i < 4 && anchor
      ? `${stageWord} ${Math.max(0, moment().diff(moment(anchor), "days"))}d`
      : null;

  const since = anchor ? ` since ${fmt(anchor)}` : "";
  const lines: Record<string, string> = {
    IN_DRAFT: "Still a draft. Send it to the IP committee when it's ready.",
    UNDER_REVIEW: `With the IP committee${since}. You'll get an email when they decide.`,
    SENT_TO_IHC: `With the IP committee${since}. You'll get an email when they decide.`,
    UPDATE_REQUEST: "The IP committee needs more information before it can proceed.",
    SEND_TO_OC: `With Photon Legal${since}. You'll get an email when they respond.`,
    UPDATE_REQUEST_BY_OC: "Photon Legal needs more information before it can proceed.",
    FILED: "Filed with the patent office. Examination can take a while — we'll keep you posted.",
    GRANTED: "Granted. This idea is now a patent.",
    REJECT_BY_IHC: "The IP committee decided not to proceed with this idea.",
    REJECTED: "The IP committee decided not to proceed with this idea.",
    REJECT_BY_OC: "Photon Legal decided not to proceed with this idea.",
  };

  return {
    currentIndex: i,
    variant,
    elapsedLabel,
    statusLine: lines[status] ?? "",
    dates,
  };
};

const COLORS = {
  green: "#1E7B4D",
  yellow: "#F9B418",
  amber: "#E08700",
  grey: "#C8C8C8",
  text: "#444444",
  muted: "#727272",
};

const StatusTimeline = ({
  idea,
  /** Inline action on a needs_more_info current node (inventor: view request). */
  onAction,
  actionLabel = "View request",
  /** Admin review action attached to the current node (unused in inventor view). */
  currentNodeAction,
  showStatusLine = true,
}: {
  idea: any;
  onAction?: () => void;
  actionLabel?: string;
  currentNodeAction?: React.ReactNode;
  showStatusLine?: boolean;
}) => {
  const ideaStatus = (idea?.status || "").toUpperCase();
  const { currentIndex, variant, elapsedLabel, statusLine, dates } =
    derive(idea);
  const granted = currentIndex === 4;

  const nodeFor = (i: number) => {
    const done = i < currentIndex || granted;
    const current = i === currentIndex && !granted;
    const dead = variant === "not_proceeding" && i > currentIndex;

    let fill = "transparent";
    let border = COLORS.grey;
    if (done) fill = border = COLORS.green;
    if (current) {
      fill = border =
        variant === "needs_more_info"
          ? COLORS.amber
          : variant === "not_proceeding"
            ? COLORS.muted
            : COLORS.yellow;
    }
    return { done, current, dead, fill, border };
  };

  return (
    <div className="border-b border-[#E8E8E8] bg-white px-6 py-5 font-sans dark:border-[#cccccc20] dark:bg-[#0c0c0c]/80">
      <div className="mx-auto w-full max-w-[1200px]">
        <ol className="flex flex-col md:flex-row">
          {STOPS.map((stop, i) => {
          const { done, current, dead, fill, border } = nodeFor(i);
          const stopLabel =
            i === 0 && ideaStatus === "IN_DRAFT" ? "Draft" : stop.label;
          const last = i === STOPS.length - 1;
          // Connector segment AFTER node i (to node i+1): solid green when
          // node i+1 is reached, dashed grey ahead of it, gone past a
          // not_proceeding stop (transparent spacer keeps columns even).
          const segReached = i + 1 <= currentIndex || granted;
          const segDead = variant === "not_proceeding" && i >= currentIndex;
          const hint =
            variant === "normal" && !granted && i === currentIndex + 1
              ? TYPICAL_DURATIONS[stop.key]
              : null;

            return (
              <li
              key={stop.key}
              className={`flex gap-3 md:block md:gap-0 ${last ? "md:flex-none" : "md:flex-1"}`}
            >
              {/* node + connector share one row (md) / one column (mobile),
                  so the line is always centered on the dot */}
              <div className="flex flex-col items-center md:w-full md:flex-row">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${dead ? "opacity-40" : ""}`}
                  style={{
                    background: fill,
                    borderColor: border,
                    boxShadow: current ? `0 0 0 3px ${border}33` : undefined,
                  }}
                >
                  {done && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
                {!last && (
                  <span
                    aria-hidden
                    className="my-1 min-h-[16px] w-0 flex-1 border-l-2 md:mx-2 md:my-0 md:min-h-0 md:w-auto md:border-l-0 md:border-t-2"
                    style={{
                      borderColor: segDead
                        ? "transparent"
                        : segReached
                          ? COLORS.green
                          : COLORS.grey,
                      borderStyle: segReached ? "solid" : "dashed",
                    }}
                  />
                )}
              </div>
              <div
                className={`min-w-0 pb-5 md:mt-1.5 md:pb-0 md:pr-4 ${dead ? "opacity-40" : ""}`}
              >
                <div
                  className="text-xs font-medium leading-tight"
                  style={{ color: done || current ? COLORS.text : COLORS.muted }}
                >
                  {stopLabel}
                </div>
                {done && dates[i] && (
                  <div className="mt-0.5 font-mono text-xs text-[#727272]">
                    {fmt(dates[i]!)}
                  </div>
                )}
                {current && elapsedLabel && (
                  <div className="mt-0.5 text-xs text-[#727272]">
                    {elapsedLabel}
                  </div>
                )}
                {current && variant === "needs_more_info" && onAction && (
                  <button
                    onClick={onAction}
                    className="mt-1 text-xs font-semibold text-[#7E5A00] underline underline-offset-2 hover:text-[#0C0C0C]"
                  >
                    {actionLabel}
                  </button>
                )}
                {current && currentNodeAction}
                {hint && (
                  <div className="mt-0.5 text-xs italic text-[#A0A0A0]">
                    {hint}
                  </div>
                )}
              </div>
              </li>
            );
          })}
        </ol>
        {showStatusLine && statusLine && (
          <p className="mt-3 text-[13px] text-[#444444] dark:text-neutral-400">
            {statusLine}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatusTimeline;
