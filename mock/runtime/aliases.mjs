// Shared by vite.design.config.ts and .storybook/main.ts. Plain JS with an explicit
// extension so Node can load it natively when Storybook reads its config.
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export const DESIGN_ALIASES = {
  "@react-oauth/google": path.resolve(here, "shims/google-oauth.tsx"),
};
