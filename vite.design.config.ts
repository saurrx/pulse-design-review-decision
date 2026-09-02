/**
 * The design fork's Vite config. Production's vite.config.ts is imported
 * untouched and extended here, so no production file is modified by tooling:
 *  - the HTML entry is swapped to the mock runtime, which starts the service
 *    worker, mounts the persona chip and only then imports src/main.tsx;
 *  - the Google OAuth package is aliased to an inert shim with the same
 *    exports, so nothing loads from Google and the login endpoint is mocked;
 *  - the /v1 dev proxy is removed, because the worker answers /v1 in-page and
 *    nothing may leave the machine.
 * Storybook reuses the same alias and content globs through .storybook/main.ts.
 */
import { defineConfig, mergeConfig, type Plugin, type UserConfig } from "vite";
import production from "./vite.config";
import { DESIGN_ALIASES } from "./mock/runtime/aliases.mjs";

const swapEntry = (): Plugin => ({
  name: "pulse-design-entry",
  transformIndexHtml: {
    // "pre": before Vite resolves the entry, or the production entry is what gets bundled.
    order: "pre",
    handler(html) {
      return html
        .replace('src="/src/main.tsx"', 'src="/mock/runtime/boot.tsx"')
        // Google Fonts links out; the vendored faces are imported by mock/runtime/boot.tsx. Nothing leaves the machine.
        .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.g[^>]*>/g, "")
        .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, "");
    },
  },
});

export default defineConfig((env) => {
  const base = (typeof production === "function" ? production(env) : production) as UserConfig;
  const merged = mergeConfig(base, {
    plugins: [swapEntry()],
    resolve: { alias: DESIGN_ALIASES },
    server: { port: 3700, strictPort: true },
    preview: { port: 3700, strictPort: true },
  }) as UserConfig;
  if (merged.server) delete (merged.server as { proxy?: unknown }).proxy;
  return merged;
});
