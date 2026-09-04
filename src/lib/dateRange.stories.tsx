import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { resolveDateRange, dateFilterLabel, toIsoDate, isDateFilterActive, DATE_PRESET_LABELS } from "./dateRange";

const meta = { title: "Lib/dateRange" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const Presets: Story = {
  render: () => <pre>{JSON.stringify(Object.fromEntries((["all","last30","last60","last90"] as const).map((p) => [p, resolveDateRange(p, "", "", new Date(2026, 8, 3))])), null, 1)}</pre>,
  play: async () => {
    const now = new Date(2026, 8, 3); // 3 Sep 2026, local
    await expect(resolveDateRange("all", "", "", now)).toEqual({});
    await expect(resolveDateRange("last30", "", "", now)).toEqual({ from: "2026-08-04", to: "2026-09-03" });
    await expect(resolveDateRange("last60", "", "", now)).toEqual({ from: "2026-07-05", to: "2026-09-03" });
    await expect(resolveDateRange("last90", "", "", now)).toEqual({ from: "2026-06-05", to: "2026-09-03" });
    // Custom passes through and an empty bound is UNDEFINED, not "".
    await expect(resolveDateRange("custom", "2026-01-01", "", now)).toEqual({ from: "2026-01-01", to: undefined });
    await expect(toIsoDate(new Date(2026, 0, 9))).toBe("2026-01-09");
  },
};

export const Labels: Story = {
  render: () => <ul>{Object.entries(DATE_PRESET_LABELS).map(([k, v]) => <li key={k}><code>{k}</code> → {v}</li>)}</ul>,
  play: async () => {
    await expect(dateFilterLabel("last30", "", "")).toBe("Last 30 days");
    await expect(dateFilterLabel("custom", "2026-01-01", "")).toBe("2026-01-01 → …");
    await expect(isDateFilterActive("all")).toBe(false);
    await expect(isDateFilterActive("custom")).toBe(true);
  },
};
