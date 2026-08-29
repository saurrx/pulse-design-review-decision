/**
 * Photon-side administration.
 *
 * PHOTON_SUPERADMIN belongs here and was missing everywhere except
 * realAdapter: the API grants a founder every capability and serves them all
 * 82 clients, while the UI gated on allow-lists that named PHOTON_ADMIN
 * literally — so the one role with unbounded reach was redirected off
 * /clients and /workspace and saw LESS product than a Head of Patents
 * (F-028). The schema comment predicted exactly this: the tier exists "so
 * access checks account for it rather than treating a founder as a Head of
 * Patents".
 */
export const isOCAdminRole = (role?: string | null) =>
  role === "PHOTON_ADMIN" || role === "PHOTON_SUPERADMIN";

export const isCaseOwnerRole = (role?: string | null) => role === "CASE_OWNER";

// Both firm roles use the outside-counsel product experience. The distinction
// is scope: OC admins see the whole tenant, while case owners see only the
// clients assigned to their session.
export const isOutsideCounselRole = (role?: string | null) =>
  isOCAdminRole(role) || isCaseOwnerRole(role);

export const canManageFirmAccess = (role?: string | null) =>
  isOCAdminRole(role);

export const canOperateCases = (role?: string | null) =>
  isOutsideCounselRole(role);

/**
 * The client-wide operations docket (/actions) — every patent's deadlines and
 * the instruction standing against each.
 *
 * Mirrors the backend capability `docket:read`. An INVENTOR is excluded: they
 * legitimately read their OWN filings, but the docket is the whole portfolio,
 * and an inventor holding `asset:read` was enough to return 104 rows of
 * colleagues' application numbers (F-026). Kept as an explicit deny-list of one
 * rather than an allow-list, so a role added later inherits docket access only
 * if someone also grants it the capability server-side — where the real
 * decision lives.
 */
export const canReadDocket = (role?: string | null) => role !== "INVENTOR";
