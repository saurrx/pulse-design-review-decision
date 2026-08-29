/**
 * The conformance tier's engine: turn a page into a STRUCTURE, and diff two
 * structures.
 *
 * Why structure and not pixels. This tier was born as a one-time
 * reconciliation against the designer's reference implementation, and the two
 * apps hold completely different data - different clients, different patents,
 * different people. A screenshot diff between them is 100% noise. What is
 * actually comparable is the SHAPE: which roles exist, what they are called,
 * which columns a table has, what order the sections come in, and what
 * typography the matched nodes carry.
 *
 * The bug this exists to catch is real and already happened here: a Due Dates
 * `Action` column was dropped and two roles silently lost the ability to pick
 * any action. Nothing failed. A columnheader is a structural signature, so its
 * disappearance is a set difference - which is exactly what `diff()` reports.
 *
 * Everything here is pure: no playwright, no network, no fs. `capture.mjs`
 * feeds it an aria snapshot string; the tier and the one-time design diff both
 * consume the same output.
 */

/* ---------- 1. parse the aria snapshot ------------------------------------
 * Playwright's ariaSnapshot({ boxes: true }) emits a YAML-ish tree:
 *
 *   - main [box=288,0,1152,900]:
 *     - heading "Actions" [level=1] [box=458,21,53,22]
 *     - button "List view" [pressed] [box=1187,18,28,28]
 *     - paragraph [box=320,23,113,18]: Photon Legal
 *     - link "Overview":
 *       - /url: /
 *
 * It is NOT YAML - names carry playwright's own escaping and the `- /url:`
 * lines are properties, not children - so it is parsed directly rather than
 * through a YAML library. Two spaces per level, always.
 */
const LINE_RE = new RegExp(
  '^(?<indent>\\s*)-\\s' +
  '(?<role>\\/?[A-Za-z][\\w-]*)' +
  '(?:\\s"(?<name>(?:[^"\\\\]|\\\\.)*)")?' +
  '(?<attrs>(?:\\s\\[[^\\]]*\\])*)' +
  '(?::(?<inline>.*))?$'
);

const ATTR_RE = /\[([^\]=]+)(?:=([^\]]*))?\]/g;

const unescapeName = (s) => s.replace(/\\(.)/g, '$1');

