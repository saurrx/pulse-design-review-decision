import React from "react";
import { Monitor } from "lucide-react";

/**
 * Pulse is a desktop product. Below the lg breakpoint (mobile + tablet) this
 * overlay covers the app with a clear ask to switch devices.
 *
 * Deliberately a pure CSS-visibility overlay: the app stays mounted
 * underneath, so no router/query/hook behaviour changes with viewport size —
 * the gate cannot introduce state bugs, only pixels.
 */
const DesktopOnlyGate: React.FC = () => (
  <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-[#11103C] px-8 text-center lg:hidden">
    <span className="inline-block bg-[#11103C] px-3 py-2 font-mono text-sm font-bold tracking-[2px] text-white ring-1 ring-white/25">
      PHOTON
      <span className="block bg-[#F9B418] px-1 text-center text-[10px] tracking-[6px] text-[#11103C]">
        LEGAL
      </span>
    </span>
    <Monitor className="h-10 w-10 text-[#F9B418]" aria-hidden="true" />
    <div>
      <h1 className="text-xl font-semibold text-white">
        Pulse is built for bigger screens
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/70">
        Reviewing disclosures and patent portfolios needs room to work. Please
        open <span className="font-medium text-white">demo.photonpulse.ai</span>{" "}
        in a desktop or laptop web browser.
      </p>
    </div>
    <p className="text-xs text-white/40">© 2026 Photon Legal</p>
  </div>
);

export default DesktopOnlyGate;
