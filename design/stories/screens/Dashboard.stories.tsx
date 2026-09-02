import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import Index from "@/pages/Index";

/** The role-branched dashboard at /. Every role has one; each reads the persona from the session cookie. */
const meta = { title: "Screens/Dashboard", component: Index, parameters: { pulse: { route: "/" } } } satisfies Meta<typeof Index>;
export default meta;
type Story = StoryObj<typeof meta>;

const seen = (text: RegExp) => async ({ canvasElement }: { canvasElement: HTMLElement }) => { await expect(await within(canvasElement).findByText(text, {}, { timeout: 10_000 })).toBeVisible(); };

export const Inventor: Story = { parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/" } }, play: seen(/Priya Raman/) };
export const InventorFirstRun: Story = { name: "Inventor, nothing submitted yet", parameters: { pulse: { scenario: "inventor/first-run", persona: "INVENTOR", route: "/" } }, play: seen(/Hana Kobayashi/) };
export const TechCommittee: Story = { parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", route: "/" } }, play: seen(/Tomás Ibarra/) };
export const LegalCounsel: Story = { parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/" } }, play: seen(/Jun Sato/) };
export const CaseOwner: Story = { parameters: { pulse: { scenario: "case-owner/assigned", persona: "CASE_OWNER", route: "/" } }, play: seen(/Ravi Menon/) };
export const PhotonAdmin: Story = { parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/" } }, play: seen(/Mu Yang/) };
export const Superadmin: Story = { parameters: { pulse: { scenario: "superadmin/firm", persona: "PHOTON_SUPERADMIN", route: "/" } }, play: seen(/Anand Krishnan/) };
export const LargePortfolio: Story = { name: "Counsel, 14,000 patents", parameters: { pulse: { scenario: "shape/large", persona: "LEGAL_COUNSEL", route: "/" } }, play: seen(/Mara Okafor/) };
