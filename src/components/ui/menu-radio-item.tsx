import * as React from "react";
import { cn } from "@/lib/utils";
import { DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";

/**
 * A radio row inside a dropdown menu, in the product's own colours rather than
 * shadcn's defaults.
 *
 * Extracted 2026-09-03 from SIXTEEN inline copies in FOUR drift variants
 * (light hover `#fafafa` vs `#fdfdfd` vs `white`, with or without `font-sans`,
 * with or without `flex items-center gap-2`). The `!important` hover/focus
 * overrides are load-bearing and are the reason this cannot simply be
 * `DropdownMenuRadioItem` with a className: Radix applies its own
 * `focus:bg-accent`, and without `!` the light theme flashed the accent colour
 * on keyboard focus.
 */
const MenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuRadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuRadioItem>
>(({ className, ...props }, ref) => (
  <DropdownMenuRadioItem
    ref={ref}
    className={cn(
      "flex cursor-pointer items-center gap-2 font-sans text-sm transition-colors",
      "text-[#404040] hover:!bg-[#fafafa] hover:!text-[#404040] focus:!text-[#404040]",
      "dark:text-zinc-200 dark:hover:!bg-white/5 dark:hover:!text-zinc-200 dark:focus:!bg-white/5 dark:focus:!text-zinc-200",
      "data-[state=checked]:bg-photon-background-light",
      className,
    )}
    {...props}
  />
));
MenuRadioItem.displayName = "MenuRadioItem";

export { MenuRadioItem };
