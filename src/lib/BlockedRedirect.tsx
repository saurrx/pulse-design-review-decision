/**
 * A role-based redirect that says so.
 *
 * Several screens answer "no" before the API does — /actions to an INVENTOR,
 * /clients and a client record to anyone outside the firm roles, /workspace to a
 * user with no workspace (see roleAccess.ts). Each was a bare `<Navigate>`, so
 * the product's own misdirection was invisible: a user bounced off a link in the
 * sidebar, in an email, or in someone's bookmark, and nothing anywhere recorded
 * it. In PostHog these are the interesting nodes of a Paths insight — the places
 * where what a person expected to reach and what their role permits disagree.
 *
 * Route SHAPES only (`/clients/:id`, never `/clients/9f3a…`): an id here would
 * escape the `$pathname` normaliser in analytics/index.ts and shatter the paths
 * into one node per record.
 */
import { useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { track } from "@/lib/analytics";

interface Props {
  /** Route shape the user tried to reach, e.g. "/clients/:id". */
  from: string;
  /** Route shape they were sent to instead. */
  to: string;
}

const BlockedRedirect = ({ from, to }: Props) => {
  // Fired from an effect, not from render: a redirect renders more than once
  // under strict mode, and one bounce is one event.
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track("redirect_blocked", { from, to });
  }, [from, to]);

  return <Navigate to={to} replace />;
};

export default BlockedRedirect;
