import { mulberry32, seedFrom, uuid, pick, type Rng } from "../runtime/prng";
import { clock } from "../runtime/clock";
import type { Client, DueDate, Patent, PortfolioSpec } from "../runtime/types";

/**
 * Deterministic portfolios. A tenant's patents and deadlines are generated from
 * a seed on demand and memoised for the session; nothing of that size is ever
 * written to the store or to local storage. Realistic shape: jurisdictions,
 * statuses, event names with slashes, dates around the mock clock.
 */
const WORDS = [["Adaptive", "Modular", "Low-latency", "Self-aligning", "Thermally stable", "Distributed", "Compact", "Recyclable", "Passive", "Hybrid"],
  ["cable harness", "torque estimator", "gripper finger", "encoder housing", "battery dock", "path planner", "lidar shield", "strain sensor", "ceramic filter", "composite panel", "adhesive system", "resin dispenser", "conveyor coupling", "vision calibration rig", "thermal lattice"],
  ["for articulated joints", "for warehouse robots", "for molten metals", "for panel assembly", "for cold-chain logistics", "with closed-loop correction", "with passive alignment", "for fast-charge cabinets", "for field maintenance", "for composite spars"]];
const JURISDICTIONS = ["US", "US", "US", "EP", "EP", "IN", "JP", "CN", "KR", "DE", "GB", "CA", "AU", "BR"];
const STATUSES: Array<Patent["status"]> = ["GRANTED", "GRANTED", "GRANTED", "APPLIED", "APPLIED", "EXAMINATION", "EXAMINATION", "EXPIRED", "WITHDRAWN", "ABANDONED", "NONPAYMENT", "REJECTED"];
const TAGS = ["core", "platform", "defensive", "licensing", "standards", "priority", "family-lead", "divisional"];
export const EVENT_TYPES = ["3 1/2 Year Maintenance Fee Due", "7 1/2 Year Maintenance Fee Due", "11 1/2 Year Maintenance Fee Due", "Office Action Response Due", "Annuity Payment Due", "Priority Deadline (12m)", "National Phase Entry Due (30m)", "Request for Examination Due", "Renewal Fee Due", "Response to Examination Report Due", "PCT Chapter II Demand Due", "Grant Fee Due"];
const INVENTOR_NAMES = ["P. Raman", "D. Osei", "H. Kobayashi", "L. Voss", "M. Okafor", "T. Ibarra", "A. Novak", "S. Lindqvist", "R. Menon", "J. Sato", "C. Dubois", "N. Adeyemi"];

const memo = new Map<string, { patents: Patent[]; dueDates: DueDate[]; byId: Map<string, Patent>; dueById: Map<string, DueDate> }>();

const appNumber = (rng: Rng, jur: string, year: number) => {
  const n = Math.floor(rng() * 900000 + 100000);
  if (jur === "US") return `${String(year).slice(2)}/${String(n).padStart(6, "0")}`;
  if (jur === "EP") return `EP${String(year).slice(2)}${String(n).padStart(6, "0")}`;
  if (jur === "IN") return `${year}${String(n).padStart(8, "0")}`;
  return `${jur}${year}${String(n).padStart(6, "0")}`;
};

export function generatePortfolio(client: Client, spec: PortfolioSpec) {
  const key = `${client.id}:${spec.seed}:${spec.count}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const rng = mulberry32(seedFrom(key));
  const patents: Patent[] = []; const dueDates: DueDate[] = [];
  const nowMs = clock.now();
  for (let i = 0; i < spec.count; i++) {
    const jur = pick(rng, JURISDICTIONS);
    const status = pick(rng, STATUSES);
    const filedDaysAgo = Math.floor(rng() * 365 * 12) + 30;
    const filing = new Date(nowMs - filedDaysAgo * 86_400_000);
    const granted = status === "GRANTED" ? new Date(filing.getTime() + (700 + Math.floor(rng() * 900)) * 86_400_000) : null;
    const title = `${pick(rng, WORDS[0])} ${pick(rng, WORDS[1])} ${pick(rng, WORDS[2])}`;
    const tags = rng() < 0.55 ? [pick(rng, TAGS)].concat(rng() < 0.25 ? [pick(rng, TAGS)] : []) : [];
    const id = uuid(rng);
    const patent: Patent = {
      id, client_id: client.id, title,
      application_number: appNumber(rng, jur, filing.getUTCFullYear()), jurisdiction: jur, status,
      filing_date: filing.toISOString(), grant_date: granted ? granted.toISOString() : null,
      tags: [...new Set(tags)], abstract: rng() < 0.7 ? `${title}. The disclosure covers a ${pick(rng, WORDS[1])} arranged so that recalibration is unnecessary under sustained load.` : null,
      assignee_original: spec.assignee, current_assignee: spec.assignee,
      inventors: [pick(rng, INVENTOR_NAMES)].concat(rng() < 0.4 ? [pick(rng, INVENTOR_NAMES)] : []),
      simple_family_members: rng() < 0.3 ? [appNumber(rng, pick(rng, JURISDICTIONS), filing.getUTCFullYear())] : [],
      ipc_all_versions: [`B25J ${9 + Math.floor(rng() * 10)}/${Math.floor(rng() * 20)}`],
      priority_details: rng() < 0.3 ? `Priority ${jur} ${filing.getUTCFullYear() - 1}` : null,
      additional_notes: null, current_status: status, prn: rng() < 0.5 ? `PRN-${Math.floor(rng() * 9000 + 1000)}` : null, oc: rng() < 0.5 ? "Photon Legal" : null,
      next_steps_gpo: status === "EXAMINATION" ? ["Respond to office action"] : [], next_steps_legal: status === "APPLIED" ? ["Await examination report"] : [],
      status_timeline_history: [{ status: "APPLIED", date: filing.toISOString() }].concat(granted ? [{ status: "GRANTED", date: granted.toISOString() }] : []),
      deleted_at: null, created_at: filing.toISOString(), updated_at: new Date(nowMs - Math.floor(rng() * 90) * 86_400_000).toISOString(),
    };
    patents.push(patent);
    const events = status === "EXPIRED" || status === "WITHDRAWN" || status === "ABANDONED" ? 0 : Math.round(spec.dueDatesPerPatent * (0.5 + rng()));
    for (let k = 0; k < events; k++) {
      const offsetDays = Math.floor(rng() * 400) - 60;                     // some overdue, most upcoming
      const due = new Date(nowMs + offsetDays * 86_400_000);
      const type = pick(rng, EVENT_TYPES);
      dueDates.push({ id: uuid(rng), patent_id: id, client_id: client.id, event_type: type, title: type, due_at: due.toISOString(), status: offsetDays < -20 && rng() < 0.6 ? "COMPLETED" : "PENDING", created_at: patent.created_at, updated_at: patent.updated_at });
    }
  }
  const entry = { patents, dueDates, byId: new Map(patents.map((p) => [p.id, p])), dueById: new Map(dueDates.map((d) => [d.id, d])) };
  memo.set(key, entry);
  return entry;
}

export const clearPortfolioMemo = () => memo.clear();
