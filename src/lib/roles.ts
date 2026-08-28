/**
 * The Pulse role model.
 *
 * These five values are the API's, not this repo's. The design was built
 * against the previous names — `PHOTON_ADMIN` and `LEGAL_COUNSEL` — but its *behaviour*
 * already matched: roleAccess.ts describes OC admins as seeing the whole tenant
 * and case owners only their assigned clients, which is exactly PHOTON_ADMIN
 * and CASE_OWNER; and LEGAL_COUNSEL is rendered as "Administrator" and manages
 * people and invites, which is LEGAL_COUNSEL. So this was a rename, not a
 * redesign.
 *
 * TECH_COMMITTEE has no screens yet — the designer is adding them. It is
 * declared here so guards can account for it rather than silently treating it
 * as an inventor.
 */
export const ROLE = {
  INVENTOR: 'INVENTOR',
  TECH_COMMITTEE: 'TECH_COMMITTEE',
  LEGAL_COUNSEL: 'LEGAL_COUNSEL',
  CASE_OWNER: 'CASE_OWNER',
  PHOTON_ADMIN: 'PHOTON_ADMIN',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const CLIENT_ROLES: Role[] = [ROLE.INVENTOR, ROLE.TECH_COMMITTEE, ROLE.LEGAL_COUNSEL];
export const PHOTON_ROLES: Role[] = [ROLE.CASE_OWNER, ROLE.PHOTON_ADMIN];

/**
 * Visible labels are DELIBERATELY unchanged from the design.
 *
 * Renaming the values is plumbing; renaming what a user reads on screen is a
 * design decision, and this repo is the design's source of truth. The labels
 * move when the designer moves them — together with the TECH_COMMITTEE screens.
 */
export const ROLE_LABEL: Record<string, string> = {
  [ROLE.PHOTON_ADMIN]: 'Photon Legal admin',
  [ROLE.CASE_OWNER]: 'Case Owner',
  [ROLE.LEGAL_COUNSEL]: 'In-house counsel',
  [ROLE.TECH_COMMITTEE]: 'IP Committee',
  [ROLE.INVENTOR]: 'Inventor',
};
