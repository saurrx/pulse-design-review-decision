import React from "react";
import { ArrowRight, ChevronDown, RotateCcw, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  PRODUCT_CARD_CLASS,
  PRODUCT_CARD_TITLE_CLASS,
} from "@/components/ui/product-surfaces";
import { ProductChip } from "@/components/ui/product-chip";

const CARD_CLASS = PRODUCT_CARD_CLASS;
const NUMS: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
const CHART_NAVY = "#11103C";
const CHART_TEAL = "#2F8D70";

/* ---------------------------------- shared bits --------------------------------- */

const StatLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={PRODUCT_CARD_TITLE_CLASS}>
    {children}
  </div>
);

/**
 * What a card shows when its data did not arrive.
 *
 * There was no such state. Every dashboard query swallowed its own error and
 * resolved with `undefined`, and the cards rendered the zeros that `?? 0`
 * produces — so a failed request and a firm with no patents looked identical.
 * Reproduced on demo by failing /v1/dashboard once: "0 Total patents, Granted
 * 0 · 0%" for a portfolio of 14,260. A number nobody can distrust is worse
 * than a gap.
 *
 * Deliberately small and in-card: the rest of the dashboard is still true, and
 * blanking the page over one failed panel trades one wrong impression for
 * another.
 */
const CardError = ({ onRetry, label = "Could not load this" }: {
  onRetry?: () => void;
  label?: string;
}) => (
  <div
    role="status"
    className="flex flex-1 flex-col items-start justify-center gap-2 py-6 text-[13px] text-[var(--pulse-ink-muted)]"
  >
    <span>{label}</span>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pulse-line)] px-2.5 py-1 text-[12px] font-semibold text-[var(--pulse-ink)] transition-colors hover:bg-[var(--pulse-surface-subtle)]"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Retry
      </button>
    )}
  </div>
);

/* -------------------------------- Portfolio motion ------------------------------- */

type MotionPoint = {
  day: string;
  ideas: number;
  filings: number;
  filing_levels?: number[];
  ideasThisWeek?: number;
};
type MotionClientOption = { id: string; name: string };

