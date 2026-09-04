# Authoritative V0 Workflows

## 1. Access and activation

### Self-signup

```text
User enters work email
→ Pulse verifies an onboarded allowed domain
→ User authenticates by supported method
→ User enters the correct workspace and role
→ Activation journey begins
```

An unknown or unapproved domain does not gain access and receives a clear next
step rather than an ambiguous failure.

### Invitation

Workspace Admin or Case Owner shares an invitation by email, short link, QR,
bulk email paste, or inventor CSV. The invited user authenticates using Google
or Microsoft. Password may be set later from Profile when supported.

## 2. Inventor submission

```text
Home: Submit an idea
→ Enter title, paste content, or upload source material
→ Pulse extracts and maps supported material
→ Structured invention disclosure opens
→ Prefilled answers are visibly distinguished
→ Inventor fills gaps and may use copilot help
→ Optional Evaluate idea
→ Inventor reviews completeness
→ Submit for review at any score
→ Confirmation explains what happens next
```

Evaluation must never become a hidden submission requirement.

## 3. Evaluation

```text
Inventor clicks Evaluate idea
→ Running/progress feedback
→ Assessment (0–10 patentability score, band label, plus meaning)
→ What appears different
→ How to strengthen
→ Detailed prior art on demand
```

After meaningful edits the inventor may re-evaluate. Previous results should
not be confused with the current disclosure version.

## 4. Client review

```text
Submitted
→ Awaiting Workspace Admin review
→ Workspace Admin opens one decision workspace
→ Send to Photon Legal / Request changes / Reject
```

Approve:

```text
Send to Photon Legal
→ Confirmation: Send to Photon Legal for filing?
→ Send to Photon Legal (confirm)
→ Status: Sent to Photon Legal
```

Request changes:

```text
Workspace Admin states what is missing
→ Inventor sees the request in context
→ Same disclosure reopens
→ Inventor edits and resubmits
→ Activity timeline preserves both events
```

Reject:

```text
Workspace Admin provides a reason
→ Inventor may revise and resubmit with a reconsideration note
→ History remains intact
```

There are no separate technical and legal review stages in V0.

## 5. On-behalf submission

```text
Workspace Admin chooses Submit an idea
→ Selects the real primary inventor
→ Completes the same invention-capture flow
→ Pulse displays Inventor and Submitted by separately
```

## 6. Photon handoff and patent lifecycle

```text
Sent to Photon Legal
→ Filed
→ Granted or Closed
```

`Filing in progress` is not a separate V0 product state. Photon Legal performs
drafting and filing outside Pulse. Photon roles update the visible lifecycle.

## 7. Patent portfolio maintenance

```text
Case Owner or Photon Admin
→ Manual entry/update or spreadsheet import
→ Validate and report added/updated/problem rows
→ Patent appears in client portfolio
→ Lifecycle and upcoming dates become visible to authorized users
```

Workspace Admin and Inventor remain read-only.

## 8. Actions

```text
Upcoming patent event
→ Workspace Admin selects an allowed action/instruction
→ Selects countries when relevant
→ Saves or submits
→ Case Owner or Photon Admin receives request
→ Submitted / Acknowledged / In progress / Completed / Declined
```

Actions do not contain purchasing, checkout, or legal-service pricing.

## 9. Activation emails

### Workspace Admin

- Invite/login email
- 24-hour login reminder
- Seven-day idea digest with login CTA
- No inventors: add inventors
- Inventors added but no idea: invite the first submission
- New idea: review now
- Weekly pending-review digest with count in subject

### Inventor

- Invite/login email
- 24-hour login reminder
- Teammate-submission social-proof email where appropriate
- Browsed but did not start: how to submit
- Clicked submit but created no draft: how to start
- Half-completed draft: return and finish
- Evaluated but not submitted: send for review
- Submitted: confirmation and next steps

Email frequency must remain helpful and must provide preference/unsubscribe
controls where legally and operationally required.

