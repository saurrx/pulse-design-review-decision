/**
 * The path classes. Mirrors AGENTS.md; the exporter and the gates read this
 * file, so the rule lives in exactly one place.
 */
import path from "node:path";

const glob = (p) => {
  const esc = p.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // Placeholders keep the single-star replacement from mangling the double-star output.
  const re = esc.replace(/\*\*\//g, "\u0000").replace(/\*\*/g, "\u0001").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*");
  return new RegExp("^" + re + "$");
};

export const CLASSES = {
  portable: ["src/components/**", "src/pages/**", "src/index.css", "src/style.css", "src/styles/**", "public/assets/**", "public/fonts/**"],
  buildImpact: ["index.html", "vite.config.ts", "tailwind.config.ts", "postcss.config.js", "tools/tokens.mjs"],
  behaviourImpact: ["src/lib/roles.ts", "src/utils/patentLegalStatus.ts", "src/contexts/**", "src/hooks/**"],
  reviewSupport: ["design/stories/**", "mock/scenarios/**", "mock/handlers/**", "changes/**", "qa/conformance/baseline-mock/**", "qa/visual/baselines/**", "design/a11y-baseline.json"],
  protected: ["mock/runtime/**", "mock/proposed-routes.json", "product-context/**", "docs/**", ".storybook/**", "design/harness/**", "design/v4/**", "design/inert-hosts.json", "design/manifest-exceptions.json", "tools/design/**", "qa/**", "contract/**", "vite.design.config.ts", "vitest.config.ts", "CLAUDE.md", "AGENTS.md", ".claude/**", "CODEOWNERS", "vercel.json", "package.json", "package-lock.json", ".gitattributes", ".gitignore", ".nvmrc", "public/mockServiceWorker.js"],
  offLimits: ["src/lib/realAdapter.ts", "src/lib/apiConfig.ts", "src/lib/auth.ts", "src/lib/analytics/**", "src/lib/api-service/**", "src/lib/ProtectedRoutes.tsx", "src/lib/PublicRoutes.tsx", "src/App.tsx", "src/main.tsx"],
};

const compiled = Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, v.map(glob)]));

/** Classify one repo-relative path. Order matters: off-limits and protected win over the broad portable globs. */
export function classify(file) {
  const f = file.split(path.sep).join("/");
  for (const cls of ["offLimits", "reviewSupport", "protected", "buildImpact", "behaviourImpact", "portable"]) {
    if (compiled[cls].some((re) => re.test(f))) return cls;
  }
  return "unclassified";
}

export const PATCH_CLASSES = new Set(["portable", "buildImpact", "behaviourImpact"]);