export function parseAria(snapshot) {
  const root = { role: '#root', name: null, attrs: {}, box: null, text: '', children: [], depth: -1 };
  const stack = [root];
  for (const rawLine of String(snapshot).split('\n')) {
    if (!rawLine.trim()) continue;
    const m = LINE_RE.exec(rawLine);
    if (!m) {
      // A wrapped continuation line (a name containing a newline). Append it
      // to the node being built rather than dropping it: silently losing text
      // would make two different pages look identical.
      const top = stack[stack.length - 1];
      if (top && top !== root) top.text = `${top.text} ${rawLine.trim()}`.trim();
      continue;
    }
    const depth = m.groups.indent.length / 2;
    const attrs = {};
    let box = null;
    for (const a of (m.groups.attrs ?? '').matchAll(ATTR_RE)) {
      const k = a[1].trim();
      const v = a[2] === undefined ? true : a[2].trim();
      if (k === 'box') box = String(v).split(',').map(Number);
      else attrs[k] = v;
    }
    const node = {
      role: m.groups.role,
      name: m.groups.name === undefined ? null : unescapeName(m.groups.name),
      attrs,
      box,
      text: (m.groups.inline ?? '').trim(),
      children: [],
      depth,
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return root;
}

/* ---------- 2. normalise away the data ------------------------------------
 * The two apps share no data at all, so any comparison has to erase it first.
 * Order matters: dates before numbers, or "Aug 4, 2026" degrades to "aug #, #"
 * and stops matching the same date written any other way.
 */
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

export function normText(input) {
  let s = String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase();
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>');
  s = s.replace(new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'g'), '<date>');
  s = s.replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?\\s+\\d{4}\\b`, 'g'), '<date>');
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '<date>');
  s = s.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, '<date>');
  s = s.replace(new RegExp(`\\b${MONTH}\\.?\\s+\\d{4}\\b`, 'g'), '<date>');
  s = s.replace(/\b\d+\s*(?:second|minute|hour|day|week|month|year)s?\s+ago\b/g, '<ago>');
  s = s.replace(/[$£€₹]\s?\d[\d,.]*/g, '<money>');
  s = s.replace(/\d[\d,./:-]*%?/g, '#');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/* Roles whose accessible name is a LABEL the product chose - comparable.
 * Everything else is a container or a data carrier. This split is the whole
 * trick: `columnheader "Due Date"` is a promise the UI makes, `cell "Aug 4,
 * 2026"` is a row that happened to load. */
export const STRUCTURAL_ROLES = new Set([
  'heading', 'columnheader', 'button', 'link', 'tab', 'checkbox', 'radio',
  'menuitem', 'menuitemcheckbox', 'menuitemradio', 'textbox', 'searchbox',
  'combobox', 'switch', 'slider', 'spinbutton', 'option', 'tooltip',
  'alert', 'alertdialog', 'dialog', 'navigation', 'banner', 'complementary',
  'contentinfo', 'main', 'form', 'search', 'region', 'tablist', 'progressbar',
]);

/* Data carriers: presence and shape are compared, never their text. */
export const DATA_ROLES = new Set([
  'cell', 'gridcell', 'rowheader', 'row', 'listitem', 'paragraph', 'text',
  'img', 'strong', 'emphasis', 'article', 'time', 'status', 'code', 'blockquote',
]);

/* Named ancestors under which even a "structural" role is really per-row data:
 * a row's edit button is named after its row. Presence still counts; the name
 * does not. */
const DATA_CONTAINERS = new Set(['row', 'listitem', 'article', 'cell', 'gridcell']);

/* Inside these, nothing is data. The sidebar is a list of listitems and the
 * primary navigation is the single most important set of labels on the page -
 * anonymising "Due Dates" because it is the fourth <li> would throw away the
 * comparison this tier exists to make. */
const CHROME_LANDMARKS = new Set(['navigation', 'banner', 'complementary', 'contentinfo']);

const LANDMARKS = ['main', 'navigation', 'banner', 'complementary', 'contentinfo', 'form', 'search', 'tablist', 'table', 'grid'];

/* Roles that may be treated as a repeated data block on their own (period 1).
 * `button` is pointedly absent: a toolbar of Sort / Columns / Export is three
 * consecutive buttons, and anonymising it would delete the labels that matter
 * most while "detecting a list". */
const REPEATABLE_ALONE = new Set(['heading', 'listitem', 'article', 'row', 'link', 'img', 'paragraph', 'cell', 'gridcell']);

/* ...except when the repeated node has internal structure. The review queue
 * renders each disclosure as a <button> wrapping a heading, and three of those
 * in a row is a list of records, not a toolbar. A heading (or paragraph, or
 * article) inside is the thing a toolbar button never has. */
const STRUCTURED_CHILD = new Set(['heading', 'paragraph', 'article', 'table', 'grid', 'list']);

/* ...and only for roles a record card is actually built from. A landmark is
 * never a record: this app renders two toast regions side by side, each
 * wrapping a list, and without this they were "a repeated block of two" and
 * lost their names. */
const CARD_ROLES = new Set(['button', 'link', 'listitem', 'article', 'row', 'group', 'figure']);

const hasStructuredChild = (node, depth = 2) =>
  depth > 0 && node.children.some((c) => STRUCTURED_CHILD.has(c.role) || hasStructuredChild(c, depth - 1));

const isCard = (node) => CARD_ROLES.has(node.role) && hasStructuredChild(node);

/* A record always carries something to read - a heading, a line of text, an
 * avatar. A run of nothing but controls is a control cluster.
 *
 * Without this, the photon dashboard's [Calendar, List][Previous month, Next
 * month] toggle pair matched as a period-2 block repeated three times and lost
 * every one of its labels - the tier quietly stopped asserting four controls
 * while looking perfectly green. Found by the design diff reporting them as
 * "only in the design" when they were plainly on both. */
const PURE_CONTROL_ROLES = new Set([
  'button', 'link', 'tab', 'checkbox', 'radio', 'switch', 'combobox',
  'textbox', 'searchbox', 'option', 'menuitem', 'slider', 'spinbutton',
]);

const carriesContent = (children, start, p) => {
  // A record block never starts OR ends on a control. A card begins and ends
  // with content - an avatar, a title, a status line. A toolbar button sitting
  // immediately before the first card, or a "Review all" link after the last,
  // is how a period-N alignment slides sideways and swallows chrome; pinning
  // both ends fixes the alignment to the cards themselves. Without this the
  // same page recorded a different set of controls depending on how many
  // records happened to be in the list that day.
  if (PURE_CONTROL_ROLES.has(children[start].role)) return false;
  if (PURE_CONTROL_ROLES.has(children[start + p - 1].role)) return false;
  for (let i = start; i < start + p; i++) if (!PURE_CONTROL_ROLES.has(children[i].role)) return true;
  return false;
};

/* Three is the threshold for "this is a list, not a layout" - except for a
 * node that wraps a heading, where two is already conclusive. Chrome does not
 * nest headings inside buttons; record cards do. Keeping three here meant a
 * dashboard whose awaiting-action list happened to hold exactly TWO items
 * recorded both idea titles into the baseline, and the next idea anyone
 * created broke the tier. */
const MIN_REPEATS = 3;
const MIN_REPEATS_CARD = 2;

/**
 * Find the children that belong to a repeated block, e.g. the three client
 * cards on /clients, which the accessibility tree flattens into
 *   img, text, button, heading, img, text, img, text   x3
 * because their wrapper divs carry no role. Those names are data - "Acme
 * Robotics" here, "Aurora Dynamics" there - and comparing them is comparing
 * the seed database.
 *
 * Periods are tried shortest first and a claimed run is not re-claimed, so the
 * card block is found as one period-8 unit rather than as eight period-1 ones.
 */
function repeatedIndices(children) {
  const roles = children.map((c) => c.role);
  const n = roles.length;
  const marked = new Set();
  const seqEq = (a, b, len) => {
    for (let k = 0; k < len; k++) if (roles[a + k] !== roles[b + k]) return false;
    return true;
  };
  for (let p = 1; p <= Math.floor(n / MIN_REPEATS_CARD); p++) {
    let start = 0;
    while (start + MIN_REPEATS_CARD * p <= n) {
      if (marked.has(start)) { start++; continue; }
      let reps = 1;
      while (start + (reps + 1) * p <= n && seqEq(start, start + reps * p, p)) reps++;
      const card = p === 1 && isCard(children[start]);
      const need = card ? MIN_REPEATS_CARD : MIN_REPEATS;
      const block = p >= 2 ? carriesContent(children, start, p) : (card || REPEATABLE_ALONE.has(roles[start]));
      if (reps >= need && block) {
        for (let i = start; i < start + reps * p; i++) marked.add(i);
        start += reps * p;
      } else start++;
    }
  }
  return marked;
}

/* ---------- 3. project a structure ---------------------------------------- */

/**
 * `signatures` - the deduped multiset of structural promises:
 *   heading[1]:actions | columnheader:due date | button:columns
 * A missing column or a missing control is a set difference here. Dedup is on
 * purpose: how MANY rows rendered is data, not shape.
 *
 * `spine` - the ordered landmark/heading skeleton, so a reordered section is
 * visible even when every signature is still present.
 *
 * `tables` - ordered column headers per table plus the body's column count,
 * because a header kept while the body cell is dropped (or the reverse) is a
 * real defect that a set difference alone would miss.
 *
 * `controls` - the structural nodes worth a computed-style probe, one per
 * distinct signature.
 */
export function project(root) {
  const signatures = new Set();
  const spine = [];
  const tables = [];
  const controls = [];

  const walk = (node, dataDepth, inChrome) => {
    const repeated = inChrome || dataDepth > 0 ? null : repeatedIndices(node.children);
    node.children.forEach((child, i) => {
      if (child.role.startsWith('/')) return;            // /url and friends are properties
      const role = child.role;
      const childChrome = inChrome || CHROME_LANDMARKS.has(role);

      // A column header is a promise about the table, never a row of it, even
      // though it lives inside a <tr>. This is the exact signal the dropped
      // Action column would have tripped, so it is never anonymised.
      const inData = role === 'columnheader'
        ? false
        : dataDepth > 0 || (!inChrome && (repeated?.has(i) || DATA_CONTAINERS.has(role)));

      if (role === 'table' || role === 'grid') tables.push(describeTable(child, tables.length));

      if (STRUCTURAL_ROLES.has(role)) {
        const sig = signature(child, inData);
        signatures.add(sig);
        if (!inData && child.name) controls.push({ role, name: child.name, sig });
      } else if (DATA_ROLES.has(role)) {
        signatures.add(`${role}:<data>`);
      } else {
        signatures.add(`${role}:`);
      }

      if (role === 'heading') spine.push(signature(child, inData));
      else if (LANDMARKS.includes(role)) spine.push(`${role}:${inData ? '<data>' : normText(child.name ?? '')}`);

      walk(child, inData && role !== 'columnheader' ? dataDepth + 1 : dataDepth, childChrome);
    });
  };
  walk(root, 0, false);

  return {
    signatures: [...signatures].sort(),
    // Three anonymous cards in a row are one section, not three. Collapsing
    // the run keeps the order check about ORDER instead of about how many rows
    // the database happened to hold.
    spine: spine.filter((s, i) => s !== spine[i - 1]),
    tables,
    controls: dedupeControls(controls),
  };
}

function signature(node, inData) {
  const level = node.attrs.level ? `[${node.attrs.level}]` : '';
  const state = ['disabled', 'checked', 'expanded', 'pressed', 'selected']
    .filter((k) => k in node.attrs).sort().map((k) => `+${k}`).join('');
  const name = inData ? '<data>' : normText(node.name ?? '');
  return `${node.role}${level}:${name}${state}`;
}

function describeTable(node, index) {
  const headers = [];
  const bodyWidths = new Set();
  const visit = (n) => {
    for (const c of n.children) {
      if (c.role === 'columnheader') headers.push(normText(c.name ?? c.text ?? ''));
      if (c.role === 'row') {
        const cells = c.children.filter((x) => x.role === 'cell' || x.role === 'gridcell');
        if (cells.length) bodyWidths.add(cells.length);
      }
      visit(c);
    }
  };
  visit(node);
  return { index, headers, bodyWidths: [...bodyWidths].sort((a, b) => a - b) };
}

/* One style probe per distinct signature: probing the 40th identical row
 * button teaches nothing and costs a round trip. */
function dedupeControls(controls) {
  const seen = new Set();
  const out = [];
  for (const c of controls) {
    if (seen.has(c.sig)) continue;
    seen.add(c.sig);
    out.push(c);
  }
  return out;
}

/* ---------- 4. diff two structures ---------------------------------------
 * Findings are {rule, detail} exactly like the invariant tier, so the same
 * narrow `selContains` exception machinery works over them unchanged.
 */
export function diff(expected, actual, { styles = true } = {}) {
  const findings = [];
  const exp = new Set(expected.signatures ?? []);
  const act = new Set(actual.signatures ?? []);

  for (const s of exp) if (!act.has(s)) findings.push({ rule: 'missing-signature', detail: s });
  for (const s of act) if (!exp.has(s)) findings.push({ rule: 'extra-signature', detail: s });

  // Tables, positionally. A table that vanished entirely is already a
  // missing-signature; this is about its columns.
  const n = Math.max((expected.tables ?? []).length, (actual.tables ?? []).length);
  for (let i = 0; i < n; i++) {
    const e = expected.tables?.[i], a = actual.tables?.[i];
    if (!e) { findings.push({ rule: 'table-added', detail: `table#${i} columns=[${a.headers.join(' | ')}]` }); continue; }
    if (!a) { findings.push({ rule: 'table-removed', detail: `table#${i} columns=[${e.headers.join(' | ')}]` }); continue; }
    if (e.headers.join('') !== a.headers.join('')) {
      const gone = e.headers.filter((h) => !a.headers.includes(h));
      const added = a.headers.filter((h) => !e.headers.includes(h));
      findings.push({
        rule: 'table-columns',
        detail: `table#${i} expected=[${e.headers.join(' | ')}] actual=[${a.headers.join(' | ')}]`
          + (gone.length ? ` dropped=[${gone.join(', ')}]` : '')
          + (added.length ? ` added=[${added.join(', ')}]` : ''),
      });
    }
    // A header row wider than every body row means a column header exists with
    // nothing under it - how a dropped Action column can hide in plain sight.
    if (a.headers.length && a.bodyWidths.length && !a.bodyWidths.includes(a.headers.length)) {
      findings.push({
        rule: 'table-body-width',
        detail: `table#${i} ${a.headers.length} header(s) but body rows carry ${a.bodyWidths.join('/')} cell(s)`,
      });
    }
  }

  // Section order, compared as a subsequence so an ADDED section is not
  // reported as "everything after it moved".
  const spineFinding = spineOrder(expected.spine ?? [], actual.spine ?? []);
  if (spineFinding) findings.push(spineFinding);

  if (styles && expected.styles && actual.styles) {
    for (const [sig, e] of Object.entries(expected.styles)) {
      const a = actual.styles[sig];
      if (!a) continue;                       // its absence is a missing-signature already
      for (const [prop, want] of Object.entries(e)) {
        const got = a[prop];
        if (got === undefined) continue;
        if (String(want) !== String(got)) {
          findings.push({ rule: 'style-drift', detail: `${sig} ${prop}: expected ${want}, actual ${got}` });
        }
      }
    }
  }
  return findings;
}

/**
 * Longest-common-subsequence order check. Reports only how many elements had
 * to move, not the whole tail after an insertion - a naive index comparison
 * turns one added heading into thirty "reordered" findings and the real one is
 * never read.
 */
function spineOrder(expected, actual) {
  const common = expected.filter((x) => actual.includes(x));
  const actualCommon = actual.filter((x) => common.includes(x));
  const moved = common.length - lcsLength(common, actualCommon);
  if (moved <= 0) return null;
  return {
    rule: 'section-order',
    detail: `${moved} section(s) out of order - expected [${common.join(' > ')}] actual [${actualCommon.join(' > ')}]`,
  };
}

function lcsLength(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}
