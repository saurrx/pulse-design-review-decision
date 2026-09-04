import type { Preview } from "@storybook/react-vite";
import { setupWorker } from "msw/browser";
import { mswLoader } from "msw-storybook-addon/csf3";
import "../src/index.css";
import "../src/style.css";
import { handlers } from "../mock/handlers";
import { pulseLoader, withPulse, VIEWPORTS } from "../design/harness";

/**
 * One worker and one decorator serve both story tiers. `withPulse` leaves
 * production's isolated component stories isolated; stories with a `pulse`
 * parameter receive the full mock session, provider tree, router and layout.
 */
const startWorker = async () => {
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: "error",
    serviceWorker: { url: "/mockServiceWorker.js", options: { updateViaCache: "none" } },
    quiet: true,
  });
  return worker;
};

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    msw: [],
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Accessibility is gated by tools/design/a11y.mjs: known Legacy reference
    // fingerprints ratchet down, while every story tagged `redesign` must have
    // zero violations in its content root. Making the addon fail globally would
    // turn 208 recorded legacy findings into duplicate failures and bypass that
    // explicit policy. Production's own repository still runs its component
    // stories with `test: "error"` through its independent config.
    a11y: { test: "off" },
    viewport: { options: VIEWPORTS },
    options: { storySort: { order: ["Surfaces", "Foundations", "Primitives", "Patterns", "States", "Legacy reference", "Auth", "Common", "Patents", "UI"] } },
  },
  initialGlobals: { viewport: { value: "pulse1440", isRotated: false } },
  loaders: [pulseLoader, mswLoader(startWorker)],
  decorators: [withPulse],
};
export default preview;
