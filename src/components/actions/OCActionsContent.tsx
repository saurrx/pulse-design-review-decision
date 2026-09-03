import React, { useState, useCallback, useEffect } from "react";
import { track } from "@/lib/analytics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import RequestStatusBadge from "./RequestStatusBadge";
import moment from "moment";
import { daysColor, filterLabel, toggleColumn } from "@/lib/actionsView";

type FilterOption = "all" | "upcoming" | "dueToday" | "overdue";
type SortOption = "newest" | "oldest" | "eventAZ" | "eventZA";

interface QueueAction {
  id: string;
  action_status: string;
  request_status: string;
  selected_countries: string[];
  notes: string;
  submitted_at: string;
  days_to_deadline: number | null;
  patent: {
    id: string;
    application_number: string;
    title: string;
  };
  patent_event: {
    id: string;
    event_name: string;
    event_date: string;
  };
  action_template: {
    id: string;
    label: string;
    category: string;
  };
  submitted_by: {
    id: string;
    name: string;
    email: string;
  } | null;
  client: {
    id: string;
    name: string;
  };
}

const OCActionsContent: React.FC = () => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState<FilterOption>("all");
  const [sortOption, setSortOption] = useState<SortOption>("oldest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [selectedClientName, setSelectedClientName] = useState<string | null>(
    null,
  );
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearchInput, setClientSearchInput] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Debounce client search input → query
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedClientSearch(clientSearchInput),
      300,
    );
    return () => clearTimeout(timer);
  }, [clientSearchInput]);

  // ...and the row search, which now reaches the API: the box stays instant,
  // the request waits for the typing to stop.
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchQuery.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Column visibility
  const [columns, setColumns] = useState([
    { id: "applicationNumber", label: "Application No.", visible: true, sticky: false },
    { id: "client", label: "Client", visible: true, sticky: false },
    { id: "nextEvent", label: "Next Event", visible: true, sticky: false },
    { id: "deadline", label: "Deadline", visible: true, sticky: false },
    { id: "days", label: "Days", visible: true, sticky: false },
    { id: "actionSelected", label: "Action Selected", visible: true, sticky: false },
    { id: "submittedBy", label: "Submitted By", visible: true, sticky: false },
    { id: "requestStatus", label: "Request Status", visible: true, sticky: false },
  ]);

  const toggleColumnVisibility = (columnId: string) =>
    setColumns(toggleColumn(columns, columnId));

  const visibleColumns = columns.filter((col) => col.visible);


  // Same `list` name as the IHC table on purpose: /actions is one screen with
  // two role-specific bodies, and splitting the label would make the breakdown
  // read as two products.
  const handleFilterChange = (value: FilterOption) => {
    track("list_filtered", { list: "actions" });
    setFilterOption(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: SortOption) => {
    track("list_sorted", { list: "actions" });
    setSortOption(value);
    setCurrentPage(1);
  };

  // Fetch OC queue
  const { data: queueData, isLoading } = useQuery({
    queryKey: [
      "oc_action_queue",
      currentPage,
      itemsPerPage,
      searchTerm,
      filterOption,
      statusFilter,
      clientFilter,
      sortOption,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());
      if (searchTerm) params.append("search", searchTerm);
      if (filterOption !== "all") params.append("filter", filterOption);
      if (statusFilter !== "all")
        params.append("request_status", statusFilter);
      if (clientFilter !== "all") params.append("client_id", clientFilter);
      params.append("sort", sortOption);
      const response = await API_CONFIG.get(
        `/api/v1/actions/oc/queue?${params.toString()}`,
      );
      return response?.data;
    },
    refetchOnMount: true,
  });

  // Fetch clients for filter (search-as-you-type, top 5)
  const { data: clientsData } = useQuery({
    queryKey: ["clients_lookup_for_actions", debouncedClientSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedClientSearch) params.append("search", debouncedClientSearch);
      params.append("limit", "5");
      const response = await API_CONFIG.get(
        `/api/v1/clients/lookup?${params.toString()}`,
      );
      return response?.data;
    },
  });

  const actions: QueueAction[] = queueData?.data || [];
  const pagination = queueData?.pagination;
  const clients = clientsData?.data || [];

  // Update request status mutation
  const { mutate: updateStatus } = useMutation({
    mutationFn: async (data: {
      patent_action_id: string;
      request_status: string;
    }) => {
      const response = await API_CONFIG.put(
        "/api/v1/actions/request-status",
        data,
      );
      return response?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oc_action_queue"] });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || "Failed to update status",
      );
    },
  });


  const handleStatusChange = useCallback(
    (actionId: string, newStatus: string) => {
      updateStatus({
        patent_action_id: actionId,
        request_status: newStatus,
      });
    },
    [updateStatus],
  );


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="pulse-product-page pulse-table-page mx-auto flex min-h-0 flex-1 w-full max-w-[1680px] flex-col overflow-hidden px-6 py-6 lg:px-8">
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
              <span>{filterLabel(filterOption)}</span>
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

        {/* Status filter - keep existing */}
        <Select value={statusFilter} onValueChange={(s) => { setStatusFilter(s); setCurrentPage(1); }}>
          <SelectTrigger className={`w-[150px] h-[42px] text-sm border rounded ${
            theme === "dark"
              ? "bg-neutral-900 border-neutral-800 text-neutral-300"
              : "bg-transparent border-neutral-200 text-[#494949]"
          }`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Client filter - searchable */}
        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`w-[180px] h-[42px] justify-between text-sm border rounded font-normal ${
                theme === "dark"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-neutral-900 hover:text-neutral-300"
                  : "hover:bg-transparent bg-transparent border-neutral-200 hover:text-neutral-700 text-[#494949] hover:border-[#F9B418]"
              }`}
            >
              <span className="truncate">
                {clientFilter === "all"
                  ? "All clients"
                  : selectedClientName || "All clients"}
              </span>
              <ChevronDown className="w-4 h-4 ml-2 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={`w-[260px] p-0 ${
              theme === "dark"
                ? "bg-[#0a0a0a] border-[#cccccc20]"
                : "bg-white border-photon-border-light"
            }`}
            align="start"
          >
            <div
              className={`p-2 border-b ${
                theme === "dark" ? "border-neutral-800" : "border-neutral-200"
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
                  onChange={(e) => setClientSearchInput(e.target.value)}
                  className={`h-8 pl-8 text-sm ${
                    theme === "dark"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                      : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
                  }`}
                />
              </div>
            </div>
            <div className="py-1 max-h-[260px] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  setClientFilter("all");
                  setSelectedClientName(null);
                  setClientPopoverOpen(false);
                  setClientSearchInput("");
                  setCurrentPage(1);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  theme === "dark"
                    ? "text-neutral-200 hover:bg-white/5"
                    : "text-[#404040] hover:bg-[#fafafa]"
                } ${clientFilter === "all" ? "font-medium" : ""}`}
              >
                All clients
              </button>
              {clients.length === 0 ? (
                <div
                  className={`px-3 py-2 text-sm ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                  }`}
                >
                  {debouncedClientSearch
                    ? "No clients found"
                    : "No clients available"}
                </div>
              ) : (
                clients.map((client: any) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setClientFilter(client.id);
                      setSelectedClientName(client.name);
                      setClientPopoverOpen(false);
                      setClientSearchInput("");
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
                      theme === "dark"
                        ? "text-neutral-200 hover:bg-white/5"
                        : "text-[#404040] hover:bg-[#fafafa]"
                    } ${clientFilter === client.id ? "font-medium" : ""}`}
                  >
                    {client.name}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

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
                      id={`col-oc-${column.id}`}
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
                      htmlFor={`col-oc-${column.id}`}
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
              {actions.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className={`text-center py-12 ${
                      theme === "dark" ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    {searchQuery ||
                    filterOption !== "all" ||
                    statusFilter !== "all" ||
                    clientFilter !== "all"
                      ? "No actions match the current filters."
                      : "No submitted actions in the queue."}
                  </td>
                </tr>
              ) : (
                actions.map((action) => (
                  <tr
                    key={action.id}
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
                              {action.patent.application_number}
                            </td>
                          );
                        case "client":
                          return (
                            <td key={col.id} className="p-3 text-xs">
                              {action.client.name}
                            </td>
                          );
                        case "nextEvent":
                          return (
                            <td key={col.id} className="p-3 text-xs">
                              {action.patent_event?.event_name}
                            </td>
                          );
                        case "deadline":
                          return (
                            <td key={col.id} className="p-3 text-xs">
                              {action.patent_event?.event_date
                                ? moment(action.patent_event.event_date).format(
                                    "MMM D, YYYY",
                                  )
                                : "-"}
                            </td>
                          );
                        case "days": {
                          // Once the action is completed the deadline is moot —
                          // don't flag it red "Overdue", show neutral "Done".
                          const isCompleted = action.request_status === "COMPLETED";
                          return (
                            <td
                              key={col.id}
                              className={`p-3 text-xs ${
                                isCompleted
                                  ? "text-zinc-500"
                                  : daysColor(action.days_to_deadline)
                              }`}
                            >
                              {isCompleted
                                ? "Done"
                                : action.days_to_deadline !== null
                                  ? action.days_to_deadline <= 0
                                    ? "Overdue"
                                    : `${action.days_to_deadline}d`
                                  : "-"}
                            </td>
                          );
                        }
                        case "actionSelected":
                          return (
                            <td key={col.id} className="p-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium">
                                  {action.action_template.label}
                                </span>
                                {action.selected_countries.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {action.selected_countries
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
                                    {action.selected_countries.length > 3 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs px-1"
                                      >
                                        +{action.selected_countries.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        case "submittedBy":
                          return (
                            <td key={col.id} className="p-3">
                              <div className="flex flex-col">
                                <span className="text-xs">
                                  {action.submitted_by?.name ||
                                    action.submitted_by?.email ||
                                    "-"}
                                </span>
                                <span
                                  className={`text-xs ${
                                    theme === "dark"
                                      ? "text-zinc-500"
                                      : "text-zinc-400"
                                  }`}
                                >
                                  {action.submitted_at
                                    ? moment(action.submitted_at).fromNow()
                                    : ""}
                                </span>
                              </div>
                            </td>
                          );
                        case "requestStatus":
                          return (
                            <td key={col.id} className="p-3">
                              <RequestStatusBadge
                                status={action.request_status}
                                editable
                                onChange={(newStatus) =>
                                  handleStatusChange(action.id, newStatus)
                                }
                              />
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                ))
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
    </div>
  );
};

export default OCActionsContent;
