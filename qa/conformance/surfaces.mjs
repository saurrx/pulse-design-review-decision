/**
 * What the conformance tier looks at, and who it looks as.
 *
 * ROLE COVERAGE IS DELIBERATELY UNEVEN, and the reason is worth stating once
 * so nobody "fixes" it later: the designer's reference implementation
 * (saurrx/pulse-design-auto @3f9b2fdb) has FOUR roles, this product has six.
 *
 *   design OC_ADMIN   -> PHOTON_ADMIN
 *   design IHC_ADMIN  -> LEGAL_COUNSEL
 *   design CASE_OWNER -> CASE_OWNER
 *   design INVENTOR   -> INVENTOR
 *   TECH_COMMITTEE     - NO design equivalent (invented here, CLAUDE.md §4)
 *   PHOTON_SUPERADMIN  - NO design equivalent, and no demo account either
 *
 * So TECH_COMMITTEE is captured into our baseline but was never compared
 * against a reference, and PHOTON_SUPERADMIN is not captured at all. Neither
 * gap is a finding; inventing a comparison for them would be.
 */

/** Our role -> the design persona whose `pl_user` cookie reproduces it. */
export const DESIGN_PERSONA = {
  PHOTON_ADMIN: {
    id: 'user-oc-1', name: 'Alex Morgan', email: 'oc@photonlegal.com',
    role: 'OC_ADMIN', client_id: 'photon-legal', organization_name: 'Photon Legal',
    verified: true, active: true, client: null, employeeId: 'PL-001',
  },
  CASE_OWNER: {
    id: 'user-case-owner-1', name: 'Morgan Ellis', email: 'morgan.ellis@photonlegal.com',
    role: 'CASE_OWNER', client_id: 'photon-legal', organization_name: 'Photon Legal',
    verified: true, active: true, client: null, employeeId: 'PL-014',
    assigned_client_ids: ['client-1', 'client-3'],
  },
  LEGAL_COUNSEL: {
    id: 'user-ihc-1', name: 'Priya Sharma', email: 'priya@acmerobotics.com',
    role: 'IHC_ADMIN', client_id: 'client-1', clientId: 'client-1',
    organization_name: 'Acme Robotics', verified: true, active: true,
    client: { id: 'client-1', name: 'Acme Robotics', logo_file: null }, employeeId: 'ACME-101',
  },
  INVENTOR: {
    id: 'user-inv-1', name: 'Rahul Verma', email: 'rahul@acmerobotics.com',
    role: 'INVENTOR', client_id: 'client-1', clientId: 'client-1',
    organization_name: 'Acme Robotics', verified: true, active: true,
    client: { id: 'client-1', name: 'Acme Robotics', logo_file: null }, employeeId: 'ACME-204',
  },
};

/**
 * `design: false` marks a surface that exists only here, so the one-time
 * design diff skips it instead of reporting the whole page as missing.
 * The role lists mirror qa/invariant/layout.qa.mjs: a role that cannot reach
 * a page must not be asked to.
 */
export const SURFACES = [
  { path: '/',          roles: ['PHOTON_ADMIN', 'CASE_OWNER', 'LEGAL_COUNSEL', 'TECH_COMMITTEE', 'INVENTOR'] },
  { path: '/ideas',     roles: ['PHOTON_ADMIN', 'CASE_OWNER', 'LEGAL_COUNSEL', 'TECH_COMMITTEE', 'INVENTOR'] },
  { path: '/patents',   roles: ['PHOTON_ADMIN', 'CASE_OWNER', 'LEGAL_COUNSEL', 'TECH_COMMITTEE', 'INVENTOR'] },
  { path: '/due-dates', roles: ['PHOTON_ADMIN', 'CASE_OWNER', 'LEGAL_COUNSEL', 'TECH_COMMITTEE'] },
  { path: '/actions',   roles: ['PHOTON_ADMIN', 'CASE_OWNER', 'LEGAL_COUNSEL'] },
  { path: '/clients',   roles: ['PHOTON_ADMIN', 'CASE_OWNER'] },
  { path: '/workspace', roles: ['PHOTON_ADMIN', 'LEGAL_COUNSEL'] },
  // Profile left the workspace and became its own route here (CLAUDE.md §10);
  // the design has no such route, so there is nothing to compare it against.
  { path: '/profile',   roles: ['PHOTON_ADMIN', 'CASE_OWNER', 'LEGAL_COUNSEL', 'TECH_COMMITTEE', 'INVENTOR'], design: false },
];

/** The roles that have a design counterpart at all. */
export const COMPARABLE_ROLES = Object.keys(DESIGN_PERSONA);

/** One viewport. The invariant tier already walks two; conformance is about
 * shape, and shape does not change between 1280 and 1440 in a desktop-only
 * app - capturing both would double the runtime to re-prove that. */
export const VIEWPORT = { width: 1440, height: 900 };

export const key = (role, path) => `${role}${path === '/' ? '/index' : path}`.replace(/\//g, '_').replace(/^_/, '');
