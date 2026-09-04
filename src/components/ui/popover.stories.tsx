import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { FilterButton } from "./filter-button";
import { Filter } from "lucide-react";

const meta = { title: "UI/Popover", component: Popover } satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NamedPopover: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild><FilterButton icon={<Filter />}>Status</FilterButton></PopoverTrigger>
      <PopoverContent aria-labelledby="pop-title"><div id="pop-title" className="text-sm font-bold">Filter by status</div><p className="text-sm">Options…</p></PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Status/ }));
    const body = within(document.body);
    const pop = await body.findByRole("dialog");
    // Radix renders a popover as role=dialog; it must carry a name or axe
    // fails it — exactly what the inline date filter did before extraction.
    await expect(pop).toHaveAccessibleName("Filter by status");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
  },
};
