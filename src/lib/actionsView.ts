/**
 * View helpers shared by the two actions screens.
 *
 * `IHCActionsContent` (the client's own queue) and `OCActionsContent` (Photon's
 * cross-client queue) are separate screens for separate roles, and they should
 * stay separate. But a clone scan on 2026-09-03 found four helpers that were
 * byte-identical between them — the same urgency thresholds, the same filter
 * labels, the same column toggle — copied rather than shared.
 *
 * Only the PURE ones live here. `handleFilterChange` and `handleSortChange` are
 * also identical but close over each screen's own state setters and page
 * counter, and lifting them would mean inventing a hook to carry state that the
 * two screens legitimately own; that is a bigger change than the duplication
 * costs. Duplication that is a fact about the data model belongs here.
 * Duplication that is a fact about a component's own state does not.
 */

export type ActionsFilterOption = "all" | "upcoming" | "dueToday" | "overdue";

/**
 * The urgency ramp for "days until due".
 *
 * These four thresholds are the docket's definition of urgent, not a styling
 * choice, which is why both screens had to agree and why they now cannot
 * disagree by accident. `null` means no due date and deliberately returns "" —
 * an undated row is not green, it is uncoloured.
 */
export function daysColor(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return "text-red-600 font-semibold";
  if (days <= 7) return "text-red-500";
  if (days <= 30) return "text-amber-600";
  return "text-green-600";
}

/** The label shown on the filter control for each filter value. */
export function filterLabel(filter: ActionsFilterOption): string {
  switch (filter) {
    case "all": return "All Actions";
    case "upcoming": return "Upcoming";
    case "dueToday": return "Due Today";
    case "overdue": return "Overdue";
    default: return "All Actions";
  }
}

/**
 * Flip one column's visibility, returning a NEW array.
 *
 * Pure so it can be tested and story-driven without mounting either screen;
 * each caller keeps its own `setColumns`.
 */
export function toggleColumn<T extends { id: string; visible: boolean }>(
  columns: T[],
  columnId: string,
): T[] {
  return columns.map((col) =>
    col.id === columnId ? { ...col, visible: !col.visible } : col,
  );
}
