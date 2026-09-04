import React from "react";
import { CalendarDays, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { FilterButton } from "@/components/ui/filter-button";
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  isDateFilterActive,
  type DatePreset,
} from "@/lib/dateRange";

/**
 * The filing-date filter: five presets and a custom from/to.
 *
 * Pulled out of PatentsContent (138 lines of inline JSX) on 2026-09-03. One
 * call site today, and that is the point rather than a problem: a control that
 * lives inside a 2,500-line screen cannot be reviewed on its own or rendered in
 * a story, and the "Clear date filter" row is the kind of thing that is very
 * easy to break and very hard to notice. Owns no state — the screen still
 * decides what a preset change means (reset the page, emit analytics).
 */
export interface DateRangeFilterProps {
  preset: DatePreset;
  from: string;
  to: string;
  onPresetChange: (preset: DatePreset) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
  /** Heading inside the popover. */
  title?: string;
  /** Trigger label. */
  label?: string;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  preset, from, to, onPresetChange, onFromChange, onToChange, onClear,
  title = "Filter by Filing Date", label = "Date",
}) => {
  const active = isDateFilterActive(preset);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FilterButton icon={<CalendarDays />} active={active} data-testid="date-filter-trigger">
          {label}
        </FilterButton>
      </PopoverTrigger>
      {/* aria-labelledby: a Radix popover is role="dialog", and axe fails a dialog
          with no accessible name. The inline original had none — found by the
          Storybook a11y run the day this was extracted. */}
      <PopoverContent
        sideOffset={8}
        aria-labelledby="date-filter-title"
        className="w-[260px] p-0 dark:border dark:border-[#cccccc20] dark:bg-neutral-900"
      >
        <div id="date-filter-title" className="px-4 pt-3 font-sans text-sm font-bold text-neutral-900 dark:text-zinc-200">{title}</div>
        <div className="space-y-0.5 p-3 font-sans">
          {DATE_PRESETS.map((p) => {
            const isActive = preset === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onPresetChange(p)}
                className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[#F9B418]/15 text-[#F9B418]"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-zinc-200 dark:hover:bg-white/5"
                }`}
              >
                <span>{DATE_PRESET_LABELS[p]}</span>
                {isActive && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            );
          })}

          {preset === "custom" && (
            <div className="mt-2 space-y-2 border-t pt-3 dark:border-[#cccccc20]" data-testid="date-filter-custom">
              <div className="space-y-1">
                <label htmlFor="date-filter-from" className="text-xs text-neutral-500 dark:text-neutral-400">From</label>
                <Input
                  id="date-filter-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => onFromChange(e.target.value)}
                  className="h-8 border-neutral-200 bg-white text-xs text-neutral-700 dark:border-[#cccccc20] dark:bg-neutral-950 dark:text-zinc-200 dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="date-filter-to" className="text-xs text-neutral-500 dark:text-neutral-400">To</label>
                <Input
                  id="date-filter-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => onToChange(e.target.value)}
                  className="h-8 border-neutral-200 bg-white text-xs text-neutral-700 dark:border-[#cccccc20] dark:bg-neutral-950 dark:text-zinc-200 dark:[color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {active && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 w-full rounded-sm px-2 py-1.5 text-left text-xs text-neutral-400 transition-colors hover:bg-[#F9B418]/10 hover:text-[#F9B418]"
            >
              Clear date filter
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangeFilter;
