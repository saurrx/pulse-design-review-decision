import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import IdeaDetailsPage from "@/pages/IdeaDetailsPage";
import type { Db } from "../../../../mock/runtime/types";

/** /ideas/:id by workflow state and by viewer. The route picks the record from the seeded store by state. */
const byState = (state: Db["ideas"][number]["state"], nth = 0) => (db: Db) => `/ideas/${db.ideas.filter((i) => i.state === state)[nth]?.id}`;
const meta = { title: "Legacy reference/Screens/Idea details", component: IdeaDetailsPage, parameters: { pulse: { path: "/ideas/:id" } } } satisfies Meta<typeof IdeaDetailsPage>;
export default meta;
type Story = StoryObj<typeof meta>;
const seen = (text: RegExp) => async ({ canvasElement }: { canvasElement: HTMLElement }) => { await expect(await within(canvasElement).findByText(text, {}, { timeout: 10_000 })).toBeVisible(); };

export const InventorUnderReview: Story = { name: "Inventor, under review", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id", route: byState("TECH_REVIEW") } }, play: seen(/Your idea is in review/i) };
export const InventorEvaluationRunning: Story = { name: "Inventor, evaluation running", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id", route: byState("TECH_REVIEW", 1) } } };
export const InventorChangesRequested: Story = { name: "Inventor, changes requested", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id", route: byState("CHANGES_REQUESTED") } } };
export const InventorRejected: Story = { name: "Inventor, rejected with appeal", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id", route: byState("REJECTED") } } };
export const InventorSentToPhoton: Story = { name: "Inventor, sent to Photon Legal", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id", route: byState("SENT_TO_PHOTON") } } };
export const InventorFiled: Story = { name: "Inventor, filed", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", path: "/ideas/:id", route: byState("FILED") } } };
export const CommitteeDecision: Story = { name: "Tech committee, decision", parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", path: "/ideas/:id", route: byState("TECH_REVIEW") } } };
export const CommitteePartialEvaluation: Story = { name: "Tech committee, partial evaluation", parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", path: "/ideas/:id", route: byState("TECH_REVIEW", 2) } } };
export const CommitteeFailedEvaluation: Story = { name: "Tech committee, failed evaluation", parameters: { pulse: { scenario: "committee/queue", persona: "TECH_COMMITTEE", path: "/ideas/:id", route: byState("TECH_REVIEW", 4) } } };
export const CounselDecision: Story = { name: "Legal counsel, decision", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", path: "/ideas/:id", route: byState("LEGAL_REVIEW") } } };
export const CounselAtCommitteeStage: Story = { name: "Legal counsel, still with the committee", parameters: { pulse: { scenario: "committee/queue", persona: "LEGAL_COUNSEL", path: "/ideas/:id", route: byState("TECH_REVIEW") } } };
export const PhotonAdminSentToPhoton: Story = { name: "Photon admin, ready to file", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", path: "/ideas/:id", route: byState("SENT_TO_PHOTON") } } };
export const PhotonAdminFiled: Story = { name: "Photon admin, filed", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", path: "/ideas/:id", route: byState("FILED") } } };
