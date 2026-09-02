import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import IdeasPage from "@/pages/IdeasPage";
import ClientsPage from "@/pages/client/ClientsPage";

/**
 * Cross-cutting states as scenario overrides: slow network, failing writes,
 * permission denied. Authentication failures live in the full app only (the
 * app's 401 handling navigates the frame away, which a story cannot survive).
 */
const meta = { title: "States/Network and permissions", component: IdeasPage } satisfies Meta<typeof IdeasPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = { name: "Slow network, review queue", parameters: { pulse: { scenario: "shape/slow", persona: "LEGAL_COUNSEL", route: "/ideas" } } };
export const FailingWrites: Story = { name: "Every write fails, review queue", parameters: { pulse: { scenario: "shape/failure", persona: "LEGAL_COUNSEL", route: "/ideas" } } };
export const PermissionDenied: StoryObj<Meta<typeof ClientsPage>> = {
  name: "Inventor opens the clients page",
  render: () => <ClientsPage />,
  parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/clients" } },
  play: async () => { const marker = await within(document.body).findByTestId("navigated-to", {}, { timeout: 8_000 }); await expect(marker).toHaveAttribute("data-pathname", "/"); },
};
