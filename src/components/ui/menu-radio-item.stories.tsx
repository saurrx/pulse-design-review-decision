import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within, fn } from "storybook/test";
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuTrigger } from "./dropdown-menu";
import { FilterButton } from "./filter-button";
import { MenuRadioItem } from "./menu-radio-item";

const onChange = fn();

/** A sort menu as the Patents screen renders it — the composition every list
 *  screen now shares instead of sixteen hand-styled radio rows. */
function SortMenu() {
  const [value, setValue] = useState("newest");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterButton icon={<ArrowUpDown />}>Sort</FilterButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[180px] p-2">
        <DropdownMenuLabel className="font-sans">Sort Patents</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => { setValue(v); onChange(v); }}>
          <MenuRadioItem value="newest">Newest First</MenuRadioItem>
          <MenuRadioItem value="oldest">Oldest First</MenuRadioItem>
          <MenuRadioItem value="titleAZ">Title (A-Z)</MenuRadioItem>
          <MenuRadioItem value="titleZA">Title (Z-A)</MenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta = { title: "UI/MenuRadioItem", component: SortMenu } satisfies Meta<typeof SortMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SortMenuComposition: Story = {
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Sort/ }));
    const body = within(document.body);
    const items = await body.findAllByRole("menuitemradio");
    await expect(items).toHaveLength(4);
    await expect(items[0]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(items[2]);
    await expect(onChange).toHaveBeenCalledWith("titleAZ");
    // Radix closes the menu on select, but make sure the RESTING state is what
    // the post-play a11y pass sees. While a Radix menu is open it puts
    // aria-hidden on every sibling of the portal — including this canvas, whose
    // trigger button stays focusable — and axe reports `aria-hidden-focus` on
    // the canvas. That is the library's focus-trap doing its job, not a defect
    // in the component; asserting on the open menu and then leaving it open is
    // what produced the false positive.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("menuitemradio")).toBeNull());
  },
};
