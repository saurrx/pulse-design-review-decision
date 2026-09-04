import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /**
   * Field-keyed maps from Formik. Typed loosely on purpose: FormikErrors and
   * FormikTouched are recursive for nested forms, so a flat
   * Record<string, string> rejects every real caller. Only read when `name` is
   * set, and only for display.
   */
  errors?: Record<string, unknown>;
  touched?: Record<string, unknown>;
  /**
   * Optional, as it is on the underlying HTML input.
   *
   * It was declared required here, which contradicted the 31 call sites that
   * legitimately omit it — search boxes, filters and one-off fields that are not
   * part of a named form. Those 31 errors were the single largest class in the
   * codebase and all of them came from this one line.
   */
  name?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, touched, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    
    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };
    
    const isPasswordField = type === 'password';
    const inputType = isPasswordField && showPassword ? 'text' : type;

    return (
      <div className="flex flex-col w-full">
        {label && (
          <Label htmlFor={props.name} className="mb-[6px]">
            {label}
          </Label>
        )}
        <div className="relative h-full">
          <input
            type={inputType}
            className={cn(
              "flex h-11 w-full rounded-sm border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-3 py-2 text-sm text-[var(--pulse-ink)] ring-offset-background transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--pulse-ink-muted)] focus-visible:border-[var(--pulse-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-brand)]/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
              isPasswordField && "pr-10",
              touched &&
                props.errors &&
                (props.name && touched?.[props.name] && props.errors?.[props.name]
                  ? "border-red-500"
                  : "border-input"),
              className
            )}
            ref={ref}
            {...props}
          />
          {isPasswordField && (
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? 
                <EyeOff className="h-4 w-4 text-neutral-500 me-1" /> : 
                <Eye className="h-4 w-4 text-neutral-500 me-1" />
              }
            </button>
          )}
        </div>
        {Boolean(touched &&
          props.errors &&
          props.name && touched?.[props.name] &&
          props.errors[props.name]) && (
            <label className="ml-1 font-normal text-red-500 text-xs mt-1.5">
              {String(props.errors?.[props.name ?? ""] ?? "")}
            </label>
          )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
