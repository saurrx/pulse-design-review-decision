import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./alert-dialog";
import { Button } from "./button";

const onConfirm = fn();
const meta = { title: "UI/AlertDialog", component: AlertDialog } satisfies Meta<typeof AlertDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmDestructive: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="destructive">Delete patent</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete this patent?</AlertDialogTitle><AlertDialogDescription>It can be restored by an admin for 30 days.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    onConfirm.mockClear();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Delete patent" }));
    const body = within(document.body);
    const dlg = await body.findByRole("alertdialog");
    await expect(dlg).toHaveAccessibleName("Delete this patent?");
    // Escape does NOT confirm.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
    await expect(onConfirm).not.toHaveBeenCalled();
    // findByRole, not getByRole: Radix keeps the canvas aria-hidden until its
    // close animation ends, so the trigger is briefly not "accessible" and a
    // synchronous query finds nothing.
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Delete patent" }));
    await userEvent.click(await body.findByRole("button", { name: "Delete" }));
    await expect(onConfirm).toHaveBeenCalledTimes(1);
  },
};
