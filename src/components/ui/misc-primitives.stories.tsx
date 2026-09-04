import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Separator } from "./separator";
import { Progress } from "./progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Button } from "./button";

/** The small primitives, each with the one thing worth asserting. */
const meta = { title: "UI/Small primitives" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const ProgressReflectsValue: Story = {
  render: () => <div className="max-w-sm"><Progress value={72} aria-label="readiness" /></div>,
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "72");
    const indicator = bar.firstElementChild as HTMLElement;
    await expect(indicator.style.transform).toBe("translateX(-28%)");
  },
};

export const SeparatorIsDecorative: Story = {
  render: () => <div className="w-64"><p>above</p><Separator /><p>below</p></div>,
  play: async ({ canvasElement }) => {
    const sep = canvasElement.querySelector('[data-orientation="horizontal"]');
    await expect(sep).not.toBeNull();
    await expect(sep!.getAttribute("role")).toBe("none");
  },
};

export const CollapsibleTogglesContent: Story = {
  render: () => (
    <Collapsible>
      <CollapsibleTrigger asChild><Button variant="outline">Show details</Button></CollapsibleTrigger>
      <CollapsibleContent>Hidden until opened</CollapsibleContent>
    </Collapsible>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByText("Hidden until opened")).toBeNull();
    await userEvent.click(c.getByRole("button", { name: "Show details" }));
    await expect(await c.findByText("Hidden until opened")).toBeVisible();
  },
};
