import type { ActionTemplate } from "../runtime/types";
import { EVENT_TYPES } from "./portfolio";

/** A slice of the 195-row action catalogue: enough for every event type in the portfolio generator. */
const rows: Array<[string, string, string, string[], boolean, boolean, number, boolean]> = [
  ["tpl-pay-fee", "Pay the fee", "Instruct Photon Legal to pay the fee before the deadline.", "Maintenance", ["3 1/2 Year Maintenance Fee Due", "7 1/2 Year Maintenance Fee Due", "11 1/2 Year Maintenance Fee Due", "Annuity Payment Due", "Renewal Fee Due", "Grant Fee Due"], false, false, 1, true],
  ["tpl-let-lapse", "Let it lapse", "Do not pay; allow the right to lapse in this jurisdiction.", "Maintenance", ["3 1/2 Year Maintenance Fee Due", "7 1/2 Year Maintenance Fee Due", "11 1/2 Year Maintenance Fee Due", "Annuity Payment Due", "Renewal Fee Due"], false, true, 3, false],
  ["tpl-respond", "Respond to the office action", "Prepare and file a response.", "Prosecution", ["Office Action Response Due", "Response to Examination Report Due"], false, false, 1, true],
  ["tpl-extend", "Request an extension", "File for an extension of time.", "Prosecution", ["Office Action Response Due", "Response to Examination Report Due"], false, true, 2, false],
  ["tpl-abandon", "Abandon the application", "Do not respond; abandon.", "Prosecution", ["Office Action Response Due", "Response to Examination Report Due", "Request for Examination Due"], false, true, 4, false],
  ["tpl-file-foreign", "File in selected countries", "Enter the national phase or claim priority in the selected countries.", "Foreign Expansion", ["Priority Deadline (12m)", "National Phase Entry Due (30m)", "PCT Chapter II Demand Due"], true, false, 1, true],
  ["tpl-no-foreign", "Do not file abroad", "No foreign filing; let the deadline pass.", "Foreign Expansion", ["Priority Deadline (12m)", "National Phase Entry Due (30m)", "PCT Chapter II Demand Due"], false, true, 2, false],
  ["tpl-request-exam", "Request examination", "File the request for examination.", "Formalities", ["Request for Examination Due"], false, false, 1, true],
];
export const ACTION_TEMPLATES: ActionTemplate[] = rows.map(([id, label, description, category, event_types, requires_countries, requires_note, rank_default, is_recommended]) => ({ id, label, description, category, event_types, requires_countries, requires_note, rank_default, is_recommended, enabled: true }));
export const templatesFor = (eventType: string) => ACTION_TEMPLATES.filter((t) => t.event_types.includes(eventType)).sort((a, b) => a.rank_default - b.rank_default);
export const EVENT_TYPES_COVERED = EVENT_TYPES.every((e) => ACTION_TEMPLATES.some((t) => t.event_types.includes(e)));
