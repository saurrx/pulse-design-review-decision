import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig, type UserConfig } from "vite";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import designConfig from "./vite.design.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Story tests run in a real browser through the Vitest addon, on top of the
 * design fork's Vite config (production's config plus the shim aliases). Serial
 * by design: Storybook frames share one origin, so the session cookie and both
 * storages are shared between stories; parallelism is enabled only after the
 * isolation test proves two personas cannot contaminate each other.
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
          test: {
            name: "storybook",
            browser: { enabled: true, headless: true, provider: "playwright", instances: [{ browser: "chromium" }] },
            setupFiles: [".storybook/vitest.setup.ts"],
            fileParallelism: false,
            testTimeout: 30_000,
          },
        },
      ],
    },
  }));
};
