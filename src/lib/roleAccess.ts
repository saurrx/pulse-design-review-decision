export const isOCAdminRole = (role?: string | null) => role === "PHOTON_ADMIN";

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
