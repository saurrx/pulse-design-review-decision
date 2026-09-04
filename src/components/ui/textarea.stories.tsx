import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Textarea } from "./textarea";
import { Label } from "./label";

const meta = { title: "UI/Textarea", component: Textarea } satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Labelled: Story = {
  render: () => (<div className="max-w-sm"><Label htmlFor="abs">Abstract</Label><Textarea id="abs" rows={3} /></div>),
  play: async ({ canvasElement }) => {
    const ta = within(canvasElement).getByLabelText("Abstract");
    await userEvent.type(ta, "line one{enter}line two");
    await expect((ta as HTMLTextAreaElement).value.split("\n")).toHaveLength(2);
    await expect(ta).toHaveAttribute("rows", "3");
  },
};
