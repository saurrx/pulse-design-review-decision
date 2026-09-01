
import React from 'react';
import { useTrackOnce } from "@/lib/analytics";
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/DashboardChrome';
import DueDatesContent, {
  type DueDatesHeaderState,
  type DueDatesViewType,
} from '@/components/due-dates/DueDatesContent';
import { CalendarDays, List } from 'lucide-react';

const DueDatesPage: React.FC = () => {
  useTrackOnce("due_dates_viewed");
  const location = useLocation();
  const initialView = (location.state?.initialView || 'list') as DueDatesViewType;
  const [headerState, setHeaderState] = React.useState<DueDatesHeaderState>({
    viewType: initialView,
    total: 0,
    onViewChange: () => undefined,
  });
  
  return (
    <>
      <PageHeader
        actions={(
          <>
            <div className="hidden h-9 items-center gap-1 rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] p-1 sm:flex">
              <button
                type="button"
                onClick={() => headerState.onViewChange('list')}
                className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
                  headerState.viewType === 'list'
                    ? 'bg-[var(--pulse-surface)] text-[var(--pulse-ink)] shadow-sm'
                    : 'text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]'
                }`}
                aria-label="List view"
                aria-pressed={headerState.viewType === 'list'}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => headerState.onViewChange('calendar')}
                className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
                  headerState.viewType === 'calendar'
                    ? 'bg-[var(--pulse-surface)] text-[var(--pulse-ink)] shadow-sm'
                    : 'text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]'
                }`}
                aria-label="Calendar view"
                aria-pressed={headerState.viewType === 'calendar'}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden h-9 items-center rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-3 text-xs text-[var(--pulse-ink-muted)] md:flex">
              Deliverables due
              <strong className="ml-2 font-semibold tabular-nums text-[var(--pulse-ink)]">
                {headerState.total}
              </strong>
            </div>
          </>
        )}
      />
      <DueDatesContent
        initialView={initialView}
        onHeaderStateChange={setHeaderState}
      />
    </>
  );
};

export default DueDatesPage;
