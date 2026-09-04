import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within, waitFor } from "storybook/test";
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
    actions: canvas.getByRole("link", { name: /^Actions due · 30 days,/ }),
    submitted: canvas.getByRole("link", { name: /^Submitted this quarter,/ }),
    patents: canvas.getByRole("link", { name: /^Total patents,/ }),
    granted: canvas.getByRole("link", { name: /^Granted,/ }),
  };
};

const scenario = (name: string): Story["parameters"] => ({ pulse: { scenario: name, persona: "LEGAL_COUNSEL", route: "/" } });

export const Typical: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 7, oldest 56 days/);
    await expect(canvas.getByRole("heading", { name: "Review Inventor Ideas" })).toBeVisible();
    // Both queue controls: the primary button in the header and the footer link.
    await expect(canvas.getByRole("button", { name: /Open queue/ })).toBeVisible();
    await expect(await canvas.findByRole("button", { name: /more waiting/ }, { timeout: 10_000 })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Patents worldwide" })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Top inventors" })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Idea pipeline" })).toBeVisible();
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
    await expect(table.getByText(/41d/)).toBeVisible();
    await expect(table.getByText("waiting")).toBeVisible();
  },
};

export const LargeAgingQueue: Story = {
  parameters: scenario("v0/workspace-admin/large-aging-queue"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.awaiting).toHaveAccessibleName(/Awaiting review, 40,/);
    await expect(await canvas.findAllByRole("row", {}, { timeout: 10_000 })).toHaveLength(7);
    await expect(canvas.getByRole("button", { name: /34 more waiting/ })).toBeVisible();
    await expect(canvas.getAllByText("waiting").length).toBeGreaterThan(1);
  },
};

export const NoActionsDue: Story = {
  parameters: scenario("v0/workspace-admin/no-actions-due"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.actions).toHaveAccessibleName(/Actions due · 30 days, 0, none due in 30 days/);
  },
};

export const NoSubmissionsThisQuarter: Story = {
  parameters: scenario("v0/workspace-admin/quiet-quarter"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = await strip(canvas);
    await expect(boxes.submitted).toHaveAccessibleName(/Submitted this quarter, 0, down 4 against last quarter/);
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
