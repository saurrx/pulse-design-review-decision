import { uuid, type Rng } from "../../runtime/prng";
import { clock } from "../../runtime/clock";
import type { Db, Draft, EmailKind, EmailRecord, Idea, User } from "../../runtime/types";
export type { EmailKind, EmailRecord };

/**
 * The activation and reminder emails of product-context/WORKFLOWS.md section 9,
 * derived from a scenario's data so every V0 scenario carries the outbox its
 * state implies. Conceptual: the backend has no mailer (backend finding BF-3,
 * mock/proposed-fields.json). The outbox exists so stories and the full app
 * can show "what the person received" states; nothing is ever sent.
 */

type Data = Omit<Db, "scenario" | "seedVersion">;
const hoursAfter = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 3_600_000).toISOString();

const PENDING: Idea["state"][] = ["LEGAL_REVIEW"];

export function outboxFor(rng: Rng, data: Data): EmailRecord[] {
  const out: EmailRecord[] = [];
  const push = (to: User, kind: EmailKind, subject: string, primary_action: EmailRecord["primary_action"], reason: string, sent_at: string) =>
    out.push({ id: uuid(rng), kind, to_user_id: to.id, to_email: to.email, subject, primary_action, reason, sent_at });
  const ideasBy = (u: User) => data.ideas.filter((i) => i.author_id === u.id || data.inventors.some((x) => x.idea_id === i.id && x.inventor_id === u.id));
  const draftOf = (i: Idea): Draft | undefined => data.drafts.find((d) => d.idea_id === i.id);
  const completion = (d: Draft | undefined) => Number((d?.answers as { __completion?: number } | undefined)?.__completion ?? (d?.status === "SUBMITTED" ? 100 : 0));

  for (const client of data.clients) {
    const admins = data.users.filter((u) => u.client_id === client.id && u.role === "LEGAL_COUNSEL");
    const inventors = data.users.filter((u) => u.client_id === client.id && u.role === "INVENTOR");
    const clientIdeas = data.ideas.filter((i) => i.client_id === client.id);
    const pending = clientIdeas.filter((i) => PENDING.includes(i.state)).sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));

    for (const admin of admins) {
      push(admin, "admin-invite", `You have been added to ${client.name} on Pulse`, { label: "Sign in to your workspace", path: "/login" }, "Invite and login email on creation.", admin.created_at);
      if (!admin.last_login_at || admin.last_login_at < clock.daysAgo(1)) push(admin, "admin-login-reminder-24h", `Your ${client.name} workspace is ready`, { label: "Sign in", path: "/login" }, "24-hour login reminder.", hoursAfter(admin.created_at, 24));
      if (inventors.length === 0) push(admin, "admin-no-inventors", `Add the first inventors to ${client.name}`, { label: "Invite inventors", path: "/workspace" }, "No inventors: add inventors.", clock.daysAgo(1));
      else if (clientIdeas.length === 0) push(admin, "admin-inventors-no-idea", "Invite the first idea", { label: "Send the first-submission invitation", path: "/workspace" }, "Inventors added but no idea yet.", clock.daysAgo(1));
      const newest = pending.at(-1);
      if (newest) push(admin, "admin-new-idea-review", `New idea to review: ${newest.title}`, { label: "Review now", path: `/ideas/${newest.id}` }, "A new idea arrived for review.", newest.submitted_at ?? clock.iso());
      if (pending.length) push(admin, "admin-weekly-pending-digest", `${pending.length} idea${pending.length === 1 ? "" : "s"} waiting for your review`, { label: "Open the review queue", path: "/ideas" }, "Weekly pending-review digest with the count in the subject and the oldest age in the body.", clock.daysAgo(0));
      if (clientIdeas.length) push(admin, "admin-seven-day-digest", `This week at ${client.name}: ${clientIdeas.filter((i) => i.created_at > clock.daysAgo(7)).length} new idea${clientIdeas.filter((i) => i.created_at > clock.daysAgo(7)).length === 1 ? "" : "s"}`, { label: "See the ideas", path: "/ideas" }, "Seven-day idea digest with a login call to action.", clock.daysAgo(2));
    }

    for (const inv of inventors) {
      push(inv, "inventor-invite", `You are invited to submit ideas at ${client.name}`, { label: "Accept the invitation", path: "/invite" }, "Invite and login email.", inv.created_at);
      if (!inv.last_login_at) { push(inv, "inventor-login-reminder-24h", "Your invitation is waiting", { label: "Sign in", path: "/login" }, "24-hour login reminder.", hoursAfter(inv.created_at, 24)); continue; }
      const mine = ideasBy(inv);
      const teammateSubmission = clientIdeas.find((i) => i.author_id !== inv.id && i.submitted_at && i.submitted_at > clock.daysAgo(14));
      if (mine.length === 0) {
        if (teammateSubmission) push(inv, "inventor-teammate-submission", "A colleague just submitted an idea", { label: "Submit an idea", path: "/" }, "Teammate-submission social proof.", teammateSubmission.submitted_at!);
        push(inv, "inventor-browsed-no-start", "Three ways to start an idea in ten minutes", { label: "Start with what you have", path: "/" }, "Browsed but did not start: how to submit.", clock.daysAgo(1));
        continue;
      }
      for (const idea of mine) {
        const d = draftOf(idea);
        if (idea.state === "DRAFT") {
          const c = completion(d);
          const evaluated = data.evaluations.some((e) => e.draft_id === d?.id && (e.state === "SUCCEEDED" || e.state === "PARTIAL"));
          if (evaluated) push(inv, "inventor-evaluated-not-submitted", `Your evaluation for “${idea.title}” is ready`, { label: "Submit for review", path: `/ideas/${idea.id}/draft` }, "Evaluated but not submitted: send for review.", clock.daysAgo(1));
          else if (c === 0) push(inv, "inventor-clicked-no-draft", "Your idea is one paste away", { label: "Return to your idea", path: `/ideas/${idea.id}/draft` }, "Clicked submit but created no content: how to start.", clock.daysAgo(1));
          else if (c < 100) push(inv, "inventor-half-draft", `Finish “${idea.title}”`, { label: "Return and finish", path: `/ideas/${idea.id}/draft` }, "Half-completed draft: return and finish.", clock.daysAgo(1));
        } else if (idea.submitted_at) {
          push(inv, "inventor-submitted-confirmation", `“${idea.title}” is with your Workspace Admin`, { label: "See what happens next", path: `/ideas/${idea.id}` }, "Submitted: confirmation and next steps.", idea.submitted_at);
        }
      }
    }
  }
  return out.sort((a, b) => a.sent_at.localeCompare(b.sent_at));
}
