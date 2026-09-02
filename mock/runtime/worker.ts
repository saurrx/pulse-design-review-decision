import { setupWorker } from "msw/browser";
import { handlers } from "../handlers";

export function createWorker() {
  return setupWorker(...handlers);
}

export const WORKER_OPTIONS = {
  // The egress handler is the last handler, so nothing reaches this; kept as a belt.
  onUnhandledRequest: "error" as const,
  serviceWorker: { url: "/mockServiceWorker.js", options: { updateViaCache: "none" as const } },
  quiet: true,
};
