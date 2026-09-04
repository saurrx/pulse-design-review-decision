/**
 * The filing-date filter's vocabulary, as data.
 *
 * Extracted 2026-09-03 from PatentsContent, where the type, the label map and
 * the range arithmetic sat beside 2,500 lines of screen. It is `moment`-free:
 * the only thing the presets need is "today minus N days" as YYYY-MM-DD, and
 * that does not justify a 300KB dependency on this path.
 *
 * Presets resolve to a rolling window ending TODAY; "custom" passes through
 * whatever the user typed, either bound may be empty; "all" is no constraint.
 */
export type DatePreset = "all" | "last30" | "last60" | "last90" | "custom";

export const DATE_PRESETS: readonly DatePreset[] = [
  "all", "last30", "last60", "last90", "custom",
] as const;

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  last30: "Last 30 days",
  last60: "Last 60 days",
  last90: "Last 90 days",
  custom: "Custom range",
};

const PRESET_DAYS: Partial<Record<DatePreset, number>> = {
  last30: 30, last60: 60, last90: 90,
};

/** Local-date YYYY-MM-DD, the shape the API and <input type="date"> agree on. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface DateRange { from?: string; to?: string }

/**
 * Turn a preset plus the custom inputs into concrete bounds for the API.
 * `now` is injectable so a test can pin "today".
 */
export function resolveDateRange(
  preset: DatePreset,
  from: string,
  to: string,
  now: Date = new Date(),
): DateRange {
  if (preset === "all") return {};
  if (preset === "custom") return { from: from || undefined, to: to || undefined };
  const days = PRESET_DAYS[preset] ?? 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { from: toIsoDate(start), to: toIsoDate(now) };
}

/** What the trigger button reads while a preset is applied. */
export function dateFilterLabel(preset: DatePreset, from: string, to: string): string {
  if (preset === "custom") return `${from || "…"} → ${to || "…"}`;
  return DATE_PRESET_LABELS[preset];
}

/** Anything other than "all" counts as a filter being applied. */
export const isDateFilterActive = (preset: DatePreset): boolean => preset !== "all";
