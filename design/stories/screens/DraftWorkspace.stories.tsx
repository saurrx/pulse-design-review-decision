import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import IdeaDraftPage from "@/pages/IdeaDraftPage";
import type { Db } from "../../../mock/runtime/types";

/** /ideas/:id/draft: the inventor's questionnaire, and the read views a reviewer gets on the same route. */
const byState = (state: Db["ideas"][number]["state"], nth = 0) => (db: Db) => `/ideas/${db.ideas.filter((i) => i.state === state)[nth]?.id}/draft`;
const meta = { title: "Screens/Draft workspace", component: IdeaDraftPage, parameters: { pulse: { path: "/ideas/:id/draft" } } } satisfies Meta<typeof IdeaDraftPage>;
export default meta;
type Story = StoryObj<typeof meta>;
const seen = (text: RegExp) => async ({ canvasElement }: { canvasElement: HTMLElement }) => { await expect(await within(canvasElement).findByText(text, {}, { timeout: 10_000 })).toBeVisible(); };

export const InventorEarlyDraft: Story = { name: "Inventor, 20% complete", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id/draft", route: byState("DRAFT", 0) } } };
export const InventorNearlyDone: Story = { name: "Inventor, 80% complete", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id/draft", route: byState("DRAFT", 1) } } };
export const InventorSubmitted: Story = { name: "Inventor, submitted and scored", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id/draft", route: byState("TECH_REVIEW", 0) } } };
export const InventorEvaluationRunning: Story = { name: "Inventor, evaluation running", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id/draft", route: byState("TECH_REVIEW", 1) } } };
export const CommitteeReadView: Story = { name: "Tech committee, read view", parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", path: "/ideas/:id/draft", route: byState("TECH_REVIEW", 0) } } };
export const CounselReadView: Story = { name: "Legal counsel, read view", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", path: "/ideas/:id/draft", route: byState("LEGAL_REVIEW", 0) } } };
export const PhotonReadView: Story = { name: "Photon admin, read view", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", path: "/ideas/:id/draft", route: byState("SENT_TO_PHOTON", 0) } } };