const CHART_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const chartDateLabel = (value: string, index: number, total: number) => {
  if (/^W\d+$/i.test(value)) {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const daysSinceMonday = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(
      weekStart.getDate() - daysSinceMonday - (total - index - 1) * 7,
    );
    return CHART_DATE_FORMATTER.format(weekStart);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : CHART_DATE_FORMATTER.format(parsed);
};

const FilingDots = ({ cx, cy, payload }: any) => {
  const count = Math.max(0, Number(payload?.filings) || 0);
  if (!count || cx == null || cy == null) return null;

  const spacing = 8;
  return (
    <g aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <circle
          key={index}
          cx={cx + (index - (count - 1) / 2) * spacing}
          cy={cy}
          r={4}
          fill={CHART_TEAL}
          stroke="#FFFFFF"
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
};

const IdeasAndFilingsTooltip = ({ active, label, payload }: any) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as MotionPoint | undefined;
  const ideas = point?.ideasThisWeek ?? 0;
  const filings = point?.filings ?? 0;

  return (
    <div className="rounded-md border border-[var(--pulse-line)] bg-white px-3 py-2 font-sans text-xs text-[var(--pulse-ink)] shadow-sm">
      Week of {label} · {ideas} idea{ideas === 1 ? "" : "s"} · {filings} filing{filings === 1 ? "" : "s"}
    </div>
  );
};

const PortfolioMotion = ({
  ideas30,
  filings90,
  series,
  ideasLabel = "Ideas received",
  clientOptions = [],
  selectedClientIds,
  onClientSelectionChange,
  hasError = false,
  onRetry,
}: {
  ideas30: number;
  filings90: number;
  /** The series did not arrive. A flat line at zero is not a trend. */
  hasError?: boolean;
  onRetry?: () => void;
  /** Role-aware: admins see "Ideas received", inventors "Ideas submitted". */
  ideasLabel?: string;
  series?: MotionPoint[];
  clientOptions?: MotionClientOption[];
  /** Null means every available client is selected. */
  selectedClientIds?: string[] | null;
  onClientSelectionChange?: (clientIds: string[] | null) => void;
}) => {
  // Cumulative view: at 5-15 ideas/month, per-week counts are all 0s and 1s.
  // Running totals show progress instead of noise.
  const data: MotionPoint[] = React.useMemo(() => {
    const weekly = series ?? [];
    let ideasSum = 0;
    return weekly.map((p, index) => {
      ideasSum += p.ideas;
      return {
        day: chartDateLabel(p.day, index, weekly.length),
        ideas: ideasSum,
        filings: Number(p.filings) || 0,
        filing_levels: p.filing_levels,
        ideasThisWeek: Number(p.ideas) || 0,
      };
    });
  }, [series]);

  const latestPoint = data[data.length - 1];
  const ideasPeriodTotal = latestPoint?.ideas ?? ideas30;
  const filingsPeriodTotal = data.length
    ? data.reduce((sum, point) => sum + point.filings, 0)
    : filings90;
  const yAxisStep = Math.max(1, Math.ceil(ideasPeriodTotal / 5));
  const yAxisMax = Math.max(yAxisStep, Math.ceil(ideasPeriodTotal / yAxisStep) * yAxisStep);
  const yAxisTicks = Array.from(
    { length: yAxisMax / yAxisStep + 1 },
    (_, index) => index * yAxisStep,
  );
  const xAxisInterval = Math.max(0, Math.ceil(data.length / 8) - 1);
  // Filings are event markers on the cumulative ideas series, not a separate
  // measure. Anchor each week's dots to the line so the relationship reads
  // correctly even when a filing is not linked to an in-window idea record.
  const filingMarkers = data
    .filter((point) => point.filings > 0)
    .map((point) => ({
      day: point.day,
      level: point.ideas,
      filings: point.filings,
    }));

  const allClientIds = clientOptions.map((client) => client.id);
  const isAllClients = selectedClientIds == null;
  const selectionLabel = isAllClients
    ? "All clients"
    : selectedClientIds.length === 1
      ? clientOptions.find((client) => client.id === selectedClientIds[0])
          ?.name || "1 client"
      : `${selectedClientIds.length} clients`;

  const toggleClient = (clientId: string, checked: boolean) => {
    if (!onClientSelectionChange) return;
    const current = isAllClients ? [...allClientIds] : [...selectedClientIds];
    const next = checked
      ? [...new Set([...current, clientId])]
      : current.filter((id) => id !== clientId);

    // Keep at least one client selected so the chart never falls into an
    // ambiguous empty state. Selecting every client collapses back to All.
    if (next.length === 0) return;
    onClientSelectionChange(
      next.length === allClientIds.length ? null : next,
    );
  };

  if (hasError) {
    return (
      <div className={`${CARD_CLASS} flex h-full min-h-[320px] flex-col`}>
        <div>
          <StatLabel>Ideas and filings</StatLabel>
          <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">Cumulative, last 3 months</p>
        </div>
        <CardError onRetry={onRetry} label="Could not load the trend." />
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASS} flex h-full min-h-[320px] flex-col`}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <StatLabel>Ideas and filings</StatLabel>
          <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">
            Cumulative, last 3 months
          </p>
        </div>
        {clientOptions.length > 1 && onClientSelectionChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 min-w-[150px] items-center justify-between gap-3 rounded-lg border border-[var(--pulse-line)] bg-white px-3 text-xs font-medium text-[var(--pulse-ink-secondary)] transition-colors hover:border-[var(--pulse-line-strong)] hover:text-[var(--pulse-ink)]"
                aria-label={`Filter chart by client: ${selectionLabel}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[var(--pulse-ink-muted)]" />
                  <span className="max-w-[150px] truncate">{selectionLabel}</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--pulse-ink-muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter clients</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={isAllClients}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => {
                  if (checked) onClientSelectionChange(null);
                }}
              >
                All clients
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {clientOptions.map((client) => (
                <DropdownMenuCheckboxItem
                  key={client.id}
                  checked={isAllClients || selectedClientIds.includes(client.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    toggleClient(client.id, checked === true)
                  }
                >
                  {client.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        className="mt-5 flex items-center gap-3 border-y border-[var(--pulse-line)] py-3 text-xs text-[var(--pulse-ink-secondary)]"
        aria-label={`Ideas ${ideasPeriodTotal}; filings ${filingsPeriodTotal}`}
      >
        <span className="h-0.5 w-6 rounded-full bg-[var(--pulse-data-primary)]" aria-hidden="true" />
        <span>Ideas <strong className="font-semibold text-[var(--pulse-ink)]" style={NUMS}>{ideasPeriodTotal}</strong></span>
        <span className="text-[var(--pulse-ink-muted)]" aria-hidden="true">·</span>
        <span className="h-2 w-2 rounded-full bg-[var(--pulse-data-success)]" aria-hidden="true" />
        <span>Filings <strong className="font-semibold text-[var(--pulse-ink)]" style={NUMS}>{filingsPeriodTotal}</strong></span>
      </div>

      <div
        className="mt-4"
        style={{ height: 190 }}
        role="img"
        aria-label={`${ideasLabel}: ${ideasPeriodTotal} cumulative over the last 3 months. ${filingsPeriodTotal} filings are marked as green dots.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#F5F5F5" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontFamily: "Instrument Sans", fontSize: 13, fill: "#73736b" }}
              axisLine={{ stroke: "#E8E8E8" }}
              tickLine={false}
              minTickGap={20}
              interval={xAxisInterval}
            />
            <YAxis
              tick={{ fontFamily: "Instrument Sans", fontSize: 13, fill: "#73736b" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, yAxisMax]}
              ticks={yAxisTicks}
            />
            <Tooltip content={<IdeasAndFilingsTooltip />} />
            <Line
              type="stepAfter"
              dataKey="ideas"
              name="Ideas (cumulative)"
              stroke={CHART_NAVY}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: "#FFFFFF", stroke: CHART_NAVY, strokeWidth: 2 }}
            />
            {filingMarkers.map((marker) => (
                <ReferenceDot
                  key={`${marker.day}-${marker.level}`}
                  x={marker.day}
                  y={marker.level}
                  ifOverflow="visible"
                  isFront
                  shape={(props: any) => (
                    <FilingDots
                      {...props}
                      payload={{ filings: marker.filings }}
                    />
                  )}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/* --------------------------------- Idea pipeline --------------------------------- */

const IdeaPipeline = ({
  submitted,
  reviewPending,
  sentToOC,
  filed,
  granted,
  title = "Idea pipeline",
  onStageClick,
  clientOptions = [],
  selectedClientIds,
  onClientSelectionChange,
  hasError = false,
  onRetry,
}: {
  submitted: number;
  reviewPending: number;
  sentToOC: number;
  filed: number;
  granted: number;
  /** The numbers did not arrive. Renders a stated failure, never zeros. */
  hasError?: boolean;
  onRetry?: () => void;
  /** "My pipeline" on the inventor dashboard; company-wide default elsewhere. */
  title?: string;
  /** When provided, each stage row links to the filtered list. */
  onStageClick?: (stageKey: string) => void;
  clientOptions?: MotionClientOption[];
  /** Null means every available client is selected. */
  selectedClientIds?: string[] | null;
  onClientSelectionChange?: (clientIds: string[] | null) => void;
}) => {
  const stages = [
    { key: "submitted", label: "Submitted", count: submitted, color: "var(--pulse-data-primary)" },
    { key: "review", label: "Review Pending", count: reviewPending, color: "var(--pl-amber)" },
    { key: "sent_to_oc", label: "Sent to Photon Legal", count: sentToOC, color: "var(--pulse-data-ai)" },
    { key: "filed", label: "Filed", count: filed, color: "var(--pulse-data-cyan)" },
    { key: "granted", label: "Granted", count: granted, color: "var(--pulse-data-success)" },
  ];
  const maxStageCount = Math.max(1, ...stages.map((stage) => stage.count));
  const allClientIds = clientOptions.map((client) => client.id);
  const isAllClients = selectedClientIds == null;
  const selectionLabel = isAllClients
    ? "All clients"
    : selectedClientIds.length === 1
      ? clientOptions.find((client) => client.id === selectedClientIds[0])
          ?.name || "1 client"
      : `${selectedClientIds.length} clients`;

  const toggleClient = (clientId: string, checked: boolean) => {
    if (!onClientSelectionChange) return;
    const current = isAllClients ? [...allClientIds] : [...selectedClientIds];
    const next = checked
      ? [...new Set([...current, clientId])]
      : current.filter((id) => id !== clientId);
    if (next.length === 0) return;
    onClientSelectionChange(
      next.length === allClientIds.length ? null : next,
    );
  };

  if (hasError) {
    return (
      <div className={`${CARD_CLASS} flex h-full min-h-[320px] flex-col`}>
        <div>
          <StatLabel>{title}</StatLabel>
          <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">Ideas by stage</p>
        </div>
        <CardError onRetry={onRetry} label="Could not load the pipeline." />
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASS} flex h-full min-h-[320px] flex-col`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatLabel>{title}</StatLabel>
          <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">Ideas by stage</p>
        </div>
        {clientOptions.length > 1 && onClientSelectionChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 min-w-[150px] items-center justify-between gap-3 rounded-lg border border-[var(--pulse-line)] bg-white px-3 text-xs font-medium text-[var(--pulse-ink-secondary)] transition-colors hover:border-[var(--pulse-line-strong)] hover:text-[var(--pulse-ink)]"
                aria-label={`Filter pipeline by client: ${selectionLabel}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[var(--pulse-ink-muted)]" />
                  <span className="max-w-[150px] truncate">{selectionLabel}</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--pulse-ink-muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter clients</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={isAllClients}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => {
                  if (checked) onClientSelectionChange(null);
                }}
              >
                All clients
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {clientOptions.map((client) => (
                <DropdownMenuCheckboxItem
                  key={client.id}
                  checked={isAllClients || selectedClientIds.includes(client.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) =>
                    toggleClient(client.id, checked === true)
                  }
                >
                  {client.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="mt-5 flex flex-1 flex-col justify-between">
        {stages.map((s, i) => {
          const inner = (
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--pulse-ink-secondary)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="text-base font-semibold text-[var(--pulse-ink)]" style={NUMS}>{s.count}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--pulse-surface-subtle)]">
                <span
                  className="block h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(6, (s.count / maxStageCount) * 100)}%`,
                    background: s.color,
                  }}
                />
              </span>
            </span>
          );
          const rowCls = `flex w-full items-center gap-3 py-2 ${
            i > 0 ? "border-t border-[var(--pulse-line)]" : ""
          }`;
          return onStageClick ? (
            <button
              key={s.key}
              type="button"
              onClick={() => onStageClick(s.key)}
              className={`${rowCls} rounded-md text-left transition-colors hover:bg-[var(--pulse-surface-subtle)]`}
            >
              {inner}
            </button>
          ) : (
            <div key={s.key} className={rowCls}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* -------------------------------- Needs your review ------------------------------ */

const QueueScoreChip = ({ score }: { score: number | null | undefined }) => {
  const value = score != null ? (score / 10).toFixed(1) : null;
  return (
    <span
      className="inline-flex shrink-0 items-baseline justify-end whitespace-nowrap text-right text-[13px] font-semibold text-[var(--pulse-ink)]"
      style={NUMS}
    >
      {value ?? "—"}
      <span className="ml-0.5 text-xs font-normal text-[var(--pulse-ink-muted)]">/10</span>
    </span>
  );
};

export type ReviewQueueRow = {
  id: string;
  title: string;
  secondary?: string;
  score?: number | null;
  waitingDays: number;
};

const NeedsReview = ({
  rows,
  laterCount,
  onOpen,
  onReviewAll,
  onViewAll,
  title = "Needs your review",
  actionLabel = "Review all",
  showScore = true,
  waitingLabel = "waiting",
  hasError = false,
  onRetry,
}: {
  /** Ideas waiting on the viewer, oldest first. */
  rows: ReviewQueueRow[];
  /**
   * The queue did not load. An empty list and a failed request both used to
   * render "This queue is clear" — the most reassuring possible way to be
   * wrong about a reviewer's workload.
   */
  hasError?: boolean;
  onRetry?: () => void;
  /** Ideas already past review, for the caught-up empty state. */
  laterCount: number;
  onOpen: (id: string) => void;
  /** Header CTA. Omitted where the role has no "review all" surface. */
  onReviewAll?: () => void;
  /** Where the overflow row goes. Falls back to onReviewAll. */
  onViewAll?: () => void;
  title?: string;
  actionLabel?: string;
  showScore?: boolean;
  waitingLabel?: string;
}) => {
  const oldestWait = Math.max(0, ...rows.map((row) => row.waitingDays));
  // The card sits in a fixed-height dashboard row beside the pipeline. Rendering
  // every queued idea stretched it — 124 rows tall on a real workspace — which
  // dragged the whole grid row with it and distorted the pipeline next to it.
  // Show a card's worth and let the overflow row carry the rest.
  const VISIBLE_ROWS = 5;
  const visibleRows = rows.slice(0, VISIBLE_ROWS);
  const hiddenCount = rows.length - visibleRows.length;
  const rowColumns = showScore
    ? "grid-cols-[minmax(0,1fr)_120px_64px_94px]"
    : "grid-cols-[minmax(0,1fr)_120px_94px]";

  return (
  <div className={`${CARD_CLASS} relative flex h-full min-h-[320px] flex-col overflow-hidden`}>
    <span
      className="absolute inset-x-0 top-0 h-[3px]"
      style={{
        background:
          "linear-gradient(90deg, var(--pulse-data-accent) 0 34%, var(--pulse-data-risk) 34% 52%, var(--pulse-data-ai) 52% 70%, var(--pulse-data-cyan) 70% 84%, var(--pulse-data-success) 84% 100%)",
      }}
      aria-hidden="true"
    />
    <div className="flex items-start justify-between gap-5 border-b border-[var(--pulse-line)] pb-4">
      <div>
        <StatLabel>{title === "Needs your review" ? "Review queue" : title}</StatLabel>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--pulse-ink-muted)]">
          {hasError ? <span>Not loaded</span> : (<>
            <span>{rows.length} awaiting decision</span>
            <span aria-hidden="true">·</span>
            <span>Oldest {oldestWait > 0 ? `${oldestWait}d` : "—"}</span>
          </>)}
        </p>
      </div>
      {onReviewAll && (
        <button
          type="button"
          onClick={onReviewAll}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[var(--pulse-brand)] px-3.5 text-xs font-semibold text-[var(--pulse-ink)] shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-colors hover:bg-[var(--pulse-brand-hover)]"
        >
          {actionLabel === "Review all" ? "Open queue" : actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
    {hasError ? (
      // Never "all caught up" for a request that failed.
      <CardError onRetry={onRetry} label="Could not load the review queue." />
    ) : rows.length === 0 ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
        <div className="text-base font-semibold text-[#0C0C0C]">
          You're all caught up ✓
        </div>
        <div className="text-xs text-[#727272]">
          {laterCount} idea{laterCount === 1 ? "" : "s"} in later stages
        </div>
      </div>
    ) : (
      <div className="mt-2 flex flex-1 flex-col">
        <div className={`grid ${rowColumns} gap-3 px-3 pb-1 pt-1 text-xs font-medium text-[var(--pulse-ink-muted)]`}>
          <span>Ideas</span>
          <span>Inventor</span>
          {showScore && <span className="text-right">Score</span>}
          <span className="text-right">Age</span>
        </div>
        {visibleRows.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r.id)}
            className={`grid min-h-11 ${rowColumns} w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--pulse-surface-subtle)] ${i > 0 ? "border-t border-[var(--pulse-line)]" : ""}`}
          >
            <span
              className="min-w-0 truncate text-[13px] font-medium text-[var(--pulse-ink)]"
              title={r.title}
            >
              {r.title}
            </span>
            <span className="truncate text-xs text-[var(--pulse-ink-secondary)]">
              {r.secondary}
            </span>
            {showScore && <QueueScoreChip score={r.score} />}
            <span className="inline-flex items-center justify-end whitespace-nowrap text-right text-xs text-[var(--pulse-ink-muted)]" style={NUMS}>
              {waitingLabel} {r.waitingDays}d
            </span>
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={onViewAll ?? onReviewAll ?? (() => onOpen(rows[0].id))}
            className="mt-auto flex w-full items-center justify-between gap-3 rounded-lg border-t border-[var(--pulse-line)] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--pulse-ink-secondary)] transition-colors hover:bg-[var(--pulse-surface-subtle)]"
          >
            <span style={NUMS}>{hiddenCount}+ pending {hiddenCount === 1 ? "action" : "actions"}</span>
            <span className="text-xs text-[var(--pulse-ink-muted)]">{actionLabel} →</span>
          </button>
        )}
      </div>
    )}
  </div>
  );
};

/* ----------------------------------- My Ideas ----------------------------------- */

// Chip pairs match the Patents table chip system: tinted wash (marker @ 8%),
// square marker, mono caps. Amber = action pending, blue = in-flight,
// green = terminal success, red = blocked, grey = draft.
const IDEA_CHIPS: Record<string, { label: string; marker: string; text: string }> = {
  IN_DRAFT: { label: "In Draft", marker: "#727272", text: "#444444" },
  SENT_TO_IHC: { label: "Submitted", marker: "#11103C", text: "#11103C" },
  UNDER_REVIEW: { label: "Review Pending", marker: "#F9B418", text: "#7E5A00" },
  UPDATE_REQUEST: { label: "Update Requested", marker: "#F9B418", text: "#7E5A00" },
  UPDATE_REQUEST_BY_OC: { label: "Update Requested", marker: "#F9B418", text: "#7E5A00" },
  SEND_TO_OC: { label: "Sent to Photon Legal", marker: "#7057C7", text: "#5943A8" },
  FILED: { label: "Filed", marker: "#25A9B8", text: "#14717C" },
  GRANTED: { label: "Granted", marker: "#2F8D70", text: "#226D57" },
  REJECT_BY_IHC: { label: "Rejected", marker: "#C96558", text: "#98443A" },
  REJECT_BY_OC: { label: "Rejected", marker: "#C96558", text: "#98443A" },
};

const IdeaStatusChip = ({ status }: { status?: string }) => {
  const meta =
    IDEA_CHIPS[status?.toUpperCase() ?? ""] ??
    ({ label: status || "—", marker: "#727272", text: "#444444" } as const);
  return (
    <ProductChip
      kind="status"
      marker
      markerColor={meta.marker}
      textColor={meta.text}
    >
      {meta.label}
    </ProductChip>
  );
};

const daysAgo = (date?: string) => {
  if (!date) return null;
  const d = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 86400000),
  );
  return d;
};

type MyIdea = {
  id: string;
  title: string;
  status?: string;
  score?: number | null;
  submission_date?: string;
  IdeaPatentLink?: { patent?: { id?: string; application_number?: string } }[];
};

const SubmitIdeaButton = ({
  onClick,
  children = "+ Submit Idea",
  large = false,
}: {
  onClick: () => void;
  children?: React.ReactNode;
  large?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 whitespace-nowrap rounded-[2px] bg-[#F9B418] font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] ${
      large ? "px-5 py-2.5 text-sm" : "px-3.5 py-1.5 text-[13px]"
    }`}
  >
    {children}
  </button>
);

const MyIdeas = ({
  ideas,
  onSubmit,
  onOpenIdea,
  onViewAll,
  onOpenPatent,
  onSendIdea,
}: {
  /** The current user's ideas, newest first. */
  ideas: MyIdea[];
  onSubmit: () => void;
  onOpenIdea: (id: string) => void;
  onViewAll: () => void;
  onOpenPatent: (patentId: string) => void;
  /** Sends a scored-but-unsent idea's draft into review. */
  onSendIdea?: (id: string) => void;
}) => {
  const recent = ideas.slice(0, 5);
  const newestDays = daysAgo(ideas[0]?.submission_date);
  const isStale = newestDays !== null && newestDays > 30;

  return (
    <div className={`${CARD_CLASS} flex h-full min-h-[280px] flex-col`}>
      <div className="flex items-center justify-between gap-3">
        <StatLabel>My ideas</StatLabel>
        <SubmitIdeaButton onClick={onSubmit} />
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#727272"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          <div className="text-sm font-semibold text-[#0C0C0C]">
            You haven't submitted an idea yet
          </div>
          <div className="max-w-[300px] text-xs leading-[18px] text-[#727272]">
            It takes 2 minutes — a title and short description is enough to
            start.
          </div>
          <div className="mt-2">
            <SubmitIdeaButton onClick={onSubmit} large>
              Submit your first idea
            </SubmitIdeaButton>
          </div>
        </div>
      ) : (
        <>
          {isStale && (
            <div className="mt-3 rounded-[2px] bg-[#F9B418]/10 px-3 py-2 text-xs text-[#7E5A00]">
              It's been a while since your last idea — got something brewing?
            </div>
          )}
          <div className="mt-2 flex flex-1 flex-col justify-start">
            {recent.map((idea, i) => {
              const linkedPatent = idea.IdeaPatentLink?.[0]?.patent;
              const d = daysAgo(idea.submission_date);
              // Recovery state: scored but never sent to the committee.
              const scoredUnsent =
                idea.status?.toUpperCase() === "IN_DRAFT" &&
                typeof idea.score === "number";
              return (
                <div
                  key={idea.id}
                  className={`flex items-center gap-3 py-2 ${
                    i > 0 ? "border-t border-[#F5F5F5]" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenIdea(idea.id)}
                    className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[#0C0C0C] hover:underline"
                    title={idea.title}
                  >
                    {idea.title}
                  </button>
                  {linkedPatent?.application_number && (
                    <button
                      type="button"
                      onClick={() => onOpenPatent(linkedPatent.id!)}
                      className="shrink-0 whitespace-nowrap font-mono text-xs text-[#4351C0] hover:underline"
                      title="Open linked patent"
                    >
                      → {linkedPatent.application_number}
                    </button>
                  )}
                  {scoredUnsent ? (
                    <>
                      <span className="shrink-0 whitespace-nowrap text-xs text-[#727272]">
                        Scored {((idea.score as number) / 10).toFixed(1)}/10 —
                        not yet sent
                      </span>
                      {onSendIdea && (
                        <button
                          type="button"
                          onClick={() => onSendIdea(idea.id)}
                          className="shrink-0 rounded-[2px] bg-[#F9B418] px-2.5 py-1 text-xs font-semibold text-[#0C0C0C] hover:bg-[#DA9700]"
                        >
                          Send
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <IdeaStatusChip status={idea.status} />
                      <span className="w-[112px] shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-[#727272]">
                        {d === null ? "" : d === 0 ? "updated today" : `updated ${d}d ago`}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="mt-3 self-start text-xs font-medium text-[#444444] hover:text-[#0C0C0C] hover:underline"
          >
            View all my ideas →
          </button>
        </>
      )}
    </div>
  );
};

/* ----------------------------- Portfolio composition ----------------------------- */

export type PortfolioStatus = {
  label: string;
  count: number;
  color?: string;
};

const PORTFOLIO_STATUS_COLORS = [
  "#2F8D70",
  "var(--pl-amber)",
  "var(--pl-slate)",
  "#7057C7",
  "#25A9B8",
  "#C96558",
];

const PortfolioComposition = ({
  total,
  granted,
  pending,
  inactive,
  statuses,
  hasError = false,
  onRetry,
}: {
  total: number;
  granted: number;
  pending: number;
  inactive: number;
  /** The numbers did not arrive. Renders a stated failure, never zeros. */
  hasError?: boolean;
  onRetry?: () => void;
  /** Optional client-specific legal statuses. The compact layout supports 3–6 cleanly. */
  statuses?: PortfolioStatus[];
}) => {
  const statusSource = statuses?.length
    ? statuses
    : [
        { label: "Granted", count: granted },
        { label: "Pending", count: pending },
        { label: "Inactive", count: inactive },
      ];
  const segments = statusSource.map((status, index) => ({
    ...status,
    color: status.color ?? PORTFOLIO_STATUS_COLORS[index % PORTFOLIO_STATUS_COLORS.length],
  }));
  const hasData = total > 0;
  const pieData = hasData
    ? segments.filter((s) => s.count > 0)
    : [{ label: "Empty", count: 1, color: "#F5F5F5" }];
  const useCompactLegend = segments.length > 3;

  if (hasError) {
    return (
      <div className={`${CARD_CLASS} flex h-full min-h-0 flex-col`}>
        <div>
          <StatLabel>Patent portfolio</StatLabel>
          <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">By legal status</p>
        </div>
        <CardError onRetry={onRetry} label="Could not load the portfolio." />
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASS} flex h-full min-h-0 flex-col`}>
      <div>
        <StatLabel>Patent portfolio</StatLabel>
        <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">By legal status</p>
      </div>
      <div className="relative mx-auto mt-1" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={75}
              startAngle={90}
              endAngle={-270}
              stroke="#FFFFFF"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {pieData.map((seg) => (
                <Cell key={seg.label} fill={seg.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="text-[32px] font-semibold leading-none text-[#0C0C0C]"
            style={NUMS}
          >
            {total.toLocaleString()}
          </div>
          <div className="mt-1 text-[13px] font-medium text-[#727272]">
            Total patents
          </div>
        </div>
      </div>
      <div className={`mt-2 grid ${useCompactLegend ? "grid-cols-2 gap-x-5" : "grid-cols-1"}`}>
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`flex min-w-0 items-center justify-between gap-3 py-2 ${
              useCompactLegend
                ? i > 1 ? "border-t border-[#E8E8E8]" : ""
                : i > 0 ? "border-t border-[#E8E8E8]" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-[#0C0C0C]">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="truncate" title={seg.label}>{seg.label}</span>
            </span>
            <span className="shrink-0 text-right text-[13px] font-semibold text-[#0C0C0C]" style={NUMS}>
              {seg.count.toLocaleString()}
              <span className="ml-1 font-normal text-[#727272]">
                · {total > 0 ? Math.round((seg.count / total) * 100) : 0}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export {
  PortfolioMotion,
  IdeaPipeline,
  PortfolioComposition,
  MyIdeas,
  NeedsReview,
};
