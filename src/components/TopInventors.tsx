import React from "react";
import useUserCookie from "@/hooks/use-auth";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import { useNavigate } from "react-router-dom";
import {
  PRODUCT_CARD_CLASS,
  PRODUCT_CARD_DESCRIPTION_CLASS,
  PRODUCT_CARD_TITLE_CLASS,
  PRODUCT_SEGMENTED_CONTROL_CLASS,
  PRODUCT_SEGMENTED_ITEM_CLASS,
} from "@/components/ui/product-surfaces";

type QuietInventor = { id: string; name: string };

export type InventorEntry = {
  id?: string;
  name: string;
  /** Ideas submitted across all available history. */
  ideas: number;
  /** Patents filed attributed to this inventor. */
  patents: number;
};

type Metric = "ideas" | "patents";

type TopInventorsProps = {
  /** Legacy single-metric rows (OC "Top Clients" view). */
  inventors?: any[];
  /** Label under the title. */
  subtitle?: string;
  /** Dual-metric rows; when set, the Ideas | Patents toggle is shown. */
  entries?: InventorEntry[];
  onOpenInventor?: (entry: InventorEntry) => void;
  /** Inventors/teams with zero submissions across all history (up to 3 shown). */
  notYetActive?: QuietInventor[];
  onNudge?: (inventor: QuietInventor) => void;
  /**
   * DSN-0002, the Workspace Admin dashboard: rows per period with a period
   * selector that defaults to this quarter (matching the stat strip), the
   * Ideas | Patents toggle stated by weight, underline and aria-pressed, and
   * an empty state that points at Workspace › People.
   */
  v0?: {
    periods: { thisQuarter: InventorEntry[]; allTime: InventorEntry[] };
    empty: { text: string; linkLabel: string; onLink: () => void };
    /** The ranking has not arrived, or failed: never the empty copy. */
    loading?: boolean;
    error?: { onRetry: () => void };
  };
};

type Period = "thisQuarter" | "allTime";
const PERIOD_LABEL: Record<Period, string> = { thisQuarter: "This quarter", allTime: "All time" };

const NUMS: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

const SUBTITLES: Record<Metric, string> = {
  ideas: "Ideas · All time",
  patents: "Patents · All time",
};

const metricKey = (userId?: string) => `topInventorsMetric:${userId ?? "anon"}`;

