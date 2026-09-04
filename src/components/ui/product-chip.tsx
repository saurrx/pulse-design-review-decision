import * as React from "react";

import { cn } from "@/lib/utils";

export type ProductChipKind = "status" | "metadata" | "tag" | "count";
export type ProductChipTone =
  | "neutral"
  | "warning"
  | "info"
  | "success"
  | "danger";

type ProductChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  kind?: ProductChipKind;
  tone?: ProductChipTone;
  icon?: React.ReactNode;
  marker?: boolean;
  markerColor?: string;
  textColor?: string;
};

const KIND_CLASSES: Record<ProductChipKind, string> = {
  status:
    "h-6 gap-1.5 rounded-xs border px-2 text-[12px] font-semibold leading-none",
  metadata:
    "h-6 gap-1.5 rounded-xs border px-2 text-[11px] font-semibold uppercase leading-none tracking-[0.06em]",
  tag:
    "h-6 gap-1 rounded-xs border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-2 text-[12px] font-normal leading-none text-[var(--pulse-ink-muted)]",
  count:
    "h-5 min-w-5 justify-center rounded-full border border-transparent bg-[var(--pulse-surface-subtle)] px-1.5 text-[11px] font-semibold leading-none tabular-nums text-[var(--pulse-ink-secondary)]",
};

const TONE_CLASSES: Record<ProductChipTone, string> = {
  neutral:
    "border-[var(--pulse-line)] bg-[var(--pulse-surface)] text-[var(--pulse-ink-secondary)]",
  warning:
    "border-[var(--pulse-line)] bg-[var(--pulse-surface)] text-[#7E5A00]",
  info:
    "border-[var(--pulse-line)] bg-[var(--pulse-surface)] text-[var(--pulse-info)]",
  success:
    "border-[var(--pulse-line)] bg-[var(--pulse-surface)] text-[var(--pulse-success)]",
  danger:
    "border-[var(--pulse-line)] bg-[var(--pulse-surface)] text-[var(--pulse-danger)]",
};

const TONE_MARKERS: Record<ProductChipTone, string> = {
  neutral: "#727272",
  warning: "var(--pulse-brand)",
  info: "var(--pulse-info)",
  success: "var(--pulse-success)",
  danger: "var(--pulse-danger)",
};

export const ProductChip = React.forwardRef<HTMLSpanElement, ProductChipProps>(
  (
    {
      kind = "status",
      tone = "neutral",
      icon,
      marker,
      markerColor,
      textColor,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const showMarker = marker ?? kind === "status";
    const resolvedMarkerColor = markerColor || TONE_MARKERS[tone];
    const customColorStyle = textColor ? { color: textColor } : undefined;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex shrink-0 items-center whitespace-nowrap font-sans",
          KIND_CLASSES[kind],
          kind === "status" || kind === "metadata"
            ? TONE_CLASSES[tone]
            : undefined,
          className,
        )}
        style={{ ...customColorStyle, ...style }}
        {...props}
      >
        {showMarker && (
          <span
            aria-hidden="true"
            className="h-[7px] w-[7px] shrink-0"
            style={{ backgroundColor: resolvedMarkerColor }}
          />
        )}
        {icon && <span className="inline-flex shrink-0 items-center">{icon}</span>}
        {typeof children === "string" || typeof children === "number" ? (
          <span className="truncate">{children}</span>
        ) : (
          children
        )}
      </span>
    );
  },
);

ProductChip.displayName = "ProductChip";
