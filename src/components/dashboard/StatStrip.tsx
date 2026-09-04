import React from "react";
import { Link } from "react-router-dom";

/**
 * The Workspace Admin dashboard's stat strip (DSN-0002).
 *
 * Five scoped numbers in one row, grouped under two overlines: what needs the
 * admin ("Your workspace") and how the program is doing ("Company portfolio").
 * Every box is one link to the list its number counts; nothing inside a box is
 * a second control. The top rule's colour is reinforced by the label, and the
 * accessible name carries the label, the number and the qualifier in words, so
 * colour and layout never carry meaning alone.
 *
 * Kept dashboard-local on purpose: when a second dashboard adopts the same
 * strip it graduates to `src/components/ui` with its own record.
 */

export type StatRule = "amber" | "red" | "navy" | "green" | "neutral";

export type StatBoxSpec = {
  key: string;
  /** The overline inside the box, e.g. "Awaiting review". */
  label: string;
  /** Null while the aggregate is not available; renders a dash, never a zero. */
  value: number | null;
  /** One line under the number, e.g. "oldest 56d" or "none due in 30 days". */
  qualifier: string;
  /** The same qualifier for the accessible name, spelt out: "oldest 56 days". */
  qualifierSpoken?: string;
  rule: StatRule;
  /** Where the box goes. The list it lands on must be the one the number counts. */
  to: string;
  /** The window or population the number describes, as the link's title. */
  title?: string;
};

export type StatGroupSpec = {
  key: string;
  /** Small-caps overline over the group, e.g. "Your workspace". */
  overline: string;
  boxes: StatBoxSpec[];
};

const NUMS: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
// Type from the token source (PL-TKN-004): metric label, metric value, caption, kicker.
const LABEL: React.CSSProperties = { font: "var(--pl-type-metric-label)", letterSpacing: "var(--pl-tracking-metric-label)" };
const VALUE: React.CSSProperties = { ...NUMS, font: "var(--pl-type-metric-value)", letterSpacing: "var(--pl-tracking-metric-value)" };
const QUALIFIER: React.CSSProperties = { ...NUMS, font: "var(--pl-type-caption)", letterSpacing: "var(--pl-tracking-caption)" };
const KICKER: React.CSSProperties = { font: "var(--pl-type-kicker)", letterSpacing: "var(--pl-tracking-kicker)" };

const RULE: Record<StatRule, string> = {
  amber: "var(--pl-amber)",
  red: "var(--pl-red)",
  navy: "var(--pl-navy-2)",
  green: "var(--pl-green)",
  neutral: "var(--pl-border-strong)",
};

const spoken = (b: StatBoxSpec) =>
  `${b.label}, ${b.value === null ? "not available" : b.value}, ${b.qualifierSpoken ?? b.qualifier}`;

// Entrance: a one-time rise of a few pixels (transform only, 240 ms, staggered),
// declared as `pulse-rise` in src/index.css and disabled there under
// prefers-reduced-motion. Opacity never animates, so text contrast is always
// the final contrast and nothing is faded when a reader or a checker arrives.
const StatBox = ({ box, index }: { box: StatBoxSpec; index: number }) => (
  <div className="min-w-0 flex-1 pulse-rise" style={{ animationDelay: `${index * 40}ms` }}>
    <Link
      to={box.to}
      title={box.title}
      aria-label={spoken(box)}
      className="group relative flex h-full min-h-[108px] flex-col overflow-hidden rounded-md border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-4 pb-4 pt-5 no-underline transition-colors hover:bg-[var(--pulse-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pulse-canvas)]"
    >
      <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-md" style={{ background: RULE[box.rule] }} aria-hidden="true" />
      <span className="truncate text-[var(--pulse-ink-muted)]" style={LABEL}>
        {box.label}
      </span>
      <span className="mt-2 block text-[var(--pulse-ink)]" style={VALUE}>
        {box.value === null ? <span aria-hidden="true">—</span> : box.value}
      </span>
      <span className="mt-1.5 block text-[var(--pulse-ink-secondary)]" style={QUALIFIER}>
        {box.qualifier}
      </span>
    </Link>
  </div>
);

export const StatStrip = ({ groups, ariaLabel = "Overview" }: { groups: StatGroupSpec[]; ariaLabel?: string }) => {
  let index = 0;
  return (
    // One row of five from 1280 CSS pixels; below that (200% zoom on a laptop)
    // each group takes its own row so nothing scrolls sideways.
    <section aria-label={ariaLabel} className="flex flex-col gap-4 xl:grid xl:grid-cols-5">
      {groups.map((g) => (
        <div
          key={g.key}
          role="group"
          aria-label={g.overline}
          className={`flex min-w-0 flex-col gap-2 ${g.boxes.length >= 3 ? "xl:col-span-3" : "xl:col-span-2"}`}
        >
          <span className="px-1 uppercase text-[var(--pulse-ink-muted)]" style={KICKER} aria-hidden="true">
            {g.overline}
          </span>
          <div className="flex min-w-0 gap-4">
            {g.boxes.map((b) => <StatBox key={b.key} box={b} index={index++} />)}
          </div>
        </div>
      ))}
    </section>
  );
};

export default StatStrip;
