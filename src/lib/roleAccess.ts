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
