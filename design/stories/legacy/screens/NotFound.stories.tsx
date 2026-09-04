import type { Meta, StoryObj } from "@storybook/react-vite";
import NotFound from "@/pages/NotFound";

/** Production's catch-all route; kept as reference so the page's restyles (DSN-0003 corners) render somewhere a reviewer can see. */
const meta = { title: "Legacy reference/Screens/Not found", component: NotFound, parameters: { pulse: { scenario: "photon-admin/firm", persona: "PHOTON_ADMIN", route: "/this-page-does-not-exist" } } } satisfies Meta<typeof NotFound>;
export default meta;
export const Missing: StoryObj<typeof meta> = {};
