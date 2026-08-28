import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-[#F9B418] placeholder:text-zinc-500 focus-visible:outline-none focus:border-none focus-visible:ring-1 focus-visible:ring-[#F9B418] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-red-500" : "border-input",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <span className="ml-1 font-normal text-red-500 text-xs mt-1.5">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
