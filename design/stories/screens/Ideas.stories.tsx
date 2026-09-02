import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import IdeasPage from "@/pages/IdeasPage";

/** /ideas branches by role: inventors see their draft cards, reviewers the queue (see Review queue), Photon roles the repository table. */
const meta = { title: "Screens/Ideas", component: IdeasPage, parameters: { pulse: { route: "/ideas" } } } satisfies Meta<typeof IdeasPage>;
export default meta;
type Story = StoryObj<typeof meta>;
const seen = (text: RegExp) => async ({ canvasElement }: { canvasElement: HTMLElement }) => { const all = await within(canvasElement).findAllByText(text, {}, { timeout: 10_000 }); await expect(all[0]).toBeVisible(); };

export const InventorCards: Story = { name: "Inventor, every state", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/ideas" } }, play: seen(/Self-tensioning cable harness/) };
export const InventorEmpty: Story = { name: "Inventor, no ideas yet", parameters: { pulse: { scenario: "inventor/first-run", persona: "INVENTOR", route: "/ideas" } } };
export const PhotonAdminTable: Story = { name: "Photon admin, repository", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/ideas" } }, play: seen(/(ACME|GLX|HLX)-\d{4}/) };
export const CaseOwnerTable: Story = { name: "Case owner, assigned clients only", parameters: { pulse: { scenario: "case-owner/assigned", persona: "CASE_OWNER", route: "/ideas" } }, play: seen(/(ACME|GLX)-\d{4}/) };
