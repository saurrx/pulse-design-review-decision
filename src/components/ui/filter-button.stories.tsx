import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Building2, CalendarDays, Filter, ArrowUpDown, Columns3 } from "lucide-react";
import { FilterButton } from "./filter-button";

/**
 * The one toolbar trigger that replaced eighteen inline copies in eight drift
 * variants. The stories pin what those copies had silently disagreed about:
 * height, the chevron, the active dot, and that an icon inherits colour rather
 * than carrying its own theme ternary.
 */
const meta = {
  title: "UI/FilterButton",
  component: FilterButton,
  args: { children: "Date", icon: <CalendarDays /> },
} satisfies Meta<typeof FilterButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole("button", { name: /Date/ });
    // Toolbar height is the contract every screen's filter row relies on.
    await expect(Math.round(btn.getBoundingClientRect().height)).toBe(42);
    await expect(btn.querySelectorAll("svg")).toHaveLength(2); // icon + chevron
    await expect(within(canvasElement).queryByTestId("filter-active-dot")).toBeNull();
  },
};

export const Active: Story = {
  args: { active: true, children: "Last 30 days" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("filter-active-dot")).toBeInTheDocument();
  },
};

export const NoChevron: Story = {
  args: { chevron: false, icon: <Columns3 />, children: "Columns" },
  play: async ({ canvasElement }) => {
    const btn = within(canvasElement).getByRole("button");
    await expect(btn.querySelectorAll("svg")).toHaveLength(1);
  },
};

/** Every trigger the list screens actually use, side by side — the row the
 *  eight drift variants used to render at slightly different heights. */
export const Toolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <FilterButton icon={<Filter />}>All Actions</FilterButton>
      <FilterButton icon={<Building2 />}>Clients</FilterButton>
      <FilterButton icon={<CalendarDays />} active>Last 30 days</FilterButton>
      <FilterButton icon={<ArrowUpDown />}>Sort</FilterButton>
      <FilterButton icon={<Columns3 />} chevron={false}>Columns</FilterButton>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const hs = Array.from(canvasElement.querySelectorAll("button")).map((b) => Math.round(b.getBoundingClientRect().height));
    await expect(new Set(hs).size).toBe(1);
  },
};
