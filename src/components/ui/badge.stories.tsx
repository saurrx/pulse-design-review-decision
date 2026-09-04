import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Badge } from "./badge";

const meta = { title: "UI/Badge", component: Badge, args: { children: "3" } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex gap-2">
      {(["default", "secondary", "destructive", "outline"] as const).map((v) => <Badge key={v} variant={v}>{v}</Badge>)}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("outline")).toBeInTheDocument();
  },
};
