import { useState } from "react";
import { track } from "@/lib/analytics";
import { AuthField } from "./AuthField";
import { ssoAllows, SSO_START_URL } from "./ssoAccess";

/**
 * The enterprise SSO hand-off, in two steps.
 *
 * Step one is a button beside Google and Microsoft. Step two asks for a work
 * email before redirecting, which exists for one reason: there is a single IdP
 * for the whole product, so someone whose organisation does not use it would
 * otherwise be sent to an Okta login they cannot possibly pass and left to work
 * out why. Telling them here is kinder and leaks nothing — the list is public
 * knowledge to anyone who reads the bundle, and it authorises nobody. See
 * ssoAccess.ts.
 *
 * The hand-off is a full-page navigation, not an XHR. The API answers with a
 * redirect to the IdP and holds the SAML `state` in an HttpOnly cookie; neither
 * survives being fetched from JavaScript.
 */
export function SsoButton({ onStart, disabled }: { onStart: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-5 rounded-sm border border-white/10 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span className="text-white font-sans">Log in with SSO</span>
    </button>
  );
}

export function SsoEmailStep({ onCancel }: { onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const value = email.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address");
      return;
    }
    if (!ssoAllows(value)) {
      setError(
        "SSO isn't enabled for your organisation. Use your email and password, or Google or Microsoft.",
      );
      return;
    }
    track("login_attempted", { method: "sso" });
    window.location.href = SSO_START_URL;
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="self-start flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors font-sans mb-2"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <AuthField
        label="Work email"
        name="sso-email"
        type="email"
        autoComplete="username"
        placeholder="you@company.com"
        error={error}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value.replace(/\s+/g, "").toLowerCase());
          if (error) setError(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
        }}
      />

      <button
        type="button"
        onClick={submit}
        className="w-full py-3 rounded-sm bg-[#F9B418] text-black font-medium hover:bg-[#F9B418]/90 transition-all font-sans"
        style={{ boxShadow: "rgba(249, 180, 24, 0.3) 0px 0px 20px" }}
      >
        Continue with SSO
      </button>
    </div>
  );
}
