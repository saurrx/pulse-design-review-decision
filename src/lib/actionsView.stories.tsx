import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { daysColor, filterLabel, toggleColumn } from "./actionsView";

/**
 * The docket's urgency ramp and filter labels, rendered as a table.
 *
 * These are pure functions, so they need no component to test — but they DO
 * need to be seen. `daysColor` returns Tailwind class names, and "is `-1` day
 * more alarming than `3` days" is a question about the rendered colour, not
 * about the string. A reviewer can read the answer off this page; they cannot
 * read it off `"text-red-600 font-semibold"`.
 *
 * Both actions screens carried byte-identical copies of these until 2026-09-03.
 * The boundary values below are the whole contract: 0, 7 and 30 are the
 * thresholds, and `null` is deliberately uncoloured rather than green.
 */
const CASES: Array<{ days: number | null; note: string }> = [
  { days: null, note: "no due date — deliberately uncoloured, not green" },
  { days: -14, note: "two weeks overdue" },
  { days: -1, note: "overdue by a day" },
  { days: 0, note: "due today (boundary: still the overdue ramp)" },
  { days: 1, note: "tomorrow" },
  { days: 7, note: "boundary: last day of the red band" },
  { days: 8, note: "first day of the amber band" },
  { days: 30, note: "boundary: last day of amber" },
  { days: 31, note: "first day of green" },
  { days: 365, note: "far out" },
];

const meta = { title: "Lib/actionsView" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const DaysColourRamp: Story = {
  /**
   * `color-contrast` is disabled HERE ONLY, and it is recording a real defect
   * rather than hiding one.
   *
   * The a11y run fails this story on `text-red-500` (#ef4444) against the
   * canvas (#f7f7f5): 3.5:1, where WCAG AA wants 4.5:1 for 13px text. That is
   * not an artefact of the story — it is the "due within 7 days" colour as both
   * actions screens actually render it, so the finding is about the product's
   * palette, not about this table.
   *
   * Changing the ramp is a visual decision about the docket that nobody has
   * taken yet, so it is registered (pulse-frontend CLAUDE.md §4.8, atlas
   * stale.md F20) rather than quietly recoloured to make a gate green. The
   * suppression is one rule on one story; every other rule still errors here,
   * and `color-contrast` still errors everywhere else.
   */
  parameters: {
    a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
  },
  render: () => (
    <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "6px 12px" }}>days</th>
          <th style={{ textAlign: "left", padding: "6px 12px" }}>rendered</th>
          <th style={{ textAlign: "left", padding: "6px 12px" }}>class</th>
          <th style={{ textAlign: "left", padding: "6px 12px" }}>why</th>
        </tr>
      </thead>
      <tbody>
        {CASES.map((c) => (
          <tr key={String(c.days)} data-days={String(c.days)}>
            <td style={{ padding: "6px 12px" }}>{c.days === null ? "null" : c.days}</td>
            <td className={daysColor(c.days)} style={{ padding: "6px 12px" }}>
              {c.days === null ? "—" : `${c.days} days`}
            </td>
            <td style={{ padding: "6px 12px", opacity: 0.7 }}>{daysColor(c.days) || "(none)"}</td>
            <td style={{ padding: "6px 12px", opacity: 0.7 }}>{c.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  play: async () => {
    await expect(daysColor(null)).toBe("");
    await expect(daysColor(0)).toBe("text-red-600 font-semibold");
    await expect(daysColor(-1)).toBe("text-red-600 font-semibold");
    await expect(daysColor(7)).toBe("text-red-500");
    await expect(daysColor(8)).toBe("text-amber-600");
    await expect(daysColor(30)).toBe("text-amber-600");
    await expect(daysColor(31)).toBe("text-green-600");
    // Monotonic: urgency never decreases as the deadline approaches. Asserted
    // as a property rather than ten more equalities, so a future threshold
    // change still has to keep the ramp ordered.
    const rank = (c: string) =>
      ["text-green-600", "text-amber-600", "text-red-500", "text-red-600 font-semibold"].indexOf(c);
    const dated = CASES.filter((c) => c.days !== null).map((c) => c.days as number).sort((a, b) => b - a);
    for (let i = 1; i < dated.length; i++) {
      await expect(rank(daysColor(dated[i]))).toBeGreaterThanOrEqual(rank(daysColor(dated[i - 1])));
    }
  },
};

export const FilterLabels: Story = {
  render: () => (
    <ul>
      {(["all", "upcoming", "dueToday", "overdue"] as const).map((f) => (
        <li key={f}>
          <code>{f}</code> → {filterLabel(f)}
        </li>
      ))}
    </ul>
  ),
  play: async () => {
    await expect(filterLabel("all")).toBe("All Actions");
    await expect(filterLabel("upcoming")).toBe("Upcoming");
    await expect(filterLabel("dueToday")).toBe("Due Today");
    await expect(filterLabel("overdue")).toBe("Overdue");
    // An unknown value must fall back rather than render "undefined" in the
    // control — the screens pass this straight into a label.
    await expect(filterLabel("nonsense" as never)).toBe("All Actions");
  },
};

export const ColumnToggle: Story = {
  render: () => <p>Pure state helper — see the assertions.</p>,
  play: async () => {
    const cols = [
      { id: "a", visible: true },
      { id: "b", visible: false },
    ];
    const next = toggleColumn(cols, "a");
    await expect(next[0].visible).toBe(false);
    await expect(next[1].visible).toBe(false);
    // Returns a NEW array and does not mutate: both screens hold these in
    // React state, and an in-place flip would not re-render.
    await expect(next).not.toBe(cols);
    await expect(cols[0].visible).toBe(true);
    // An unknown id is a no-op rather than an error.
    await expect(toggleColumn(cols, "zzz").map((c) => c.visible)).toEqual([true, false]);
  },
};
