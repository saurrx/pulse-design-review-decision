import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "./input";
import { Label } from "./label";

const meta = { title: "UI/Input", component: Input } satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Labelled: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="app-no">Application Number</Label>
      <Input id="app-no" placeholder="e.g. US20240012345A1" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const input = c.getByLabelText("Application Number");
    await userEvent.type(input, "US1234");
    await expect(input).toHaveValue("US1234");
  },
};

export const Types: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="t1">Date</Label><Input id="t1" type="date" />
      <Label htmlFor="t2">Password</Label><Input id="t2" type="password" />
      <Label htmlFor="t3">Disabled</Label><Input id="t3" disabled value="read only" readOnly />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByLabelText("Date")).toHaveAttribute("type", "date");
    await expect(c.getByLabelText("Disabled")).toBeDisabled();
  },
};
