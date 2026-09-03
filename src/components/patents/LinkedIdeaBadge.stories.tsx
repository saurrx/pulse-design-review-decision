import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import LinkedIdeaBadge from "./LinkedIdeaBadge";

/**
 * The badge marking a filing that came from a disclosure on the platform.
 *
 * These stories are the ONLY place this is verifiable. Most of the demo
 * portfolio was imported and carries no idea link — a scan of 500 patents on
 * demo found zero — so the badge renders on no screen anyone can open, and
 * "does the new circular icon look right" has no answer from the running app.
 * That is exactly why it stopped being inline JSX inside a 2,600-line file.
 */
const onOpen = fn();
const onRowClick = fn();

const meta = {
  title: "Patents/LinkedIdeaBadge",
  component: LinkedIdeaBadge,
  args: {
    ideaId: "8f0a2b3c-1111-4222-8333-444455556666",
    ideaTitle: "Phase-change lattice for battery pack cooling",
    onOpen,
  },
  decorators: [
    (Story) => (
      // The real context: a narrow, sticky table cell where the badge sits
      // beside the application number. The badge existing is not the claim —
      // the claim is that it fits ON that line.
      <table>
        <tbody>
          <tr>
            <td style={{ minWidth: 140, padding: "10px 16px" }}>
              <span
                data-testid="app-number-line"
                className="text-[13px] tabular-nums whitespace-nowrap flex items-center gap-1.5"
              >
                US17855760
                <Story />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    ),
  ],
} satisfies Meta<typeof LinkedIdeaBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The shape change that was asked for: a CIRCLE, on the same line as the
 * number, not a pill on a second row.
 */
export const InlineWithApplicationNumber: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const badge = c.getByTestId("linked-idea-badge");
    const line = c.getByTestId("app-number-line");

    // Circular, and actually round rather than merely rounded: the radius must
    // be at least half the box.
    const cs = getComputedStyle(badge);
    const r = parseFloat(cs.borderRadius);
    const box = badge.getBoundingClientRect();
    await expect(box.width).toBeCloseTo(box.height, 0);
    await expect(r).toBeGreaterThanOrEqual(box.width / 2);

    // Small enough to sit in the line rather than grow it.
    await expect(box.height).toBeLessThanOrEqual(20);

    // On the SAME line as the number: vertically centred against it, and no
    // taller than the line it lives in. This is the assertion the old pill
    // would have failed — it sat on a second row.
    const lineBox = line.getBoundingClientRect();
    await expect(Math.abs((box.top + box.height / 2) - (lineBox.top + lineBox.height / 2)))
      .toBeLessThan(4);
    await expect(box.height).toBeLessThanOrEqual(lineBox.height);

    // And it is not the old text chip.
    await expect(badge.textContent?.trim()).toBe("");
  },
};

/**
 * A bare icon must still say what it opens. The pill at least read "Linked
 * idea"; the circle says more than that did, through its accessible name.
 */
export const NamesTheIdeaForScreenReaders: Story = {
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByRole("button", {
      name: "Open the linked idea: Phase-change lattice for battery pack cooling",
    });
    await expect(badge).toBeInTheDocument();
  },
};

export const UntitledIdea: Story = {
  args: { ideaTitle: null },
  play: async ({ canvasElement }) => {
    // Never "Open the linked idea: null".
    await expect(
      within(canvasElement).getByRole("button", { name: "Open the linked idea: Untitled disclosure" }),
    ).toBeInTheDocument();
  },
};

/**
 * The row this badge sits in is itself clickable and opens the PATENT. Without
 * stopPropagation both handlers fire and the last one wins — so the badge is
 * asserted to call its own handler exactly once, which only holds if the click
 * stopped there.
 */
export const OpensTheIdeaAndStopsTheRowClick: Story = {
  decorators: [
    (Story) => {
      onRowClick.mockClear();
      return (
        <table>
          <tbody>
            <tr onClick={onRowClick} style={{ cursor: "pointer" }}>
              <td style={{ padding: 10 }}>
                <span className="flex items-center gap-1.5">
                  US17855760
                  <Story />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    onOpen.mockClear();
    onRowClick.mockClear();
    await userEvent.click(within(canvasElement).getByTestId("linked-idea-badge"));
    await expect(onOpen).toHaveBeenCalledTimes(1);
    await expect(onOpen).toHaveBeenCalledWith("8f0a2b3c-1111-4222-8333-444455556666");
    await expect(onRowClick).not.toHaveBeenCalled();
  },
};