const TopInventors = ({
  inventors,
  subtitle,
  entries,
  onOpenInventor,
  notYetActive = [],
  onNudge,
  v0,
}: TopInventorsProps) => {
  const { user } = useUserCookie();
  const navigate = useNavigate();
  const isOC = isOutsideCounselRole(user?.role);
  const [period, setPeriod] = React.useState<Period>("thisQuarter");
  const rows = v0 ? v0.periods[period] : entries;
  const hasToggle = !!rows && !isOC;

  const [metric, setMetric] = React.useState<Metric>(() => {
    try {
      const saved = localStorage.getItem(metricKey(user?.id));
      return saved === "patents" ? "patents" : "ideas";
    } catch {
      return "ideas";
    }
  });
  // The user cookie hydrates after first render; re-read the saved choice
  // once the real user id is known.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(metricKey(user?.id));
      if (saved === "patents" || saved === "ideas") setMetric(saved);
    } catch {
      /* ignore */
    }
  }, [user?.id]);
  const pickMetric = (m: Metric) => {
    setMetric(m);
    try {
      localStorage.setItem(metricKey(user?.id), m);
    } catch {
      /* storage unavailable — selection just won't persist */
    }
  };

  const ranked = React.useMemo(() => {
    if (!rows) return [];
    return rows
      .filter((e) => e[metric] > 0)
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 5);
  }, [rows, metric]);

  return (
    <div className={`${PRODUCT_CARD_CLASS} flex h-full min-h-[320px] flex-col`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          {v0 ? (
            <h2 className={PRODUCT_CARD_TITLE_CLASS}>Top inventors</h2>
          ) : (
            <div className={PRODUCT_CARD_TITLE_CLASS}>
              {isOC ? "Top Clients" : "Top Inventors"}
            </div>
          )}
          <div className={PRODUCT_CARD_DESCRIPTION_CLASS}>
            {v0
              ? `${metric === "ideas" ? "Ideas submitted" : "Patents filed"} · ${PERIOD_LABEL[period]}`
              : hasToggle
                ? SUBTITLES[metric]
                : subtitle ?? (isOC ? "By patent count" : "By ideas · All time")}
          </div>
        </div>
        {hasToggle && (
          <div className={PRODUCT_SEGMENTED_CONTROL_CLASS}>
            {(["ideas", "patents"] as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => pickMetric(m)}
                className={`${PRODUCT_SEGMENTED_ITEM_CLASS} capitalize ${
                  metric === m
                    ? "bg-white font-semibold text-[var(--pulse-ink)] underline decoration-[var(--pulse-brand)] decoration-2 underline-offset-4 shadow-sm"
                    : "text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        {isOC && (
          <button
            className="text-xs font-medium text-[#333F99] hover:underline"
            onClick={() => navigate("/clients")}
          >
            View all →
          </button>
        )}
      </div>

      {v0 && (
        <label className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--pulse-line)] pt-3 text-xs text-[var(--pulse-ink-muted)]">
          <span>Period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="h-8 rounded-sm border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-2 text-xs font-medium text-[var(--pulse-ink-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-focus)]"
          >
            <option value="thisQuarter">This quarter</option>
            <option value="allTime">All time</option>
          </select>
        </label>
      )}

      {/* No inner scroll: the card is a leaderboard, and a five-row list that
          scrolls inside a fixed card is a list you cannot see. Both branches
          cap at five, and long names truncate rather than pushing the count
          off the card. */}
      <div className="mt-2 flex min-h-0 flex-col justify-start overflow-hidden">
        {hasToggle ? (
          <>
            {!(v0?.loading || v0?.error) && ranked.map((e, index) => (
              <button
                key={e.id ?? e.name}
                type="button"
                onClick={() => onOpenInventor?.(e)}
                aria-label={`${index + 1}. ${e.name}, ${e[metric]} ${metric}`}
                className={`group flex min-h-14 w-full items-center justify-between gap-3 rounded-xs py-2 text-left transition-colors hover:bg-[var(--pulse-surface-subtle)] ${
                  index > 0 ? "border-t border-[var(--pulse-line)]" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--pulse-surface-subtle)] text-xs font-semibold text-[var(--pulse-ink-muted)]" style={NUMS} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-[var(--pulse-ink-secondary)] group-hover:text-[var(--pulse-ink)]" title={e.name}>
                      {e.name}
                    </div>
                  </div>
                </div>
                <span
                  className="pr-6 text-lg font-semibold text-[var(--pulse-ink)]"
                  style={NUMS}
                >
                  {e[metric]}
                </span>
              </button>
            ))}
            {v0?.loading && (
              <div className="mt-2 flex flex-col gap-3" role="status" aria-busy="true" aria-label="Loading top inventors">
                {[0, 1, 2].map((k) => <div key={k} className="h-9 animate-pulse rounded-xs bg-[var(--pulse-surface-subtle)]" />)}
              </div>
            )}
            {v0?.error && !v0.loading && (
              <div role="status" className="flex flex-col items-start gap-2 py-6 text-[13px] text-[var(--pulse-ink-muted)]">
                <span>Could not load top inventors.</span>
                <button type="button" onClick={v0.error.onRetry} className="rounded-sm border border-[var(--pulse-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--pulse-ink)] hover:bg-[var(--pulse-surface-subtle)]">Retry</button>
              </div>
            )}
            {ranked.length === 0 && v0 && !v0.loading && !v0.error && (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center text-[13px] text-[var(--pulse-ink-muted)]">
                <span>{v0.empty.text}</span>
                <button type="button" onClick={v0.empty.onLink} className="font-medium text-[var(--pulse-ink-secondary)] underline underline-offset-2 hover:text-[var(--pulse-ink)]">
                  {v0.empty.linkLabel}
                </button>
              </div>
            )}
            {ranked.length === 0 && !v0 && (
              <div className="py-6 text-center text-[13px] text-[var(--pulse-ink-muted)]">
                No {metric} yet.
              </div>
            )}
          </>
        ) : (
          <>
            {inventors?.slice(0, 5).map((inventor, index) => (
              <div
                key={inventor.id ?? index}
                className={`flex min-w-0 items-center justify-between gap-3 py-2.5 ${
                  index > 0 ? "border-t border-[var(--pulse-line)]" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--pulse-surface-subtle)] text-xs font-semibold text-[var(--pulse-ink-muted)]"
                    style={NUMS}
                  >
                    {index + 1}
                  </span>
                  <span
                    className="truncate text-[13px] font-medium text-[var(--pulse-ink-secondary)]"
                    title={inventor.name}
                  >
                    {inventor.name}
                  </span>
                </div>
                <span
                  className="shrink-0 text-lg font-semibold text-[var(--pulse-ink)]"
                  style={NUMS}
                >
                  {inventor.count}
                </span>
              </div>
            ))}
            {(!inventors || inventors.length === 0) && (
              <div className="py-6 text-center text-[13px] text-[var(--pulse-ink-muted)]">
                No submissions yet.
              </div>
            )}
          </>
        )}
      </div>

      {notYetActive.length > 0 && (
        <div className="mt-2 border-t border-[var(--pulse-line)] pt-3">
          <div className="text-xs font-medium text-[var(--pulse-ink-muted)]">
            Not yet active
          </div>
          {notYetActive.slice(0, 3).map((q) => (
            <div key={q.id} className="flex items-center justify-between py-1.5">
              <span className="text-[13px] text-[var(--pulse-ink-secondary)]">{q.name}</span>
              <button
                onClick={() => onNudge?.(q)}
                className="text-xs font-medium text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]"
              >
                Nudge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopInventors;
