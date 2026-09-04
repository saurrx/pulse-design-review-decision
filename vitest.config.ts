import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.config";

/**
 * The app's config is a FUNCTION — `defineConfig(({ mode }) => ({ … }))` — and
 * `mergeConfig` refuses a callback ("Cannot merge config in form of callback").
 * Resolve it for the test mode first, so what gets merged is the same resolved
 * object Vite itself would build with.
 */
const resolvedAppConfig = await (typeof viteConfig === "function"
  ? (viteConfig as (env: { mode: string; command: "build" | "serve" }) => unknown)({
      mode: "test",
      command: "serve",
    })
  : viteConfig);

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every story is also a test.
 *
 * `storybookTest` turns each exported story into a Vitest case: it renders in a
 * real Chromium via Playwright, runs the story's `play` function if it has one,
 * and fails on an accessibility violation because `preview.tsx` sets
 * `a11y: { test: "error" }`. A story with no play function still asserts
 * something real — that the component mounts with those props without throwing,
 * which is the check that would have caught an unstyled or unprovided context.
 *
 * It merges the APP's vite config, so the `@` alias and the plugin chain are
 * identical to production. A Storybook that resolves modules differently from
 * the app can go green on code the app cannot build.
 *
 * There is no `setupFiles` entry. Since Storybook 10.3 `@storybook/addon-vitest`
 * applies `.storybook/preview.tsx`'s annotations — the stylesheets, the theme
 * decorator, the a11y parameter — by itself, and a setup file calling
 * `setProjectAnnotations` makes it SKIP that automatic wiring and warn on every
 * run. Deleted rather than silenced.
 *
 * Headless and chromium-only on purpose: this runs in CI's browser tier
 * alongside the journeys, and the repo has a 400-minute monthly budget. Cross
 * browser is Chromatic's job if it is ever wanted, not this file's.
 */
export default mergeConfig(
  resolvedAppConfig as Parameters<typeof mergeConfig>[0],
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
          // ONE copy of React. Vite's dependency optimizer pre-bundles on demand,
          // and the first story to import a Radix package (dropdown-menu, popover)
          // made it pre-bundle a SECOND React for that graph — every hook in that
          // story then threw "Cannot read properties of null (reading 'useState')".
          // Listing them up front means one pre-bundle, one React.
          optimizeDeps: {
            include: [
              "react", "react-dom", "react/jsx-runtime", "react-dom/client",
              "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover",
              "@radix-ui/react-tooltip", "@radix-ui/react-dialog", "@radix-ui/react-label",
              "lucide-react",
            ],
          },
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              provider: playwright({}),
              headless: true,
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  }),
);
