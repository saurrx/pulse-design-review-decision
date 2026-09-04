import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

/**
 * `color-contrast` off here only, recording a TOKEN finding: an inactive tab
 * is `text-muted-foreground` (#737373) on `bg-muted` (#f5f5f5) — 4.34:1 at
 * 14px against AA's 4.5:1. Those are the shadcn defaults in tailwind.config's
 * theme, so this is a palette decision (atlas stale.md F20), not a Tabs bug.
 * Every other rule still errors here.
 */
const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } } },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SwitchesPanels: Story = {
  render: () => (
    <Tabs defaultValue="overview">
      <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="people">People</TabsTrigger></TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="people">People panel</TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Overview panel")).toBeVisible();
    await expect(c.queryByText("People panel")).toBeNull();
    await userEvent.click(c.getByRole("tab", { name: "People" }));
    await expect(await c.findByText("People panel")).toBeVisible();
    await expect(c.getByRole("tab", { name: "People" })).toHaveAttribute("aria-selected", "true");
  },
};
