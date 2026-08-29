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

/**
 * Snapshot until the page stops changing, rather than after a fixed wait.
 *
 * A fixed wait is a bet on how long the slowest query takes, and it loses
 * quietly: a dashboard whose awaiting-action list had not arrived yet recorded
 * a baseline missing two controls, and the very next run reported them as new.
 * A snapshot that equals the previous one is direct evidence the page has
 * settled, which is the thing the wait was trying to approximate.
 */
async function stableSnapshot(page, { settleMs, pollMs = 1000, attempts = 8, stableReads = 2 }) {
  // networkidle again, not just the one at goto(). These pages fire their
  // react-query requests AFTER mount, so the load-time idle happens before the
  // dashboard has asked for anything - which is how a capture came back
  // without the Nudge button that is reliably there a second later.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(settleMs);
  let previous = await page.locator('body').ariaSnapshot({ boxes: true });
  let stable = 0;
  for (let i = 0; i < attempts; i++) {
    await page.waitForTimeout(pollMs);
    const next = await page.locator('body').ariaSnapshot({ boxes: true });
    // TWO consecutive matches, not one. A dashboard chip that arrives a second
    // late holds still just long enough to look settled, and the run that
    // catches it reports a control as missing that is merely slow.
    if (next === previous) { if (++stable >= stableReads) return next; }
    else stable = 0;
    previous = next;
  }
  // Still moving after every attempt. Return the last read rather than
  // throwing: a page with a live clock or a spinner is not a test failure, and
  // whatever is oscillating will show up as a diff for a human to judge.
  return previous;
}

export async function captureStructure(page, { path, role, settleMs = 2000 } = {}) {
  const snapshot = await stableSnapshot(page, { settleMs });
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
