import React from "react";
import { Monitor } from "lucide-react";

/**
 * Pulse is a desktop product. On a phone or tablet this overlay covers the app
 * with a clear ask to switch devices.
 *
 * "Phone or tablet", NOT "narrow window". The gate used to be `lg:hidden`, a
 * pure width test, and CSS pixels shrink with browser zoom — a 1440px laptop
 * at 150% reports 960px — so desktop users were told to go and find a desktop.
 * Zoom is also the first thing a person with low vision reaches for, so a
 * width-only gate locked them out of the product entirely. The condition lives
 * in index.css (`.pulse-desktop-gate`) because the body scroll lock has to
 * share it exactly; see the comment there.
 *
 * Deliberately a pure CSS-visibility overlay: the app stays mounted
 * underneath, so no router/query/hook behaviour changes with viewport size —
 * the gate cannot introduce state bugs, only pixels.
 *
 * Sizing note: the outer element is the scroll container and the inner one
 * is the flex box (min-h-full, not h-full). That pairing is what keeps the
 * message reachable when it is taller than a short landscape viewport —
 * centring inside a scroll container clips the top edge out of reach, but
 * content that outgrows min-h-full simply pushes the container taller.
 * The body scroll lock below lg (index.css) keeps this the ONLY scroller.
 */
const DesktopOnlyGate: React.FC = () => (
  <div className="pulse-desktop-gate fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-[#11103C]">
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center sm:gap-6 sm:px-8">
      <span className="inline-block bg-[#11103C] px-3 py-2 font-mono text-sm font-bold tracking-[2px] text-white ring-1 ring-white/25">
        PHOTON
        <span className="block bg-[#F9B418] px-1 text-center text-[10px] tracking-[6px] text-[#11103C]">
          LEGAL
        </span>
      </span>
      <Monitor
        className="h-9 w-9 shrink-0 text-[#F9B418] sm:h-10 sm:w-10"
        aria-hidden="true"
      />
      <div>
        <h1 className="text-balance text-lg font-semibold text-white sm:text-xl">
          Pulse is built for bigger screens
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-pretty text-sm leading-relaxed text-white/70">
          Reviewing disclosures and patent portfolios needs room to work.
          Please open{" "}
          <span className="font-medium text-white">demo.photonpulse.ai</span> in
          a desktop or laptop web browser.
        </p>
      </div>
      <p className="text-xs text-white/40">© 2026 Photon Legal</p>
    </div>
  </div>
);

export default DesktopOnlyGate;
