import { mulberry32, seedFrom, uuid } from "../runtime/prng";
import { clock } from "../runtime/clock";
import type { Client, User } from "../runtime/types";

/**
 * Personas mirror the backend seed so designer and developer talk about the
 * same accounts: Acme runs a tech committee, Globex does not; Photon staff
 * have no tenant. Reserved .test domains only, and no credential anywhere:
 * the mock login accepts a known email with any password.
 */
const rng = mulberry32(seedFrom("pulse-design.personas.v1"));
const id = () => uuid(rng);

export const ACME: Client = { id: id(), name: "Acme Robotics", domain: "acme.test", has_tech_committee: true, idea_reference_prefix: "ACME", type: "EXISTING", plan: "ENTERPRISE", is_active: true, logo_file: null, created_at: clock.daysAgo(400), updated_at: clock.daysAgo(3) };
export const GLOBEX: Client = { id: id(), name: "Globex Materials", domain: "globex.test", has_tech_committee: false, idea_reference_prefix: "GLX", type: "EXISTING", plan: "ENTERPRISE", is_active: true, logo_file: null, created_at: clock.daysAgo(220), updated_at: clock.daysAgo(9) };
export const CLIENTS = [ACME, GLOBEX];

const user = (email: string, name: string, role: User["role"], client: Client | null, assigned: Client[] = []): User => ({
  id: id(), email, name, role, status: "ACTIVE", client_id: client?.id ?? null, assigned_client_ids: assigned.map((c) => c.id),
  last_login_at: clock.hoursAgo(5), created_at: clock.daysAgo(180), updated_at: clock.daysAgo(1),
});

export const USERS = {
  inventor: user("inventor@acme.test", "Priya Raman", "INVENTOR", ACME),
  coinv: user("coinv@acme.test", "Daniel Osei", "INVENTOR", ACME),
  newdev: user("newdev@acme.test", "Hana Kobayashi", "INVENTOR", ACME),
  committee: user("committee@acme.test", "Tomás Ibarra", "TECH_COMMITTEE", ACME),
  counsel: user("counsel@acme.test", "Mara Okafor", "LEGAL_COUNSEL", ACME),
  globexInventor: user("inventor@globex.test", "Lena Voss", "INVENTOR", GLOBEX),
  globexCounsel: user("counsel@globex.test", "Jun Sato", "LEGAL_COUNSEL", GLOBEX),
  owner: user("owner@photonlegal.test", "Ravi Menon", "CASE_OWNER", null, [ACME, GLOBEX]),
  cover: user("cover@photonlegal.test", "Sofia Lindqvist", "CASE_OWNER", null, [GLOBEX]),
  admin: user("admin@photonlegal.test", "Mu Yang", "PHOTON_ADMIN", null),
  founder: user("founder@photonlegal.test", "Anand Krishnan", "PHOTON_SUPERADMIN", null),
} as const;

export const ALL_USERS: User[] = Object.values(USERS);
