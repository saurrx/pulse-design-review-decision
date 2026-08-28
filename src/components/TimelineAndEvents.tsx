import React, { useState, useMemo } from "react";
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, List, RotateCcw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import useUserCookie from "@/hooks/use-auth";
import {
  isPatentEventCompleted,
  usePatentEventCompletion,
} from "@/hooks/usePatentEventCompletion";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import moment from "moment";
import { motion } from "framer-motion";
import {
  PRODUCT_CARD_CLASS,
  PRODUCT_CARD_DESCRIPTION_CLASS,
  PRODUCT_CARD_TITLE_CLASS,
  PRODUCT_SEGMENTED_CONTROL_CLASS,
  PRODUCT_SEGMENTED_ITEM_CLASS,
} from "@/components/ui/product-surfaces";
import {
  ProductChip,
  type ProductChipTone,
} from "@/components/ui/product-chip";

const DUE_SOON_DAYS = 30;

const getEventTone = (event: any): ProductChipTone => {
  if (isPatentEventCompleted(event)) {
    return "success";
  }

  const today = new Date();
  const eventDate = new Date(event?.event_date);
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  if (eventDate < today) {
    return "danger";
  }
  if (eventDate.getTime() === today.getTime()) {
    return "warning";
  }
  const daysUntilEvent = Math.ceil(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysUntilEvent <= DUE_SOON_DAYS ? "warning" : "neutral";
};

// Helper to format month and year
const formatMonthYear = (date: Date) => {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

// Helper to get days in month
const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

// Helper to get first day of month (0 = Sunday, 1 = Monday, etc.)
const getFirstDayOfMonth = (date: Date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  // Convert to Monday = 0 format
  return (firstDay.getDay() + 6) % 7;
};

const TimelineAndEvents = ({
  dueDates,
  isLoading,
  pagination,
  onPageChange,
  onItemsPerPageChange,
  setMonth,
  setYear,
  refetch,
}: {
  dueDates: any[];
  isLoading: boolean;
  pagination: any;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
  refetch: () => void;
}) => {
  const { theme } = useTheme();
  const { user } = useUserCookie();
  const eventCompletion = usePatentEventCompletion();
  const canManageEvents = isOutsideCounselRole(user?.role);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [isShowApplication, setIsShowApplication] = useState<string | null>(
    null,
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleShowApplication = (applicationNumber) => {
    setIsShowApplication(
      isShowApplication === applicationNumber ? null : applicationNumber,
    );
  };

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days: (number | null)[] = [];

    // leading empty days
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    // trailing empty days → force 42 cells
    while (days.length < 42) {
      days.push(null);
    }

    return days;
  }, [currentDate]);

  // Map due dates to calendar days
  const eventsByDay = useMemo(() => {
    if (!dueDates || dueDates.length === 0) return {};

    const events: Record<number, any[]> = {};

    dueDates.forEach((dueDate) => {
      if (dueDate.event_date) {
        const eventDate = new Date(dueDate.event_date);
        if (
          eventDate.getMonth() === currentDate.getMonth() &&
          eventDate.getFullYear() === currentDate.getFullYear()
        ) {
          const day = eventDate.getDate();
          if (!events[day]) {
            events[day] = [];
          }
          events[day].push(dueDate);
        }
      }
    });

    return events;
  }, [dueDates, currentDate, refetch]);

  const showClientName = useMemo(() => {
    const names = new Set(
      (dueDates || [])
        .map(
          (event) =>
            event.patent?.assignee_original ||
            event.patent?.client_name ||
            event.counsel,
        )
        .filter(Boolean),
    );
    return names.size > 1;
  }, [dueDates]);

  // Navigation handlers
  const handlePreviousMonth = async () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
    await setMonth(currentDate?.getMonth() ? currentDate?.getMonth() : 12);
    await setYear(
      currentDate?.getMonth()
        ? currentDate?.getFullYear()
        : currentDate?.getFullYear() - 1,
    );

    refetch();
  };

  const handleNextMonth = async () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
    await setMonth(
      currentDate?.getMonth() + 2 === 0
        ? 12
        : currentDate?.getMonth() + 2 === 13
          ? 1
          : currentDate?.getMonth() + 2,
    );
    await setYear(
      currentDate?.getMonth() + 2 === 13
        ? currentDate?.getFullYear() + 1
        : currentDate?.getFullYear(),
    );

    refetch();
  };

  const weekDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <motion.div
      className={`${PRODUCT_CARD_CLASS} relative mb-20 overflow-hidden md:mb-0`}
    >
      <div className="relative z-10 font-sans">
        <div className="mb-5 flex items-center justify-between gap-5">
          <div>
            <h2 className={PRODUCT_CARD_TITLE_CLASS}>
              Timeline & Events
            </h2>
            <p className={PRODUCT_CARD_DESCRIPTION_CLASS}>
              Upcoming deadlines and meetings
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className={PRODUCT_SEGMENTED_CONTROL_CLASS}>
              <button
                onClick={() => setViewMode("calendar")}
                className={`${PRODUCT_SEGMENTED_ITEM_CLASS} ${
                  viewMode === "calendar"
                    ? "bg-white text-[var(--pulse-ink)] shadow-[0_1px_3px_rgba(17,16,60,0.10)]"
                    : "text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`${PRODUCT_SEGMENTED_ITEM_CLASS} ${
                  viewMode === "list"
                    ? "bg-white text-[var(--pulse-ink)] shadow-[0_1px_3px_rgba(17,16,60,0.10)]"
                    : "text-[var(--pulse-ink-muted)] hover:text-[var(--pulse-ink)]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
            {/* Month Navigation */}
            <div className="flex items-center gap-2 font-sans">
              <button
                onClick={handlePreviousMonth}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--pulse-line)] bg-white text-[var(--pulse-ink-secondary)] transition-colors hover:border-[var(--pulse-line-strong)] hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span
                className="min-w-[88px] text-center text-[13px] font-semibold text-[var(--pulse-ink-secondary)]"
              >
                {formatMonthYear(currentDate)}
              </span>
              <button
                onClick={handleNextMonth}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--pulse-line)] bg-white text-[var(--pulse-ink-secondary)] transition-colors hover:border-[var(--pulse-line-strong)] hover:bg-[var(--pulse-surface-subtle)] hover:text-[var(--pulse-ink)]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid — always rendered; empty months get a note above it */}
        {viewMode === "calendar" && Object.keys(eventsByDay).length === 0 && (
          <div className="mb-3 rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-4 py-2 text-center text-[13px] text-[var(--pulse-ink-muted)]">
            No deadlines or meetings in{" "}
            {currentDate.toLocaleString("en-US", { month: "long" })}
          </div>
        )}
        {viewMode === "calendar" && (
          <div className="overflow-hidden rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface)] font-sans">
            {/* Week Day Headers */}
            <div className="grid grid-cols-7 border-b border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)]">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="border-r border-[var(--pulse-line)] py-2.5 text-center text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)] last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days - Split into weeks */}
            {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map(
              (_, weekIndex) => (
                <div
                  key={weekIndex}
                  className="grid grid-cols-7 border-b border-[var(--pulse-line)] last:border-b-0"
                >
                  {calendarDays
                    .slice(weekIndex * 7, (weekIndex + 1) * 7)
                    .map((day, dayIndex) => {
                      const globalIndex = weekIndex * 7 + dayIndex;

                      if (day === null) {
                        return (
                          <div
                            key={`empty-${globalIndex}`}
                            className="h-[84px] border-r border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] last:border-r-0"
                          />
                        );
                      }

                      const dayEvents = eventsByDay[day] || [];

                      return (
                        <div
                          key={day}
                          className="h-[84px] border-r border-[var(--pulse-line)] p-2 transition-colors last:border-r-0 hover:bg-[var(--pulse-surface-subtle)]"
                        >
                          <div className="mb-1 text-[12px] font-medium text-[var(--pulse-ink-muted)]">
                            {day}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event, eventIndex) => {
                              const tone = getEventTone(event);
                              const eventTitle =
                                event.event_name ||
                                event.event ||
                                "Event";
                              const clientName =
                                event.patent?.assignee_original ||
                                event.patent?.client_name ||
                                event.counsel ||
                                "";
                              const applicationNumber =
                                event.patent?.application_number;

                              return (
                                <div key={event.id || eventIndex} className="space-y-1">
                                  <button
                                    onClick={() =>
                                      handleShowApplication(applicationNumber)
                                    }
                                    className="block w-full cursor-pointer text-left"
                                    title={eventTitle}
                                  >
                                    <ProductChip kind="status" tone={tone} className="pointer-events-none w-full max-w-full justify-start">
                                      {eventTitle}
                                    </ProductChip>
                                  </button>
                                  {showClientName && clientName && (
                                    <div className="truncate px-2 text-[11px] text-[var(--pulse-ink-muted)]">{clientName}</div>
                                  )}

                                  {isShowApplication === applicationNumber && (
                                    <div
                                      className="text-xs px-2 py-1.5 rounded space-y-0.5 bg-black/[0.02] border-black/[0.08] dark:bg-white/[0.03] border dark:border-white/[0.08] text-zinc-600 dark:text-zinc-400"
                                      style={{ opacity: "1", height: "auto" }}
                                    >
                                      <motion.div
                                        className="flex items-start gap-1"
                                        initial={
                                          isShowApplication
                                            ? { scaleY: 0, display: "none" }
                                            : false
                                        }
                                        animate={
                                          isShowApplication
                                            ? { scaleY: 1, display: "flex" }
                                            : false
                                        }
                                        transition={{
                                          ease: "easeInOut",
                                          duration: 0.1,
                                          delay: 0.06,
                                        }}
                                        style={{ transformOrigin: "top" }}
                                      >
                                        <span className="text-zinc-500">
                                          App:
                                        </span>
                                        <span className="font-medium">
                                          {applicationNumber}
                                        </span>
                                      </motion.div>
                                      {canManageEvents && (
                                        <button
                                          type="button"
                                          disabled={eventCompletion.isPending}
                                          onClick={(clickEvent) => {
                                            clickEvent.stopPropagation();
                                            eventCompletion.mutate({
                                              eventId: event.id,
                                              completed: !isPatentEventCompleted(event),
                                            });
                                          }}
                                          className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[var(--pulse-info)] disabled:opacity-50"
                                        >
                                          {isPatentEventCompleted(event) ? (
                                            <RotateCcw className="h-3.5 w-3.5" />
                                          ) : (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          )}
                                          {isPatentEventCompleted(event) ? "Reopen event" : "Mark done"}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="px-1 text-[11px] font-medium text-[var(--pulse-ink-muted)]">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ),
            )}
          </div>
        )}
        {viewMode === "list" && (
          <div
            className={`mx-auto space-y-1 overflow-y-auto ${
              dueDates?.length === 0
                ? "min-h-[160px] max-h-[160px]"
                : "min-h-[400px] max-h-[400px]"
            }`}
          >
            {dueDates?.map((item, index) => {
              const today = new Date();
              const eventDate = new Date(item?.event_date);
              const isCleared = isPatentEventCompleted(item);

              today.setHours(0, 0, 0, 0);
              eventDate.setHours(0, 0, 0, 0);
              const isOverdue = eventDate < today;
              const isToday = eventDate.getTime() === today.getTime();

              const diffTime = eventDate.getTime() - today.getTime();

              const daysLeft =
                diffTime <= 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={item.id}
                  className={`border-b overflow-hidden ${
                    theme === "dark"
                      ? "border-[#cccccc20] hover:bg-white/5"
                      : "border-gray-200/70 hover:bg-gray-50"
                  }`}
                >
                  {/* Header */}
                  <button
                    onClick={() => toggle(index)}
                    className={`flex min-h-14 w-full items-center justify-between px-4 py-2 text-left transition-colors duration-150 ${
                      theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-4">
                        <div className="grid">
                          <span className="font-semibold text-sm text-start font-sans">
                            {item.event_name}
                          </span>
                          <p className="text-start font-sans text-[12px] font-normal text-[var(--pulse-ink-muted)]">
                            {moment(item?.event_date).format("MMM D, YYYY · h:mm A")}
                            {showClientName && item.patent?.assignee_original
                              ? ` · ${item.patent.assignee_original}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <ProductChip kind="status" tone={getEventTone(item)} className="min-w-[64px] justify-center">
                      {isCleared
                        ? "Cleared"
                        : isOverdue
                          ? "Overdue"
                          : isToday
                            ? "Today"
                            : `${daysLeft}d`}
                    </ProductChip>
                  </button>

                  {/* Content */}
                  <div
                    className={`overflow-hidden transition-all duration-150 ease-out ${
                      openIndex === index
                        ? "max-h-40 opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    <div
                      className={`px-4 py-3 ${
                        theme === "dark"
                          ? "bg-zinc-800 border-[#cccccc20] text-gray-400"
                          : "bg-[#00000005] text-gray-500"
                      } mx-3 mb-3 border rounded-lg text-xs`}
                    >
                      Application No:{" "}
                      <span
                        className={`text-xs font-semibold ${
                          theme === "dark" ? "text-gray-200" : "text-gray-700"
                        } tracking-wider ml-1`}
                      >
                        {item?.patent?.application_number}
                      </span>
                      {canManageEvents && (
                        <button
                          type="button"
                          disabled={eventCompletion.isPending}
                          onClick={() =>
                            eventCompletion.mutate({
                              eventId: item.id,
                              completed: !isCleared,
                            })
                          }
                          className="ml-4 inline-flex items-center gap-1.5 font-semibold text-[var(--pulse-info)] disabled:opacity-50"
                        >
                          {isCleared ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {isCleared ? "Reopen event" : "Mark done"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {dueDates?.length === 0 && (
              <div
                className="mx-auto my-14 flex justify-center text-sm text-[var(--pulse-ink-muted)]"
              >
                <p>No upcoming deadlines or meetings.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TimelineAndEvents;
