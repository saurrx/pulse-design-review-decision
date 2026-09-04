import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type UserConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import designConfig from "./vite.design.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production now owns Vitest 4 and colocated component stories. The design fork
 * keeps those stories and adds its node fidelity/V0 projects plus the mock-aware
 * Storybook catalogue. Role-aware stories remain serial because frames share a
 * cookie origin; the isolation probe is the authority for changing that rule.
 */
export default async () => {
  const base = (await (designConfig as unknown as (env: { command: "serve"; mode: string }) => UserConfig | Promise<UserConfig>)({ command: "serve", mode: "test" })) as UserConfig;
  return mergeConfig(base, defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: { name: "fidelity", environment: "node", include: ["qa/fidelity/**/*.test.ts"], setupFiles: ["qa/fidelity/setup.ts"] },
        },
        {
          extends: true,
          test: { name: "v0", environment: "node", include: ["qa/v0/**/*.test.ts"], setupFiles: ["qa/fidelity/setup.ts"] },
        },
        {
          extends: true,
          plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
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
            browser: { enabled: true, headless: true, provider: playwright({}), instances: [{ browser: "chromium" }] },
            fileParallelism: false,
            testTimeout: 30_000,
          },
        },
      ],
    },
  }));
};
