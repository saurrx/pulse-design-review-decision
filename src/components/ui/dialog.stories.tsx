import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Button } from "./button";

const meta = { title: "UI/Dialog", component: Dialog } satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OpensAndCloses: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild><Button>Add a patent</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a patent</DialogTitle><DialogDescription>Add a single patent to this client's portfolio.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline">Cancel</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add a patent" }));
    const body = within(document.body);
    const dialog = await body.findByRole("dialog");
    // Named: a dialog without an accessible name is an axe error, and the
    // date-filter popover shipped that way until today.
    await expect(dialog).toHaveAccessibleName("Add a patent");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
  },
};
