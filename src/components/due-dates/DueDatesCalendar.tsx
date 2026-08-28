
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, FileText, Building2, RotateCcw } from 'lucide-react';
import { format, addMonths, subMonths, setMonth, setYear, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addYears, subYears, getMonth, getYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { ProductChip, type ProductChipTone } from '@/components/ui/product-chip';

interface DueDate {
  id: string;
  event: string;
  patent: string;
  counsel: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
  country: string;
  applicationNumber?: string;
  eventStatus?: string;
  completedAt?: string | null;
}

interface DueDatesCalendarProps {
  dueDates: DueDate[];
  canManageEvents?: boolean;
  updatingEventId?: string;
  onEventCompletion?: (eventId: string, completed: boolean) => void;
}

const DueDatesCalendar: React.FC<DueDatesCalendarProps> = ({ 
  dueDates,
  canManageEvents = false,
  updatingEventId,
  onEventCompletion,
}) => {
  const formatStatusLabel = (status?: string) =>
    (status || "Unknown")
      .replace(/_APPLIED$/i, "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const { theme } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DueDate | null>(null);

  const isCompleted = (event: DueDate) =>
    ["COMPLETED", "CLEARED"].includes(
      String(event.eventStatus || "").toUpperCase(),
    ) || Boolean(event.completedAt);
  
  // Add scrollbar styles on mount
  useEffect(() => {
    const styleId = 'due-dates-calendar-scrollbar-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .scrollbar-light::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .scrollbar-light::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .scrollbar-light::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .scrollbar-light::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .scrollbar-dark::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .scrollbar-dark::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 4px;
        }
        .scrollbar-dark::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 4px;
        }
        .scrollbar-dark::-webkit-scrollbar-thumb:hover {
          background: #525252;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  
  const currentMonth = format(currentDate, 'MMMM');
  const currentYear = format(currentDate, 'yyyy');
  
  // Calculate the years range for the dropdown
  const startYear = 2022;
  const endYear = 2026;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  
  // Calculate the days of the current month
  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  
  // Calculate the dates of the previous and next month to fill the calendar
  const prevMonthDays: Date[] = [];
  let prevDate = new Date(firstDayOfMonth);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevDate = new Date(firstDayOfMonth);
    prevDate.setDate(prevDate.getDate() - (i + 1));
    prevMonthDays.push(prevDate);
  }
  
  // Calculate the dates of the next month to fill the calendar
  const nextMonthDays: Date[] = [];
  const lastDayOfWeek = lastDayOfMonth.getDay();
  
  if (lastDayOfWeek < 6) {
    for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
      const nextDate = new Date(lastDayOfMonth);
      nextDate.setDate(nextDate.getDate() + i);
      nextMonthDays.push(nextDate);
    }
  }
  
  // Map events to calendar dates
  const eventsMap = useMemo(() => {
    const map = new Map();
    
    dueDates.forEach(dueDate => {
      const date = new Date(dueDate.dueDate);
      const dateStr = date.toISOString().split('T')[0];
      
      if (map.has(dateStr)) {
        map.get(dateStr).push(dueDate);
      } else {
        map.set(dateStr, [dueDate]);
      }
    });
    
    return map;
  }, [dueDates]);
  
  // Get events for the selected date
  const eventsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    
    const dateStr = selectedDate.toISOString().split('T')[0];
    return eventsMap.get(dateStr) || [];
  }, [selectedDate, eventsMap]);

  // Get events for the current month when no date is selected
  const eventsForCurrentMonth = useMemo(() => {
    if (selectedDate || selectedEvent) return [];
    
    // Filter events for the current month
    return dueDates.filter(dueDate => {
      const date = new Date(dueDate.dueDate);
      return isSameMonth(date, currentDate);
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [currentDate, dueDates, selectedDate, selectedEvent]);
  
  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setSelectedDate(null);
    setSelectedEvent(null);
  };
  
  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setSelectedDate(null);
    setSelectedEvent(null);
  };
  
  const handlePrevYear = () => {
    setCurrentDate(subYears(currentDate, 1));
    setSelectedDate(null);
    setSelectedEvent(null);
  };
  
  const handleNextYear = () => {
    setCurrentDate(addYears(currentDate, 1));
    setSelectedDate(null);
    setSelectedEvent(null);
  };
  
  const handleMonthChange = (month: string) => {
    const monthIndex = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(month);
    if (monthIndex !== -1) {
      setCurrentDate(setMonth(currentDate, monthIndex));
      setSelectedDate(null);
      setSelectedEvent(null);
    }
  };
  
  const handleYearChange = (year: string) => {
    setCurrentDate(setYear(currentDate, parseInt(year)));
    setSelectedDate(null);
    setSelectedEvent(null);
  };
  
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
  };
  
  const handleEventClick = (event: DueDate) => {
    setSelectedEvent(event);
  };
  
  const getEventTone = (event: DueDate): ProductChipTone =>
    isCompleted(event)
      ? 'success'
      : event.daysOverdue > 0
        ? 'danger'
        : event.daysOverdue === 0
          ? 'warning'
          : 'success';
  
  const formatEventDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };
  
  // Reset selected event when changing date/month/year
  useEffect(() => {
    setSelectedEvent(null);
  }, [selectedDate, currentDate]);

  useEffect(() => {
    if (!selectedEvent) return;
    const latest = dueDates.find((event) => event.id === selectedEvent.id);
    if (latest) setSelectedEvent(latest);
  }, [dueDates, selectedEvent?.id]);

  // Get all days of the month including padding days - always exactly 42 cells (6 rows × 7 days)
  const allDays = useMemo(() => {
    const firstDay = startOfMonth(currentDate);
    const lastDay = endOfMonth(currentDate);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const days: Date[] = [];
    
    // Add padding days at the start to fill the first week
    // If first day is Sunday (0), no padding needed
    // If first day is Monday (1), we need 1 day (Sunday)
    // If first day is Tuesday (2), we need 2 days (Sunday, Monday), etc.
    for (let i = 0; i < startDayOfWeek; i++) {
      const date = new Date(firstDay);
      date.setDate(date.getDate() - (startDayOfWeek - i));
      days.push(date);
    }
    
    // Add all days of the current month
    const monthDays = eachDayOfInterval({ start: firstDay, end: lastDay });
    days.push(...monthDays);
    
    // Calculate how many days we have so far
    const currentCount = days.length;
    
    // Add padding days at the end to complete exactly 42 cells (6 weeks × 7 days)
    const remaining = Math.max(0, 42 - currentCount);
    
    // Always add exactly the remaining days needed to reach 42 cells
    // This ensures we always have exactly 6 rows (42 cells)
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(lastDay);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    
    // Final safety check: always return exactly 42 days (6 rows × 7 days)
    // This prevents any extra blank rows from appearing
    // Force exactly 42 cells - no more, no less
    return days.slice(0, 42);
  }, [currentDate]);

  // Determine how many calendar cells (and rows) to render based on month length and start day
  const monthLength = lastDayOfMonth.getDate(); // 28–31
  const startDay = firstDayOfMonth.getDay();    // 0 = Sun, 5 = Fri, 6 = Sat
  const isFebruary = getMonth(currentDate) === 1;

  let visibleCells = 35; // default

  if (isFebruary) {
    // For February: if it starts on Sunday show 28 cells, otherwise 35
    visibleCells = startDay === 0 ? 28 : 35;
  } else if (monthLength === 31 && startDay === 5) {
    // 31-day month starting on Friday → need 42 cells (6 full weeks)
    visibleCells = 42;
  } else if (monthLength === 30 && startDay === 6) {
    // 30-day month starting on Saturday → need 42 cells (6 full weeks)
    visibleCells = 42;
  } else {
    // All other non-February months use 35 cells (5 weeks)
    visibleCells = 35;
  }

  const calendarWeeks = visibleCells / 7;

  return (
    <div className="flex-1 md:flex flex-col gap-6 p-6 h-full">

      <div className='md:flex md:gap-6 lg:flex-row h-full overflow-y-auto md:overflow-hidden' >


      <div className="mb-1 min-w-0 md:mb-0 md:flex-1 md:flex md:flex-col overflow-y-auto min-h-0">
        <div className={`flex items-center justify-between mb-6 pb-4 border-b flex-shrink-0 ${
          theme === "dark" ? "border-neutral-800" : "border-neutral-200"
        }`}>
          <h3 className={`font-sans text-xl font-bold ${
            theme === "dark" ? "text-neutral-100" : "text-neutral-900"
          }`}>
            {currentMonth} {currentYear}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className={`px-3 py-1.5 font-sans border rounded text-sm transition-colors flex items-center gap-2 ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:text-[#F9B418]"
                  : "bg-white border-neutral-200 text-neutral-700 hover:border-[#F9B418] hover:text-[#F9B418]"
              }`}
            >
              Today
            </button>
            <button
              onClick={handlePrevMonth}
              className={`p-2 border rounded transition-colors ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-[#F9B418]/50 hover:text-[#F9B418]"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-[#F9B418] hover:text-[#F9B418]"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className={`p-2 border rounded transition-colors ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-[#F9B418]/50 hover:text-[#F9B418]"
                  : "bg-white border-neutral-200 text-neutral-600 hover:border-[#F9B418] hover:text-[#F9B418]"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className={`font-sans grid grid-cols-7 gap-2 mb-2 flex-shrink-0 ${
          theme === "dark" ? "" : ""
        }`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className={`text-center text-xs uppercase tracking-wider py-2 ${
              theme === "dark" ? "text-neutral-500" : "text-neutral-600"
            }`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 ${
          theme === "dark" ? "scrollbar-dark" : "scrollbar-light"
        }`} style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: theme === "dark" ? '#404040 #1a1a1a' : '#cbd5e1 #f1f5f9'
        }}>
          
          <div
            className="grid grid-cols-7 gap-3 p-1"
            style={{
              gridTemplateRows: `repeat(${calendarWeeks}, minmax(120px, auto))`,
              maxHeight: 'fit-content'
            }}
          >
            {(() => {
              return allDays.slice(0, visibleCells).map((date, index) => {
              const dateStr = date.toISOString().split('T')[0];
              const hasEvents = eventsMap.has(dateStr);
              const eventsForDate = hasEvents ? eventsMap.get(dateStr) : [];
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isCurrentMonth = isSameMonth(date, currentDate);
              const isTodayDate = isToday(date);
              
              return (
                <button
                  key={`day-${date.toISOString()}`}
                  disabled={!isCurrentMonth}
                  className={`relative min-w-0 min-h-[120px] overflow-hidden p-3 border rounded-lg transition-all max-h-[120px] flex justify-start ${
                    !isCurrentMonth
                      ? "invisible"
                      : isSelected
                        ? "border-[#F9B418]/50 bg-[#F9B418]/10"
                        : theme === "dark"
                          ? "bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/50"
                          : "bg-white/50 border-neutral-200 hover:bg-neutral-50"
                  } ${isTodayDate && !isSelected ? "ring-2 ring-[#F9B418]/50" : ""} cursor-pointer`}
                  onClick={() => isCurrentMonth && handleDateClick(date)}
          
                >
                  <div className="font-sans flex w-full min-w-0 flex-col items-start justify-start">
                    <div className={`text-base font-semibold mb-2 ${
                      isTodayDate 
                        ? "text-[#F9B418]" 
                        : theme === "dark" 
                          ? "text-neutral-200" 
                          : "text-neutral-800"
                    }`}>
                      {date.getDate()}
                    </div>
                    {eventsForDate && eventsForDate.length > 0 && (
                      <div className="flex-1 max-w-full flex flex-col gap-1.5  overflow-y-auto max-h-[calc(100px-2.5rem)] min-h-0 scrollbar-modern-light" style={{ scrollbarColor: 'transparent transparent', background: 'none' }}>
                        {eventsForDate.map((event: DueDate, idx: number) => {
                          return (
                            <div
                              key={`${dateStr}-${event.id}-${idx}`}
                              className="w-[20px] truncate md:w-full"
                              title={`${event.event} - ${event.patent}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                            >
                              <ProductChip kind="status" tone={getEventTone(event)} className="pointer-events-none w-full max-w-full justify-start">
                                {event.event}
                              </ProductChip>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
              });
            })()}

          </div>
        </div>
        
        {/* Legend */}
        <div className={`mt-4 pt-3 border-t ${
          theme === "dark" ? "border-neutral-800/50" : "border-neutral-200/50"
        }`}>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border ${
                theme === "dark" 
                  ? "bg-red-500/30 border-red-500/50" 
                  : "bg-red-500/20 border-red-500/40"
              }`}></div>
              <span className={`text-xs ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}>Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border ${
                theme === "dark" 
                  ? "bg-orange-500/30 border-orange-500/50" 
                  : "bg-orange-500/20 border-orange-500/40"
              }`}></div>
              <span className={`text-xs ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}>Due Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border ${
                theme === "dark" 
                  ? "bg-[#F9B418]/30 border-[#F9B418]/50" 
                  : "bg-[#F9B418]/20 border-[#F9B418]/40"
              }`}></div>
              <span className={`text-xs ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}>Upcoming</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded border ${
                theme === "dark" 
                  ? "bg-blue-500/30 border-blue-500/50" 
                  : "bg-blue-500/20 border-blue-500/40"
              }`}></div>
              <span className={`text-xs ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}>Future</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border border-emerald-500/50 bg-emerald-500/25"></div>
              <span className={`text-xs ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}>Completed</span>
            </div>
          </div>
        </div>
      </div>
  
      <div className={`w-full lg:w-96 flex flex-col border rounded-xl overflow-y-auto backdrop-blur-xl max-h-[250px] mb-[60px] md:mb-[0] md:pb-5 md:max-h-[600px] ${
        theme === "dark"
          ? "bg-neutral-900/50 border-neutral-800"
          : "bg-white/50 border-neutral-200"
      }`}>
        <div className={`p-4 border-b flex-shrink-0 ${
          theme === "dark" ? "border-neutral-800" : "border-neutral-200"
        }`}>
          <div className="font-sans font-bold flex items-center gap-2 mb-1">
            <CalendarIcon className={`h-5 w-5 ${
              theme === "dark" ? "text-neutral-400" : "text-neutral-600"
            }`} />
            <h3 className={`${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}>
              {selectedEvent 
                ? 'Event Details' 
                : selectedDate 
                  ? format(selectedDate, 'MMMM d, yyyy') 
                  : `${format(currentDate, 'MMMM yyyy')}`}
            </h3>
          </div>
          {!selectedEvent && !selectedDate && (
            <div className={`font-sans text-xs ${
              theme === "dark" ? "text-neutral-500" : "text-neutral-600"
            }`}>
              {eventsForCurrentMonth.length} events this month
            </div>
          )}
        </div>
        {selectedEvent ? (
          <div className={`flex-1 overflow-y-auto p-4 min-h-0 ${
            theme === "dark" ? "scrollbar-dark" : "scrollbar-light"
          }`} style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: theme === "dark" ? '#404040 #1a1a1a' : '#cbd5e1 #f1f5f9'
          }}>
            <div className="space-y-4">
              <div>
                <h4 className="text-base text-neutral-800 dark:text-neutral-300 font-medium">{selectedEvent.event}</h4>
                <p className="text-sm text-gray-500 dark:text-neutral-400">{selectedEvent.patent}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-neutral-400 text-xs">Due Date</p>
                  <p className='text-neutral-800 dark:text-neutral-300'>{formatEventDate(selectedEvent.dueDate)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-neutral-400 text-xs">Patent Status</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <ProductChip kind="status" tone="info">
                      {selectedEvent.status}
                    </ProductChip>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-neutral-400 text-xs">Due Status</p>
                  <ProductChip kind="status" tone={getEventTone(selectedEvent)} className="mt-1">
                    {isCompleted(selectedEvent)
                      ? "Completed"
                      : selectedEvent.daysOverdue > 0
                      ? `${selectedEvent.daysOverdue} days overdue`
                      : selectedEvent.daysOverdue === 0
                        ? 'Due today'
                        : `Due in ${Math.abs(selectedEvent.daysOverdue)} days`}
                  </ProductChip>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-neutral-400 text-xs">Country</p>
                  <p className='text-neutral-800 dark:text-neutral-300'>{selectedEvent.country || "---"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-neutral-400 text-xs">Outside Counsel</p>
                  <p className='text-neutral-800 dark:text-neutral-300'>{selectedEvent.counsel}</p>
                </div>
              </div>

              {canManageEvents && onEventCompletion && (
                <Button
                  size="sm"
                  disabled={updatingEventId === selectedEvent.id}
                  className="w-full bg-[#F9B418] text-neutral-950 hover:bg-[#e5a310]"
                  onClick={() =>
                    onEventCompletion(
                      selectedEvent.id,
                      !isCompleted(selectedEvent),
                    )
                  }
                >
                  {isCompleted(selectedEvent) ? (
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  {updatingEventId === selectedEvent.id
                    ? "Updating…"
                    : isCompleted(selectedEvent)
                      ? "Reopen event"
                      : "Mark done"}
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="dark:bg-neutral-900 rounded-lg dark:text-neutral-500 dark:hover:bg-[#F9B418] dark:hover:text-neutral-900  dark:border-neutral-800 w-full mt-4   hover:border-[#F9B418] hover:bg-transparent bg-white text-neutral-700 hover:text-neutral-700 border-neutral-200"
                onClick={() => setSelectedEvent(null)}
              >
                Back to events
              </Button>
            </div>
          </div>
        ) : (
          <div className={`font-sans flex-1 overflow-y-auto p-4 min-h-0 ${
            theme === "dark" ? "scrollbar-dark" : "scrollbar-light"
          }`} style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: theme === "dark" ? '#404040 #1a1a1a' : '#cbd5e1 #f1f5f9'
          }}>
            {(selectedDate && eventsForSelectedDate.length > 0) ? (
              <div className="space-y-6">
             
                {eventsForSelectedDate.map((event: DueDate) => (
                  <div key={event.id} className="space-y-3">
                    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                      theme === "dark" ? "border-neutral-800" : "border-neutral-200"
                    }`}>
                      <div className={`text-sm font-semibold ${
                        theme === "dark" ? "text-neutral-300" : "text-neutral-700"
                      }`}>
                        {format(selectedDate, 'EEE, MMM d')}
                      </div>
                      <span className={`text-xs ml-auto ${
                        theme === "dark" ? "text-neutral-500" : "text-neutral-600"
                      }`}>
                        {eventsForSelectedDate.length} event{eventsForSelectedDate.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div
                      className={`p-3 border rounded-lg backdrop-blur-sm cursor-pointer transition-colors ${
                        theme === "dark"
                          ? "bg-neutral-800/50 border-neutral-700"
                          : "bg-white/80 border-neutral-200 hover:bg-neutral-50"
                      }`}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className={`text-sm ${
                          theme === "dark" ? "text-neutral-200" : "text-neutral-800"
                        }`}>{event.event}</h4>
                        <ProductChip kind="status" tone={getEventTone(event)}>
                          {isCompleted(event)
                            ? "Completed"
                            : event.daysOverdue > 0
                            ? 'Overdue'
                            : event.daysOverdue === 0
                              ? 'Due Today'
                              : 'Upcoming'}
                        </ProductChip>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${
                            theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                          }`} />
                          <span className={`text-xs font-mono ${
                            theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                          }`}>{event.applicationNumber || event.patent}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${
                            theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                          }`} />
                          <span className={`text-xs ${
                            theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                          }`}>{event.counsel}</span>
                        </div>
                      </div>
                      <div className={`mt-2 pt-2 border-t text-xs ${
                        theme === "dark"
                          ? "border-neutral-700 text-neutral-500"
                          : "border-neutral-200 text-neutral-600"
                      }`}>
                        {formatStatusLabel(event.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (selectedDate && eventsForSelectedDate.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p>No events on this date</p>
              </div>
            ) : eventsForCurrentMonth.length > 0 ? (
              
              <div className="space-y-6">
                
                {Object.entries(
                  eventsForCurrentMonth.reduce((acc: any, event: DueDate) => {
                    
                    const date = new Date(event.dueDate);
                    const dateKey = format(date, 'EEE, MMM d');
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(event);
                    return acc;
                  }, {})
                ).map(([dateKey, events]: [string, any]) => (
                  <div key={dateKey}>
                    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                      theme === "dark" ? "border-neutral-800" : "border-neutral-200"
                    }`}>
                      <div className={`text-sm font-semibold ${
                        theme === "dark" ? "text-neutral-300" : "text-neutral-700"
                      }`}>{dateKey}</div>
                      <span className={`text-xs ml-auto ${
                        theme === "dark" ? "text-neutral-500" : "text-neutral-600"
                      }`}>
                        {events.length} event{events.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {events.map((event: DueDate) => (
                        <div
                          key={event.id}
                          className={`p-3 border rounded-lg backdrop-blur-sm cursor-pointer transition-colors ${
                            theme === "dark"
                              ? "bg-neutral-800/50 border-neutral-700 hover:bg-neutral-800"
                              : "bg-white/80 border-neutral-200 hover:bg-transparent"
                          }`}
                          onClick={() => handleEventClick(event)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className={`font-sans font-bold text-sm ${
                              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
                            }`}>{event.event}</h4>
                            <ProductChip kind="status" tone={getEventTone(event)}>
                              {isCompleted(event)
                                ? "Completed"
                                : event.daysOverdue > 0
                                ? 'Overdue'
                                : event.daysOverdue === 0
                                  ? 'Due Today'
                                  : 'Upcoming'}
                            </ProductChip>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <FileText className={`w-4 h-4 ${
                                theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                              }`} />
                              <span className={`text-xs font-mono ${
                                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                              }`}>{event.applicationNumber || event.patent}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className={`w-4 h-4 ${
                                theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                              }`} />
                              <span className={`text-xs ${
                                theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                              }`}>{event.counsel}</span>
                            </div>
                          </div>
                          <div className={`mt-2 pt-2 border-t text-xs ${
                            theme === "dark"
                              ? "border-neutral-700 text-neutral-500"
                              : "border-neutral-200 text-neutral-600"
                          }`}>
                            {formatStatusLabel(event.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p>No events in this month</p>
              </div>
            )}
          </div>
        )}
      </div>


      </div>
    </div>
  );
};

export default DueDatesCalendar;
