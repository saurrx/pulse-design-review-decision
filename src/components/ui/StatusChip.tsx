import React from "react";

/**
 * Compact semantic tag: neutral surface, visible marker, and accessible text.
 */

type Tone = "blue" | "green" | "amber" | "red" | "slate";

const TONES: Record<Tone, { mark: string; text: string }> = {
  blue: { mark: "#4351C0", text: "#333F99" },
  green: { mark: "#2F8D70", text: "#216B55" },
  amber: { mark: "#F9B418", text: "#7E5A00" },
  red: { mark: "#C96558", text: "#91483F" },
  slate: { mark: "#5E6470", text: "#484E59" },
};

// Semantic mapping per spec 3.1: green = terminal success only, blue =
// in-flight procedural, amber = action pending, red = blocking, slate = draft.
const STATUS_TONES: Record<string, Tone> = {
  IN_DRAFT: "slate",
  UNDER_REVIEW: "amber",
  UPDATE_REQUEST: "amber",
  UPDATE_REQUEST_BY_OC: "amber",
  SEND_TO_OC: "blue",
  FILED: "blue",
  REJECT_BY_IHC: "red",
  REJECT_BY_OC: "red",
  GRANTED: "green",
  PENDING: "amber",
  REJECTED: "red",
};

const StatusChip = ({
  status,
  label,
  tone,
}: {
  status?: string;
  label: string;
  tone?: Tone;
}) => {
  const t = TONES[tone ?? STATUS_TONES[status ?? ""] ?? "slate"];
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-xs border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-2.5 py-1.5"
    >
      <span
        className="h-[7px] w-[7px] shrink-0"
        style={{ background: t.mark }}
      />
      <span
        className="text-xs font-semibold leading-none tracking-[0.01em]"
        style={{ color: t.text }}
      >
        {label}
      </span>
    </span>
  );
};

export default StatusChip;
