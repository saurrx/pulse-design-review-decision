import React from "react";

/**
 * The shell every product page sits in.
 *
 * It exists because five pages had each invented their own height maths —
 * h-screen, h-full, h-[calc(100dvh-64px)] — and every one of them was wrong in
 * the same way: they measure against the VIEWPORT while sitting below the 64px
 * header inside <main>, so each page overhung the bottom by exactly that much
 * and left a phantom 64px of scroll. Content at the tail was unreachable rather
 * than merely below the fold.
 *
 * `min-h-0 flex-1` inside the flex column that DashboardLayout's <main> now is
 * says the one thing that is actually true: "take the space left under the
 * header". min-h-0 is the part people forget — without it a flex child refuses
 * to shrink below its content and the inner scroll region never engages.
 *
 * `scroll` pages own their scrolling internally (tables, long lists that need a
 * sticky toolbar); `flow` pages are short enough to let <main> scroll them.
 */
export const ProductPage: React.FC<{
  children: React.ReactNode;
  /** Tailwind max-w-* token. Table pages run wide; a profile does not. */
  maxWidth?: string;
  /** "scroll" = this page manages its own overflow. */
  mode?: "scroll" | "flow";
  /** Extra classes for the rare page that needs them. */
  className?: string;
  /** Adds the shared table-page typography/controls treatment. */
  table?: boolean;
}> = ({ children, maxWidth = "max-w-[1680px]", mode = "flow", className = "", table = false }) => (
  <div
    className={[
      "pulse-product-page relative mx-auto flex w-full flex-col px-6 py-6 lg:px-8",
      "min-h-0 flex-1",
      table ? "pulse-table-page" : "",
      mode === "scroll" ? "overflow-hidden" : "",
      maxWidth,
      className,
    ].filter(Boolean).join(" ")}
  >
    {children}
  </div>
);

export default ProductPage;
