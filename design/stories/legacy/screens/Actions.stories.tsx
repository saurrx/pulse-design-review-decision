import type { Meta, StoryObj } from "@storybook/react-vite";
import ActionsPage from "@/pages/ActionsPage";

/** /actions: the client's instruction selection, and Photon's operations queue. */
const meta = { title: "Legacy reference/Screens/Actions", component: ActionsPage, parameters: { pulse: { route: "/actions" } } } satisfies Meta<typeof ActionsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CounselSelection: Story = { name: "Legal counsel, choose instructions", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/actions" } } };
export const PhotonQueue: Story = { name: "Photon admin, operations queue", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/actions" } } };
export const CaseOwnerQueue: Story = { name: "Case owner, assigned clients", parameters: { pulse: { scenario: "case-owner/assigned", persona: "CASE_OWNER", route: "/actions" } } };
export const PhotonQueueEmpty: Story = { name: "Photon admin, nothing in the queue", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/actions", prepare: (db) => { db.actionRequests = []; } } } };
export const InventorRedirected: Story = { name: "Inventor is redirected home", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/actions" } } };
