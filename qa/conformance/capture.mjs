/**
 * Capture one page's STRUCTURE: the aria projection plus a curated
 * computed-style projection over the nodes that projection matched.
 *
 * Two things this deliberately does not do.
 *
 * 1. It does not screenshot. See qa/lib/conformance.mjs for why.
 * 2. It does not compute the style key itself from the DOM. The style probe
 *    re-finds each node through `getByRole(role, { name, exact: true })`, so
 *    the accessible name used to key a style is computed by exactly the same
 *    engine that produced the aria snapshot. A hand-rolled DOM-side name
 *    computation would drift from playwright's and silently key styles onto
 *    the wrong node.
 */
import { parseAria, project } from '../lib/conformance.mjs';

/**
 * Curated on purpose. Every property here answers a question someone would
 * actually ask in review - "is this the right type scale / weight / colour /
 * radius / spacing / layout mode" - and nothing here is data-dependent.
 * Widths, heights and positions are excluded: they move with content length,
 * which is exactly what this tier refuses to compare.
 */
const STYLE_PROPS = [
  'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
  'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
  'textTransform', 'textAlign', 'color', 'backgroundColor',
  'borderRadius', 'borderTopWidth', 'borderBottomWidth', 'borderColor',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginBottom', 'opacity',
];

/** Roles worth a style probe: the ones a designer would point at. */
const STYLED_ROLES = new Set(['heading', 'columnheader', 'button', 'link', 'tab', 'textbox', 'searchbox', 'combobox', 'checkbox']);

/** Probing every control on a 300-node page costs more than it teaches. */
const MAX_STYLE_PROBES = 70;

export async function captureStructure(page, { path, role, settleMs = 2500 } = {}) {
  await page.waitForTimeout(settleMs);
  const snapshot = await page.locator('body').ariaSnapshot({ boxes: true });
  const structure = project(parseAria(snapshot));

  const styles = {};
  const probes = structure.controls.filter((c) => STYLED_ROLES.has(c.role)).slice(0, MAX_STYLE_PROBES);
  for (const c of probes) {
    try {
      const loc = page.getByRole(c.role, { name: c.name, exact: true }).first();
      if (!(await loc.count())) continue;
      const s = await loc.evaluate((el, props) => {
        const cs = getComputedStyle(el);
        const out = {};
        for (const p of props) out[p] = cs[p];
        // Font family is a stack; only the first entry is a decision.
        out.fontFamily = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
        return out;
      }, STYLE_PROPS);
      styles[c.sig] = s;
    } catch {
      // A control that moved, unmounted or became ambiguous between the
      // snapshot and the probe is not a style finding - its presence is
      // already asserted by the signature set. Skipping keeps this tier from
      // inventing flake it would then have to suppress.
    }
  }

  return {
    path,
    role,
    signatures: structure.signatures,
    spine: structure.spine,
    tables: structure.tables,
    styles,
  };
}

/** Deterministic on-disk form: sorted keys, one snapshot per file, newline at
 * the end so a git diff of a baseline is readable. */
export function serialise(structure) {
  const ordered = {
    path: structure.path,
    role: structure.role,
    tables: structure.tables,
    spine: structure.spine,
    signatures: structure.signatures,
    styles: Object.fromEntries(Object.keys(structure.styles).sort().map((k) => [k, sortKeys(structure.styles[k])])),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
