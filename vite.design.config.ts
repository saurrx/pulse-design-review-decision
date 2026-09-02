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

/**
 * The two identity-provider hand-offs are full-page navigations to /v1, which
 * the worker never sees. In the mock they land the browser where the real
 * round trip would: Microsoft on the app root, SAML on the callback page, each
 * with a persona the boot consumes. The deploy config carries the same rule.
 */
export const AUTH_REDIRECTS: Array<{ source: string; destination: string }> = [
  { source: "/v1/auth/microsoft", destination: "/?persona=admin@photonlegal.test" },
  { source: "/v1/auth/saml/login", destination: "/auth/saml/callback?persona=counsel@acme.test" },
];
const redirectMiddleware = (server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void }, next: () => void) => void) => void } }) => {
  server.middlewares.use((req, res, next) => {
    const hit = AUTH_REDIRECTS.find((r) => (req.url ?? "").split("?")[0] === r.source);
    if (!hit) return next();
    res.statusCode = 302; res.setHeader("Location", hit.destination); res.end();
  });
};

const swapEntry = (): Plugin => ({
  name: "pulse-design-entry",
  configureServer: redirectMiddleware,
  configurePreviewServer: redirectMiddleware,
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
