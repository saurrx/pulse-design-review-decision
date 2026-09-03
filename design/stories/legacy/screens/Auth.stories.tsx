import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import Signup from "@/pages/auth/Signup";
import Invite from "@/pages/auth/Invite";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import SamlCallback from "@/pages/auth/SamlCallback";

/** The public auth screens beyond login: signup, invitations, password reset, the SAML landing. Public layout, no persona unless the story says so. */
const meta = { title: "Legacy reference/Screens/Authentication", component: Signup, parameters: { pulse: { layout: "public", route: "/signup" } } } satisfies Meta<typeof Signup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignupForm: Story = { name: "Sign up", parameters: { pulse: { layout: "public", route: "/signup" } } };
export const InviteLanding: StoryObj<Meta<typeof Invite>> = { name: "Invitation", render: () => <Invite />, parameters: { pulse: { layout: "public", route: "/invite" } } };
export const ShareLink: StoryObj<Meta<typeof Invite>> = { name: "Share link with code", render: () => <Invite />, parameters: { pulse: { layout: "public", scenario: "counsel/queue", path: "/i/:inviteCode", route: (db) => `/i/${db.invites.find((i) => i.email === "*")?.code}` } } };
export const Forgot: StoryObj<Meta<typeof ForgotPassword>> = { name: "Forgot password", render: () => <ForgotPassword />, parameters: { pulse: { layout: "public", route: "/forgot-password" } } };
export const Reset: StoryObj<Meta<typeof ResetPassword>> = { name: "Reset password", render: () => <ResetPassword />, parameters: { pulse: { layout: "public", route: "/reset-password?token=mock-token" } } };
export const SamlLanding: StoryObj<Meta<typeof SamlCallback>> = {
  name: "SAML round trip lands",
  render: () => <SamlCallback />,
  parameters: { pulse: { layout: "public", scenario: "counsel/queue", persona: "LEGAL_COUNSEL", route: "/auth/saml/callback" } },
  play: async () => { const marker = await within(document.body).findByTestId("navigated-to", {}, { timeout: 8_000 }); await expect(marker).toHaveAttribute("data-pathname", "/"); },
};
