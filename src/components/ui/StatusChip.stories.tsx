import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import StatusChip from "./StatusChip";

const STATES = ["IN_DRAFT","UNDER_REVIEW","UPDATE_REQUEST","SEND_TO_OC","FILED","REJECT_BY_IHC","REJECT_BY_OC","GRANTED","PENDING","REJECTED"];
const meta = { title: "UI/StatusChip", component: StatusChip } satisfies Meta<typeof StatusChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every idea/patent state the app renders, so the tone mapping (spec 3.1:
 *  green = terminal success only, red = blocking, slate = draft) is visible
 *  in one place and pinned. */
export const AllStates: Story = {
  args: { label: "x" },
  render: () => <div className="flex flex-wrap gap-2">{STATES.map((s) => <StatusChip key={s} status={s} label={s.replace(/_/g, " ").toLowerCase()} />)}</div>,
  play: async ({ canvasElement }) => {
    const marks = Array.from(canvasElement.querySelectorAll("span.h-\\[7px\\]")).map((m) => (m as HTMLElement).style.background);
    const byState = Object.fromEntries(STATES.map((s, i) => [s, marks[i]]));
    await expect(byState.GRANTED).toBe("rgb(47, 141, 112)");     // green — terminal success only
    await expect(byState.FILED).toBe("rgb(67, 81, 192)");        // blue — in-flight
    await expect(byState.IN_DRAFT).toBe("rgb(94, 100, 112)");    // slate — draft
    await expect(byState.REJECT_BY_OC).toBe("rgb(201, 101, 88)"); // red — blocking
    await expect(byState.UNDER_REVIEW).toBe("rgb(249, 180, 24)"); // amber — action pending
  },
};

export const ExplicitTone: Story = {
  args: { label: "Custom", tone: "red" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Custom")).toBeInTheDocument();
  },
};

export const UnknownStatusFallsBackToSlate: Story = {
  args: { label: "???", status: "NOT_A_STATE" },
  play: async ({ canvasElement }) => {
    const mark = canvasElement.querySelector("span.h-\\[7px\\]") as HTMLElement;
    await expect(mark.style.background).toBe("rgb(94, 100, 112)");
  },
};
