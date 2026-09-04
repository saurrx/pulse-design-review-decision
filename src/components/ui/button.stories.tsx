import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Plus } from "lucide-react";
import { Button } from "./button";

const onClick = fn();
const meta = { title: "UI/Button", component: Button, args: { children: "Save Idea", onClick } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map((v) => <Button key={v} variant={v}>{v}</Button>)}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("button")).toHaveLength(6);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="sm">sm</Button><Button size="default">default</Button><Button size="lg">lg</Button>
      <Button size="icon" aria-label="add"><Plus className="h-4 w-4" /></Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [sm, md, lg, icon] = Array.from(canvasElement.querySelectorAll("button")).map((b) => b.getBoundingClientRect());
    await expect(sm.height).toBeLessThan(md.height);
    await expect(md.height).toBeLessThan(lg.height);
    await expect(Math.round(icon.width)).toBe(Math.round(icon.height));
  },
};

export const Clickable: Story = {
  play: async ({ canvasElement }) => {
    onClick.mockClear();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Save Idea" }));
    await expect(onClick).toHaveBeenCalledTimes(1);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    onClick.mockClear();
    const btn = within(canvasElement).getByRole("button");
    await expect(btn).toBeDisabled();
    await userEvent.click(btn).catch(() => undefined);
    await expect(onClick).not.toHaveBeenCalled();
  },
};
