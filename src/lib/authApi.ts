import API_CONFIG from "./apiConfig";

/**
 * Auth against the Pulse API.
 *
 * The screens in this repo were written against the previous backend
 * (`/api/v1/auth/...`, a `pl_user` cookie holding the user object). The new API
 * uses `/v1/auth/...` and HttpOnly session cookies, and it is invite-only —
 * there is no self-signup, by design: PRD #1's first rule is that outsiders
 * cannot get in.
 *
 * This module is the single place that difference lives, so the screens keep
 * calling one function and nothing else has to know which backend answers.
 */

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  clientId: string | null;
  name?: string | null;
}

/** The adapter hands back the old envelope; the user sits under data.user. */
const unwrap = (res: any): SessionUser =>
  res?.data?.data?.user ?? res?.data?.user ?? res?.data;

/** Thrown when the email's domain belongs to no onboarded client. */
export class DomainNotOnboardedError extends Error {
  constructor(message: string) { super(message); this.name = 'DomainNotOnboardedError'; }
}

/**
 * The API answers 403 with this message for every unonboarded domain, on every
 * path — password signup, Google and Microsoft alike. Recognising it here means
 * the screens can show one dedicated state instead of a generic red toast.
 */
export function asDomainError(e: any): DomainNotOnboardedError | null {
  const status = e?.response?.status;
  const msg = e?.response?.data?.message ?? '';
  return status === 403 && /has not onboarded/i.test(String(msg))
    ? new DomainNotOnboardedError(String(msg))
    : null;
}

export const authApi = {
  /** Pre-flight for the signup screen. Returns only a boolean — never the
   *  client's name, which would leak the customer list. */
  checkDomain: async (email: string): Promise<boolean> => {
    try {
      const r = await API_CONFIG.get(`/v1/auth/check-domain?email=${encodeURIComponent(email)}`);
      return !!r?.data?.onboarded;
    } catch { return true; }   // never block signup on a failed pre-flight
  },

  signup: async (email: string, password?: string, name?: string): Promise<SessionUser> =>
    unwrap(await API_CONFIG.post('/api/v1/auth/email-signup', { email, password, name })),

  login: async (email: string, password: string): Promise<SessionUser> =>
    unwrap(await API_CONFIG.post("/api/v1/auth/login", { email, password })),

  /** Google Identity Services access token; the API verifies the audience. */
  google: async (accessToken: string): Promise<SessionUser> =>
    unwrap(await API_CONFIG.post("/v1/auth/google", { access_token: accessToken })),

  me: async (): Promise<SessionUser> => (await API_CONFIG.get("/v1/auth/me")).data,

  logout: async (): Promise<void> => {
    await API_CONFIG.post("/api/v1/auth/logout").catch(() => {});
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    await API_CONFIG.post("/v1/auth/password-reset/request", { email });
  },

  completePasswordReset: async (token: string, password: string): Promise<void> => {
    await API_CONFIG.post("/v1/auth/password-reset/complete", { token, password });
  },

  peekInvite: async (code: string) =>
    (await API_CONFIG.get(`/v1/auth/invite/${code}`)).data,

  acceptInvite: async (token: string, name?: string, password?: string): Promise<SessionUser> =>
    unwrap(await API_CONFIG.post("/v1/auth/invite/accept", { token, name, password })),
};
