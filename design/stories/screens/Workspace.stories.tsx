import type { Meta, StoryObj } from "@storybook/react-vite";
import WorkspacePage from "@/pages/WorkspacePage";
import ProfilePage from "@/pages/ProfilePage";

/** /workspace (people, case owners, organisation) and /profile. */
const meta = { title: "Screens/Workspace and profile", component: WorkspacePage, parameters: { pulse: { route: "/workspace" } } } satisfies Meta<typeof WorkspacePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CounselPeople: Story = { name: "Legal counsel, people and invites", parameters: { pulse: { scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/workspace" } } };
export const PhotonAdminCaseOwners: Story = { name: "Photon admin, case owners", parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/workspace" } } };
export const InventorRedirected: Story = { name: "Inventor is sent to profile", parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/workspace" } } };
export const ProfileInventor: StoryObj<Meta<typeof ProfilePage>> = { name: "Profile, inventor", render: () => <ProfilePage />, parameters: { pulse: { scenario: "inventor/portfolio", persona: "INVENTOR", route: "/profile" } } };
export const ProfilePhotonAdmin: StoryObj<Meta<typeof ProfilePage>> = { name: "Profile, Photon admin", render: () => <ProfilePage />, parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/profile" } } };
