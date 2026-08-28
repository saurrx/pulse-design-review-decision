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
};

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
}: TopInventorsProps) => {
  const { user } = useUserCookie();
  const navigate = useNavigate();
  const isOC = isOutsideCounselRole(user?.role);
  const hasToggle = !!entries && !isOC;

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
    if (!entries) return [];
    return entries
      .filter((e) => e[metric] > 0)
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 5);
  }, [entries, metric]);

  return (
    <div className={`${PRODUCT_CARD_CLASS} flex h-full min-h-[320px] flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={PRODUCT_CARD_TITLE_CLASS}>
            {isOC ? "Top Clients" : "Top Inventors"}
          </div>
          <div className={PRODUCT_CARD_DESCRIPTION_CLASS}>
            {hasToggle
              ? SUBTITLES[metric]
              : subtitle ?? (isOC ? "By patent count" : "By ideas · All time")}
          </div>
        </div>
        {hasToggle && (
          <div className={PRODUCT_SEGMENTED_CONTROL_CLASS}>
            {(["ideas", "patents"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => pickMetric(m)}
                className={`${PRODUCT_SEGMENTED_ITEM_CLASS} capitalize ${
                  metric === m
                    ? "bg-white text-[var(--pulse-ink)] shadow-sm"
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

      <div className="mt-2 flex flex-col justify-start">
        {hasToggle ? (
          <>
            {ranked.map((e, index) => (
              <button
                key={e.id ?? e.name}
                onClick={() => onOpenInventor?.(e)}
                className={`group flex min-h-14 w-full items-center justify-between gap-3 rounded-lg py-2 text-left transition-colors hover:bg-[var(--pulse-surface-subtle)] ${
                  index > 0 ? "border-t border-[var(--pulse-line)]" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--pulse-surface-subtle)] text-xs font-semibold text-[var(--pulse-ink-muted)]" style={NUMS}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-[var(--pulse-ink-secondary)] group-hover:text-[var(--pulse-ink)]">
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
            {ranked.length === 0 && (
              <div className="py-6 text-center text-[13px] text-[var(--pulse-ink-muted)]">
                No {metric} yet.
              </div>
            )}
          </>
        ) : (
          <>
            {inventors?.map((inventor, index) => (
              <div
                key={index}
                className={`flex items-center justify-between gap-3 py-2.5 ${
                  index > 0 ? "border-t border-[var(--pulse-line)]" : ""
                }`}
              >
                <div className="text-[13px] font-medium text-[var(--pulse-ink-secondary)]">
                  {inventor.name}
                </div>
                <span
                  className="text-lg font-semibold text-[var(--pulse-ink)]"
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
