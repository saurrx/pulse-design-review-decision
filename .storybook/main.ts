import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import { DESIGN_ALIASES } from "../mock/runtime/aliases.mjs";

/**
 * Storybook reuses production's vite.config.ts (the framework loads it) plus
 * the design fork's aliases, so the Google OAuth shim applies here too. The
 * worker script is served from public/, exactly as in the full app.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../design/stories/**/*.stories.@(ts|tsx)", "../design/stories/**/*.mdx"],
  staticDirs: ["../public"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest", "msw-storybook-addon"],
  core: { disableTelemetry: true },
  viteFinal: async (cfg) => {
    const merged = mergeConfig(cfg, { resolve: { alias: DESIGN_ALIASES } });
    if (merged.server) delete (merged.server as { proxy?: unknown }).proxy;
    return merged;
  },
};
export default config;
