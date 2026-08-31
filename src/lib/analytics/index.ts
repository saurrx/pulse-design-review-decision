/**
 * Analytics wrapper — the thin, framework-agnostic arm over posthog-js.
 *
 * The canonical event vocabulary lives in `./catalog` (byte-identical across the
 * three repos, sha256 drift-gated by qa/security/analytics-guard.qa.mjs). This
 * module never widens it; it only gates, stamps base props, sanitises, and sends.
 *
 * PRIVACY: `track()` runs every payload through `sanitize()` (from the catalogue)
 * before it reaches posthog — the runtime arm of the no-free-text rule. Callers
 * must still only pass ids / enums / counts / timings; never disclosure text,
 * notes, reasons, emails, names, file contents, or the client `reference`.
 *
 * FAIL-CLOSED: nothing fires unless the env is allowlisted, a key is present, AND
 * the browser origin is allowlisted. Dev / local / preview are guaranteed no-ops,
 * so wiring `track(...)` anywhere is safe.
 */
import { useEffect, useRef } from "react";
import posthog, { type CaptureResult } from "posthog-js";
import { readUserCookie } from "@/lib/auth";
import {
  envEnabled,
  sanitize,
  ANALYTICS_HOST_ALLOWLIST,
  PROPERTY_DENYLIST,
  type EventName,
} from "./catalog";

export { posthog };
export type { EventName };

const ANALYTICS_ENV = import.meta.env.VITE_ANALYTICS_ENV;

/**
 * True only when analytics may fire in THIS environment/origin. Fail-closed:
 * env allowlisted (demo/prod) AND a key is present AND we are in a browser on an
 * allowlisted host. Anything else — dev, local, preview, a missing key — is false
 * and every `track()` becomes a no-op.
 */
export function analyticsEnabled(): boolean {
  return (
    envEnabled(ANALYTICS_ENV) &&
    !!import.meta.env.VITE_POSTHOG_KEY &&
    typeof window !== "undefined" &&
    (ANALYTICS_HOST_ALLOWLIST as readonly string[]).includes(
      window.location.hostname,
    )
  );
}

/**
 * Base props attached to every event. Ids / enums only — role and client_id come
 * from the `pl_user` cookie; NEVER email or name (both denylisted anyway). A
 * view-as session is flagged with `view: true`.
 */
function base(): Record<string, unknown> {
  const props: Record<string, unknown> = {
    surface: "web",
    environment: ANALYTICS_ENV,
  };
  try {
    const user = readUserCookie();
    if (user) {
      if (user.role) props.role = user.role;
      const clientId = user.client_id ?? user.clientId;
      if (clientId) props.client_id = clientId;
    }
    if (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("pl_client_mode") === "true") {
      props.view = true;
    }
  } catch {
    // cookie/storage unavailable — send what we have
  }
  return props;
}

/**
 * Emit a catalogue event. No-op unless `analyticsEnabled()`. The payload is
 * merged over the base props and run through `sanitize()` (whitelist to declared
 * keys + drop denylisted) before it reaches posthog. Best-effort: analytics must
 * never throw into a product handler.
 */
export function track(event: EventName, props: Record<string, unknown> = {}): void {
  if (!analyticsEnabled()) return;
  try {
    const safe = sanitize(event, { ...base(), ...props });
    posthog.capture(event, safe);
  } catch {
    // swallow — a broken metric must never break a click
  }
}

/**
 * Fire a catalogue event once each time `when` becomes true.
 *
 * Every "this was opened" event wants exactly this and nothing else: a ref guard
 * so React's strict-mode double-invoke and any re-render do not turn one visit
 * into three, and an effect so it never fires during render. Written once here
 * because a dozen screens copying the same four lines is a dozen chances to get
 * the guard wrong, and a view event that over-counts is worse than an absent one
 * — it silently inflates every funnel it starts.
 *
 * The guard RE-ARMS on the falling edge, which is what makes one hook serve both
 * shapes: a screen passing a stable `when` fires once for the mount, while a
 * dialog that stays mounted and toggles `open` fires once per opening rather
 * than once, ever.
 *
 * `props` is read at fire time, so a value that arrives late is fine — but gate
 * the call with `when` if the event is meaningless until it does.
 */
export function useTrackOnce(
  event: EventName,
  props: Record<string, unknown> = {},
  when = true,
): void {
  const firedRef = useRef(false);
  // Kept in a ref so a fresh props object each render never re-fires the effect.
  const propsRef = useRef(props);
  propsRef.current = props;
  useEffect(() => {
    if (!when) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    track(event, propsRef.current);
  }, [event, when]);
}

/** Identify the signed-in user. No-op unless enabled. Never pass email/name. */
export function identifyUser(
  id: string,
  props: Record<string, unknown> = {},
): void {
  if (!analyticsEnabled()) return;
  try {
    posthog.identify(id, sanitizeIdentity(props));
  } catch {
    // best-effort
  }
}

/** Clear the identified person (logout / view-as exit). No-op unless enabled. */
export function resetUser(): void {
  if (!analyticsEnabled()) return;
  try {
    posthog.reset();
  } catch {
    // best-effort
  }
}

/** Strip any denylisted key from a person-properties bag (belt for identify). */
function sanitizeIdentity(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (PROPERTY_DENYLIST.has(k.toLowerCase())) continue;
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

const ID_SEGMENT =
  /\/(ideas|patents|clients)\/[0-9a-fA-F-]{8,}(?=\/|$)/g;

/**
 * before_send belt for posthog — runs on EVERY event including autocaptured `$`
 * ones. (a) drops any property whose lowercased key is denylisted; (b) normalises
 * id segments in `$pathname` / `$current_url` so funnels group by route shape
 * (`/ideas/:id/draft`, not `/ideas/9f3a…/draft`). Returns the event, or null to drop.
 */
export function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event || typeof event !== "object") return event;
  const props = event.properties as Record<string, unknown> | undefined;
  if (props && typeof props === "object") {
    for (const key of Object.keys(props)) {
      if (PROPERTY_DENYLIST.has(key.toLowerCase())) delete props[key];
    }
    for (const routeKey of ["$pathname", "$current_url"] as const) {
      const val = props[routeKey];
      if (typeof val === "string") {
        props[routeKey] = val.replace(ID_SEGMENT, (_m, seg) => `/${seg}/:id`);
      }
    }
  }
  return event;
}
