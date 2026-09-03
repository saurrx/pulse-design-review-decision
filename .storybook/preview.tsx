import type { Preview } from "@storybook/react-vite";
import { setupWorker } from "msw/browser";
import { mswLoader } from "msw-storybook-addon/csf3";
import "../src/index.css";
import { handlers } from "../mock/handlers";
import { pulseLoader, withPulse, VIEWPORTS } from "../design/harness";

/**
 * One worker for the whole Storybook, started with the same handlers and the
 * same egress rule as the full app. A story's `parameters.msw` adds overrides
 * on top (they take precedence); the base handlers and the egress catch-all
 * stay in place underneath.
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
    a11y: { test: "error" },
    viewport: { options: VIEWPORTS },
    options: { storySort: { order: ["Surfaces", "Foundations", "Primitives", "Patterns", "States", "Legacy reference"] } },
  },
  initialGlobals: { viewport: { value: "pulse1440", isRotated: false } },
  loaders: [pulseLoader, mswLoader(startWorker)],
  decorators: [withPulse],
};
export default preview;
