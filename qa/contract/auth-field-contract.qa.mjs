/**
 * Every auth screen states an invalid field the same way. @tier:contract @area:auth @sec:a11y @cp:pre-deploy
 *
 *   node qa/contract/auth-field-contract.qa.mjs        (static; no browser needed)
 *
 * The five auth screens used to disagree with each other in three ways a user
 * could see, and all three survived because nothing compared them:
 *
 *  - Login, Signup and Invite rendered the message as
 *    `<p className="text-red-400 fixed text-xs mt-1">`. `fixed` is
 *    `position: fixed`, so the message was laid out against the VIEWPORT, took
 *    no space in the flow, and overlapped whatever followed it.
 *  - Nothing reserved room for a message, so on the two screens where it WAS in
 *    flow the submit button jumped down the moment one appeared.
 *  - `aria-invalid` was never set on any auth input. The classNames carried
 *    `aria-invalid:border-destructive` variants that nothing could ever
 *    trigger, so the border stayed neutral while the text below said the value
 *    was wrong — and a screen reader was told nothing at all.
 *
 * There was also a timing bug underneath: bare Formik defaults meant tabbing
 * out of an empty field scolded the user before they had submitted anything,
 * while `disabled={!isValid}` meant that once errors DID wait for a submit the
 * button could never be pressed to produce them. The two have to move together.
 *
 * This is the static half, and it runs in the build job where no browser
 * exists. The behaviour was measured in a real browser at 1440x900 when it
 * landed: before submit both messages empty and `aria-invalid` null even with
 * an invalid email typed and blurred; after submit both messages present with
 * the border at rgb(220,38,38); card height 714px identical before and after,
 * i.e. nothing moved; and fixing the value cleared both live.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const AUTH = join(SRC, 'pages', 'auth');

// IHCLogin is not routed anywhere (nothing in App.tsx renders it) and survives
// only because ResetPassword imports a type from it. It is a stale-code
// question, not an auth screen, so it is out of scope here rather than
// silently exempted.
const SKIP = new Set(['AuthField.tsx', 'IHCLogin.tsx']);
const screens = readdirSync(AUTH).filter(f => f.endsWith('.tsx') && !SKIP.has(f));

const failures = [];
const fail = (f, why) => failures.push(`${f}: ${why}`);

for (const f of screens) {
  const s = readFileSync(join(AUTH, f), 'utf8');

  // 1. One way to render a field. A raw <Input> is how the three variants got in.
  if (/<Input\b/.test(s)) fail(f, 'renders a raw <Input>; auth fields go through <AuthField>');

  // 2. The specific defect: an error message taken out of the flow.
  if (/className="[^"]*\btext-red-\d+\b[^"]*\bfixed\b|className="[^"]*\bfixed\b[^"]*\btext-red-\d+\b/.test(s)) {
    fail(f, 'error message is position:fixed — it will overlap the next control');
  }

  // 3. Errors answer a submit. A screen with a form must gate them on it.
  if (/useFormik\(/.test(s)) {
    if (!/validateOnChange:\s*submitted/.test(s) || !/validateOnBlur:\s*submitted/.test(s)) {
      fail(f, 'useFormik does not gate validation on `submitted` — errors will appear before the first submit');
    }
    if (!/setSubmitted\(true\)/.test(s)) fail(f, 'nothing sets `submitted`, so validation can never turn on');
    if (/disabled=\{!isValid/.test(s)) {
      fail(f, 'submit is disabled on !isValid — with errors gated on submit, the user could never trigger them');
    }
    if (/error=\{(?!submitted \?)/.test(s)) fail(f, 'an AuthField error is not gated on `submitted`');
  }
}

// 4. The shared field must actually carry the state it promises.
const field = readFileSync(join(AUTH, 'AuthField.tsx'), 'utf8');
if (!/aria-invalid=\{invalid/.test(field)) failures.push('AuthField.tsx: does not set aria-invalid');
if (!/aria-describedby=/.test(field)) failures.push('AuthField.tsx: message is not tied to the input');
if (!/border-red-\d+/.test(field)) failures.push('AuthField.tsx: invalid state does not paint the border');
if (!/min-h-\[\d+px\]/.test(field)) failures.push('AuthField.tsx: message slot reserves no height — the layout will jump');
// The message node must be unconditional; a `&&` around it is the height back.
if (!/\{error \?\? ""\}/.test(field)) failures.push('AuthField.tsx: message node is conditional — reserved space is not reserved');

console.log(`auth field contract — ${screens.length} screens checked\n`);
if (failures.length) {
  console.error(`${failures.length} failure(s):\n`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
for (const f of screens) console.log(`  ok   ${f}`);
console.log('\none field component, one error state, and it waits for the submit');
