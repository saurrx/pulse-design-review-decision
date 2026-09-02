import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * One labelled field on an auth screen, with its error state.
 *
 * It exists because the five auth screens disagreed with each other in three
 * ways that a user could see:
 *
 *  - The message was rendered `position: fixed` on Login/Signup/Invite, so it
 *    was laid out against the VIEWPORT rather than the field, took no space in
 *    the flow, and overlapped whatever came next.
 *  - Nothing reserved room for it, so on the screens where it WAS in flow the
 *    submit button jumped down the moment a message appeared.
 *  - The field itself never changed. `aria-invalid` was never set on any auth
 *    input — the classNames carried `aria-invalid:` variants that nothing could
 *    ever trigger — so the border stayed neutral while the text below said the
 *    value was wrong, and a screen reader was told nothing at all.
 *
 * So: the message slot is always present and always the same height, the
 * invalid state paints the border red AND sets `aria-invalid`, and the message
 * is tied to the input with `aria-describedby`.
 *
 * `error` is the message to show, or undefined. Deciding WHEN to show it is the
 * caller's job — every auth form gates it on `submitCount > 0`, because errors
 * before the first submit is a complaint about typing rather than an answer.
 */
export interface AuthFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  name: string;
  error?: string;
}

const BASE =
  "flex h-11 w-full min-w-0 rounded-md border px-3 py-1 text-base md:text-sm font-sans " +
  "outline-none transition-[color,box-shadow,border-color] " +
  "bg-white/5 text-white placeholder:text-neutral-600 " +
  "focus-visible:ring-[0.5px] focus-visible:ring-offset-0 " +
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

export const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, name, error, className, ...props }, ref) => {
    const invalid = Boolean(error);
    const errorId = `${name}-error`;

    return (
      <div>
        <label
          htmlFor={name}
          className="font-sans items-center gap-2 font-medium select-none text-sm mb-2 block text-neutral-300"
        >
          {label}
        </label>

        <Input
          ref={ref}
          id={name}
          name={name}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(
            BASE,
            // Last wins in the tailwind-merge, so the invalid border beats the
            // neutral one. The matching `!important` override for the light
            // skin lives in index.css under `.pulse-auth-card`.
            invalid
              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500"
              : "border-white/10 focus-visible:border-[#F9B418] focus-visible:ring-[#F9B418]",
            className,
          )}
          {...props}
        />

        {/* Always rendered, always the same height: the layout must not move
            when a message appears. `role="alert"` announces it when it does. */}
        <p
          id={errorId}
          role="alert"
          className="min-h-[18px] mt-1.5 text-xs leading-[18px] font-sans text-red-500"
        >
          {error ?? ""}
        </p>
      </div>
    );
  },
);
AuthField.displayName = "AuthField";
