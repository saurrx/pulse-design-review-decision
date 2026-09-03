import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook 10, React + Vite.
 *
 * It reads the app's own `vite.config.ts` — including the `@` path alias — so a
 * story imports a component exactly the way the app does. There is deliberately
 * no `viteFinal` override: the moment Storybook's build diverges from the app's,
 * a story can pass while the screen it stands for is broken, which is the
 * failure mode this whole harness exists to avoid.
 *
 * Stories live BESIDE the component (`Foo.stories.tsx` next to `Foo.tsx`) rather
 * than in a parallel tree, so a component and its stories move and get deleted
 * together.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  // The app's own index.css/style.css are loaded in preview.ts; nothing here
  // needs a static dir except the two brand assets the auth screens reference.
  staticDirs: ["../public"],
};

export default config;
