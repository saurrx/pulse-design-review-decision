import { mulberry32, seedFrom, uuid } from "../runtime/prng";
import { clock } from "../runtime/clock";
import type { Client, ClientAccess, User } from "../runtime/types";

/**
 * Personas mirror the backend seed so designer and developer talk about the
 * same accounts: Acme runs a tech committee, Globex does not, Helix is a
 * smaller third tenant for the Photon views. Photon staff have no tenant.
 * Reserved .test domains only, and no credential anywhere: the mock login
 * accepts a known email with any password.
 */
const rng = mulberry32(seedFrom("pulse-design.personas.v2"));
const id = () => uuid(rng);
const client = (name: string, domain: string, has_tech_committee: boolean, prefix: string, plan: Client["plan"], ageDays: number): Client => ({
  id: id(), name, domain, has_tech_committee, idea_reference_prefix: prefix, type: "EXISTING", plan, is_active: true, about: null, logo_file_id: null, created_at: clock.daysAgo(ageDays), updated_at: clock.daysAgo(3),
});
export const ACME = client("Acme Robotics", "acme.test", true, "ACME", "ENTERPRISE", 400);
export const GLOBEX = client("Globex Materials", "globex.test", false, "GLX", "ENTERPRISE", 220);
export const HELIX = client("Helix Biotech", "helix.test", true, "HLX", "FREE", 60);
export const CLIENTS = [ACME, GLOBEX, HELIX];

const user = (email: string, name: string, role: User["role"], c: Client | null, opts: Partial<User> = {}): User => ({
  id: id(), email, name, role, status: "ACTIVE", client_id: c?.id ?? null, assigned_client_ids: [],
  phone: null, country_code: null, country_name: null, address: null,
  notification_prefs: { reviewDecisions: true, informationRequests: true, filingUpdates: true },
  last_login_at: clock.hoursAgo(5), created_at: clock.daysAgo(180), updated_at: clock.daysAgo(1), ...opts,
});

export const USERS = {
  inventor: user("inventor@acme.test", "Priya Raman", "INVENTOR", ACME, { phone: "+91 98450 11223", country_code: "IN", country_name: "India" }),
  coinv: user("coinv@acme.test", "Daniel Osei", "INVENTOR", ACME),
  newdev: user("newdev@acme.test", "Hana Kobayashi", "INVENTOR", ACME, { last_login_at: null, created_at: clock.daysAgo(2) }),
  invited: user("invited@acme.test", "Ama Boateng", "INVENTOR", ACME, { status: "INVITED", last_login_at: null }),
  suspended: user("former@acme.test", "Ivan Petrov", "INVENTOR", ACME, { status: "SUSPENDED" }),
  committee: user("committee@acme.test", "Tomás Ibarra", "TECH_COMMITTEE", ACME),
  committee2: user("committee2@acme.test", "Wei Zhang", "TECH_COMMITTEE", ACME),
  counsel: user("counsel@acme.test", "Mara Okafor", "LEGAL_COUNSEL", ACME),
  globexInventor: user("inventor@globex.test", "Lena Voss", "INVENTOR", GLOBEX),
  globexInventor2: user("inventor2@globex.test", "Omar Haddad", "INVENTOR", GLOBEX),
  globexCounsel: user("counsel@globex.test", "Jun Sato", "LEGAL_COUNSEL", GLOBEX),
  helixInventor: user("inventor@helix.test", "Sara Lindgren", "INVENTOR", HELIX),
  helixCommittee: user("committee@helix.test", "Ravi Iyer", "TECH_COMMITTEE", HELIX),
  helixCounsel: user("counsel@helix.test", "Grace Mwangi", "LEGAL_COUNSEL", HELIX),
  owner: user("owner@photonlegal.test", "Ravi Menon", "CASE_OWNER", null),
  cover: user("cover@photonlegal.test", "Sofia Lindqvist", "CASE_OWNER", null),
  admin: user("admin@photonlegal.test", "Mu Yang", "PHOTON_ADMIN", null),
  founder: user("founder@photonlegal.test", "Anand Krishnan", "PHOTON_SUPERADMIN", null),
} as const;

// Case-owner reach: owner covers Acme and Globex, cover covers Globex and (temporarily) Helix.
USERS.owner.assigned_client_ids = [ACME.id, GLOBEX.id];
USERS.cover.assigned_client_ids = [GLOBEX.id, HELIX.id];

export const ACCESS: ClientAccess[] = [
  { id: id(), user_id: USERS.owner.id, client_id: ACME.id, kind: "ASSIGNMENT", is_primary: true, reason: null, expires_at: null, granted_at: clock.daysAgo(300), revoked_at: null },
  { id: id(), user_id: USERS.owner.id, client_id: GLOBEX.id, kind: "ASSIGNMENT", is_primary: false, reason: null, expires_at: null, granted_at: clock.daysAgo(200), revoked_at: null },
  { id: id(), user_id: USERS.cover.id, client_id: GLOBEX.id, kind: "ASSIGNMENT", is_primary: true, reason: null, expires_at: null, granted_at: clock.daysAgo(150), revoked_at: null },
  { id: id(), user_id: USERS.cover.id, client_id: HELIX.id, kind: "TEMPORARY", is_primary: false, reason: "Covering during onboarding", expires_at: clock.daysAhead(20), granted_at: clock.daysAgo(10), revoked_at: null },
];

export const ALL_USERS: User[] = Object.values(USERS);
