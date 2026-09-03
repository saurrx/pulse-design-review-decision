import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ClientsPage from "@/pages/client/ClientsPage";
import ClientDetailPage from "@/pages/client/ClientDetailPage";

/** /clients and /clients/:id: Photon side only; case owners see their assignments; the founder tier is bounced from detail today. */
const meta = { title: "Legacy reference/Screens/Clients", component: ClientsPage, parameters: { pulse: { route: "/clients" } } } satisfies Meta<typeof ClientsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PhotonAdmin: Story = { name: "Photon admin, all clients", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/clients" } }, play: async ({ canvasElement }) => { await expect((await within(canvasElement).findAllByText(/Acme Robotics/, {}, { timeout: 10_000 }))[0]).toBeVisible(); } };
export const CaseOwner: Story = { name: "Case owner, two of three", parameters: { pulse: { scenario: "case-owner/assigned", persona: "CASE_OWNER", route: "/clients" } } };
export const Detail: StoryObj<Meta<typeof ClientDetailPage>> = { name: "Photon admin, client workspace", render: () => <ClientDetailPage />, parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", path: "/clients/:clientId", route: (db) => `/clients/${db.clients[0].id}` } } };
export const DetailCaseOwner: StoryObj<Meta<typeof ClientDetailPage>> = { name: "Case owner, an assigned client", render: () => <ClientDetailPage />, parameters: { pulse: { scenario: "case-owner/assigned", persona: "CASE_OWNER", path: "/clients/:clientId", route: (db) => `/clients/${db.clients[0].id}` } } };
export const SuperadminBounced: StoryObj<Meta<typeof ClientDetailPage>> = { name: "Founder tier is bounced from detail", render: () => <ClientDetailPage />, parameters: { pulse: { scenario: "superadmin/firm", persona: "PHOTON_SUPERADMIN", path: "/clients/:clientId", route: (db) => `/clients/${db.clients[0].id}` } } };
