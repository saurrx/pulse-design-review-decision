import React from "react";

/**
 * The Google and Microsoft marks used on the social sign-in buttons.
 *
 * Extracted 2026-09-03 from two byte-identical inline copies each, in Login and
 * Signup — 24 lines of `<path>` for Google and 11 for Microsoft, twice over.
 *
 * The path data is copied VERBATIM out of Login.tsx by script, not retyped: a
 * hand-transcribed `d` attribute is silently wrong, and the first attempt at
 * this file did corrupt one of Google's four paths. Do not "tidy" the
 * coordinates or recolour either mark — these are the vendors' own marks and
 * both brand policies require them as supplied, which is why `size` and
 * `className` are the only props.
 *
 * aria-hidden on both: the button already carries the accessible name
 * ("Continue with Google"), and an icon repeating it makes a screen reader say
 * the vendor twice.
 */
export interface BrandIconProps {
  size?: number;
  className?: string;
}

export const GoogleIcon: React.FC<BrandIconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M19.8055 10.2292C19.8055 9.55207 19.7493 8.86821 19.6299 8.19775H10.2002V12.0492H15.6014C15.3773 13.2911 14.6571 14.3898 13.6025 15.0879V17.5866H16.8251C18.7173 15.8449 19.8055 13.2728 19.8055 10.2292Z"
      fill="#4285F4"
    ></path>
    <path
      d="M10.2002 20.0006C12.9517 20.0006 15.2726 19.1151 16.8288 17.5865L13.6062 15.0878C12.7092 15.6979 11.5492 16.0431 10.2038 16.0431C7.54164 16.0431 5.28676 14.2828 4.48943 11.9165H1.16309V14.4923C2.75191 17.8695 6.27072 20.0006 10.2002 20.0006Z"
      fill="#34A853"
    ></path>
    <path
      d="M4.48584 11.9163C4.06482 10.6744 4.06482 9.32958 4.48584 8.08765V5.51184H1.16307C-0.390024 8.73056 -0.390024 12.2734 1.16307 15.492L4.48584 11.9163Z"
      fill="#FBBC04"
    ></path>
    <path
      d="M10.2002 3.95805C11.6222 3.936 13.0005 4.47247 14.036 5.45722L16.8929 2.60096C15.1858 0.990301 12.9334 0.0839084 10.2002 0.109031C6.27072 0.109031 2.75191 2.24007 1.16309 5.61841L4.48585 8.19422C5.2796 5.82116 7.53806 3.95805 10.2002 3.95805Z"
      fill="#EA4335"
    ></path>
  </svg>
);

export const MicrosoftIcon: React.FC<BrandIconProps> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 23 23"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);
