/**
 * Renders design/v0/coverage.json as design/v0/COVERAGE.md so a person can read
 * the V0 coverage matrix without parsing JSON. The V0 semantic gate fails when
 * the rendered file is stale.
 *   node tools/design/v0-coverage.mjs           # check
 *   node tools/design/v0-coverage.mjs --write   # rewrite COVERAGE.md
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = "design/v0/coverage.json";
const OUT = "design/v0/COVERAGE.md";

export function render(c) {
  const label = (p) => c.personas[p]?.label ?? p;
  const lines = [];
  lines.push("# V0 coverage matrix");
  lines.push("");
  lines.push(`Generated from \`${SRC}\` by \`tools/design/v0-coverage.mjs\`; do not edit by hand. Product context version ${c.contextVersion}. One section per brief in product-context/surfaces. A story id is an intention: the story exists only when its DSN record creates the production-shaped component, and the \`dsn\` column stays empty until then.`);
  lines.push("");
  lines.push("## Personas and navigation");
  lines.push("");
  lines.push("| Persona | Backend role | Navigation | Badge |");
  lines.push("|---|---|---|---|");
  for (const [key, p] of Object.entries(c.personas)) {
    const badge = c.badges[key] ? Object.entries(c.badges[key]).map(([item, kind]) => `${item}: ${kind}`).join(", ") : "none";
    lines.push(`| ${p.label} | ${p.backendRole} | ${(c.navigation[key] ?? []).join(" · ")} | ${badge} |`);
  }
  lines.push("");
  lines.push(`Excluded from V0 everywhere: ${c.excludedFeatures.join(", ")}.`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Surface | Personas | Routes | Scenarios | Story ids | Backend impact | DSN |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const s of c.surfaces) lines.push(`| ${s.title} | ${s.personas.map(label).join(", ")} | ${s.routes.map((r) => `\`${r.path}\``).join(", ")} | ${s.scenarios.length} | ${s.storyIds.length} | ${s.backendImpact} | ${s.dsn ?? ""} |`);
  lines.push("");
  const totals = { surfaces: c.surfaces.length, stories: c.surfaces.reduce((n, s) => n + s.storyIds.length, 0), scenarios: new Set(c.surfaces.flatMap((s) => s.scenarios)).size, conceptual: c.surfaces.filter((s) => s.backendImpact === "conceptual").length, unwired: c.surfaces.filter((s) => s.backendImpact === "unwired").length };
  lines.push(`${totals.surfaces} surfaces, ${totals.stories} intended stories, ${totals.scenarios} V0 scenarios; backend impact conceptual on ${totals.conceptual}, unwired on ${totals.unwired}, none on ${totals.surfaces - totals.conceptual - totals.unwired}.`);
  lines.push("");
  for (const s of c.surfaces) {
    lines.push(`## ${s.title}`);
    lines.push("");
    lines.push(`Brief: \`product-context/${s.brief}\` · Storybook title: \`${s.storyTitle}\` · DSN: ${s.dsn ?? "none yet"}`);
    lines.push("");
    lines.push(`- **Personas:** ${s.personas.map(label).join(", ")}`);
    lines.push(`- **User goal:** ${s.userGoal}`);
    lines.push(`- **Business goal:** ${s.businessGoal}`);
    lines.push(`- **Routes:** ${s.routes.map((r) => `\`${r.path}\` (${r.personas.map(label).join(", ")}${r.exists ? "" : ", new"})${r.note ? ` — ${r.note}` : ""}`).join("; ")}`);
    lines.push(`- **Required scenarios:** ${s.scenarios.map((n) => `\`${n}\``).join(", ")}`);
    lines.push(`- **States:** loading — ${s.states.loading}; empty — ${s.states.empty}; success — ${s.states.success}; error — ${s.states.error}; permission — ${s.states.permission}`);
    lines.push(`- **Surface-specific states:** ${s.states.specific.join(", ")}`);
    lines.push(`- **Navigation badge:** ${s.badge === "none" ? "none" : `${s.badge} for ${(s.badgePersonas ?? []).map(label).join(", ")}`}`);
    lines.push(`- **Backend impact:** ${s.backendImpact} — ${s.backendNotes}`);
    lines.push(`- **Intended story ids:** ${s.storyIds.map((id) => `\`${id}\``).join(", ")}`);
    lines.push(`- **Excluded here:** ${s.excludes.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const coverage = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const text = render(coverage);
  if (process.argv.includes("--write")) { fs.writeFileSync(OUT, text); console.log(`wrote ${OUT}`); }
  else if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text) { console.error(`${OUT} is stale; run node tools/design/v0-coverage.mjs --write`); process.exit(1); }
  else console.log(`${OUT} is current`);
}
