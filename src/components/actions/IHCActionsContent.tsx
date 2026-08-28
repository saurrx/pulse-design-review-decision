import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import useUserCookie from "@/hooks/use-auth";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
} from "lucide-react";
import Loader from "../Loader";
import ActionDropdown from "./ActionDropdown";
import RequestStatusBadge from "./RequestStatusBadge";
import CountrySelector from "./CountrySelector";
import SubmitActionsDialog from "./SubmitActionsDialog";
import moment from "moment";

type FilterOption = "all" | "upcoming" | "dueToday" | "overdue";
type SortOption = "newest" | "oldest" | "eventAZ" | "eventZA";
type StatusFilter = "active" | "completed" | "all";

interface ActionEvent {
  id: string;
  event_name: string;
  event_date: string;
  days_to_deadline: number | null;
  patent: {
    id: string;
    application_number: string;
    title: string;
    client_id: string;
  };
  patent_action: {
    id: string;
    action_template: {
      id: string;
      label: string;
      requires_countries: boolean;
    };
    action_status: string;
    request_status: string;
    selected_countries: string[];
    notes: string;
    submitted_by: { name: string; email: string } | null;
    submitted_at: string | null;
    version: number;
    updatedAt: string;
  } | null;
}

const IHCActionsContent: React.FC = () => {
  const { user } = useUserCookie();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortOption, setSortOption] = useState<SortOption>("oldest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Column visibility
  const [columns, setColumns] = useState([
    { id: "applicationNumber", label: "Application No.", visible: true, sticky: true },
    { id: "title", label: "Title", visible: true, sticky: false },
    { id: "nextEvent", label: "Next Event", visible: true, sticky: false },
    { id: "deadline", label: "Deadline", visible: true, sticky: false },
    { id: "days", label: "Days", visible: true, sticky: false },
    { id: "action", label: "Action", visible: true, sticky: false },
    { id: "status", label: "Status", visible: true, sticky: false },
    { id: "lastUpdated", label: "Last Updated", visible: true, sticky: false },
  ]);

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    );
  };

  const visibleColumns = columns.filter((col) => col.visible);

  const getFilterLabel = (filter: FilterOption): string => {
    switch (filter) {
      case "all": return "All Actions";
      case "upcoming": return "Upcoming";
      case "dueToday": return "Due Today";
      case "overdue": return "Overdue";
      default: return "All Actions";
    }
  };

  const handleFilterChange = (value: FilterOption) => {
    setFilterOption(value);
    setCurrentPage(1);
  };

  const getStatusLabel = (s: StatusFilter): string => {
    switch (s) {
      case "active": return "Active";
      case "completed": return "Completed";
      case "all": return "All Statuses";
      default: return "Active";
    }
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    setCurrentPage(1);
  };

  // Single action pending confirmation
  interface PendingAction {
    patent_event_id: string;
    patent_id: string;
    action_template_id: string;
    action_template_label: string;
    application_number: string;
    selected_countries?: string[];
    notes?: string;
  }
  const [pendingSubmitAction, setPendingSubmitAction] = useState<PendingAction | null>(null);

  // Dialogs
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [countrySelectorOpen, setCountrySelectorOpen] = useState(false);
  const [pendingCountryAction, setPendingCountryAction] = useState<{
    eventId: string;
    patentId: string;
    applicationNumber: string;
    templateId: string;
    templateLabel: string;
  } | null>(null);

  const clientId = user?.client_id;

  // Fetch IHC actions
  const { data: actionsData, isLoading } = useQuery({
    queryKey: [
      "ihc_actions",
      clientId,
      currentPage,
      itemsPerPage,
      searchQuery,
      filterOption,
      statusFilter,
      sortOption,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());
      if (searchQuery) params.append("search", searchQuery);
      if (filterOption !== "all") params.append("filter", filterOption);
      params.append("status", statusFilter);
      params.append("sort", sortOption);
      const response = await API_CONFIG.get(
        `/api/v1/actions/ihc/client/${clientId}?${params.toString()}`,
      );
      return response?.data;
    },
    enabled: !!clientId,
    refetchOnMount: true,
  });

  const events: ActionEvent[] = actionsData?.data || [];
  const pagination = actionsData?.pagination;

  // Submit-all mutation (single API call, no drafts)
  const { mutate: submitAllActions, isPending: isSubmitting } = useMutation({
    mutationFn: async (data: {
      client_id: string;
      actions: Array<{
        patent_event_id: string;
        patent_id: string;
        action_template_id: string;
        selected_countries?: string[];
        notes?: string;
      }>;
    }) => {
      const response = await API_CONFIG.post("/api/v1/actions/submit-all", data);
      return response?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ihc_actions"] });
      setPendingSubmitAction(null);
      setShowSubmitDialog(false);
      toast.success(data?.message || "Action submitted successfully");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || "Failed to submit actions",
      );
    },
  });

  // Handle action selection from dropdown — immediately show confirmation
  const handleActionSelect = useCallback(
    (
      eventId: string,
      patentId: string,
      applicationNumber: string,
      template: {
        id: string;
        label: string;
        requires_countries: boolean;
      },
    ) => {
      if (template.requires_countries) {
        setPendingCountryAction({
          eventId,
          patentId,
          applicationNumber,
          templateId: template.id,
          templateLabel: template.label,
        });
        setCountrySelectorOpen(true);
        return;
      }

      setPendingSubmitAction({
        patent_event_id: eventId,
        patent_id: patentId,
        action_template_id: template.id,
        action_template_label: template.label,
        application_number: applicationNumber,
      });
      setShowSubmitDialog(true);
    },
    [],
  );

  // Handle country selection confirm — show submit dialog
  const handleCountryConfirm = useCallback(
    (countries: string[]) => {
      if (!pendingCountryAction) return;

      setPendingSubmitAction({
        patent_event_id: pendingCountryAction.eventId,
        patent_id: pendingCountryAction.patentId,
        action_template_id: pendingCountryAction.templateId,
        action_template_label: pendingCountryAction.templateLabel,
        application_number: pendingCountryAction.applicationNumber,
        selected_countries: countries,
      });
      setPendingCountryAction(null);
      setShowSubmitDialog(true);
    },
    [pendingCountryAction],
  );

  // Handle submit — single action
  const handleSubmit = useCallback(() => {
    if (!pendingSubmitAction) {
      toast.error("No action selected to submit");
      return;
    }

    submitAllActions({
      client_id: clientId!,
      actions: [
        {
          patent_event_id: pendingSubmitAction.patent_event_id,
          patent_id: pendingSubmitAction.patent_id,
          action_template_id: pendingSubmitAction.action_template_id,
          selected_countries: pendingSubmitAction.selected_countries,
          notes: pendingSubmitAction.notes,
        },
      ],
    });
  }, [pendingSubmitAction, clientId, submitAllActions]);

  const getDaysColor = (days: number | null) => {
    if (days === null) return "";
    if (days <= 0) return "text-red-600 font-semibold";
    if (days <= 7) return "text-red-500";
    if (days <= 30) return "text-amber-600";
    return "text-green-600";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="pulse-product-page pulse-table-page mx-auto flex h-[calc(100dvh-64px)] min-h-0 w-full max-w-[1680px] flex-col overflow-hidden px-6 py-6 lg:px-8">
      {/* Search + Filter + Sort + Columns bar */}
      <div className="pulse-toolbar !mx-0 !mb-5 !mt-0">
        <div className="flex-1">
          <div className="relative min-w-[200px] max-w-[400px]">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-400"
              }`}
            />
            <Input
              type="text"
              placeholder="Search by application number or title..."
              className={`w-full border rounded pl-10 pr-10 h-[42px] text-sm focus:outline-none transition-colors ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                  : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
              }`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <Plus
                onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-45 w-4 h-4 z-10 cursor-pointer ${
                  theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                }`}
              />
            )}
          </div>
        </div>

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={`flex items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-neutral-900 hover:text-neutral-300"
                  : "hover:bg-transparent bg-transparent border-neutral-200 hover:text-neutral-700 text-[#494949] hover:border-[#F9B418]"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{getFilterLabel(filterOption)}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={`w-64 px-3 ${
              theme === "dark"
                ? "bg-[#0a0a0a] border-[#cccccc20]"
                : "bg-white border-photon-border-light"
            }`}
          >
            <DropdownMenuRadioGroup
              value={filterOption}
              onValueChange={(value: string) =>
                handleFilterChange(value as FilterOption)
              }
              className="grid gap-3 pt-2 pb-2"
            >
              {[
                { label: "All Actions", value: "all" },
                { label: "Upcoming", value: "upcoming" },
                { label: "Due Today", value: "dueToday" },
                { label: "Overdue", value: "overdue" },
              ].map((item) => (
                <DropdownMenuRadioItem
                  key={item.value}
                  value={item.value}
                  className={`font-sans cursor-pointer flex items-center gap-2 text-sm transition-colors ${
                    theme === "dark"
                      ? "text-zinc-200 hover:!text-zinc-200 focus:!text-zinc-200 hover:!bg-white/5 focus:!bg-white/5"
                      : "text-[#404040] hover:!text-[#404040] focus:!text-[#404040] hover:bg-[#fdfdfd]"
                  } data-[state=checked]:bg-photon-background-light`}
                >
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={`flex items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-neutral-900 hover:text-neutral-300"
                  : "hover:bg-transparent bg-transparent border-neutral-200 hover:text-neutral-700 text-[#494949] hover:border-[#F9B418]"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{getStatusLabel(statusFilter)}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={`w-56 px-3 ${
              theme === "dark"
                ? "bg-[#0a0a0a] border-[#cccccc20]"
                : "bg-white border-photon-border-light"
            }`}
          >
            <DropdownMenuRadioGroup
              value={statusFilter}
              onValueChange={(value: string) =>
                handleStatusChange(value as StatusFilter)
              }
              className="grid gap-3 pt-2 pb-2"
            >
              {[
                { label: "Active", value: "active" },
                { label: "Completed", value: "completed" },
                { label: "All Statuses", value: "all" },
              ].map((item) => (
                <DropdownMenuRadioItem
                  key={item.value}
                  value={item.value}
                  className={`font-sans cursor-pointer flex items-center gap-2 text-sm transition-colors ${
                    theme === "dark"
                      ? "text-zinc-200 hover:!text-zinc-200 focus:!text-zinc-200 hover:!bg-white/5 focus:!bg-white/5"
                      : "text-[#404040] hover:!text-[#404040] focus:!text-[#404040] hover:bg-[#fdfdfd]"
                  } data-[state=checked]:bg-photon-background-light`}
                >
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={`font-sans flex items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-neutral-900 hover:text-neutral-300"
                  : "hover:bg-transparent bg-transparent hover:text-[#494949] text-[#404040] border-neutral-200 hover:border-[#F9B418]"
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>Sort</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={`font-sans w-64 px-3 ${
              theme === "dark"
                ? "bg-[#0a0a0a] border-[#cccccc20]"
                : "bg-white border-photon-border-light"
            }`}
          >
            <DropdownMenuRadioGroup
              value={sortOption}
              onValueChange={(value: string) =>
                handleSortChange(value as SortOption)
              }
              className="grid gap-3 py-2"
            >
              <DropdownMenuRadioItem
                value="newest"
                className={`cursor-pointer ${
                  theme === "dark"
                    ? "text-zinc-200 hover:!text-zinc-200 focus:!text-zinc-200 hover:!bg-white/5 focus:!bg-white/5"
                    : "text-[#404040] hover:!text-[#404040] focus:!text-[#404040] hover:!bg-[#fafafa]"
                } data-[state=checked]:bg-photon-background-light text-sm`}
              >
                Newest First
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="oldest"
                className={`cursor-pointer ${
                  theme === "dark"
                    ? "text-zinc-200 hover:!text-zinc-200 focus:!text-zinc-200 hover:!bg-white/5 focus:!bg-white/5"
                    : "text-[#404040] hover:!text-[#404040] focus:!text-[#404040]"
                } data-[state=checked]:bg-photon-background-light text-sm`}
              >
                Oldest First
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Columns popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`flex items-center gap-2 px-4 py-5 border rounded text-sm font-normal transition-colors whitespace-nowrap ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-neutral-300 hover:border-[#F9B418]/50 hover:bg-neutral-900"
                  : "hover:bg-transparent bg-transparent border-neutral-200 text-[#404040] hover:border-[#F9B418]"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                <path d="M9 3v18"></path>
                <path d="M15 3v18"></path>
              </svg>
              <span>Columns</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={`w-72 p-3 ${
              theme === "dark" && "bg-[#0a0a0a] border border-[#cccccc20]"
            }`}
          >
            <ScrollArea className="h-[350px] font-sans">
              <div className="space-y-2">
                {columns.map((column) => (
                  <div
                    key={column.id}
                    className={`cursor-pointer flex items-center gap-2 p-2 ${
                      theme === "dark"
                        ? "hover:bg-white/5"
                        : "hover:bg-[#fafafa]"
                    }`}
                  >
                    <Checkbox
                      id={`col-ihc-${column.id}`}
                      checked={column.visible}
                      onCheckedChange={() => toggleColumnVisibility(column.id)}
                      disabled={column.sticky}
                      className={`${
                        theme === "dark"
                          ? "border-[#242424] bg-transparent"
                          : "border-zinc-900"
                      }`}
                    />
                    <label
                      htmlFor={`col-ihc-${column.id}`}
                      className={`text-sm cursor-pointer ${
                        theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                      }`}
                    >
                      {column.label}
                      {column.sticky && (
                        <span className="text-xs text-muted-foreground ml-1">(fixed)</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      <div
        /* flex column so the ScrollArea below can be given a height to scroll
           against. pulse-table-frame is overflow-hidden, and an unconstrained
           ScrollArea just grows past it — at 1280x720 the last rows of the
           queue were unreachable. */
        className={`pulse-table-frame !mx-0 !mb-3 flex min-h-0 flex-1 flex-col ${
          theme === "dark" ? "border-zinc-800" : "border-zinc-200"
        }`}
      >
        <ScrollArea className="h-full w-full flex-1">
          <table className="pulse-data-table w-full">
            <thead>
              <tr
                className={`border-b ${
                  theme === "dark"
                    ? "bg-zinc-900 border-zinc-800"
                    : "bg-zinc-50 border-zinc-200"
                }`}
              >
                {visibleColumns.map((col) => (
                    <th key={col.id} className="text-left p-3 font-medium">
                      {col.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className={`text-center py-12 ${
                      theme === "dark" ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    No upcoming events found for your portfolio.
                  </td>
                </tr>
              ) : (
                events.map((event) => {
                  return (
                    <tr
                      key={event.id}
                      className={`border-b transition-colors ${
                        theme === "dark"
                          ? "border-zinc-800 hover:bg-zinc-800/50"
                          : "border-zinc-100 hover:bg-zinc-50"
                      }`}
                    >
                      {visibleColumns.map((col) => {
                        switch (col.id) {
                          case "applicationNumber":
                            return (
                              <td key={col.id} className="p-3 font-sans tabular-nums text-xs">
                                {event.patent.application_number}
                              </td>
                            );
                          case "title":
                            return (
                              <td
                                key={col.id}
                                className="p-3 max-w-[200px] truncate"
                                title={event.patent.title}
                              >
                                {event.patent.title}
                              </td>
                            );
                          case "nextEvent":
                            return (
                              <td key={col.id} className="p-3 text-xs">
                                {event.event_name}
                              </td>
                            );
                          case "deadline":
                            return (
                              <td key={col.id} className="p-3 text-xs">
                                {event.event_date
                                  ? moment(event.event_date).format("MMM D, YYYY")
                                  : "-"}
                              </td>
                            );
                          case "days": {
                            // Once the action is completed the deadline is moot —
                            // don't flag it red "Overdue", show neutral "Done".
                            const isCompleted =
                              event.patent_action?.request_status === "COMPLETED";
                            return (
                              <td
                                key={col.id}
                                className={`p-3 text-xs ${
                                  isCompleted
                                    ? "text-zinc-500"
                                    : getDaysColor(event.days_to_deadline)
                                }`}
                              >
                                {isCompleted
                                  ? "Done"
                                  : event.days_to_deadline !== null
                                    ? event.days_to_deadline <= 0
                                      ? "Overdue"
                                      : `${event.days_to_deadline}d`
                                    : "-"}
                              </td>
                            );
                          }
                          case "action": {
                            const countries = event.patent_action?.selected_countries || [];
                            return (
                              <td key={col.id} className="p-3">
                                <ActionDropdown
                                  eventType={event.event_name || ""}
                                  selectedTemplateId={
                                    event.patent_action?.action_template?.id
                                  }
                                  onSelect={(template) =>
                                    handleActionSelect(
                                      event.id,
                                      event.patent.id,
                                      event.patent.application_number,
                                      template,
                                    )
                                  }
                                  disabled={
                                    event.patent_action?.action_status === "SUBMITTED"
                                  }
                                />
                                {countries.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {countries
                                        .slice(0, 3)
                                        .map((c) => (
                                          <Badge
                                            key={c}
                                            variant="outline"
                                            className="text-xs px-1"
                                          >
                                            {c}
                                          </Badge>
                                        ))}
                                      {countries.length > 3 && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs px-1"
                                        >
                                          +{countries.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                              </td>
                            );
                          }
                          case "status":
                            return (
                              <td key={col.id} className="p-3">
                                {event.patent_action?.action_status === "SUBMITTED" || event.patent_action?.action_status === "UPDATED" ? (
                                  <RequestStatusBadge
                                    status={event.patent_action?.request_status || "NEW"}
                                  />
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-medium bg-gray-100 text-gray-600 border-gray-200"
                                  >
                                    No Action
                                  </Badge>
                                )}
                              </td>
                            );
                          case "lastUpdated":
                            return (
                              <td
                                key={col.id}
                                className={`p-3 text-xs ${
                                  theme === "dark" ? "text-zinc-400" : "text-zinc-500"
                                }`}
                              >
                                {event.patent_action?.updatedAt
                                  ? moment(event.patent_action.updatedAt).fromNow()
                                  : "-"}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pulse-pagination-bar !mx-0 !mb-0 flex items-center justify-between rounded-xl">
          <p
            className={`text-sm ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
            total)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === pagination.totalPages}
              onClick={() => setCurrentPage(pagination.totalPages)}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Submit Dialog */}
      <SubmitActionsDialog
        open={showSubmitDialog}
        onOpenChange={(open) => {
          setShowSubmitDialog(open);
          if (!open) setPendingSubmitAction(null);
        }}
        actionLabel={pendingSubmitAction?.action_template_label}
        applicationNumber={pendingSubmitAction?.application_number}
        selectedCountries={pendingSubmitAction?.selected_countries}
        onConfirm={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Country Selector */}
      <CountrySelector
        open={countrySelectorOpen}
        onOpenChange={setCountrySelectorOpen}
        selectedCountries={[]}
        onConfirm={handleCountryConfirm}
      />
    </div>
  );
};

export default IHCActionsContent;
