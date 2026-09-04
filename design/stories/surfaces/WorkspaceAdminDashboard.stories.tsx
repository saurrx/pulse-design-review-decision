import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import Index from "@/pages/Index";
import { route } from "../../../mock/runtime/registry";

/**
 * Surfaces/Workspace Admin dashboard (product-context/surfaces/workspace-admin-dashboard.md, DSN-0002).
 *
 * The Workspace Admin's Overview at "/": five scoped stat boxes, Patents
 * worldwide and Top inventors (both kept by founder override, recorded in
 * docs/architecture/CONTEXT-RECONCILIATION.md R-07), the Review Inventor Ideas
 * queue with the page's only primary button, and the Idea pipeline. Every
 * story selects a `v0/` scenario and signs in as a Workspace Admin.
 */
const meta = {
  title: "Surfaces/Workspace Admin dashboard",
  component: Index,
  tags: ["redesign"],
  parameters: { pulse: { scenario: "v0/workspace-admin/queue", persona: "LEGAL_COUNSEL", route: "/" } },
} satisfies Meta<typeof Index>;
export default meta;
type Story = StoryObj<typeof meta>;

const strip = async (canvas: ReturnType<typeof within>) => {
  await canvas.findByRole("link", { name: /^Awaiting review,/ }, { timeout: 10_000 });
  return {
    awaiting: canvas.getByRole("link", { name: /^Awaiting review,/ }),
    actions: canvas.getByRole("link", { name: /^Deadlines · 30 days,/ }),
    patents: canvas.getByRole("link", { name: /^Total patents,/ }),
    granted: canvas.getByRole("link", { name: /^Granted,/ }),
    pending: canvas.getByRole("link", { name: /^Pending patents,/ }),
  };
};

const scenario = (name: string): Story["parameters"] => ({ pulse: { scenario: name, persona: "LEGAL_COUNSEL", route: "/" } });

export const Typical: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 7, oldest 56 days/);
    await expect(canvas.queryByRole("group", { name: "Your workspace" })).toBeNull();
    await expect(canvas.queryByRole("group", { name: "Company portfolio" })).toBeNull();
    await expect(canvas.getByRole("heading", { name: "Review Inventor Ideas" })).toBeVisible();
    const scoreHeader = canvas.getByRole("columnheader", { name: /Score sorted highest first/ });
    await expect(scoreHeader).toHaveAttribute("aria-sort", "descending");
    await expect(canvas.queryByRole("img", { name: "Not evaluated" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: /Submitted/ }));
    await expect(canvas.getByRole("columnheader", { name: /Submitted sorted oldest first/ })).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(canvas.getByRole("button", { name: /Score/ }));
    await expect(scoreHeader).toHaveAttribute("aria-sort", "descending");
    // Both queue controls: the primary button in the header and the footer link.
    await expect(canvas.getByRole("button", { name: /Open queue/ })).toBeVisible();
    await expect(await canvas.findByRole("button", { name: /Showing 6 of 7/ }, { timeout: 10_000 })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Patents worldwide" })).toBeVisible();
    await expect(canvas.queryByText("By jurisdiction")).toBeNull();
    await expect(canvas.queryByRole("list", { name: "Patents by jurisdiction" })).toBeNull();
    await expect(canvas.queryByText(/^\d+ patents$/)).toBeNull();
    await expect(await canvas.findByRole("img", { name: /^United States, \d+ patents, \d+ granted, \d+ pending$/ })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Top inventors" })).toBeVisible();
    const inventorPeriod = canvas.getByRole("combobox", { name: "Period" });
    await expect(within(inventorPeriod).getAllByRole("option")).toHaveLength(5);
    await expect(await canvas.findAllByRole("button", { name: /^\d+\. .+, \d+ ideas?$/ }, { timeout: 10_000 })).toHaveLength(5);
    await canvas.getByRole("button", { name: "Patents" }).click();
    await expect(await canvas.findAllByRole("button", { name: /^\d+\. .+, \d+ patents?$/ })).toHaveLength(5);
    await canvas.getByRole("button", { name: "Ideas" }).click();
    await expect(canvas.getByRole("heading", { name: "Idea pipeline" })).toBeVisible();
    const pipelinePeriod = canvas.getByRole("combobox", { name: "Pipeline period" });
    await expect(canvas.getByText("usually 1–2 months")).toBeVisible();
    await expect(canvas.getByText("company average: 9 months")).toBeVisible();
    await expect(canvas.getByText("with outside counsel")).toBeVisible();
    await expect(within(pipelinePeriod).getAllByRole("option")).toHaveLength(3);
    await userEvent.selectOptions(pipelinePeriod, "last_quarter");
    await expect(pipelinePeriod).toHaveValue("last_quarter");
    await userEvent.selectOptions(pipelinePeriod, "all_time");
    await expect(canvas.getByRole("heading", { name: "Timeline & Events" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Calendar" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "List" })).toBeVisible();
    await expect(await canvas.findByRole("table")).toBeVisible();
    // No "1+ pending action" footer, no cumulative chart, no donut, no Nudge.
    await expect(canvas.queryByText(/pending action/)).toBeNull();
    await expect(canvas.queryByText(/Nudge/)).toBeNull();
    await expect(canvas.queryByText(/Patent portfolio/)).toBeNull();
  },
};

export const NoPendingReviews: Story = {
  parameters: scenario("v0/workspace-admin/empty"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 0, nothing waiting/);
    await expect(await canvas.findByText("Nothing waiting for your review.")).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: /Workspace › People/ })[0]).toBeVisible();
  },
};

