import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * The trigger button every list-screen filter opens from — Date, Clients,
 * Status, Tags, Sort, Columns.
 *
 * Extracted 2026-09-03 from EIGHTEEN inline copies across six screens, in
 * EIGHT drift variants: the same outline button with a `#F9B418` hover border,
 * differing only in whether `font-sans` or `shrink-0` had been added, whether
 * the light text was `#404040`, `#494949` or `neutral-700`, and whether dark
 * hover was `bg-white/5` or `bg-neutral-900`. None of those differences was a
 * decision; they are what copy-paste does over a year. This is one style.
 *
 * Icons inside inherit `currentColor`, so the per-icon `theme === "dark" ?
 * "text-zinc-200" : "text-neutral-700"` ternaries the copies carried are gone —
 * the button sets the colour once.
 *
 * `active` renders the amber dot the Date filter used to show when a preset
 * was applied; any filter can now say "something is set" the same way.
 */
export interface FilterButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  /** A filter is applied — shows the amber dot beside the label. */
  active?: boolean;
  /** The chevron is on by default; a button that opens nothing hides it. */
  chevron?: boolean;
  /** Fixed 42px height + no wrap, for a toolbar row. Default on. */
  toolbar?: boolean;
}

const FilterButton = React.forwardRef<HTMLButtonElement, FilterButtonProps>(
  (
    { icon, active = false, chevron = true, toolbar = true, className, children, ...rest },
    ref,
  ) => (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-sm border px-4 font-sans text-sm font-normal transition-colors",
        "border-neutral-200 bg-transparent text-neutral-700 hover:border-[#F9B418] hover:bg-transparent hover:text-[#494949]",
        "dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-[#F9B418]/50 dark:hover:bg-white/5 dark:hover:text-neutral-300",
        toolbar && "h-[42px] whitespace-nowrap",
        className,
      )}
      data-active={active || undefined}
      {...rest}
    >
      {icon && <span className="inline-flex h-4 w-4 shrink-0 items-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
      {active && (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-[#F9B418]"
          data-testid="filter-active-dot"
          aria-label="filter applied"
        />
      )}
      {chevron && <ChevronDown className="h-3 w-3 shrink-0 opacity-80" aria-hidden="true" />}
    </Button>
  ),
);
FilterButton.displayName = "FilterButton";

export { FilterButton };
