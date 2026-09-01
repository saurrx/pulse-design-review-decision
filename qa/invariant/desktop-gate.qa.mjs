/**
 * The desktop gate blocks DEVICES, not zoom levels. @tier:invariant @sec:a11y @cp:pre-deploy
 *
 *   node qa/invariant/desktop-gate.qa.mjs        (static; no browser needed)
 *
 * The gate used to be `lg:hidden` — a pure width test at 1024 CSS pixels. CSS
 * pixels shrink with browser zoom, so a 1440px laptop at 150% reports a 960px
 * viewport and the product told the person sitting at a desktop to go and find
 * a desktop, with no way past it. Zoom is also the first accommodation a person
 * with low vision reaches for, which makes a width-only gate an accessibility
 * failure rather than a rough edge.
 *
 * The condition is now "the primary input is a finger and there is no cursor"
 * (`pointer: coarse` and `hover: none`), plus a hard floor under 640px where
 * nothing can lay this app out on any device.
 *
 * THREE rules share that one condition and must never drift apart, because
 * each half is broken alone:
 *   - `.pulse-desktop-gate` display — the overlay itself.
 *   - the html/body scroll lock — a gate without it leaves the app scrolling
 *     underneath the overlay; a lock without the gate FREEZES a desktop user's
 *     page with no overlay to explain why.
 *   - `body { min-width: 1024px }` — the desktop floor, which must be lifted
 *     exactly where the gate takes over, and must still apply on a zoomed
 *     desktop so the layout keeps its proportions and pans instead of reflowing.
 *
 * Verified in a browser across the real matrix (desktop at 100/125/150/200%
 * zoom, iPhone 13, iPad gen 7): desktop passes at every zoom, every touch
 * device is gated. This gate is the static half — it fails if the shared
 * condition is edited in one place and not the others.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
const gate = readFileSync(join(ROOT, 'src/components/DesktopOnlyGate.tsx'), 'utf8');

/** The device test, as written in the stylesheet. */
const DEVICE = '(max-width: 1023.98px) and (pointer: coarse) and (hover: none)';
const FLOOR = '(max-width: 639.98px)';

const fail = [];
const ok = [];

const has = (label, cond) => (cond ? ok : fail).push(label);

// 1. The gate is driven by the shared class, not by a width utility.
has('DesktopOnlyGate uses .pulse-desktop-gate', /pulse-desktop-gate/.test(gate));
// The className only — the doc comment above it legitimately NAMES the old
// width utility while explaining why it went, and matching prose made this
// gate fail on its own explanation.
const gateClassName = (gate.match(/className="([^"]*pulse-desktop-gate[^"]*)"/) ?? [])[1] ?? '';
has('the gate element no longer hides on width alone', gateClassName !== '' && !/\blg:hidden\b/.test(gateClassName));

// 2. The gate's own rule names both halves of the condition.
const gateRule = css.slice(css.indexOf('.pulse-desktop-gate'));
const gateMedia = gateRule.slice(0, gateRule.indexOf('min-width: 1024px'));
has('gate shows on a coarse-pointer device', gateMedia.includes(DEVICE));
has('gate shows below the 640px hard floor', gateMedia.includes(FLOOR));

// 3. The scroll lock lives in the SAME media block as the gate's display.
//    Same block is the strongest form of "cannot drift": one edit moves both.
const gateBlockStart = css.indexOf(FLOOR + ',');
const gateBlockEnd = css.indexOf('/* The floor applies wherever', gateBlockStart);
const gateBlock = gateBlockStart > -1 ? css.slice(gateBlockStart, gateBlockEnd) : '';
has('scroll lock shares the gate\'s media block', /overflow:\s*hidden/.test(gateBlock) && /html,/.test(gateBlock));

// 4. The desktop floor is lifted exactly where the gate takes over.
has('min-width floor is lifted on gated devices',
  new RegExp(DEVICE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,80}min-width:\\s*0').test(css));

// 5. Nothing reintroduces a bare width gate.
has('no bare max-width:1023.98px scroll lock outside the shared block',
  (css.match(/@media \(max-width: 1023\.98px\)\s*\{/g) ?? []).length === 0);

console.log(`desktop-gate: ${ok.length} rule(s) hold`);
for (const o of ok) console.log('  ok   ' + o);
if (fail.length) {
  console.log(`\n${fail.length} broken:`);
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('\nThe gate, the scroll lock and the desktop floor share one condition.');
  console.log('Editing one without the others locks out a zoomed desktop or freezes its page.');
  process.exit(1);
}
console.log('\nthe gate blocks devices, not zoom levels');
