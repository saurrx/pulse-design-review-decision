import React from "react";
import { Loader2 } from "lucide-react";

/**
 * The full-screen "Signing in…" veil an auth screen shows while a credential
 * is in flight.
 *
 * Extracted 2026-09-03 from four byte-identical copies — Login, Signup, Invite
 * and ResetPassword. They differed only in the state variable driving them
 * (`isLoading` vs `isLoadingLogin`), which is now the `show` prop.
 *
 * The copy is "Signing in…" on all four, INCLUDING ResetPassword and Invite,
 * where the user is not literally signing in — they are setting a password or
 * accepting an invite, and the app signs them in immediately afterwards. That
 * is the outcome the veil is waiting for, so the label is right; `label` exists
 * for a screen where it stops being right rather than to make this configurable
 * for its own sake.
 */
export interface AuthLoadingOverlayProps {
  show: boolean;
  label?: string;
}

const AuthLoadingOverlay: React.FC<AuthLoadingOverlayProps> = ({
  show,
  label = "Signing in...",
}) => {
  if (!show) return null;
  return (
    <div
      className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50"
      role="status"
      aria-live="polite"
      data-testid="auth-loading-overlay"
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-photon-primary" />
        <p className="text-gray-600 font-medium">{label}</p>
      </div>
    </div>
  );
};

export default AuthLoadingOverlay;
