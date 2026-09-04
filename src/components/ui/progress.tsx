import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    disabled?: boolean,
    theme?: "dark" | "light"
  }
>(({ className, value, disabled=false, theme="light", ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    // `value` MUST reach the Radix root. The shadcn template destructures it
    // to drive the indicator's transform and then never forwards it, so the
    // root rendered role="progressbar" with no aria-valuenow / aria-valuemax —
    // a bar a screen reader could see but never read. The draft readiness
    // rail is built on this. Found by the Storybook a11y run, 2026-09-03.
    value={value}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-photon-gray-200",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-[#F9B418] transition-all", disabled && theme === "dark" && "bg-neutral-600",  disabled && theme === "light" && "bg-gray-500")}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
