import React from "react";
import type { Preview } from "@storybook/react-vite";
import { ThemeContext } from "../src/contexts/ThemeContext";
import "../src/index.css";
import "../src/style.css";

/**
 * Both stylesheets, in the app's order.
 *
 * A story rendered without them is a lie: this codebase styles almost entirely
 * through Tailwind utilities plus the `--pulse-*` design tokens defined in
 * `index.css`, so a component loaded bare renders unstyled and any visual
 * assertion made against it is meaningless.
 *
 * WHY THE CONTEXT IS PROVIDED HERE RATHER THAN VIA ThemeProvider.
 * `contexts/ThemeContext.tsx`'s provider hardcodes `theme: 'light'` and a
 * `toggleTheme` that returns undefined — the app ships light-only, and every
 * `theme === "dark" ? … : …` ternary in the product code currently takes the
 * light branch and nothing else (registered in atlas/stale.md as F19). Using
 * that provider would make a "dark" story silently render light, which is worse
 * than having no dark story at all. So the toolbar value is injected straight
 * into the context, which is the ONE place in this repo that can render the
 * dark branch those ternaries were written for.
 */
const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Fail a story on a serious accessibility violation rather than colouring a
    // panel. A warning nobody is required to read is not a control.
    a11y: { test: "error" },
  },
  globalTypes: {
    theme: {
      description: "Pulse theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme ?? "light") as "light" | "dark";
      document.documentElement.classList.toggle("dark", theme === "dark");
      return (
        <ThemeContext.Provider value={{ theme, toggleTheme: () => undefined }}>
          <Story />
        </ThemeContext.Provider>
      );
    },
  ],
};

export default preview;
