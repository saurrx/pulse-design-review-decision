/**
 * Layout invariants, asserted against the live DOM.
 *
 * These exist because a pixel baseline could not have caught any of the layout
 * bugs this project actually shipped. A baseline diff tells you a page CHANGED;
 * every one of those bugs was wrong on the day it was written, so the baseline
 * would have been captured wrong and then defended the bug forever.
 *
 * What these assert instead is that the page obeys rules that are true of every
 * correct page, with no reference image involved:
 *
 *   horizontal-overflow  a table wider than its container   (patents page)
 *   page-overflow        viewport arithmetic under a header (the 64px overhang)
 *   clipped-text         text taller than its overflow:hidden box
 *   unbounded-list       a list rendering without a scroll container
 *
 * Each rule returns violations with enough detail to find the element, because
 * "something overflows on /patents" is not actionable.
 */

/** Runs inside the page. Must be self-contained — no closure over Node scope. */
export const COLLECT = () => {
  const path = (el) => {
    const bits = [];
    for (let n = el; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { bits.unshift(`${s}#${n.id}`); break; }
      const cls = (n.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      bits.unshift(s);
    }
    return bits.join(' > ');
  };
  const scrolls = (cs) => /(auto|scroll)/.test(cs.overflowX + cs.overflowY);

  const out = { horizontalOverflow: [], clippedText: [], unboundedList: [], page: {} };
  const vw = document.documentElement.clientWidth;

  out.page = {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  };

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // Only `hidden` counts. This rule was first written to fire on any
    // scrollWidth > clientWidth and produced 402 violations across 62 pages —
    // useless, because a check that fires everywhere gets ignored.
    //
    // The distinction that matters is whether content is UNREACHABLE:
    //   overflow-x: visible  paints outside the box; nothing is lost, and if
    //                        it pushes the document wide the page-level rule
    //                        catches it. Not a bug.
    //   overflow-x: auto|scroll  the user can scroll to it. Not a bug.
    //   overflow-x: hidden   the content is cut off and cannot be reached.
    //                        That is the bug.
    const ellipsis = cs.textOverflow === 'ellipsis';
    if (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1 && !ellipsis) {
      out.horizontalOverflow.push({
        sel: path(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
        overflowX: cs.overflowX, text: (el.textContent || '').trim().slice(0, 50),
      });
    }

    if (cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 1
        && cs.textOverflow !== 'ellipsis' && !/line-clamp/.test(el.className || '')) {
      const txt = (el.textContent || '').trim();
      // A leaf-ish box whose own text is taller than it. Containers with many
      // children are excluded: their overflow is a layout choice, not lost
      // text. `-webkit-line-clamp` is deliberate truncation, like ellipsis.
      if (txt.length > 12 && el.childElementCount < 3) {
        out.clippedText.push({ sel: path(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, text: txt.slice(0, 60) });
      }
    }

    if ((el.tagName === 'UL' || el.tagName === 'OL' || el.getAttribute('role') === 'list')
        && el.childElementCount > 25) {
      let scrollable = false;
      for (let n = el; n; n = n.parentElement) if (scrollable = scrolls(getComputedStyle(n))) break;
      if (!scrollable) out.unboundedList.push({ sel: path(el), rows: el.childElementCount });
    }
  }
  return out;
};

export function evaluate(raw, { allow = [] } = {}) {
  const violations = [];
  const permitted = (sel) => allow.some(a => sel.includes(a));

  for (const v of raw.horizontalOverflow) {
    if (permitted(v.sel)) continue;
    violations.push({ rule: 'clipped-horizontal', detail:
      `${v.sel} hides ${v.scrollWidth - v.clientWidth}px of content (${v.scrollWidth} > ${v.clientWidth})${v.text ? ` — "${v.text}…"` : ''}` });
  }
  for (const v of raw.clippedText) {
    if (permitted(v.sel)) continue;
    violations.push({ rule: 'clipped-text', detail: `${v.sel} clips "${v.text}…"` });
  }
  for (const v of raw.unboundedList) {
    if (permitted(v.sel)) continue;
    violations.push({ rule: 'unbounded-list', detail: `${v.sel} renders ${v.rows} rows with no scroll container` });
  }
  // The 64px overhang: the page measured itself against the VIEWPORT while
  // sitting below a 64px header inside <main>, so every page overhung by
  // exactly that much and left a phantom strip of scroll.
  if (raw.page.scrollWidth > raw.page.clientWidth + 1) {
    violations.push({ rule: 'page-h-overflow', detail:
      `document scrollWidth ${raw.page.scrollWidth} > clientWidth ${raw.page.clientWidth} — the page body scrolls sideways` });
  }
  return violations;
}
