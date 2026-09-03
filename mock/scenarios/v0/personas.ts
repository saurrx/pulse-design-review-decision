import { mulberry32, seedFrom, uuid } from "../../runtime/prng";
import { clock } from "../../runtime/clock";
import type { Client, ClientAccess, User } from "../../runtime/types";
import type { RoleName } from "../../../contract/enums";

/**
 * V0 personas. Exactly four: Inventor, Workspace Admin, Case Owner and Photon
 * Admin (product-context/PERSONAS.md). Each signs in as the backend role that
 * carries its permissions today; the Workspace Admin is LEGAL_COUNSEL in the
 * contract and "Workspace Admin" everywhere a person can read it. No V0 client
 * runs a technical committee, so every review is one Workspace Admin stage.
 * Reserved .test domains, synthetic names, no credential anywhere.
 */
const rng = mulberry32(seedFrom("pulse-design.v0.personas.v1"));
const id = () => uuid(rng);

const client = (name: string, domain: string, prefix: string, ageDays: number, opts: Partial<Client> = {}): Client => ({
  id: id(), name, domain, has_tech_committee: false, idea_reference_prefix: prefix, type: "EXISTING", plan: "ENTERPRISE", is_active: true,
  about: null, logo_file_id: null, created_at: clock.daysAgo(ageDays), updated_at: clock.daysAgo(2), ...opts,
});

/** An established workspace: two Workspace Admins, several inventors, a portfolio. */
export const NORTHWIND = client("Northwind Instruments", "northwind.test", "NWI", 320, { about: "Precision measurement instruments for process industries." });
/** A workspace onboarded six weeks ago: one Workspace Admin, no inventors yet. */
export const BEACON = client("Beacon Health Systems", "beacon.test", "BHS", 42);
/** A potential client without a Case Owner or a Workspace Admin: the Photon exception. */
export const ORBITAL = client("Orbital Foods", "orbital.test", "ORB", 9, { type: "POTENTIAL" });
export const V0_CLIENTS: Client[] = [NORTHWIND, BEACON, ORBITAL];

const user = (email: string, name: string, role: RoleName, c: Client | null, opts: Partial<User> = {}): User => ({
  id: id(), email, name, role, status: "ACTIVE", client_id: c?.id ?? null, assigned_client_ids: [],
  phone: null, country_code: null, country_name: null, address: null,
  notification_prefs: { reviewDecisions: true, informationRequests: true, filingUpdates: true },
  last_login_at: clock.hoursAgo(6), created_at: clock.daysAgo(200), updated_at: clock.daysAgo(1), ...opts,
});

export const V0_USERS = {
  // Inventors at Northwind
  inventor: user("inventor@northwind.test", "Anika Sharma", "INVENTOR", NORTHWIND, { country_code: "DE", country_name: "Germany" }),
  coinventor: user("coinventor@northwind.test", "Mateo Ruiz", "INVENTOR", NORTHWIND),
  newInventor: user("new.inventor@northwind.test", "Ines Duarte", "INVENTOR", NORTHWIND, { last_login_at: clock.hoursAgo(1), created_at: clock.daysAgo(2) }),
  invitedInventor: user("invited@northwind.test", "Kwame Mensah", "INVENTOR", NORTHWIND, { status: "INVITED", last_login_at: null, created_at: clock.daysAgo(3) }),
  suspendedInventor: user("former@northwind.test", "Ivan Novak", "INVENTOR", NORTHWIND, { status: "SUSPENDED", last_login_at: clock.daysAgo(90) }),
  // Workspace Admins (LEGAL_COUNSEL in the contract)
  admin: user("admin@northwind.test", "Leah Feldman", "LEGAL_COUNSEL", NORTHWIND),
  admin2: user("admin2@northwind.test", "Noor Rahman", "LEGAL_COUNSEL", NORTHWIND, { created_at: clock.daysAgo(30) }),
  beaconAdmin: user("admin@beacon.test", "Elin Sørensen", "LEGAL_COUNSEL", BEACON, { last_login_at: clock.daysAgo(9), created_at: clock.daysAgo(41) }),
  // Photon Legal
  caseOwner: user("caseowner@photonlegal.test", "Devika Nair", "CASE_OWNER", null),
  caseOwner2: user("caseowner2@photonlegal.test", "Jonas Weber", "CASE_OWNER", null, { created_at: clock.daysAgo(4) }),
  photonAdmin: user("photonadmin@photonlegal.test", "Tobias Berg", "PHOTON_ADMIN", null),
} as const;

V0_USERS.caseOwner.assigned_client_ids = [NORTHWIND.id, BEACON.id];

export const V0_ACCESS: ClientAccess[] = [
  { id: id(), user_id: V0_USERS.caseOwner.id, client_id: NORTHWIND.id, kind: "ASSIGNMENT", is_primary: true, reason: null, expires_at: null, granted_at: clock.daysAgo(300), revoked_at: null },
  { id: id(), user_id: V0_USERS.caseOwner.id, client_id: BEACON.id, kind: "ASSIGNMENT", is_primary: true, reason: null, expires_at: null, granted_at: clock.daysAgo(5), revoked_at: null },
];

export const V0_ALL_USERS: User[] = Object.values(V0_USERS);

/** The four V0 persona names, keyed by the backend role that carries each one. */
export const V0_PERSONA_LABELS: Partial<Record<RoleName, string>> = {
  INVENTOR: "Inventor",
  LEGAL_COUNSEL: "Workspace Admin",
  CASE_OWNER: "Case Owner",
  PHOTON_ADMIN: "Photon Admin",
};
export const V0_ROLES = Object.keys(V0_PERSONA_LABELS) as RoleName[];
export const personaLabel = (role: RoleName) => V0_PERSONA_LABELS[role] ?? role;
