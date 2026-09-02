/**
 * Which email addresses are offered the SSO hand-off.
 *
 * This is a UX guardrail and NOTHING MORE. It decides who sees the button work,
 * not who gets in — Okta decides who can authenticate, and the API's own rule
 * decides who gets an account (an unknown email is provisioned only if its
 * domain belongs to an onboarded client). Someone who edits this list in their
 * browser gets sent to Okta and bounced, which is the correct outcome.
 *
 * It exists because there is ONE IdP for the whole product: sending a user
 * whose organisation does not use it to a login page they cannot pass is worse
 * than telling them up front. When per-tenant IdPs land (docs/plan.md,
 * `idp_connection`), this list is replaced by the domain claim on the
 * connection and should be deleted rather than kept in step.
 */
export const SSO_ALLOWED_DOMAINS: readonly string[] = ["automationanywhere.com"];

/** One-offs, so a single person can be enabled without opening their domain. */
export const SSO_ALLOWED_EMAILS: readonly string[] = [
  "saurabh@photonlegal.com",
  "developer@photonlegal.com",
];

export function ssoAllows(rawEmail: string): boolean {
  const email = rawEmail.trim().toLowerCase();
  if (SSO_ALLOWED_EMAILS.some((e) => e.toLowerCase() === email)) return true;
  const domain = email.split("@")[1];
  return Boolean(domain) && SSO_ALLOWED_DOMAINS.some((d) => d.toLowerCase() === domain);
}

/** Where the API begins the SP-initiated flow. Same-origin on purpose: the app
 *  proxies /v1 to the API, which is what keeps the session cookie first-party. */
export const SSO_START_URL = "/v1/auth/saml/login";
