/**
 * Inert replacement for @react-oauth/google, aliased in by vite.design.config.ts
 * and .storybook/main.ts. Same named exports the app imports, no script from
 * Google, no network. Google sign-in is therefore a visible but inert control in
 * the design fork; the mock answers the password login endpoint instead.
 */
import React from "react";

export const GoogleOAuthProvider = ({ children }: { children: React.ReactNode; clientId?: string }) => (
  <>{children}</>
);

type LoginOptions = { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void; [k: string]: unknown };
export const useGoogleLogin = (_options?: LoginOptions) => () => {
  console.info("[pulse-design] Google sign-in is inert in the design fork.");
};
export const useGoogleOneTapLogin = (_options?: LoginOptions) => undefined;
export const useGoogleOAuth = () => ({ clientId: "inert", scriptLoadedSuccessfully: false });
export const googleLogout = () => undefined;
export const GoogleLogin = (_props: Record<string, unknown>) => null;
export const hasGrantedAllScopesGoogle = () => false;
export const hasGrantedAnyScopeGoogle = () => false;
