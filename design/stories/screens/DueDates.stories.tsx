import type { Meta, StoryObj } from "@storybook/react-vite";
import DueDatesPage from "@/pages/DueDatesPage";

/** /due-dates: the docket list and calendar. Client roles carry the Action column; Photon roles work the other axis. */
const meta = { title: "Screens/Due dates", component: DueDatesPage, parameters: { pulse: { route: "/due-dates" } } } satisfies Meta<typeof DueDatesPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Counsel: Story = { parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/due-dates" } } };
export const Committee: Story = { parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", route: "/due-dates" } } };
export const CaseOwner: Story = { parameters: { pulse: { scenario: "case-owner/assigned", persona: "CASE_OWNER", route: "/due-dates" } } };
export const PhotonAdmin: Story = { parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/due-dates" } } };
export const Large: Story = { name: "Legal counsel, 13,000 deadlines", parameters: { pulse: { scenario: "shape/large", persona: "LEGAL_COUNSEL", route: "/due-dates" } } };
export const Empty: Story = { name: "Legal counsel, nothing due", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/due-dates", prepare: (db) => { db.portfolios = {}; } } } };
