import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import type { Role } from "@/lib/roles";
import { identifyUser } from "@/lib/analytics";

/**
 * The signed-in user, as stored in the `pl_user` cookie.
 *
 * Typed because `useState(null)` inferred the state as `null`, which under
 * strictNullChecks made `user` resolve to `never` — and every `user?.role` in
 * the app then failed to compile. One untyped line produced 150 errors.
 *
 * Fields beyond these are carried through by the index signature: the cookie
 * holds whatever the API returned, and different screens read different parts
 * of it. Narrowing that further belongs with the real API contract.
 */
export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role: Role | string;
  client_id?: string | null;
  clientId?: string | null;
  organization_name?: string;
  client?: { id: string; name: string; logo_file?: { file_path?: string | null } | null } | null;
  [key: string]: any;
}

const useUserCookie = () => {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const cookieValue = Cookies.get("pl_user");
    if (cookieValue) {
      try {
        const parsed = JSON.parse(cookieValue) as SessionUser;
        setUser(parsed);
        // Identify by the opaque user id, with role + client_id as person
        // properties only. NEVER email/name (both denylisted). client_id as a
        // free property — no paid group() add-on. No-op unless the env gate is on.
        if (parsed.id) {
          identifyUser(parsed.id, {
            role: parsed.role,
            client_id: parsed.client_id ?? parsed.clientId,
          });
        }
      } catch (error) {
        console.error("Error parsing user cookie:", error);
        Cookies.remove("pl_user");
      }
    }
  }, []);

  return {
    user,
    isAuthenticated: !!user,
  };
};

export default useUserCookie;
