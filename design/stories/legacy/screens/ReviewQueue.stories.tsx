import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import IdeasPage from "@/pages/IdeasPage";
import { route } from "../../../../mock/runtime/registry";

/**
 * The reviewers' queue at /ideas, through the real page so the role branch and
 * the dashboard chrome are exercised. Each story names a scenario and a persona.
 */
const meta = {
  title: "Legacy reference/Screens/Review queue",
  component: IdeasPage,
  parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", route: "/ideas" } },
} satisfies Meta<typeof IdeasPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Committee: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(/Self-tensioning cable harness/, {}, { timeout: 10_000 });
    await expect(canvas.getByRole("link", { name: /Review queue/ })).toBeVisible();
  },
};

export const Counsel: Story = {
  parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/ideas" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(/Graded-porosity ceramic filter/, {}, { timeout: 10_000 });
  },
};

export const RequestChangesDialog: Story = {
  name: "Committee, request changes dialog",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(/Self-tensioning cable harness/, {}, { timeout: 10_000 });
    await userEvent.click(canvas.getByRole("button", { name: /Request (update|changes)/i }));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
  },
};

export const Empty: Story = {
  name: "Committee, nothing to review",
  parameters: { msw: [route("get", "/v1/ideas", () => [])] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.queryByText(/Self-tensioning cable harness/)).toBeNull(), { timeout: 10_000 });
  },
};
