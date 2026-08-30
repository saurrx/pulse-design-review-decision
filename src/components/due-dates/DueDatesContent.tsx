import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RemindButton from "./RemindButton";
import {
  Filter,
  Search,
  ChevronDown,
  ArrowUpDown,
  FileSearch,
  Building2,
  ChevronRight,
  ChevronsRight,
  ChevronLeft,
  ChevronsLeft,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import DueDatesCalendar from "./DueDatesCalendar";
import useUserCookie from "@/hooks/use-auth";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import {
  isPatentEventCompleted,
  usePatentEventCompletion,
} from "@/hooks/usePatentEventCompletion";
import API_CONFIG from "@/lib/apiConfig";
import Loader from "../Loader";
import moment from "moment";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ProductChip,
  type ProductChipTone,
} from "@/components/ui/product-chip";
import {
  PATENT_LEGAL_STATUS_META,
  type PatentLegalStatus,
} from "@/utils/patentLegalStatus";
import ActionDropdown from "@/components/actions/ActionDropdown";

interface DueDate {
  id: string;
  event: string;
  patent: string;
  counsel: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
  country: string;
}

type FilterOption = "all" | "upcoming" | "dueToday" | "overdue" | "completed";
type SortOption = "newest" | "oldest" | "eventAZ" | "eventZA";
export type DueDatesViewType = "list" | "calendar";

export type DueDatesHeaderState = {
  viewType: DueDatesViewType;
  total: number;
  onViewChange: (view: DueDatesViewType) => void;
};

interface DueDatesContentProps {
  initialView?: DueDatesViewType;
  onHeaderStateChange?: (state: DueDatesHeaderState) => void;
}
type StatusFilter =
  | "all"
  | "pending"
  | "underReview"
  | "awaitingPayment"
  | "draft"
  | "urgent"
  | "inProgress"
  | "scheduled";
type CountryFilter = "all" | string;

const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return new Date(dateString).toLocaleDateString("en-US", options);
};

