/**
 * The app's toast — sonner, with error and warning counted.
 *
 * Every screen imports `toast` from HERE rather than from "sonner" directly, so
 * that `ui_error_toast_shown` is fired once, in one place, instead of at 153
 * call sites nobody would keep in step. An error toast is the moment a user is
 * told something went wrong, which makes its rate per screen the cheapest real
 * measure of whether the product is working — but only if it cannot be bypassed,
 * hence the single import path.
 *
 * PRIVACY: the toast MESSAGE never travels. It is free text, routinely an API
 * error echoing a field the user typed, and it is exactly what the catalogue's
 * denylist exists to keep out. Only `kind` — the toast variant, an enum — is
 * sent; which screen it happened on comes from posthog's own `$pathname`.
 *
 * Everything else (`success`, `info`, `promise`, `dismiss`, …) passes straight
 * through, so this is a drop-in for `import { toast } from "sonner"`.
 */
import { toast as sonner } from "sonner";
import { track } from "@/lib/analytics";

type Sonner = typeof sonner;

/** Best-effort by construction: track() already swallows its own failures. */
const announce = (kind: "error" | "warning") =>
  track("ui_error_toast_shown", { kind });

export const toast: Sonner = Object.assign(
  ((...args: Parameters<Sonner>) => sonner(...args)) as Sonner,
  sonner,
  {
    error: ((...args: Parameters<Sonner["error"]>) => {
      announce("error");
      return sonner.error(...args);
    }) as Sonner["error"],
    warning: ((...args: Parameters<Sonner["warning"]>) => {
      announce("warning");
      return sonner.warning(...args);
    }) as Sonner["warning"],
  },
);

export default toast;