export const OneUrgentReview: Story = {
  parameters: scenario("v0/workspace-admin/one-urgent-review"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 1, oldest 41 days/);
    await expect(await canvas.findAllByRole("row", {}, { timeout: 10_000 })).toHaveLength(2);
    const table = within(canvas.getByRole("table"));
    await expect(table.getByRole("cell", { name: /41 days ago, past 30 day threshold/ })).toBeVisible();
  },
};

export const LargeAgingQueue: Story = {
  parameters: scenario("v0/workspace-admin/large-aging-queue"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 40,/);
    await expect(await canvas.findAllByRole("row", {}, { timeout: 10_000 })).toHaveLength(7);
    await expect(canvas.getByRole("button", { name: /Showing 6 of 40/ })).toBeVisible();
    await expect(canvas.getAllByRole("cell", { name: /past 30 day threshold/ }).length).toBeGreaterThan(1);
  },
};

export const NoActionsDue: Story = {
  parameters: scenario("v0/workspace-admin/no-actions-due"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.actions).toHaveAccessibleName(/Deadlines · 30 days, 0, none due in 30 days/);
  },
};

export const NoSubmissionsThisQuarter: Story = {
  parameters: scenario("v0/workspace-admin/quiet-quarter"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 2,/);
    await expect(await canvas.findByText("No submissions this quarter yet.")).toBeVisible();
  },
};

export const EmptyPortfolio: Story = {
  parameters: scenario("v0/workspace-admin/empty-portfolio"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.patents).toHaveAccessibleName(/Total patents, 0, no patents added yet/);
    await expect(boxes.granted).toHaveAccessibleName(/Granted, 0, no patents added yet/);
    await expect(boxes.pending).toHaveAccessibleName(/Pending patents, 0, no patents added yet/);
    await expect(await canvas.findByText("No patents added yet", { selector: "p" })).toBeVisible();
  },
};

export const SingleInventor: Story = {
  parameters: scenario("v0/workspace-admin/single-inventor"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await strip(canvas);
    await expect(await canvas.findByRole("button", { name: /^1\. Anika Sharma, \d+ ideas$/ })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /^2\. / })).toBeNull();
  },
};

export const LongTitles: Story = {
  parameters: scenario("v0/workspace-admin/long-titles"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await strip(canvas);
    await expect((await canvas.findAllByText(/Self-calibrating multi-axis interferometric/))[0]).toBeVisible();
    await expect(canvas.getAllByText(/Rosalind Kowalczyk-Vanderberg/)[0]).toBeVisible();
  },
};

export const Loading: Story = {
  parameters: scenario("v0/shape/slow"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = await canvas.findByRole("region", { name: "Overview" });
    await expect(region).toHaveAttribute("aria-busy", "true");
  },
};

export const DataUnavailable: Story = {
  parameters: {
    ...scenario("v0/workspace-admin/queue"),
    msw: [route("get", "/v1/dashboard", () => ({ status: 500, body: { message: "Dashboard unavailable." } }))],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/The overview numbers could not be loaded/, {}, { timeout: 15_000 })).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: "Retry" })[0]).toBeVisible();
    // The queue still loads on its own.
    await expect(canvas.getByRole("heading", { name: "Review Inventor Ideas" })).toBeVisible();
    await waitFor(() => expect(canvas.getByRole("table")).toBeVisible(), { timeout: 10_000 });
  },
};

export const Width1280: Story = { tags: ["viewport:1280x720"], play: Typical.play };
export const Width1366: Story = { tags: ["viewport:1366x768"], play: Typical.play };
export const Width1440: Story = { tags: ["viewport:1440x900"], play: Typical.play };
export const Width1920: Story = { tags: ["viewport:1920x1080"], play: Typical.play };
export const Zoom200: Story = { tags: ["viewport:640x360@2"], play: Typical.play };

/** The screenshot harness renders with reduced motion; this story asserts the final state is present without waiting on animation. */
export const ReducedMotion: Story = {
  tags: ["viewport:1440x900"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await waitFor(() => expect(boxes.awaiting).toBeVisible());
    await expect(canvas.getByRole("heading", { name: "Idea pipeline" })).toBeVisible();
  },
};
