import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const onChange = fn();
const meta = { title: "UI/Checkbox", component: Checkbox } satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Toggles: Story = {
  render: () => (<div className="flex items-center gap-2"><Checkbox id="c1" onCheckedChange={onChange} /><Label htmlFor="c1">6sense</Label></div>),
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const box = within(canvasElement).getByRole("checkbox", { name: "6sense" });
    await expect(box).toHaveAttribute("aria-checked", "false");
    await userEvent.click(box);
    await expect(box).toHaveAttribute("aria-checked", "true");
    await expect(onChange).toHaveBeenCalledWith(true);
    // Clicking the LABEL toggles too — the client picker relies on this.
    await userEvent.click(within(canvasElement).getByText("6sense"));
    await expect(box).toHaveAttribute("aria-checked", "false");
  },
};

export const Disabled: Story = {
  render: () => (<div className="flex items-center gap-2"><Checkbox id="c2" disabled checked /><Label htmlFor="c2">locked</Label></div>),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("checkbox")).toBeDisabled();
  },
};
