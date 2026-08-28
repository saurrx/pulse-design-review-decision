import { Building2 } from "lucide-react";

/**
 * Shown when someone's email domain belongs to no onboarded client.
 *
 * This is the one deliberate addition to the design: the screens were built for
 * a backend with open signup, so no such state existed. It reuses the amber
 * treatment already used for warnings elsewhere rather than inventing a new
 * pattern — this is a "not yet", not a failure, and should not read as one.
 *
 * The copy deliberately does not say whether the address itself is known. That
 * would let anyone test which companies are customers.
 */
export function NotOnboarded({ email, onBack }: { email: string; onBack: () => void }) {
  const domain = email.split("@")[1] ?? email;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5" role="status">
      <div className="flex gap-3">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div>
          <p className="font-medium text-neutral-900">
            {domain} hasn’t onboarded Pulse yet
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Pulse is available to teams whose organisation is already a Photon Legal
            client. We’ve noted your interest and will be in touch.
          </p>
          <p className="mt-3 text-sm text-neutral-600">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onBack}
              className="font-medium text-neutral-900 underline underline-offset-2"
            >
              Sign in instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
