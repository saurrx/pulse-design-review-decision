/**
 * Canonical product-surface primitives.
 *
 * Keep composed dashboard surfaces here so cards, section headers, and
 * segmented controls do not drift as individual pages evolve.
 */
export const PRODUCT_CARD_CLASS =
  "rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] p-6 font-sans [box-shadow:var(--pulse-shadow-card)]";

export const PRODUCT_CARD_TITLE_CLASS =
  "text-[16px] font-semibold leading-5 tracking-[-0.015em] text-[var(--pulse-ink)]";

export const PRODUCT_CARD_DESCRIPTION_CLASS =
  "mt-1 text-[13px] leading-[18px] text-[var(--pulse-ink-muted)]";

export const PRODUCT_SEGMENTED_CONTROL_CLASS =
  "inline-flex shrink-0 items-center rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] p-1";

export const PRODUCT_SEGMENTED_ITEM_CLASS =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150";
