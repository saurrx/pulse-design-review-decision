import React from "react";
import { useTheme } from "@/hooks/useTheme";

/**
 * The three drifting gradient blobs behind a full-bleed page.
 *
 * Extracted 2026-09-03 from EIGHT byte-identical copies (75 lines each), of
 * which SEVEN rendered nothing at all:
 *
 *   - five sat inside `<div className="hidden">` — PatentsContent,
 *     PatentDetailsContent, DueDatesContent, IdeasContent, ClientsPage;
 *   - two more were inside a `.pulse-product-page`, and `index.css` carries
 *     `.pulse-product-page .animate-blob { display: none !important }` —
 *     IdeaDetailsContent, ClientDetailPage.
 *
 * Measured rather than reasoned: a Playwright probe over the deployed demo
 * found 3 `.animate-blob` nodes in the DOM on /patents, /ideas, /due-dates and
 * /clients and **0 visible** on every one, and 3 of 3 visible on the 404 page.
 * The seven dead copies were deleted; this is the one that renders.
 *
 * It stays a component rather than going back inline because a decoration
 * copy-pasted eight times is how it got here, and one definition is what stops
 * the ninth. `hidden` renders it for a Storybook story or a visual snapshot
 * without the animation.
 */
const BLOBS = [
  {
    key: "amber",
    size: "w-[600px] h-[600px]",
    position: { top: "-10%", right: "10%" },
    delay: "0s",
    dark: { rgb: "245, 166, 35", alpha: 0.3, opacity: "opacity-20" },
    light: { rgb: "245, 166, 35", alpha: 0.2, opacity: "opacity-30" },
  },
  {
    key: "cyan",
    size: "w-[500px] h-[500px]",
    position: { bottom: "10%", left: "5%" },
    delay: "2s",
    dark: { rgb: "6, 182, 212", alpha: 0.3, opacity: "opacity-20" },
    light: { rgb: "6, 182, 212", alpha: 0.15, opacity: "opacity-25" },
  },
  {
    // The third blob is the one place the two themes disagree on HUE, not just
    // on opacity: purple in the dark theme, pink in the light one. Preserved
    // exactly as the original markup had it — this is a port, not a redesign.
    key: "accent",
    size: "w-[550px] h-[550px]",
    position: { top: "40%", left: "30%" },
    delay: "4s",
    dark: { rgb: "168, 85, 247", alpha: 0.3, opacity: "opacity-15" },
    light: { rgb: "236, 72, 153", alpha: 0.15, opacity: "opacity-20" },
  },
] as const;

export interface GradientBlobsProps {
  /** Force a theme instead of reading the context. Storybook and snapshots. */
  theme?: "dark" | "light";
  /** Drop the 20s animation, so a visual snapshot is deterministic. */
  animated?: boolean;
  className?: string;
}

const GradientBlobs: React.FC<GradientBlobsProps> = ({
  theme: forced,
  animated = true,
  className = "absolute inset-0 overflow-hidden pointer-events-none",
}) => {
  const ctx = useTheme();
  const theme = forced ?? ctx.theme;
  const dark = theme === "dark";

  return (
    <div className={className} data-testid="gradient-blobs" aria-hidden="true">
      {BLOBS.map((b) => {
        const t = dark ? b.dark : b.light;
        return (
          <div
            key={b.key}
            data-blob={b.key}
            className={`absolute ${b.size} rounded-full ${t.opacity} blur-3xl ${
              animated ? "animate-blob" : ""
            }`}
            style={{
              background: `radial-gradient(circle, rgba(${t.rgb}, ${t.alpha}) 0%, rgba(${t.rgb}, 0) 70%)`,
              ...b.position,
              animationDelay: b.delay,
            }}
          />
        );
      })}
    </div>
  );
};

export default GradientBlobs;
