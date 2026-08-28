import Cookies from "js-cookie";
import axios, { type AxiosInstance } from "axios";
import { makeRealAdapter } from "./realAdapter";

/**
 * The app's HTTP client — the real Pulse API, always.
 *
 * The in-browser mock was removed when the app went production-bound. Every one
 * of the ~150 call sites still speaks the old backend's dialect (/api/v1 paths,
 * a { data, message } envelope); realAdapter translates that onto the clean /v1
 * API in one place, so the call sites were never touched. A route the adapter
 * does not yet map fails with a named 501 rather than a silent wrong answer.
 */

const real: AxiosInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) ?? "",
  // The API authenticates with HttpOnly cookies, which JavaScript cannot read.
  // That is the point: an XSS here cannot exfiltrate a session the way a token
  // in localStorage can. It also means every request must carry credentials.
  withCredentials: true,
  headers: {
    "content-type": "application/json",
    // A cross-site form post cannot set a custom header, so requiring one
    // closes the simple CSRF case at no cost.
    "x-requested-with": "XMLHttpRequest",
  },
});

/**
 * Access tokens are short-lived by design. On the first 401 we refresh once and
 * replay the original request; a second failure means the session is genuinely
 * gone and the user is sent to sign in.
 *
 * `_retried` guards the obvious trap: without it a failing refresh triggers a
 * refresh, forever.
 */
let refreshing: Promise<unknown> | null = null;

real.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error?.config ?? {};
    const status = error?.response?.status;
    const isAuthCall = String(original.url ?? "").includes("/auth/");

    if (status !== 401 || original._retried || isAuthCall) return Promise.reject(error);
    original._retried = true;

    try {
      // Share one refresh across concurrent 401s rather than firing several.
      refreshing = refreshing ?? real.post("/v1/auth/refresh");
      await refreshing;
      return real(original);
    } catch (e) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        // Half-logged state (pl_user set, tokens dead) presents as "data never
        // loads until hard refresh" — clear the cookie so /login accepts us.
        Cookies.remove("pl_user");
        window.location.assign("/login");
      }
      return Promise.reject(e);
    } finally {
      refreshing = null;
    }
  },
);

// The adapter translates the screens' old dialect onto /v1 (see realAdapter.ts).
// `real` is exported raw for code written directly against the new API.
const API_CONFIG = makeRealAdapter(real) as unknown as AxiosInstance;
export const rawApi = real;



/**
 * Builds a URL for a file served by the API (logos, uploads, patent documents).
 *
 * Components were doing assetUrl(path) inline in 21
 * places. The mock client has no `baseURL`, so every one of those produced
 * "undefined/logo.png" and a broken image — exactly one call site guarded it.
 * Centralising also means a relative `baseURL` (the deployed default) yields a
 * correct root-relative URL rather than a double slash.
 */
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;   // already absolute
  const base = (real.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/${String(path).replace(/^\//, "")}`;
}
export default API_CONFIG;
