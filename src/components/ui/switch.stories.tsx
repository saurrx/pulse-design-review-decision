import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Switch } from "./switch";
import { Label } from "./label";

const onChange = fn();
const meta = { title: "UI/Switch", component: Switch } satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Toggles: Story = {
  render: () => (<div className="flex items-center gap-2"><Switch id="s1" onCheckedChange={onChange} /><Label htmlFor="s1">Filing updates</Label></div>),
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const sw = within(canvasElement).getByRole("switch", { name: "Filing updates" });
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(onChange).toHaveBeenCalledWith(true);
  },
};
