import API_CONFIG from "@/lib/apiConfig";
import { Loader2 } from "lucide-react";
import Cookies from "js-cookie";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/lib/toast";
import { track } from "@/lib/analytics";

/**
 * Where the API's SAML ACS route sends the browser after a valid assertion.
 *
 * By the time this mounts the session cookies are already set — the redirect
 * that brought us here carried them. All that is left is the readable `pl_user`
 * cookie the app reads for display state, exactly as the password and social
 * paths do. Nothing here decides whether the login succeeded; the server did
 * that, and a failure would have gone to /login?sso_error=1 instead.
 */
const SamlCallback = () => {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const response = await API_CONFIG.get("/api/v1/auth/session");
        const user = response?.data?.data?.user;
        if (!user?.email) throw new Error("no user");

        // asUser has already resolved the photon sentinel client_id.
        Cookies.set("pl_user", JSON.stringify(user), { secure: true, sameSite: "lax", path: "/" });
        track("login_succeeded", { method: "saml" });
        toast.success("Signed in with SSO");
        navigate("/", { replace: true });
      } catch {
        toast.error("SSO sign-in could not be completed. Please try again.");
        navigate("/login?sso_error=1", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="pulse-auth-shell flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#F9B418]" />
        <p className="font-sans text-neutral-500">Completing sign in…</p>
      </div>
    </div>
  );
};

export default SamlCallback;
