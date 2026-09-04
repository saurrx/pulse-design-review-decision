import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { Button } from "./button";

const meta = { title: "UI/Tooltip", component: Tooltip } satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OnHover: Story = {
  render: () => (
    <TooltipProvider delayDuration={0}>
      <Tooltip><TooltipTrigger asChild><Button variant="outline">Hover me</Button></TooltipTrigger><TooltipContent>Filed from a disclosure on Pulse.</TooltipContent></Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole("button", { name: "Hover me" }));
    await expect(await within(document.body).findByRole("tooltip")).toHaveTextContent("Filed from a disclosure on Pulse.");
  },
};
