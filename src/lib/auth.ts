import Cookies from "js-cookie";
import type { SessionUser } from "@/hooks/use-auth";
import posthog from "posthog-js";
import { envEnabled, ANALYTICS_HOST_ALLOWLIST } from "@/lib/analytics/catalog";

/**
 * Local fail-closed gate. Import `posthog` from `posthog-js` directly (NOT from
 * `@/lib/analytics`) because `@/lib/analytics` imports `readUserCookie` from this
 * file — going the other way would be an import cycle. The catalogue has no
 * imports, so reading the allowlists from it is cycle-free.
 */
function analyticsOn(): boolean {
  return (
    envEnabled(import.meta.env.VITE_ANALYTICS_ENV) &&
    !!import.meta.env.VITE_POSTHOG_KEY &&
    typeof window !== "undefined" &&
    (ANALYTICS_HOST_ALLOWLIST as readonly string[]).includes(window.location.hostname)
  );
}

/** Clear the identified person on session teardown. No-op unless the gate is on. */
function resetAnalytics(): void {
  if (!analyticsOn()) return;
  try {
    posthog.reset();
  } catch {
    // best-effort — teardown must never throw
  }
}

/**
 * Reads the signed-in user from the `pl_user` cookie.
 *
 * Exists because the same three lines were repeated across components:
 *
 *   Cookies.get("pl_user") ? JSON.parse(Cookies.get("pl_user")) : null
 *
 * which TypeScript cannot narrow (the second get() is a fresh `string |
 * undefined`), and which throws on malformed JSON — a cookie a user can edit.
 * This reads once, parses defensively, and clears a corrupt cookie rather than
 * crashing the render that touched it.
 *
 * For components, prefer the useUserCookie hook; this is for the places that
 * are not React contexts.
 */
export function readUserCookie(): SessionUser | null {
  const raw = Cookies.get("pl_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    Cookies.remove("pl_user");
    return null;
  }
}


/**
 * Centralized client-side auth/session teardown.
 *
 * Clears everything the browser can reach: the non-HttpOnly `pl_user` cookie,
 * the client-mode admin token, and background-analysis artifacts in storage.
 *
 * NOTE: the HttpOnly `pl_access_token` cookie can only be cleared by the
 * backend (`POST /api/v1/auth/logout`); callers should fire that separately.
 */
export function clearAuthSession(): void {
  // Analytics identity dies with the session — reset before we clear the cookie
  // so a subsequent login is a fresh distinctId, not merged into the old person.
  resetAnalytics();

  // Cookies (path "/" matches how they're set on login)
  Cookies.remove("pl_user", { path: "/" });
  Cookies.remove("pl_user");
  Cookies.remove("pl_admin_token", { path: "/" });

  try {
    sessionStorage.removeItem("pl_client_mode");
    sessionStorage.removeItem("pl_original_admin_user");
    localStorage.removeItem("analysisDraftID");
    // Background-score cache keys are suffixed with the idea id
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("run-bg-score-")) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // storage may be unavailable (private mode) — safe to ignore
  }
}

// Guard so a burst of 401s only triggers a single redirect (no loops/flicker).
let isForcingLogout = false;

/**
 * Force a logout from a non-React context (e.g. the Axios 401 interceptor).
 * Clears client session and hard-redirects to /login. Runs at most once.
 */
export function forceLogoutRedirect(): void {
  // Always tear down the client session on an auth failure (idempotent).
  clearAuthSession();

  // Already on the login page: there's nothing to navigate to. Crucially we do
  // NOT latch the guard here — no page unload would ever reset it, so a later
  // 401 (e.g. after re-logging in within the same SPA session) would be
  // silently swallowed, leaving the app broken with no path to recovery.
  if (window.location.pathname === "/login") return;

  // A redirect is already in flight — collapse a burst of 401s into one
  // navigation (no loops/flicker). The full-page load below unloads this
  // module, which resets the flag, so it can only ever be set while a
  // navigation is genuinely pending.
  if (isForcingLogout) return;
  isForcingLogout = true;

  window.location.assign("/login?session_expired=1");
}