const DueDatesContent: React.FC<DueDatesContentProps> = ({
  initialView = "list",
  onHeaderStateChange,
}) => {
  const isMobile = useIsMobile();
  const [viewType, setViewType] = useState<DueDatesViewType>(initialView);
  const [rowHeight, setRowHeight] = useState<string>("medium");
  const [searchQuery, setSearchQuery] = useState<string>("");
  // The search term now reaches the API, so the query key needs to settle
  // rather than fire once per keystroke. The INPUT stays instant; only the
  // request waits.
  const [searchTerm, setSearchTerm] = useState<string>("");
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("oldest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedClientIds, setSelectedClientIds] = React.useState<string[]>(
    [],
  );
  const [clientSearchInput, setClientSearchInput] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const { theme } = useTheme();

  // Debounce client search → query
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedClientSearch(clientSearchInput),
      300,
    );
    return () => clearTimeout(timer);
  }, [clientSearchInput]);

  const { user } = useUserCookie();
  // Read role synchronously from cookie so columns init correctly on first render
  // (useUserCookie populates `user` in useEffect, so it's null on first render)
  const isOC = (() => {
    try {
      const raw = Cookies.get("pl_user");
      return raw ? isOutsideCounselRole(JSON.parse(raw)?.role) : false;
    } catch {
      return false;
    }
  })();
  const queryClient = useQueryClient();
  const eventCompletion = usePatentEventCompletion();
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [draftActions, setDraftActions] = useState<
    Record<string, { templateId: string; updatedAt: string }>
  >({});

  // Column visibility state — the Photon-side Operations table's order and
  // vocabulary, which is the design's: identity first, then what is coming and
  // when. The row number column is gone: it numbered the CURRENT page of a
  // sorted, filtered list, so it identified nothing and moved whenever either
  // changed. Event/Due Date are Next Event/Deadline, the words the rest of the
  // product already uses.
  const [columns, setColumns] = useState([
    {
      id: "applicationNumber",
      label: "Application No.",
      visible: true,
      // The design fixes the row-identity column so it cannot be hidden.
      sticky: true,
    },
    // The Client column only means something across tenants — photon-side view.
    ...(isOC ? [{
      id: "outsideCounsel",
      label: "Client",
      visible: true,
      sticky: false,
    }] : []),
    // The invention title belongs on the default view — a docket row identified
    // only by application number tells you nothing about what is at stake.
    { id: "title", label: "Title", visible: true, sticky: false },
    { id: "event", label: "Next Event", visible: true, sticky: false },
    { id: "dueDate", label: "Deadline", visible: true, sticky: false },
    // Urgency, not just the date. The countdown is the at-a-glance overdue
    // signal the deadline list exists for.
    { id: "days", label: "Days", visible: true, sticky: false },
    // Selecting an action against a deadline. Counsel and the committee have no
    // /actions nav item, so this column is their ONLY surface for it — dropping
    // it made choosing an instruction impossible for those two roles.
    { id: "action", label: "Action", visible: true, sticky: false },
    { id: "status", label: "Status", visible: true, sticky: false },
    { id: "lastUpdated", label: "Last Updated", visible: true, sticky: false },
    {
      id: "familyMembers",
      label: "Family Members",
      visible: false,
      sticky: false,
    },
    {
      id: "currentEvent",
      label: "Current Event",
      visible: false,
      sticky: false,
    },
    ...(isOC
      ? [{ id: "remind", label: "Remind", visible: true, sticky: false }]
      : []),
    { id: "legalStatus", label: "Legal Status", visible: false, sticky: false },
    { id: "assignee", label: "Assignee", visible: false, sticky: false },
    { id: "inventors", label: "Inventors", visible: false, sticky: false },
    { id: "country", label: "Country", visible: false, sticky: false },
  ]);

  const {
    isLoading: isFetchingDueDates,
    data: dueDatesData,
  } = useQuery({
    queryKey: [
      "all_due_dates",
      currentPage,
      searchTerm,
      filterOption,
      itemsPerPage,
      sortOption,
      selectedClientIds,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      // The four sort options are two fields x two directions. This sent
      // `event_date` for all of them and then re-sorted the page in the
      // browser, which can only ever order the rows the server already chose —
      // "Event (A-Z)" over page 1 of 11 is not A-Z.
      const byEvent = sortOption === "eventAZ" || sortOption === "eventZA";
      const order = sortOption === "oldest" || sortOption === "eventAZ" ? "asc" : "desc";
      const sort = byEvent ? "event_name" : "due_at";
      const response = await API_CONFIG.get(
        `/api/v1/patent/fetch/all-due-dates?${params?.toString()}&limit=${itemsPerPage}&order=${order}&sort=${
          sort
        }&search=${encodeURIComponent(searchTerm)}&filter=${filterOption}&filter_client_id=${selectedClientIds.join(
          ",",
        )}`,
      );

      if (response.status === 200) {
        return response?.data;
      }
    },
    enabled: !!user?.client_id,
    refetchOnMount: true,
  });

  const dueDatesTotal = Number(dueDatesData?.pagination?.total) || 0;

  useEffect(() => {
    onHeaderStateChange?.({
      viewType,
      total: dueDatesTotal,
      onViewChange: setViewType,
    });
  }, [dueDatesTotal, onHeaderStateChange, viewType]);

  const { data: clientsData } = useQuery({
    queryKey: ["clients_lookup_for_due_dates", debouncedClientSearch],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (debouncedClientSearch)
          params.append("search", debouncedClientSearch);
        params.append("limit", "5");
        const response = await API_CONFIG.get(
          `/api/v1/clients/lookup?${params.toString()}`,
        );
        return response?.data;
      } catch (error) {
        console.error("Error getting clients", error);
      }
    },
    enabled: isOutsideCounselRole(user?.role),
  });

  // OC: Send reminder mutation
  const { mutate: sendReminder } = useMutation({
    mutationFn: async (patentEventId: string) => {
      const response = await API_CONFIG.post(
        `/api/v1/patent/events/${patentEventId}/remind`,
      );
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_due_dates"] });
      setRemindingId(null);
      toast.success("Reminder sent to the client's legal team");
    },
    onError: (error: any) => {
      setRemindingId(null);
      toast.error(
        error?.response?.data?.message || "Failed to send reminder",
      );
    },
  });

  const handleRemind = useCallback(
    (eventId: string) => {
      setRemindingId(eventId);
      sendReminder(eventId);
    },
    [sendReminder],
  );

  // Filtering AND sorting are the server's: the list is paginated, so a sort
  // applied here would only reorder the 10 rows this page happens to hold and
  // present them as the whole ordering. It also mutated the query cache in
  // place (Array.sort sorts the array react-query handed it).
  const filteredAndSortedDueDates = useMemo(
    () => dueDatesData?.data ?? [],
    [dueDatesData],
  );

  useEffect(() => {
    if (viewType === "calendar") {
      setSearchQuery("");
      setFilterOption("all");
      setStatusFilter("all");
      setCountryFilter("all");
      setAppliedFilters([]);
    }
  }, [viewType]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reset to page 1 when client filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClientIds]);

  const getEventTone = (daysOverdue: number): ProductChipTone =>
    daysOverdue > 0 ? "danger" : daysOverdue === 0 ? "warning" : "success";

  const handleFilterChange = (value: FilterOption) => {
    setFilterOption(value);
    setCurrentPage(1); // Reset to first page when filter changes

    const newFilters = [...appliedFilters.filter((f) => !f.startsWith("Due:"))];
    if (value !== "all") {
      newFilters.push(`Due: ${getFilterLabel(value)}`);
    }
    setAppliedFilters(newFilters);

    toast.success(`Filter applied: ${getFilterLabel(value)}`);
  };

  const handleStatusFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page when filter changes

    const newFilters = [
      ...appliedFilters.filter((f) => !f.startsWith("Status:")),
    ];
    if (value !== "all") {
      newFilters.push(`Status: ${value}`);
    }
    setAppliedFilters(newFilters);

    toast.success(`Status filter applied: ${value}`);
  };

  const handleCountryFilterChange = (value: CountryFilter) => {
    setCountryFilter(value);
    setCurrentPage(1); // Reset to first page when filter changes

    const newFilters = [
      ...appliedFilters.filter((f) => !f.startsWith("Country:")),
    ];
    if (value !== "all") {
      newFilters.push(`Country: ${value}`);
    }
    setAppliedFilters(newFilters);

    toast.success(`Country filter applied: ${value}`);
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    setCurrentPage(1); // Reset to first page when sort changes
    toast.success(`Sort applied: ${getSortLabel(value)}`);
  };

  const removeFilter = (filter: string) => {
    const newFilters = appliedFilters.filter((f) => f !== filter);
    setAppliedFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filter is removed

    if (filter.startsWith("Due:")) {
      setFilterOption("all");
    } else if (filter.startsWith("Status:")) {
      setStatusFilter("all");
    } else if (filter.startsWith("Country:")) {
      setCountryFilter("all");
    }

    toast.success(`Filter removed: ${filter}`);
  };

  const clearAllFilters = () => {
    setAppliedFilters([]);
    setFilterOption("all");
    setStatusFilter("all");
    setCountryFilter("all");
    setSearchQuery("");
    setCurrentPage(1); // Reset to first page when filters are cleared
    toast.success("All filters cleared");
  };

  const getFilterLabel = (filter: FilterOption): string => {
    switch (filter) {
      case "all":
        return "All Due Dates";
      case "upcoming":
        return "Upcoming";
      case "dueToday":
        return "Due Today";
      case "overdue":
        return "Overdue";
      case "completed":
        return "Completed";
      default:
        return "All Due Dates";
    }
  };

  const getSortLabel = (sort: SortOption): string => {
    switch (sort) {
      case "newest":
        return "Newest First";
      case "oldest":
        return "Oldest First";
      case "eventAZ":
        return "Event (A-Z)";
      case "eventZA":
        return "Event (Z-A)";
      default:
        return "Newest First";
    }
  };

  const renderMobileCard = (dueDate: DueDate, index: number) => {
    return (
      <div
        key={dueDate.id}
        className="bg-white p-4 rounded-lg border border-gray-200 mb-3 shadow-sm"
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-medium text-base truncate max-w-[200px]">
            {dueDate.event}
          </h3>
          <ProductChip kind="status" tone={getEventTone(dueDate.daysOverdue)}>
            {dueDate.daysOverdue > 0
              ? `${dueDate.daysOverdue}d overdue`
              : dueDate.daysOverdue === 0
                ? "Due today"
                : `${Math.abs(dueDate.daysOverdue)}d left`}
          </ProductChip>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Patent</p>
            <p className="truncate">{dueDate.patent}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Deadline</p>
            <p>{formatDate(dueDate.dueDate)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Status</p>
            <p className="truncate">{dueDate.status}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Country</p>
            <p className="truncate">{dueDate.country}</p>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <span>Counsel: {dueDate.counsel}</span>
        </div>
      </div>
    );
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    );
  };

  // Get visible columns in their original order
  const visibleColumns = columns.filter((col) => col.visible);

  // Helper function to render cell content based on column ID
  const renderCellContent = (columnId: string, client: any, index: number) => {
    switch (columnId) {
      case "event":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span className="font-medium text-[var(--pulse-ink)]">{client.event_name}</span>
          </td>
        );
      case "applicationNumber":
        return (
          <td
            key={columnId}
            className={`min-w-[150px] p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span className="whitespace-nowrap text-[13px] tabular-nums text-[var(--pulse-ink-secondary)] dark:text-neutral-300">
              {client?.patent?.application_number || "N/A"}
            </span>
          </td>
        );
      case "title":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span
              className="block max-w-[280px] truncate font-medium text-[var(--pulse-ink)]"
              title={client?.patent?.title || "N/A"}
            >
              {client?.patent?.title || "N/A"}
            </span>
          </td>
        );
      case "nextEvent":
        return (
          <td key={columnId} className="min-w-[220px] p-4 text-sm">
            <span
              className="block max-w-[300px] truncate text-[var(--pulse-ink-secondary)]"
              title={client.event_name}
            >
              {client.event_name || "—"}
            </span>
          </td>
        );
      case "deadline":
        return (
          <td key={columnId} className="min-w-[130px] whitespace-nowrap p-4 text-sm tabular-nums text-[var(--pulse-ink-secondary)]">
            {client.event_date
              ? moment(client.event_date).format("MMM D, YYYY")
              : "—"}
          </td>
        );
      case "days": {
        const completed = isPatentEventCompleted(client);
        const today = new Date();
        const deadline = new Date(client.event_date);
        today.setHours(0, 0, 0, 0);
        deadline.setHours(0, 0, 0, 0);
        const days = Math.ceil(
          (deadline.getTime() - today.getTime()) / 86400000,
        );
        return (
          <td key={columnId} className="min-w-[90px] whitespace-nowrap p-4 text-xs font-semibold tabular-nums">
            <span
              className={
                completed
                  ? "text-[var(--pulse-success)]"
                  : days < 0
                  ? "text-[var(--pulse-danger)]"
                  : days <= 30
                    ? "text-[#7E5A00]"
                    : "text-[var(--pulse-ink-secondary)]"
              }
            >
              {completed
                ? "Completed"
                : days < 0
                  ? "Overdue"
                  : days === 0
                    ? "Today"
                    : `${days}d`}
            </span>
          </td>
        );
      }
      case "action": {
        const submittedAction =
          client?.patent_action || client?.PatentAction?.[0];
        const draftAction = draftActions[client.id];
        return (
          <td key={columnId} className="min-w-[220px] p-4">
            <ActionDropdown
              eventType={client.event_name || ""}
              selectedTemplateId={
                draftAction?.templateId ||
                submittedAction?.action_template?.id
              }
              onSelect={(template) =>
                setDraftActions((current) => ({
                  ...current,
                  [client.id]: {
                    templateId: template.id,
                    updatedAt: new Date().toISOString(),
                  },
                }))
              }
              disabled={Boolean(submittedAction)}
            />
          </td>
        );
      }
      case "actionStatus": {
        const submittedAction =
          client?.patent_action || client?.PatentAction?.[0];
        const draftAction = draftActions[client.id];
        const status = submittedAction?.request_status ||
          submittedAction?.action_status;
        const label = draftAction
          ? "Draft"
          : status
            ? String(status)
                .toLowerCase()
                .replace(/_/g, " ")
                .replace(/^./, (letter) => letter.toUpperCase())
            : "No Action";
        return (
          <td key={columnId} className="min-w-[120px] p-4">
            <ProductChip kind="status" tone="neutral">
              {label}
            </ProductChip>
          </td>
        );
      }
      case "lastUpdated": {
        const submittedAction =
          client?.patent_action || client?.PatentAction?.[0];
        const updatedAt =
          draftActions[client.id]?.updatedAt || submittedAction?.updatedAt;
        return (
          <td key={columnId} className="min-w-[120px] whitespace-nowrap p-4 text-xs text-[var(--pulse-ink-muted)]">
            {updatedAt ? moment(updatedAt).fromNow() : "—"}
          </td>
        );
      }
      case "outsideCounsel":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span>{client?.patent?.assignee_original || "N/A"}</span>
          </td>
        );
      case "dueDate":
        return (
          <td key={columnId} className="p-4 text-sm whitespace-nowrap">
            <span className="font-mono text-[13px] tabular-nums text-[var(--pulse-ink-secondary)] dark:text-neutral-300">
              {moment(client.event_date).format("MMM D, YYYY")}
            </span>
          </td>
        );
      case "status":
        {
          const value = client.patent?.legal_current_status as
            | PatentLegalStatus
            | undefined;
          const meta = value ? PATENT_LEGAL_STATUS_META[value] : undefined;
          return (
            <td key={columnId}>
              {meta ? (
                <ProductChip
                  kind="status"
                  marker
                  markerColor={meta.marker}
                  textColor={meta.text}
                >
                  {meta.label.replace(/^(Active|Inactive) – /, "")}
                </ProductChip>
              ) : (
                <span className="text-xs text-[var(--pulse-ink-muted)]">—</span>
              )}
            </td>
          );
        }
      case "legalStatus":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span>{client?.patent?.legal_current_status || "N/A"}</span>
          </td>
        );
      case "assignee":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span>{client?.patent?.assignee_original || "N/A"}</span>
          </td>
        );
      case "inventors":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-200" : "text-neutral-800"
            }`}
          >
            <span>{client?.patent?.inventors?.join(", ") || "N/A"}</span>
          </td>
        );
      case "country":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-400" : "text-neutral-600"
            }`}
          >
            <span>{client?.patent?.country || "N/A"}</span>
          </td>
        );
      case "familyMembers":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-400" : "text-neutral-600"
            }`}
          >
            {client?.patent?.simple_family_members?.length ? (
              <div className="max-w-xs truncate font-mono text-xs">
                {client.patent.simple_family_members.join(", ")}
              </div>
            ) : (
              <div className="max-w-xs truncate font-mono text-xs">N/A</div>
            )}
          </td>
        );
      case "currentEvent":
        return (
          <td
            key={columnId}
            className={`p-4 text-sm ${
              theme === "dark" ? "text-neutral-300" : "text-neutral-700"
            }`}
          >
            {client.event_name}
          </td>
        );
      case "remind": {
        const submittedAction = client?.PatentAction?.[0];
        const actionAlreadySubmitted =
          submittedAction &&
          ["SUBMITTED", "UPDATED"].includes(submittedAction.action_status);
        return (
          <td key={columnId} className="p-4 text-sm">
            <RemindButton
              lastRemindedAt={client?.last_reminded_at || null}
              actionAlreadySubmitted={!!actionAlreadySubmitted}
              onClick={() => handleRemind(client.id)}
              isLoading={remindingId === client.id}
            />
          </td>
        );
      }
      default:
        return null;
    }
  };

  const paginationMeta = dueDatesData?.pagination || {};

  const totalItems = paginationMeta.total || 0;
  const currentPageFromApi = paginationMeta.page || currentPage;
  const startIndex = (currentPageFromApi - 1) * itemsPerPage;

  const renderPagination = () => {
    if (!dueDatesData?.pagination) return null;

    const totalPages = Number(dueDatesData.pagination.totalPages) || 1;
    const total = Number(dueDatesData.pagination.total) || 0;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return (
      <div
        className={`pulse-pagination-bar relative z-20 !mx-0 !mb-0 !mt-0 flex-shrink-0 rounded-xl border ${
          theme === "dark"
            ? "bg-neutral-950 border-[#cccccc20]"
            : "bg-white border-neutral-200"
        }`}
      >
        <div
          className="font-sans flex items-center justify-between text-nowrap overflow-x-auto"
          style={{ scrollbarColor: "transparent transparent" }}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-sm ${
                theme === "dark" ? "text-neutral-500" : "text-neutral-600"
              }`}
            >
              Showing {startIndex + 1} to{" "}
              {Math.min(startIndex + dueDatesData?.data?.length, totalItems)} of{" "}
              {totalItems} entries
            </span>
            <div className="relative">
              <select
                value={itemsPerPage.toString()}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                className={`border rounded pl-3 pr-6 py-1.5 text-sm appearance-none focus:outline-none focus:border-[#F9B418] transition-colors ${
                  theme === "dark"
                    ? "bg-neutral-900 border-neutral-800 text-neutral-300"
                    : "bg-white border-neutral-200 text-neutral-700"
                }`}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <ChevronDown
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                  theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                }`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                theme === "dark"
                  ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                  : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
              }`}
              onClick={() => setCurrentPage(1)}
              disabled={currentPageFromApi === 1}
              title="First page"
            >
              <div className="w-3 h-3">
                <ChevronsLeft className="w-4 h-4" />
              </div>
            </button>
            <button
              className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                theme === "dark"
                  ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                  : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
              }`}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPageFromApi === 1}
              title="Previous page"
            >
              <div className="w-3 h-3">
                <ChevronLeft className="w-4 h-4" />
              </div>
            </button>
            {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 3) {
                pageNum = i + 1;
              } else if (currentPageFromApi <= 2) {
                pageNum = i + 1;
              } else if (currentPageFromApi >= totalPages - 1) {
                pageNum = totalPages - 2 + i;
              } else {
                pageNum = currentPageFromApi - 1 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    currentPageFromApi === pageNum
                      ? "bg-[#F9B418] text-black"
                      : `${
                          theme === "dark"
                            ? "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50"
                            : "bg-white border border-neutral-200 text-neutral-700 hover:border-[#F9B418]"
                        }`
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                theme === "dark"
                  ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                  : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
              }`}
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPageFromApi === totalPages}
              title="Next page"
            >
              <div className="w-3 h-3">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
            <button
              className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                theme === "dark"
                  ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                  : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
              }`}
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPageFromApi === totalPages}
              title="Last page"
            >
              <div className="w-3 h-3">
                <ChevronsRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pulse-product-page pulse-table-page relative mx-auto flex min-h-0 flex-1 w-full max-w-[1680px] flex-1 flex-col overflow-hidden px-6 py-6 lg:px-8">
      {/* Animated Gradient Background */}
      <div className="hidden">
        {theme === "dark" ? (
          <>
            {/* Yellow Gradient Blob */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.3) 0%, rgba(245, 166, 35, 0) 70%)",
                top: "-10%",
                right: "10%",
                animationDelay: "0s",
              }}
            />
            {/* Cyan Gradient Blob */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, rgba(6, 182, 212, 0) 70%)",
                bottom: "10%",
                left: "5%",
                animationDelay: "2s",
              }}
            />
            {/* Purple Gradient Blob */}
            <div
              className="absolute w-[550px] h-[550px] rounded-full opacity-15 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(168, 85, 247, 0) 70%)",
                top: "40%",
                left: "30%",
                animationDelay: "4s",
              }}
            />
          </>
        ) : (
          <>
            {/* Yellow Gradient Blob - Light */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.2) 0%, rgba(245, 166, 35, 0) 70%)",
                top: "-10%",
                right: "10%",
                animationDelay: "0s",
              }}
            />
            {/* Cyan Gradient Blob - Light */}
            <div
              className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0) 70%)",
                bottom: "10%",
                left: "5%",
                animationDelay: "2s",
              }}
            />
            {/* Pink Gradient Blob - Light */}
            <div
              className="absolute w-[550px] h-[550px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)",
                top: "40%",
                left: "30%",
                animationDelay: "4s",
              }}
            />
          </>
        )}
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {viewType === "list" && (
          <>
            <div
              className={`pulse-toolbar !mx-0 !mb-5 !mt-0 font-sans flex flex-wrap md:flex-shrink-0 overflow-x-auto ${
                theme === "dark"
                  ? "bg-[#0a0a0a] border-neutral-900"
                  : "bg-white border-neutral-200"
              }`}
              style={{ scrollbarColor: "transparent transparent" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className={`relative min-w-[300px]`}>
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none ${
                        theme === "dark"
                          ? "text-neutral-500"
                          : "text-neutral-400"
                      }`}
                    />
                    <Input
                      name="search"
                      type="text"
                      placeholder="Search by event, application number, client..."
                      className={`w-full border rounded pl-10 pr-4 pb-2 h-[42px] text-sm focus:outline-none focus:border-[#F9B418]/10 transition-colors ${
                        theme === "dark"
                          ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                          : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
                      }`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Plus
                      onClick={() => setSearchQuery("")}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-45 w-4 h-4 z-10 cursor-pointer ${
                        theme === "dark"
                          ? "text-neutral-500"
                          : "text-neutral-400"
                      }`}
                    />
                  </div>
                </div>

                {/* <div className="flex items-center gap-3 flex-shrink-0"> */}
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
                      <span>
                        {getFilterLabel(filterOption)}
                      </span>
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
                        { label: "All Due Dates", value: "all" },
                        { label: "Upcoming", value: "upcoming" },
                        { label: "Due Today", value: "dueToday" },
                        { label: "Overdue", value: "overdue" },
                        { label: "Completed", value: "completed" },
                      ].map((all) => (
                        <DropdownMenuRadioItem
                          key={all.value}
                          value={all.value}
                          className={`font-sans cursor-pointer flex items-center gap-2 text-sm transition-colors ${
                            theme === "dark"
                              ? "text-zinc-200 hover:!text-zinc-200 focus:!text-zinc-200 hover:!bg-white/5 focus:!bg-white/5"
                              : "text-[#404040] hover:!text-[#404040] focus:!text-[#404040] hover:bg-[#fdfdfd]"
                          }  data-[state=checked]:bg-photon-background-light`}
                        >
                          {all.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {isOutsideCounselRole(user?.role) && (
                  <Popover
                    onOpenChange={(open) => {
                      if (!open) setClientSearchInput("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`flex items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                          theme === "dark"
                            ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-white/5 hover:text-neutral-300"
                            : "hover:bg-transparent bg-transparent border-neutral-200 text-neutral-700 hover:text-[#494949] hover:border-[#F9B418]"
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        <span>Clients</span>
                        {selectedClientIds.length > 0 && (
                          <Badge
                            variant="outline"
                            className={`ml-1 px-1.5 py-0 text-xs ${
                              theme === "dark"
                                ? "bg-[#F9B418]/10 border-[#F9B418]/30 text-[#F9B418]"
                                : "bg-[#F9B418]/10 border-[#F9B418]/40 text-[#8a6300]"
                            }`}
                          >
                            {selectedClientIds.length}
                          </Badge>
                        )}
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      sideOffset={8}
                      align="start"
                      className={`w-[260px] p-0 ${
                        theme === "dark"
                          ? "bg-[#0a0a0a] border border-[#cccccc20]"
                          : ""
                      }`}
                    >
                      <div
                        className={`p-2 border-b ${
                          theme === "dark"
                            ? "border-neutral-800"
                            : "border-neutral-200"
                        }`}
                      >
                        <div className="relative">
                          <Search
                            className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-neutral-400"
                            }`}
                          />
                          <Input
                            autoFocus
                            type="text"
                            placeholder="Search clients..."
                            value={clientSearchInput}
                            onChange={(e) =>
                              setClientSearchInput(e.target.value)
                            }
                            className={`h-8 pl-8 text-sm ${
                              theme === "dark"
                                ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                                : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
                            }`}
                          />
                        </div>
                      </div>
                      {selectedClientIds.length > 0 && (
                        <div
                          className={`px-3 py-2 border-b flex items-center justify-between ${
                            theme === "dark"
                              ? "border-neutral-800"
                              : "border-neutral-200"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              theme === "dark"
                                ? "text-neutral-400"
                                : "text-neutral-600"
                            }`}
                          >
                            {selectedClientIds.length} selected
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedClientIds([])}
                            className={`text-xs underline ${
                              theme === "dark"
                                ? "text-neutral-300 hover:text-white"
                                : "text-neutral-700 hover:text-black"
                            }`}
                          >
                            Clear
                          </button>
                        </div>
                      )}
                      <ScrollArea className="max-h-[260px] overflow-y-auto">
                        <div className="font-sans p-2 space-y-1">
                          {clientsData?.data?.length === 0 ? (
                            <div
                              className={`px-2 py-2 text-sm ${
                                theme === "dark"
                                  ? "text-neutral-500"
                                  : "text-neutral-400"
                              }`}
                            >
                              {debouncedClientSearch
                                ? "No clients found"
                                : "No clients available"}
                            </div>
                          ) : (
                            clientsData?.data?.map((client: any) => {
                              const checked = selectedClientIds.includes(
                                client.id,
                              );

                              return (
                                <div
                                  key={client.id}
                                  className={`flex items-center gap-2 cursor-pointer p-1.5 rounded ${
                                    theme === "dark"
                                      ? "hover:bg-white/5"
                                      : "hover:bg-[#fafafa]"
                                  }`}
                                >
                                  <Checkbox
                                    id={`client-${client.id}`}
                                    checked={checked}
                                    onCheckedChange={(value) => {
                                      setSelectedClientIds((prev) =>
                                        value
                                          ? [...prev, client.id]
                                          : prev.filter(
                                              (id) => id !== client.id,
                                            ),
                                      );
                                    }}
                                    className={
                                      theme === "dark"
                                        ? "bg-transparent border-white/10"
                                        : "border-zinc-900"
                                    }
                                  />

                                  <label
                                    htmlFor={`client-${client.id}`}
                                    className={`text-sm cursor-pointer truncate ${
                                      theme === "dark"
                                        ? "text-zinc-200"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {client.name}
                                  </label>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}

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

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`flex items-center gap-2 px-4 py-5 border rounded text-sm font-normal transition-colors whitespace-nowrap ${
                        theme === "dark"
                          ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-neutral-300 hover:border-[#F9B418]/50 hover:bg-neutral-900"
                          : "hover:bg-transparent bg-transparent border-neutral-200 text-[#404040]  hover:border-[#F9B418]"
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
                        className="lucide lucide-columns3 lucide-columns-3 w-4 h-4"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                        <path d="M9 3v18"></path>
                        <path d="M15 3v18"></path>
                      </svg>
                      <span className="sm:inline">Columns</span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={`w-72 p-3 ${
                      theme === "dark" &&
                      "bg-[#0a0a0a] border border-[#cccccc20]"
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
                              id={`column-${column.id}`}
                              checked={column.visible}
                              onCheckedChange={() =>
                                toggleColumnVisibility(column.id)
                              }
                              disabled={column.sticky}
                              className={`${
                                theme === "dark"
                                  ? "border-[#242424] bg-transparent"
                                  : "border-zinc-900"
                              }`}
                            />
                            <label
                              htmlFor={`column-${column.id}`}
                              className={`text-sm cursor-pointer ${
                                column.sticky
                                  ? `${
                                      theme === "dark"
                                        ? "text-zinc-200"
                                        : "text-[#404040]"
                                    }`
                                  : `${
                                      theme === "dark"
                                        ? "text-zinc-200"
                                        : "text-neutral-700"
                                    }`
                              }`}
                            >
                              {column.label}
                              {column.sticky && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (fixed)
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                {/* </div> */}
              </div>

              {viewType === "list" && appliedFilters.length > 0 && (
                <div
                  className={`font-sans flex-shrink-0 flex-start mt-5 ${
                    theme === "dark"
                      ? "border-neutral-900 bg-neutral-950"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center font-sans gap-2">
                    <span
                      className={`text-xs ${
                        theme === "dark"
                          ? "text-neutral-500"
                          : "text-neutral-600"
                      }`}
                    >
                      Applied filters:
                    </span>
                    {appliedFilters.map((filter) => (
                      <Badge
                        key={filter}
                        variant="outline"
                        className={`flex items-center gap-1 ${
                          theme === "dark"
                            ? "bg-neutral-900 border-neutral-800 text-neutral-300"
                            : "bg-neutral-50 border-neutral-200"
                        }`}
                      >
                        {filter}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-4 w-4 rounded-full ml-1 ${
                            theme === "dark"
                              ? "hover:bg-white/5 hover:text-neutral-300"
                              : "hover:bg-neutral-100"
                          }`}
                          onClick={() => removeFilter(filter)}
                        >
                          <span className="sr-only">Remove</span>
                          <span className="text-xs">×</span>
                        </Button>
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 text-xs ${
                        theme === "dark"
                          ? "text-neutral-400 bg-white/5 hover:text-neutral-300 hover:bg-white/10 border !border-neutral-800"
                          : "text-neutral-600"
                      }`}
                      onClick={clearAllFilters}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isFetchingDueDates && !dueDatesData && viewType === "list" ? (
          <Loader />
        ) : viewType === "calendar" ? (
          <>
            {/* Search and Filter Bar for Calendar View */}
            <div
              className={`pulse-toolbar !mx-0 !mb-5 !mt-0 flex flex-wrap md:block md:flex-shrink-0 overflow-x-auto ${
                theme === "dark"
                  ? "bg-neutral-950 border-neutral-900"
                  : "bg-white border-neutral-200"
              }`}
              style={{ scrollbarColor: "transparent transparent" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="relative min-w-[300px]">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none ${
                        theme === "dark"
                          ? "text-neutral-500"
                          : "text-neutral-400"
                      }`}
                    />
                    <Input
                      name="search"
                      type="text"
                      placeholder="Search by event, application number, client..."
                      className={`w-full border rounded pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-[#F9B418]/10 transition-colors ${
                        theme === "dark"
                          ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                          : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
                      }`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                {isOutsideCounselRole(user?.role) && (
                  <Popover
                    onOpenChange={(open) => {
                      if (!open) setClientSearchInput("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        className={`flex font-sans items-center gap-2 px-4 py-2.5 border rounded text-sm transition-colors ${
                          theme === "dark"
                            ? "bg-neutral-900 hover:bg-[#171717] border-neutral-800 text-[#d4d4d4] hover:border-[#F9B418]/50"
                            : "bg-white border-neutral-200 text-neutral-700 hover:bg-transparent hover:border-[#F9B418]"
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        <span>Clients</span>
                        {selectedClientIds.length > 0 && (
                          <Badge
                            variant="outline"
                            className={`ml-1 px-1.5 py-0 text-xs ${
                              theme === "dark"
                                ? "bg-[#F9B418]/10 border-[#F9B418]/30 text-[#F9B418]"
                                : "bg-[#F9B418]/10 border-[#F9B418]/40 text-[#8a6300]"
                            }`}
                          >
                            {selectedClientIds.length}
                          </Badge>
                        )}
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      sideOffset={8}
                      align="start"
                      className={`w-[260px] p-0 ${
                        theme === "dark"
                          ? "bg-zinc-900 border border-[#cccccc20]"
                          : ""
                      }`}
                    >
                      <div
                        className={`p-2 border-b ${
                          theme === "dark"
                            ? "border-neutral-800"
                            : "border-neutral-200"
                        }`}
                      >
                        <div className="relative">
                          <Search
                            className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-neutral-400"
                            }`}
                          />
                          <Input
                            autoFocus
                            type="text"
                            placeholder="Search clients..."
                            value={clientSearchInput}
                            onChange={(e) =>
                              setClientSearchInput(e.target.value)
                            }
                            className={`h-8 pl-8 text-sm ${
                              theme === "dark"
                                ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                                : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
                            }`}
                          />
                        </div>
                      </div>
                      {selectedClientIds.length > 0 && (
                        <div
                          className={`px-3 py-2 border-b flex items-center justify-between ${
                            theme === "dark"
                              ? "border-neutral-800"
                              : "border-neutral-200"
                          }`}
                        >
                          <span
                            className={`text-xs ${
                              theme === "dark"
                                ? "text-neutral-400"
                                : "text-neutral-600"
                            }`}
                          >
                            {selectedClientIds.length} selected
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedClientIds([])}
                            className={`text-xs underline ${
                              theme === "dark"
                                ? "text-neutral-300 hover:text-white"
                                : "text-neutral-700 hover:text-black"
                            }`}
                          >
                            Clear
                          </button>
                        </div>
                      )}
                      <ScrollArea className="max-h-[260px]">
                        <div className="p-2 space-y-1">
                          {clientsData?.data?.length === 0 ? (
                            <div
                              className={`px-2 py-2 text-sm ${
                                theme === "dark"
                                  ? "text-neutral-500"
                                  : "text-neutral-400"
                              }`}
                            >
                              {debouncedClientSearch
                                ? "No clients found"
                                : "No clients available"}
                            </div>
                          ) : (
                            clientsData?.data?.map((client: any) => {
                              const checked = selectedClientIds.includes(
                                client.id,
                              );
                              return (
                                <div
                                  key={client.id}
                                  className={`flex items-center gap-2 p-1.5 rounded ${
                                    theme === "dark"
                                      ? "hover:bg-white/5"
                                      : "hover:bg-[#fafafa]"
                                  }`}
                                >
                                  <Checkbox
                                    id={`calendar-client-${client.id}`}
                                    checked={checked}
                                    onCheckedChange={(value) => {
                                      setSelectedClientIds((prev) =>
                                        value
                                          ? [...prev, client.id]
                                          : prev.filter(
                                              (id) => id !== client.id,
                                            ),
                                      );
                                    }}
                                    className={
                                      theme === "dark"
                                        ? "bg-[#cccccc20] border-none"
                                        : "border-zinc-900"
                                    }
                                  />
                                  <label
                                    htmlFor={`calendar-client-${client.id}`}
                                    className={`text-sm cursor-pointer truncate ${
                                      theme === "dark"
                                        ? "text-zinc-200"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {client.name}
                                  </label>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            {isFetchingDueDates ? (
              <Loader />
            ) : (
              <div className="flex-1 min-h-0">
                <DueDatesCalendar
                  canManageEvents={isOutsideCounselRole(user?.role)}
                  updatingEventId={
                    eventCompletion.isPending
                      ? eventCompletion.variables?.eventId
                      : undefined
                  }
                  onEventCompletion={(eventId, completed) =>
                    eventCompletion.mutate({ eventId, completed })
                  }
                  dueDates={dueDatesData?.data?.map((item: any) => {
                    const dueDate = new Date(item.event_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDate.setHours(0, 0, 0, 0);
                    const daysDiff = Math.floor(
                      (dueDate.getTime() - today.getTime()) /
                        (1000 * 60 * 60 * 24),
                    );

                    return {
                      id: item.id || `${item.event_name}-${item.event_date}`,
                      event: item.event_name || "",
                      patent:
                        item.patent?.title ||
                        item.patent?.application_number ||
                        "",
                      applicationNumber: item.patent?.application_number || "",
                      counsel: item.patent?.assignee_original || "",
                      dueDate: item.event_date,
                      daysOverdue: -daysDiff, // Negative means overdue, positive means upcoming
                      status: item.patent?.legal_current_status || "",
                      country: item.patent?.country || "",
                      eventStatus: item.event_status || item.status || "OPEN",
                      completedAt: item.completed_at || item.cleared_at || null,
                    };
                  })}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {filteredAndSortedDueDates.length === 0 ? (
              <div
                className={`font-sans flex-1 flex flex-col items-center justify-center border-t ${
                  theme === "dark"
                    ? "border-neutral-900 bg-neutral-950"
                    : "border-neutral-200 bg-white"
                } p-8 text-center`}
              >
                <div
                  className={`font-sans flex h-20 w-20 items-center justify-center rounded-full ${
                    theme === "dark" ? "bg-gray-500/20" : "bg-gray-100"
                  }`}
                >
                  <FileSearch
                    className={`h-10 w-10 ${
                      theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                    }`}
                  />
                </div>
                <h3
                  className={`mt-6 text-xl font-semibold ${
                    theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                  }`}
                >
                  No due dates found
                </h3>
                <p
                  className={`font-sans mt-3 max-w-md text-center ${
                    theme === "dark" ? "text-neutral-400" : "text-gray-600"
                  }`}
                >
                  We couldn't find any due dates matching your search criteria.
                </p>
              </div>
            ) : (
              <div
                className="pulse-table-frame !mx-0 !mb-3 min-h-0 flex-1 overflow-auto"
              >
                <div className="min-w-full inline-block align-middle">
                  <table className="pulse-data-table min-w-full">
                    <thead
                      className={`sticky top-0 z-10 border-b ${
                        theme === "dark"
                          ? "bg-neutral-950 border-neutral-800"
                          : "bg-white border-neutral-200"
                      }`}
                    >
                      <tr>
                        {visibleColumns.map((column) => (
                          <th
                            key={column.id}
                            className="p-4 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-500"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody
                      className={
                        theme === "dark" ? "bg-neutral-950" : "bg-white"
                      }
                    >
                      {dueDatesData?.data?.map((client: any, index: number) => (
                        <tr
                          key={index}
                          className={`border-b transition-colors ${
                            theme === "dark"
                              ? "border-neutral-900 hover:bg-white/[0.02]"
                              : "border-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          {visibleColumns.map((column) =>
                            renderCellContent(column.id, client, index),
                          )}
                        </tr>
                      ))}
                      {dueDatesData?.data?.length === 0 && (
                        <tr>
                          <td
                            colSpan={visibleColumns.length}
                            className={`text-center text-sm p-4 ${
                              theme === "dark"
                                ? "text-neutral-400"
                                : "text-gray-500"
                            }`}
                          >
                            No due dates found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dueDatesData?.pagination?.total > 0 && renderPagination()}
          </>
        )}
      </div>
    </div>
  );
};

export default DueDatesContent;
