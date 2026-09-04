/**
 * DSN-0003 radius gate. The five-step radius scale in src/styles/tokens.json is
 * the only source of corners: Tailwind's theme.borderRadius carries exactly the
 * scale, every `rounded-*` utility in product files names a step of it, and no
 * product file writes a raw `border-radius`. The react-pdf document is the one
 * exception: it renders a PDF and cannot read a CSS variable.
 * @tier:v0
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { radius } from "../../src/styles/tokens.tailwind";

const STEPS = ["xs", "sm", "md", "lg", "full"] as const;
const walk = (dir: string, out: string[] = []) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(f.name) && !/^tokens\.(css|tailwind\.ts)$/.test(f.name)) out.push(p);
  }
  return out;
};
const EXEMPT = new Set([
  // Renders a PDF through react-pdf; its StyleSheet cannot read a CSS variable.
  "src/components/ideas/PatentReportDocument.tsx",
  // Off-limits for a design branch (AGENTS.md); its chunk-reload fallback button still says `rounded`, recorded as a production finding in DSN-0003.
  "src/App.tsx",
]);
const files = walk("src").filter((f) => !EXEMPT.has(f));
const read = (f: string) => readFileSync(f, "utf8");

// `rounded`, `rounded-xl`, `rounded-t-2xl`, `rounded-[5px]` ... anything that is not a step of the scale, `none` or `inherit`.
const LEGACY_UTILITY = /(?<![\w-])rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?(?:-(?!(?:xs|sm|md|lg|full|none)(?![\w-]))(?:[a-z0-9]+|\[(?!inherit\])[^\]]*\]))?(?![\w-])/g;
const TOKEN_VAR = /^var\(--pl-radius-(?:xs|sm|md|lg|full)\)$/;
/** `border-radius: <value>;` in css or a style string; the value must be a token variable, `!important` allowed. */
const rawCss = (s: string) => [...s.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1].replace(/!important/, "").trim()).filter((v) => !TOKEN_VAR.test(v));
/** `borderRadius: <expr>` in a style object; the expression must be `radius.<step>`, a quoted token variable or "inherit". */
const rawInline = (s: string) => [...s.matchAll(/borderRadius\s*:\s*([^,}\n]+)/g)].map((m) => m[1].trim()).filter((v) => !/^(?:radius\.(?:xs|sm|md|lg|full)|["'`]var\(--pl-radius-(?:xs|sm|md|lg|full)\)["'`]|["']inherit["'])$/.test(v));

describe("the radius scale is the only source of corners", () => {
  it("has the five steps of DSN-0003", () => {
    expect(Object.keys(radius)).toEqual([...STEPS]);
    expect(radius).toEqual({ xs: "4px", sm: "6px", md: "8px", lg: "12px", full: "9999px" });
  });
  it("Tailwind's borderRadius theme is exactly the scale", () => {
    const cfg = read("tailwind.config.ts");
    const block = /borderRadius:\s*\{([\s\S]*?)\n\s*\},/.exec(cfg)?.[1] ?? "";
    const keys = [...block.matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1]);
    expect(keys).toEqual(["none", ...STEPS]);
    for (const s of STEPS.filter((s) => s !== "full")) expect(block).toContain(`var(--pl-radius-${s}`);
  });
  it("no product file uses a legacy or arbitrary rounded utility", () => {
    const hits: string[] = [];
    // Comment prose ("merely rounded") is not a class: lines that are only a comment are skipped.
    const code = (l: string) => !/^\s*(?:\/\/|\/?\*)/.test(l);
    for (const f of files) for (const line of read(f).split("\n").entries()) if (code(line[1])) for (const m of line[1].matchAll(LEGACY_UTILITY)) hits.push(`${f}:${line[0] + 1} ${m[0]}`);
    expect(hits, "use rounded-xs|sm|md|lg|full|none").toEqual([]);
  });
  it("no product file writes a raw border-radius", () => {
    const hits: string[] = [];
    for (const f of files) {
      const s = read(f);
      for (const v of [...rawCss(s), ...rawInline(s)]) hits.push(`${f}: ${v}`);
    }
    expect(hits, "reference var(--pl-radius-*) or radius.<step>").toEqual([]);
  });
  it("the generated css carries every step", () => {
    const css = read("src/styles/tokens.css");
    for (const s of STEPS) expect(css).toContain(`--pl-radius-${s}: ${radius[s]};`);
    expect(css).toContain(`--radius: ${radius.sm};`);
  });
});
