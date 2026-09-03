import type { Meta, StoryObj } from "@storybook/react-vite";
import AssistantPage from "@/pages/client/AssistantPage";

/** /assistant is a placeholder surface in production; kept so the redesign decides what to do with it. */
const meta = { title: "Legacy reference/Screens/Assistant", component: AssistantPage, parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/assistant" } } } satisfies Meta<typeof AssistantPage>;
export default meta;
export const Placeholder: StoryObj<typeof meta> = {};
