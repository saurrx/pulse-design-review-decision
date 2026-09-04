import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import { DESIGN_ALIASES } from "../mock/runtime/aliases.mjs";

/**
 * One catalogue, two tiers: production's colocated component stories and the
 * design fork's scenario-driven review stories. Storybook still starts from
 * production's Vite config; the only override is the design build's inert
 * service aliases, and the production proxy is removed so no request can leave.
 */
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)", "../design/stories/**/*.stories.@(ts|tsx)", "../design/stories/**/*.mdx"],
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
