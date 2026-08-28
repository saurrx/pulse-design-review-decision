// Mirrors the PATENT_LEGAL_STATUS Prisma enum. Keep in sync with
// photon-legal-backend/prisma/schema.prisma.

export const PATENT_LEGAL_STATUS = {
  ACTIVE_GRANTED: "ACTIVE_GRANTED",
  ACTIVE_APPLIED: "ACTIVE_APPLIED",
  ACTIVE_EXAMINATION: "ACTIVE_EXAMINATION",
  INACTIVE_EXPIRED: "INACTIVE_EXPIRED",
  INACTIVE_WITHDRAWN: "INACTIVE_WITHDRAWN",
  INACTIVE_REJECTED: "INACTIVE_REJECTED",
  INACTIVE_ABANDONED: "INACTIVE_ABANDONED",
  INACTIVE_NONPAYMENT: "INACTIVE_NONPAYMENT",
} as const;

export type PatentLegalStatus =
  (typeof PATENT_LEGAL_STATUS)[keyof typeof PATENT_LEGAL_STATUS];

export const PATENT_LEGAL_STATUS_VALUES: PatentLegalStatus[] = [
  "ACTIVE_GRANTED",
  "ACTIVE_APPLIED",
  "ACTIVE_EXAMINATION",
  "INACTIVE_EXPIRED",
  "INACTIVE_WITHDRAWN",
  "INACTIVE_REJECTED",
  "INACTIVE_ABANDONED",
  "INACTIVE_NONPAYMENT",
];

interface StatusMeta {
  label: string;
  badge: string;
  // Pulse design-token chip pair: square marker fill + label text ink.
  // Color system (intentional): neutral grey = normal in-flight states
  // (Applied) and states that ended naturally (Expired, Withdrawn);
  // blue = under examination; green = granted; red = ended badly or
  // needs attention (Rejected, Abandoned, Nonpayment).
  marker: string;
  text: string;
}

export const PATENT_LEGAL_STATUS_META: Record<PatentLegalStatus, StatusMeta> = {
  ACTIVE_GRANTED: {
    label: "Active – Granted",
    badge:
      "dark:bg-emerald-500/20 dark:text-emerald-500 dark:border-emerald-800 bg-emerald-100 text-emerald-700 border-emerald-500/50",
    marker: "#1E7B4D",
    text: "#155C3B",
  },
  ACTIVE_APPLIED: {
    label: "Active – Applied",
    badge:
      "dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-400 bg-blue-100 text-blue-700 border-blue-400",
    // Normal in-flight states stay neutral; color is reserved for
    // exceptional outcomes so repeated chips don't become noise.
    marker: "#727272",
    text: "#444444",
  },
  ACTIVE_EXAMINATION: {
    label: "Active – Examination",
    badge:
      "dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-100 text-indigo-700 border-indigo-400",
    marker: "#4351C0",
    text: "#333F99",
  },
  INACTIVE_EXPIRED: {
    label: "Inactive – Expired",
    badge:
      "dark:bg-neutral-500/20 dark:text-neutral-400 dark:border-neutral-600 bg-neutral-100 text-neutral-700 border-neutral-400",
    marker: "#727272",
    text: "#444444",
  },
  INACTIVE_WITHDRAWN: {
    label: "Inactive – Withdrawn",
    badge:
      "dark:bg-neutral-500/20 dark:text-neutral-400 dark:border-neutral-600 bg-neutral-100 text-neutral-700 border-neutral-400",
    marker: "#727272",
    text: "#444444",
  },
  INACTIVE_REJECTED: {
    label: "Inactive – Rejected",
    badge:
      "dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 bg-red-100 text-red-700 border-red-300",
    marker: "#B3362F",
    text: "#8E2B25",
  },
  INACTIVE_ABANDONED: {
    label: "Inactive – Abandoned",
    badge:
      "dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 bg-red-100 text-red-700 border-red-300",
    marker: "#B3362F",
    text: "#8E2B25",
  },
  INACTIVE_NONPAYMENT: {
    label: "Inactive – Nonpayment",
    badge:
      "dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 bg-red-100 text-red-700 border-red-300",
    marker: "#B3362F",
    text: "#8E2B25",
  },
};

export const getPatentLegalStatusLabel = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  return PATENT_LEGAL_STATUS_META[value as PatentLegalStatus]?.label ?? null;
};
