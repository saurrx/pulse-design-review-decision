import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import PatentsPage from "@/pages/PatentsPage";
import { allPatents } from "../../../mock/runtime/store";

/** /patents: the portfolio table with URL-synced filters, and /patents/:id. Rows come from the generated portfolio. */
const meta = { title: "Screens/Patents", component: PatentsPage, parameters: { pulse: { route: "/patents" } } } satisfies Meta<typeof PatentsPage>;
export default meta;
type Story = StoryObj<typeof meta>;
const seenAny = (text: RegExp) => async ({ canvasElement }: { canvasElement: HTMLElement }) => { const all = await within(canvasElement).findAllByText(text, {}, { timeout: 15_000 }); await expect(all[0]).toBeVisible(); };

export const Counsel: Story = { name: "Legal counsel, 60 patents", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/patents" } }, play: seenAny(/Export/i) };
export const PhotonAdmin: Story = { name: "Photon admin, all clients", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/patents" } } };
export const Inventor: Story = { parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/patents" } } };
export const Large: Story = { name: "Legal counsel, 14,000 patents", parameters: { pulse: { scenario: "shape/large", persona: "LEGAL_COUNSEL", route: "/patents" } } };
export const Empty: Story = { name: "Legal counsel, empty portfolio", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/patents", prepare: (db) => { db.portfolios = {}; } } } };
export const Detail: Story = { name: "Photon admin, filing details", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", path: "/patents/:patentId", route: () => `/patents/${allPatents(null)[0].id}` } } };
export const DetailCounsel: Story = { name: "Legal counsel, filing details", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", path: "/patents/:patentId", route: (db) => `/patents/${allPatents([db.clients[1].id])[3].id}` } } };
