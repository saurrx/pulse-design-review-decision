import React, { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import useUserCookie from "@/hooks/use-auth";

export type DashboardHeaderAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
};

export type DashboardHeaderConfig = {
  title: string;
  eyebrow?: string;
  back?: {
    label: string;
    to: string;
  };
  actions?: ReactNode;
  primaryAction?: DashboardHeaderAction;
};

/**
 * The header's primary button, exported so a page portalling its own controls
 * renders the SAME markup rather than a lookalike that drifts out of step.
 */
export const HeaderPrimaryAction = ({ action }: { action: DashboardHeaderAction }) => (
  <button
    type="button"
    onClick={action.onClick}
    disabled={action.disabled}
    className="inline-flex h-9 items-center gap-2 rounded-sm bg-[var(--pulse-brand)] px-3.5 text-sm font-semibold text-[var(--pulse-ink)] shadow-[0_8px_18px_-14px_rgba(17,16,60,0.6)] transition-[background-color,box-shadow,transform] hover:brightness-[0.97] hover:shadow-[0_10px_22px_-14px_rgba(17,16,60,0.7)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-brand)]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
  >
    {action.icon}
    <span className="hidden sm:inline">{action.label}</span>
    {typeof action.count === "number" && action.count > 0 && (
      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--pulse-ink)]/10 px-1.5 text-xs leading-5">
        {action.count}
      </span>
    )}
  </button>
);

const Header = ({
  title,
  eyebrow,
  back,
  actions,
  primaryAction,
  titleSlotRef,
  actionsSlotRef,
  titleSlotFilled,
}: DashboardHeaderConfig & {
  titleSlotRef?: React.Ref<HTMLSpanElement>;
  actionsSlotRef?: React.Ref<HTMLSpanElement>;
  titleSlotFilled?: boolean;
}) => {
  const { user } = useUserCookie();
  const workspaceName =
    eyebrow ||
    user?.organization_name ||
    user?.company ||
    user?.client?.name ||
    "Photon Legal";

  return (
    <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-[var(--pulse-line)] bg-[var(--pulse-surface)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-[1680px] items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <Link
              to={back.to}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-[var(--pulse-ink-muted)] transition-colors hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pulse-brand)]/40"
              aria-label={back.label}
              title={back.label}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}

          <p className="hidden max-w-[220px] truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)] sm:block">
            {workspaceName}
          </p>
          <span
            className="hidden h-4 w-px shrink-0 bg-[var(--pulse-line-strong)] sm:block"
            aria-hidden="true"
          />
          <h1 className="truncate font-sans text-base font-semibold tracking-[-0.015em] text-[var(--pulse-ink)]">
            {/* The route-derived title, plus a slot a page can portal its own
                into (a client's name). The slot sits AFTER the default and
                hides it once filled, so the header never flashes empty while a
                page's data loads. */}
            <span className={titleSlotFilled ? "hidden" : undefined}>{title}</span>
            <span ref={titleSlotRef} />
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {/* Where a page portals its own controls. */}
          <span ref={actionsSlotRef} className="flex shrink-0 items-center gap-2" />

          {primaryAction && <HeaderPrimaryAction action={primaryAction} />}
        </div>
      </div>
    </header>
  );
};

export default Header;
