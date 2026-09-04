import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "./label";

const onChange = fn();
const meta = { title: "UI/RadioGroup", component: RadioGroup } satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSelection: Story = {
  render: () => (
    <RadioGroup defaultValue="list" onValueChange={onChange}>
      {["list", "grid"].map((v) => (
        <div key={v} className="flex items-center gap-2"><RadioGroupItem value={v} id={`r-${v}`} /><Label htmlFor={`r-${v}`}>{v} view</Label></div>
      ))}
    </RadioGroup>
  ),
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const c = within(canvasElement);
    await expect(c.getByRole("radio", { name: "list view" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(c.getByRole("radio", { name: "grid view" }));
    await expect(onChange).toHaveBeenCalledWith("grid");
    // Exactly one checked, always.
    await expect(c.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
  },
};
