import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Filter,
  Search,
  Columns,
  ChevronDown,
  Check,
  FileSearch,
  ChevronsRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Plus,
  Pencil,
  X,
  Loader2,
  CalendarDays,
  Tags as TagsIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StickyTableHead,
  StickyTableCell,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ProductChip } from "@/components/ui/product-chip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import useUserCookie from "@/hooks/use-auth";
import Cookies from "js-cookie";
import Loader from "../Loader";
import moment from "moment";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";
import PatentTagsCell from "./PatentTagsCell";
import {
  PATENT_LEGAL_STATUS_META,
  PATENT_LEGAL_STATUS_VALUES,
  type PatentLegalStatus,
} from "@/utils/patentLegalStatus";

interface Patent {
  id: string;
  application_number: string;
  title: string;
  abstract: string;
  assignee_original: string;
  current_assignee: string;
  inventors: string[]; // Stored as a single string (joining array entries)
  publicationDate: string;
  application_date: string;
  priority_details: string;
  publication_country: string;
  current_status: string;
  issue_date: string;
  simpleFamilyMembers: string[];
  ipcAllVersions: string[];
  fileHistoryId: string;
  createdAt: string;
  updatedAt: string;
  prn: string;
  oc: string;
  legal_current_status?: string;
  tags?: string[];
  // patentEvents: PatentEvent[];
  // fileHistory: FileHistory;
}

// interface PatentEvent {
//   id: string;
//   eventName: string;
//   eventDate: string;
//   patentId: string;
//   createdAt: string;
//   updatedAt: string;
// }

// interface FileHistory {
//   id: string;
//   fileName: string;
//   filePath: string;
//   size: number;
//   type: string;
//   uploadedBy: string;
//   clientId: string;
//   createdAt: string;
//   updatedAt: string;
//   user: {
//     id: string;
//     name: string;
//     email: string;
//   };
// }

// Filter values are PATENT_LEGAL_STATUS enum members. Legacy bucket labels
// (granted/pending/rejected) are still accepted by the backend so old
// bookmarked URLs keep working, but the UI no longer surfaces them.
type FilterOption = PatentLegalStatus;
type SortOption = "newest" | "oldest" | "titleAZ" | "titleZA";

// Filing-date filter. Presets resolve to a rolling window ending today;
// "custom" uses the user-picked from/to. "all" means no date constraint.
type DatePreset = "all" | "last30" | "last60" | "last90" | "custom";

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  last30: "Last 30 days",
  last60: "Last 60 days",
  last90: "Last 90 days",
  custom: "Custom range",
};

// Turn the preset + custom inputs into concrete YYYY-MM-DD bounds for the
// API. Presets are anchored to today; custom passes through whatever the
// user entered (either bound may be empty).
const resolveDateRange = (
  preset: DatePreset,
  from: string,
  to: string,
): { from?: string; to?: string } => {
  if (preset === "all") return {};
  if (preset === "custom") {
    return { from: from || undefined, to: to || undefined };
  }
  const days = preset === "last30" ? 30 : preset === "last60" ? 60 : 90;
  return {
    from: moment().subtract(days, "days").format("YYYY-MM-DD"),
    to: moment().format("YYYY-MM-DD"),
  };
};

interface SortConfig {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface Column {
  id: string;
  label: string;
  width: string;
  accessor: keyof Patent | ((patent: Patent) => React.ReactNode);
  visible: boolean;
  sticky?: boolean;
  // DB column the backend sorts by when this header is clicked. Omitted for
  // columns that can't be server-sorted (row index, array fields like tags
  // and inventors).
  sortField?: string;
}

type PatentsContentProps = {
  patentStatus?: any;
  setTotalPatents?: (x: number) => void;
  // Parent registers its export-trigger ref via this callback. We re-register
  // every time the filter closure changes so the parent button always fires
  // an export against the latest filter state.
  setExportTrigger?: (fn: (() => Promise<void> | void) | null) => void;
};

const COLUMN_VISIBILITY_KEY_PREFIX = "patents-portfolio-column-visibility-v5";

const CORE_COLUMN_WIDTHS: Record<string, string> = {
  prn: "160px",
  title: "320px",
  legal_current_status: "170px",
  publicationCountry: "170px",
  dateOfFiling: "140px",
  tags: "220px",
};

const getColumnVisibilityStorageKey = (userId: string | undefined): string =>
  userId
    ? `${COLUMN_VISIBILITY_KEY_PREFIX}:${userId}`
    : COLUMN_VISIBILITY_KEY_PREFIX;

const readUserIdFromCookie = (): string | undefined => {
  try {
    const raw = Cookies.get("pl_user");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "string" ? parsed.id : undefined;
  } catch {
    return undefined;
  }
};

const defaultColumns: Column[] = [
  {
    id: "index",
    label: "#",
    width: "w-10",
    accessor: "id",
    visible: false,
    sticky: true,
  },
  {
    id: "applicationNo",
    label: "Application No.",
    width: "w-36",
    accessor: "application_number",
    visible: false,
    sticky: true,
    sortField: "application_number",
  },
  {
    id: "prn",
    label: "PRN",
    width: "w-40",
    accessor: "prn",
    visible: true,
    sticky: true,
    sortField: "prn",
  },
  {
    id: "title",
    label: "Invention Title",
    width: "w-96",
    accessor: "title",
    visible: true,
    sortField: "title",
  },
  {
    id: "legal_current_status",
    label: "Current Status",
    width: "w-36",
    accessor: "legal_current_status",
    visible: true,
    sortField: "legal_current_status",
  },
  {
    id: "publicationCountry",
    label: "Publication Country",
    width: "w-36",
    accessor: "publication_country",
    visible: true,
    sortField: "publication_country",
  },
  {
    id: "dateOfFiling",
    label: "Filed",
    width: "w-36",
    accessor: (patent) =>
      moment(patent?.application_date).format("YYYY-MM-DD"),
    visible: true,
    sortField: "application_date",
  },
  {
    id: "assigneeOriginal",
    label: "Assignee Original",
    width: "w-40",
    accessor: "assignee_original",
    visible: false,
    sortField: "assignee_original",
  },
  {
    id: "tags",
    label: "Tags",
    width: "w-64",
    accessor: "tags" as keyof Patent,
    visible: true,
  },
  {
    id: "abstract",
    label: "Abstract",
    width: "w-96",
    accessor: "abstract",
    visible: false,
    sortField: "abstract",
  },
  {
    id: "priority",
    label: "Priority Details",
    width: "w-96",
    accessor: "priority_details",
    visible: false,
    sortField: "priority_details",
  },
  {
    id: "currentAssignee",
    label: "Current Assignee",
    width: "w-40",
    accessor: "current_assignee",
    visible: false,
    sortField: "current_assignee",
  },
  {
    id: "inventors",
    label: "Inventors",
    width: "w-72",
    accessor: "inventors",
    visible: false,
  },
  {
    id: "publication_date",
    label: "Pub. Date",
    width: "w-36",
    accessor: (patent) => moment(patent?.issue_date).format("YYYY-MM-DD") || "-",
    visible: false,
    sortField: "issue_date",
  },
];

const loadColumnsFromStorage = (userId: string | undefined): Column[] => {
  try {
    const stored = localStorage.getItem(getColumnVisibilityStorageKey(userId));
    if (!stored) return defaultColumns;
    const overrides = JSON.parse(stored) as Record<string, unknown>;
    return defaultColumns.map((col) => {
      if (col.sticky) return col;
      const v = overrides?.[col.id];
      return typeof v === "boolean" ? { ...col, visible: v } : col;
    });
  } catch {
    return defaultColumns;
  }
};

const PatentsContent = (props: PatentsContentProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL params
  const getInitialSearchQuery = () => searchParams.get("search") || "";
  const getInitialFilterOption = (): FilterOption[] => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      const statuses = statusParam.split(",").filter(Boolean) as FilterOption[];
      return statuses;
    }
    return props.patentStatus ? [props.patentStatus] : [];
  };
  const getInitialSortOption = (): SortOption => {
    const sortParam = searchParams.get("sort") || "newest";
    return (["newest", "oldest", "titleAZ", "titleZA"].includes(sortParam) 
      ? sortParam 
      : "newest") as SortOption;
  };
  const getInitialPage = () => {
    const pageParam = searchParams.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  };
  const getInitialItemsPerPage = () => {
    const limitParam = searchParams.get("limit");
    return limitParam ? parseInt(limitParam, 10) : 10;
  };
  const getInitialSelectedClientId = (): string[] => {
    const clientParam = searchParams.get("client");
    return clientParam ? clientParam.split(",").filter(Boolean) : [];
  };
  const getInitialSelectedTags = (): string[] => {
    const tagsParam = searchParams.get("tags");
    return tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  };
  const getInitialSortConfig = (): SortConfig => {
    const sortBy = searchParams.get("sortBy") || "application_date";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
    return { sortBy, sortOrder };
  };
  const getInitialDatePreset = (): DatePreset => {
    const param = searchParams.get("date");
    return (["last30", "last60", "last90", "custom"].includes(param || "")
      ? param
      : "all") as DatePreset;
  };
  const getInitialCustomFrom = () => searchParams.get("date_from") || "";
  const getInitialCustomTo = () => searchParams.get("date_to") || "";

  const [viewMode, setViewMode] = useState<string>("list");
  const [rowHeight, setRowHeight] = useState<string>("large"); // Default to large for abstracts
  const [searchQuery, setSearchQuery] = useState<string>(getInitialSearchQuery);
  const [filterOption, setFilterOption] = useState<FilterOption[]>(getInitialFilterOption);
  const [sortOption, setSortOption] = useState<SortOption>(getInitialSortOption);
  const [currentPage, setCurrentPage] = useState<number>(getInitialPage);
  const [itemsPerPage, setItemsPerPage] = useState<number>(getInitialItemsPerPage);
  const [selectedClientId, setSelectedClientId] = useState<string[]>(getInitialSelectedClientId);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>(getInitialSelectedTags);
  const [tagSearchQuery, setTagSearchQuery] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(getInitialSortConfig);
  const [datePreset, setDatePreset] = useState<DatePreset>(getInitialDatePreset);
  const [customFrom, setCustomFrom] = useState<string>(getInitialCustomFrom);
  const [customTo, setCustomTo] = useState<string>(getInitialCustomTo);

  // Concrete from/to bounds sent to the API, recomputed whenever the preset
  // or custom inputs change.
  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  // Inline-edit state for the Current Status cell. PHOTON_ADMIN clicks the
  // pencil → row id goes into editingPatentId → cell renders a Select of
  // the 7 PATENT_LEGAL_STATUS enum values. Saving fires the mutation below.
  const [editingPatentId, setEditingPatentId] = useState<string | null>(null);

  // Ref to track if we're updating from URL params to prevent loops
  const isUpdatingFromUrl = React.useRef(false);

  // Sync state changes to URL params
  useEffect(() => {
    // Skip if we're updating from URL params
    if (isUpdatingFromUrl.current) {
      return;
    }
    const newParams = new URLSearchParams(searchParams);
    
    if (searchQuery) {
      newParams.set("search", searchQuery);
    } else {
      newParams.delete("search");
    }
    
    if (filterOption.length > 0) {
      newParams.set("status", filterOption.join(","));
    } else {
      newParams.delete("status");
    }
    
    if (sortOption !== "newest") {
      newParams.set("sort", sortOption);
    } else {
      newParams.delete("sort");
    }
    
    if (currentPage > 1) {
      newParams.set("page", currentPage.toString());
    } else {
      newParams.delete("page");
    }
    
    if (itemsPerPage !== 10) {
      newParams.set("limit", itemsPerPage.toString());
    } else {
      newParams.delete("limit");
    }
    
    if (selectedClientId.length > 0) {
      newParams.set("client", selectedClientId.join(","));
    } else {
      newParams.delete("client");
    }

    if (selectedTags.length > 0) {
      newParams.set("tags", selectedTags.join(","));
    } else {
      newParams.delete("tags");
    }

    if (sortConfig.sortBy !== "application_date" || sortConfig.sortOrder !== "desc") {
      newParams.set("sortBy", sortConfig.sortBy);
      newParams.set("sortOrder", sortConfig.sortOrder);
    } else {
      newParams.delete("sortBy");
      newParams.delete("sortOrder");
    }

    if (datePreset !== "all") {
      newParams.set("date", datePreset);
    } else {
      newParams.delete("date");
    }

    if (datePreset === "custom" && customFrom) {
      newParams.set("date_from", customFrom);
    } else {
      newParams.delete("date_from");
    }

    if (datePreset === "custom" && customTo) {
      newParams.set("date_to", customTo);
    } else {
      newParams.delete("date_to");
    }

    setSearchParams(newParams, { replace: true });
  }, [searchQuery, filterOption, sortOption, currentPage, itemsPerPage, selectedClientId, selectedTags, sortConfig, datePreset, customFrom, customTo, setSearchParams]);

  // Download the current filtered patent list as a CSV. Builds the URL from
  // the same filter state the list query uses, then streams the response as
  // a blob and triggers a save. Backend returns text/csv with Content-
  // Disposition so the filename is set there.
  const handleExportCsv = async () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterOption.length > 0)
      params.set("filter_status", filterOption.join(","));
    if (selectedClientId.length > 0)
      params.set("filter_client_id", selectedClientId.join(","));
    if (selectedTags.length > 0)
      params.set("filter_tags", selectedTags.join(","));
    if (sortConfig?.sortBy) params.set("sortBy", sortConfig.sortBy);
    if (sortConfig?.sortOrder) params.set("sortOrder", sortConfig.sortOrder);
    if (dateRange.from) params.set("date_from", dateRange.from);
    if (dateRange.to) params.set("date_to", dateRange.to);

    try {
      const response = await API_CONFIG.get(
        `/api/v1/patent/export/client/${user?.client_id}?${params.toString()}`,
        { responseType: "blob" },
      );
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patents-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? err?.message ?? "Export failed";
      toast.error(message);
    }
  };

  // Re-register the export trigger every time the filter closure changes so
  // the parent's button fires against the latest filters.
  useEffect(() => {
    props.setExportTrigger?.(handleExportCsv);
    return () => {
      props.setExportTrigger?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterOption, selectedClientId, selectedTags, sortConfig, dateRange, props.setExportTrigger]);

  // Sync state from URL params when they change externally (e.g., browser back/forward)
  useEffect(() => {
    isUpdatingFromUrl.current = true;
    
    const urlSearch = searchParams.get("search") || "";
    const urlStatus = searchParams.get("status");
    const urlSort = searchParams.get("sort") || "newest";
    const urlPage = searchParams.get("page");
    const urlLimit = searchParams.get("limit");
    const urlClient = searchParams.get("client");
    const urlTags = searchParams.get("tags");
    const urlSortBy = searchParams.get("sortBy");
    const urlSortOrder = searchParams.get("sortOrder");
    const urlDate = searchParams.get("date");
    const urlDateFrom = searchParams.get("date_from") || "";
    const urlDateTo = searchParams.get("date_to") || "";

    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
    
    if (urlStatus) {
      const statuses = urlStatus.split(",").filter(Boolean) as FilterOption[];
      if (JSON.stringify(statuses.sort()) !== JSON.stringify(filterOption.sort())) {
        setFilterOption(statuses);
      }
    } else if (filterOption.length > 0 && !props.patentStatus) {
      setFilterOption([]);
    }
    
    if (urlSort !== sortOption && ["newest", "oldest", "titleAZ", "titleZA"].includes(urlSort)) {
      setSortOption(urlSort as SortOption);
    }
    
    if (urlPage) {
      const page = parseInt(urlPage, 10);
      if (page !== currentPage && page > 0) {
        setCurrentPage(page);
      }
    } else if (currentPage !== 1) {
      setCurrentPage(1);
    }
    
    if (urlLimit) {
      const limit = parseInt(urlLimit, 10);
      if (limit !== itemsPerPage && limit > 0) {
        setItemsPerPage(limit);
      }
    } else if (itemsPerPage !== 10) {
      setItemsPerPage(10);
    }
    
    if (urlClient) {
      const clients = urlClient.split(",").filter(Boolean);
      if (JSON.stringify(clients.sort()) !== JSON.stringify(selectedClientId.sort())) {
        setSelectedClientId(clients);
      }
    } else if (selectedClientId.length > 0) {
      setSelectedClientId([]);
    }

    if (urlTags) {
      const tags = urlTags.split(",").filter(Boolean);
      if (JSON.stringify(tags.sort()) !== JSON.stringify(selectedTags.sort())) {
        setSelectedTags(tags);
      }
    } else if (selectedTags.length > 0) {
      setSelectedTags([]);
    }

    if (urlSortBy && urlSortOrder) {
      if (sortConfig.sortBy !== urlSortBy || sortConfig.sortOrder !== urlSortOrder) {
        setSortConfig({ sortBy: urlSortBy, sortOrder: urlSortOrder as "asc" | "desc" });
      }
    } else if (sortConfig.sortBy !== "application_date" || sortConfig.sortOrder !== "desc") {
      setSortConfig({ sortBy: "application_date", sortOrder: "desc" });
    }

    const nextDatePreset = (["last30", "last60", "last90", "custom"].includes(
      urlDate || "",
    )
      ? urlDate
      : "all") as DatePreset;
    if (nextDatePreset !== datePreset) {
      setDatePreset(nextDatePreset);
    }
    if (urlDateFrom !== customFrom) {
      setCustomFrom(urlDateFrom);
    }
    if (urlDateTo !== customTo) {
      setCustomTo(urlDateTo);
    }

    // Reset flag in next tick to allow state updates to complete
    requestAnimationFrame(() => {
      isUpdatingFromUrl.current = false;
    });
  }, [searchParams]); // Only depend on searchParams to avoid loops

  const userId = useMemo(() => readUserIdFromCookie(), []);

  const [columns, setColumns] = useState<Column[]>(() =>
    loadColumnsFromStorage(userId),
  );

  useEffect(() => {
    const key = getColumnVisibilityStorageKey(userId);
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setColumns(loadColumnsFromStorage(userId));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId]);

  const { user } = useUserCookie();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const canEditStatus = isOutsideCounselRole(user?.role);

  const { mutate: updatePatentStatus, isPending: isUpdatingStatus } =
    useMutation({
      mutationFn: async ({
        id,
        status,
      }: {
        id: string;
        status: PatentLegalStatus;
      }) => {
        const response = await API_CONFIG.put(
          `/api/v1/patent/update-single/${id}`,
          { legal_current_status: status },
        );
        return response?.data;
      },
      onSuccess: () => {
        toast.success("Status updated");
        setEditingPatentId(null);
        queryClient.invalidateQueries({ queryKey: ["patents"] });
      },
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.message || "Failed to update status",
        );
      },
    });

  const patentsQueryKey = useMemo(
    () => [
      "patents",
      user?.client_id,
      currentPage,
      itemsPerPage,
      searchQuery,
      filterOption,
      sortConfig,
      selectedClientId,
      selectedTags,
      dateRange,
    ],
    [
      user?.client_id,
      currentPage,
      itemsPerPage,
      searchQuery,
      filterOption,
      sortConfig,
      selectedClientId,
      selectedTags,
      dateRange,
    ],
  );

  const {
    data: patentData,
    isFetching: isFetchingPatents,
    refetch,
  } = useQuery({
    queryKey: patentsQueryKey,
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/patent/fetch-lastet/client/${
          user?.client_id
        }?source=dashboard&page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}&filter_status=${
          filterOption.length > 0 ? filterOption.join(",") : ""
        }&sortBy=${sortConfig.sortBy}&sortOrder=${sortConfig.sortOrder}${
          selectedClientId.length > 0
            ? `&filter_client_id=${selectedClientId.join("")}`
            : ""
        }${
          selectedTags.length > 0
            ? `&filter_tags=${selectedTags
                .map(encodeURIComponent)
                .join(",")}`
            : ""
        }${dateRange.from ? `&date_from=${dateRange.from}` : ""}${
          dateRange.to ? `&date_to=${dateRange.to}` : ""
        }`,
      );

      if (response.status === 200) {
        props?.setTotalPatents?.(response.data?.pagination?.total ?? 0);
        return response?.data;
      }
    },
    enabled: !!user?.client_id,
    refetchOnMount: true,
  });

  const {
    data: clientsData,
    isLoading: isLoadingClients,
    isError: isErrorClients,
    error: clientsError,
  } = useQuery({
    queryKey: ["fetch_clients"],
    // The client filter only exists for Photon-side roles; client-side users
    // hold no client:read capability and would just collect a 403.
    enabled: isOutsideCounselRole(user?.role),
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get("/api/v1/clients?limit=500&sort=name&order=asc");
        return response?.data;
      } catch (error) {
        console.error("Error getting clients", error);
      }
    },
  });

  // Distinct tags for the Tags filter dropdown. Shares the cache key with
  // PatentTagsCell so editing a patent's tags refreshes these options too.
  const { data: tagOptionsData } = useQuery({
    queryKey: ["patent-tags", user?.client_id],
    queryFn: async () => {
      const response = await API_CONFIG.get(
        `/api/v1/patent/distinct-tags/client/${user?.client_id}`,
      );
      return (response?.data?.data ?? []) as string[];
    },
    enabled: !!user?.client_id,
    staleTime: 60_000,
  });
  const tagOptions = tagOptionsData ?? [];

  const paginationMeta = patentData?.pagination || {};

  const totalItems = paginationMeta.total || 0;
  const currentPageFromApi = paginationMeta.page || currentPage;
  const startIndex = (currentPageFromApi - 1) * itemsPerPage;

  // Derive the header metric from the exact response rendering this table.
  // This avoids the page header briefly or permanently showing zero while
  // populated rows and pagination are already visible.
  useEffect(() => {
    const resolvedTotal =
      Number(paginationMeta.total) || Number(patentData?.data?.length) || 0;
    props.setTotalPatents?.(resolvedTotal);
  }, [paginationMeta.total, patentData?.data?.length, props.setTotalPatents]);

  const visibleColumns = useMemo(() => {
    return columns.filter((column) => column.visible);
  }, [columns]);

  const toggleColumnVisibility = (columnId: string) => {
    setColumns((prevColumns) => {
      const next = prevColumns.map((column) =>
        column.id === columnId
          ? { ...column, visible: !column.visible }
          : column,
      );
      try {
        const overrides = next.reduce<Record<string, boolean>>((acc, col) => {
          if (!col.sticky) acc[col.id] = col.visible;
          return acc;
        }, {});
        localStorage.setItem(
          getColumnVisibilityStorageKey(userId),
          JSON.stringify(overrides),
        );
      } catch {
        /* empty */
      }
      return next;
    });
    toast.success(`Column visibility updated`);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "Granted":
        return "bg-green-50 text-green-600 min-w-[10px] w-fit text-center truncate";
      case "Pending":
        return "bg-blue-50 text-blue-600 min-w-[10px] w-fit text-center truncate";
      case "Failed":
        return "bg-red-50 text-red-600 min-w-[10px] w-fit text-center truncate";
      default:
        return "bg-gray-50 text-gray-600 min-w-[10px] w-fit text-center truncate";
    }
  };

  const handleSortChange = (value: SortOption) => {
    let newSortConfig: SortConfig;

    switch (value) {
      case "newest":
        newSortConfig = { sortBy: "application_date", sortOrder: "desc" };
        break;
      case "oldest":
        newSortConfig = { sortBy: "application_date", sortOrder: "asc" };
        break;
      case "titleAZ":
        newSortConfig = { sortBy: "title", sortOrder: "asc" };
        break;
      case "titleZA":
        newSortConfig = { sortBy: "title", sortOrder: "desc" };
        break;
      default:
        newSortConfig = { sortBy: "application_date", sortOrder: "desc" };
    }

    setSortConfig(newSortConfig);
    setSortOption(value);
    setCurrentPage(1); // Reset to first page when sort changes
    toast.success(`Sort applied: ${getSortLabel(value)}`);
  };

  // Clicking a column header sorts by that DB field. First click on a new
  // column sorts ascending; clicking the already-active column toggles
  // asc/desc. Sorting is applied server-side via sortConfig in the query.
  const handleHeaderSort = (field: string) => {
    setSortConfig((prev) => {
      const sortOrder =
        prev.sortBy === field && prev.sortOrder === "asc" ? "desc" : "asc";
      return { sortBy: field, sortOrder };
    });
    setCurrentPage(1);
  };

  // Reflect the live sortConfig in the preset dropdown. When the user sorts via
  // a column header that doesn't map to one of the 4 presets, no preset shows
  // as selected.
  const activeSortPreset: SortOption | "" =
    sortConfig.sortBy === "application_date"
      ? sortConfig.sortOrder === "desc"
        ? "newest"
        : "oldest"
      : sortConfig.sortBy === "title"
        ? sortConfig.sortOrder === "asc"
          ? "titleAZ"
          : "titleZA"
        : "";

  const renderSortIndicator = (field?: string) => {
    if (!field) return null;
    if (sortConfig.sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />;
    }
    return sortConfig.sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 shrink-0" />
    );
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page when search changes
  };

  // Apply a date preset (or switch to custom). Custom keeps whatever from/to
  // the user has already typed; switching away from custom clears them.
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setCustomFrom("");
      setCustomTo("");
    }
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setDatePreset("all");
    setCustomFrom("");
    setCustomTo("");
    setCurrentPage(1);
  };

  const dateFilterActive = datePreset !== "all";

  const getDateFilterLabel = (): string => {
    if (datePreset === "custom") {
      const from = customFrom || "…";
      const to = customTo || "…";
      return `${from} → ${to}`;
    }
    return DATE_PRESET_LABELS[datePreset];
  };

  const getSortLabel = (sort: SortOption): string => {
    switch (sort) {
      case "newest":
        return "Newest First";
      case "oldest":
        return "Oldest First";
      case "titleAZ":
        return "Title (A-Z)";
      case "titleZA":
        return "Title (Z-A)";
      default:
        return "Newest First";
    }
  };

  const handleRowClick = (patentId: string) => {
    navigate(`/patents/${patentId}`);
  };

  const handleItemsPerPageChange = async (value: string) => {
    await setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when changing items per page
    refetch();
  };

  // Helper function to render cell content based on column ID
  const renderCellContent = (columnId: string, client: any, index: number) => {
    switch (columnId) {
      case "assigneeOriginal":
        return (
          <td
            className="px-4 py-2.5"
            style={{ minWidth: "140px", maxWidth: "220px" }}
          >
            <span
              className={`block truncate whitespace-nowrap text-sm font-sans ${
                theme === "dark" ? "text-zinc-200" : "text-[var(--pulse-ink-secondary)]"
              }`}
              title={client?.assignee_original}
            >
              {client?.assignee_original}
            </span>
          </td>
        );

      case "abstract":
        return (
          <td className="px-4 py-3" style={{ minWidth: "540px" }}>
            <span
              className={`text-sm font-sans ${
                theme === "dark" ? "text-zinc-200" : "text-gray-900"
              }`}
            >
              {client?.abstract}
            </span>
          </td>
        );
      case "priority":
        return (
          <td className="px-4 py-3" style={{ minWidth: "240px" }}>
            <span
              className={`text-sm font-sans ${
                theme === "dark" ? "text-zinc-200" : "text-gray-900"
              }`}
            >
              {client?.priority_details || "-"}
            </span>
          </td>
        );
      case "prn":
        return (
          <td className="px-4 py-2.5" style={{ minWidth: "140px" }}>
            <span
              className={`whitespace-nowrap text-[13px] tabular-nums ${
                theme === "dark" ? "text-neutral-300" : "text-[var(--pulse-ink)]"
              }`}
            >
              {client?.prn || <span className="text-neutral-400">—</span>}
            </span>
          </td>
        );
      case "title":
        return (
          <td
            className="px-4 py-2.5"
            style={{ minWidth: "320px", maxWidth: "480px" }}
          >
            <span
              className={`block truncate whitespace-nowrap font-sans text-sm font-medium ${
                theme === "dark" ? "text-zinc-200" : "text-[var(--pulse-ink)]"
              }`}
              title={client.title}
            >
              {client.title}
            </span>
          </td>
        );
      case "currentAssignee":
        return (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-sans uppercase ${
                  theme === "dark" ? "text-neutral-400" : "text-neutral-600"
                }`}
              >
                {client?.current_assignee || 0}
              </span>
            </div>
          </td>
        );
      case "dateOfFiling":
        return (
          <td className="px-4 py-2.5" style={{ minWidth: "120px" }}>
            <div className="flex items-center justify-end gap-2">
              <span
                className={`whitespace-nowrap text-[13px] tabular-nums ${
                  theme === "dark" ? "text-neutral-400" : "text-[var(--pulse-ink-secondary)]"
                }`}
              >
                {moment(client?.application_date).format("YYYY-MM-DD")}
              </span>
            </div>
          </td>
        );
      case "publication_date":
        return (
          <td className="px-4 py-3" style={{ minWidth: "150px" }}>
            <div className="flex items-center gap-2">
              <span
                className={`text-[13px] tabular-nums ${
                  theme === "dark" ? "text-neutral-400" : "text-[var(--pulse-ink-secondary)]"
                }`}
              >
                {(client?.issue_date &&
                  moment(client?.issue_date).format("YYYY-MM-DD")) ||
                  "-"}
              </span>
            </div>
          </td>
        );
      case "legal_current_status": {
        const isEditing = editingPatentId === client.id;
        const currentValue = client.legal_current_status as
          | PatentLegalStatus
          | null
          | undefined;
        const meta = currentValue
          ? PATENT_LEGAL_STATUS_META[currentValue]
          : null;

        if (isEditing) {
          return (
            <td
              key={columnId}
              className="text-left px-4 py-2.5 font-sans"
              style={{ width: "250px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Select
                  defaultValue={currentValue ?? undefined}
                  disabled={isUpdatingStatus}
                  onValueChange={(value) =>
                    updatePatentStatus({
                      id: client.id,
                      status: value as PatentLegalStatus,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PATENT_LEGAL_STATUS_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {PATENT_LEGAL_STATUS_META[v].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isUpdatingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingPatentId(null)}
                    className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    aria-label="Cancel edit"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </td>
          );
        }

        return (
          <td
            key={columnId}
            className="text-left px-4 py-2.5 font-sans"
            style={{ width: "170px" }}
          >
            <div className="inline-flex items-center gap-2">
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
                <span className="text-xs text-neutral-400">—</span>
              )}
              {canEditStatus && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPatentId(client.id);
                  }}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-label="Edit status"
                  title="Edit status"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </td>
        );
      }
      case "inventors":
        return (
          <td
            key={columnId}
            className={`px-4 py-2.5 text-sm min-w-[150px] ${
              theme === "dark" ? "text-neutral-400" : "text-neutral-800"
            }`}
          >
            {client?.inventors
              ?.slice(0, 4)
              .map((inventor: any, idx: number) => (
                <div key={idx}>
                  <span className="whitespace-nowrap font-sans">
                    {inventor || "N/A"}
                  </span>
                </div>
              ))}

            {client?.inventors?.length > 4 && (
              <div className="mt-1 text-xs font-sans text-neutral-700">
                +{client.inventors.length - 4} more
              </div>
            )}
          </td>
        );
      case "tags":
        return (
          <td
            key={columnId}
            className="px-2 py-1.5 align-middle"
            style={{ minWidth: "220px", maxWidth: "280px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <PatentTagsCell
              patentId={client.id}
              tags={Array.isArray(client?.tags) ? client.tags : []}
              patentsQueryKey={patentsQueryKey}
            />
          </td>
        );
      case "publicationCountry": {
        const cc = (client?.publication_country || "").toUpperCase();
        // ISO2 → regional-indicator emoji flag; skip placeholders like "??".
        const flag = /^[A-Z]{2}$/.test(cc)
          ? String.fromCodePoint(
              ...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
            )
          : null;
        return (
          <td key={columnId} className="px-4 py-2.5">
            {cc ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                {flag && <span className="text-[13px] leading-none">{flag}</span>}
                <span
                  className={`text-[13px] tabular-nums ${
                    theme === "dark" ? "text-neutral-300" : "text-[var(--pulse-ink-secondary)]"
                  }`}
                >
                  {cc}
                </span>
              </span>
            ) : (
              <span className="text-xs text-neutral-400">—</span>
            )}
          </td>
        );
      }
      default:
        return null;
    }
  };

  const renderPagination = () => {
    if (!patentData?.pagination) return null;

    const totalPages = Number(patentData.pagination.totalPages) || 1;
    const total = Number(patentData.pagination.total) || 0;
    if (total === 0) return null;
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Only disable if we're actually on the first/last page
    const isFirstPage = currentPage <= 1;
    const isLastPage = currentPage >= totalPages;

    return (
      <div
        className={`pulse-pagination-bar relative z-20 !mx-0 !mb-0 !mt-0 rounded-xl border ${
          theme === "dark"
            ? "bg-neutral-950 border-[#cccccc20]"
            : "bg-white border-photon-gray-300"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-sm whitespace-nowrap ${
                theme === "dark" ? "text-neutral-500" : "text-gray-500"
              }`}
            >
              Showing {startIndex + 1} to{" "}
              {Math.min(startIndex + patentData?.data?.length, totalItems)} of{" "}
              {totalItems} entries
            </span>
            <div className="relative">
              <select
                value={itemsPerPage.toString()}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                className={`border rounded pl-3 pr-8 py-1.5 text-sm appearance-none focus:outline-none focus:border-[#F9B418] transition-colors ${
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
            {totalPages > 5 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-transparent"
                onClick={() => setCurrentPage(1)}
                disabled={currentPageFromApi === 1}
                title="First page"
              >
                <ChevronsLeft
                  className={`w-4 h-4 ${theme === "dark" && "text-zinc-200"}`}
                />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-transparent"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPageFromApi === 1}
              title="Previous page"
            >
              <ChevronLeft
                className={`w-4 h-4 ${theme === "dark" && "text-zinc-200"}`}
              />
            </Button>
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
                <Button
                  key={pageNum}
                  variant={
                    currentPageFromApi === pageNum ? "default" : "outline"
                  }
                  size="sm"
                  className={`px-3 py-1.5 w-8 text-sm font-sans ${
                    currentPageFromApi === pageNum
                      ? "bg-[#F9B418] text-zinc-900 hover:bg-[#F9B418]"
                      : `text-neutral-300 ${
                          theme === "dark"
                            ? "bg-neutral-900 text-neutral-300"
                            : "bg-neutral-100 text-neutral-900"
                        } border border-[#cccccc20] hover:bg-neutral-800 hover:text-neutral-300`
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-transparent"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPageFromApi === totalPages}
              title="Next page"
            >
              <ChevronRight
                className={`w-4 h-4 ${theme === "dark" && "text-zinc-200"}`}
              />
            </Button>
            {totalPages > 5 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-transparent"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPageFromApi === totalPages}
                title="Last page"
              >
                <ChevronsRight
                  className={`w-4 h-4 ${theme === "dark" && "text-zinc-200"}`}
                />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex min-w-0 w-full flex-col">
      {/* Animated Gradient Background */}
      <div className="hidden">
        {theme === "dark" ? (
          <>
            {/* Yellow Gradient Blob */}
            <div
              className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-blob"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 166, 35, 0.4) 0%, rgba(245, 166, 35, 0) 70%)",
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
      <div className="flex w-full flex-col bg-transparent">
        <div className="pulse-toolbar !mx-0 !mb-5 !mt-0 !items-start">
          <div className="flex w-full flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-[1_1_320px]">
              <div className="relative w-full">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                  }`}
                />
                <Input
                  name="search"
                  className={`pl-10 h-[42px] pb-2.5 rounded ${
                    theme === "dark"
                      ? "bg-neutral-900 border border-[#cccccc11] text-zinc-200 placeholder:text-neutral-600"
                      : "text-zinc-900 placeholder:text-neutral-400 bg-neutral-50"
                  }`}
                  placeholder="Search by application no., title, inventor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Plus
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-45 w-4 h-4 z-10 cursor-pointer ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                  }`}
                />
              </div>
            </div>

            {isOutsideCounselRole(user?.role) && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`shrink-0 gap-1 hover:bg-transparent border py-5 rounded hover:border-[#F9B418] ${
                      theme === "dark"
                        ? "bg-zinc-900 border-[#cccccc20] hover:bg-zinc-900 hover:border-[#F9B418]/50"
                        : "bg-white text-neutral-700"
                    }`}
                  >
                    <Building2
                      className={`${
                        theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                      }`}
                    />
                    <span
                      className={`font-sans font-normal ml-1 ${
                        theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                      }`}
                    >
                      Clients
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 ml-1 ${
                        theme === "dark" ? "text-zinc-200" : "text-foreground"
                      }`}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={`w-[280px]  rounded-lg border p-0 ${
                    theme === "dark"
                      ? "bg-zinc-900 border-[#cccccc20]"
                      : "bg-white border-photon-border-light"
                  }`}
                >
                  <div
                    className={`font-bold font-sans px-3 pt-3 text-sm ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                    }`}
                  >
                    Filter by Client
                  </div>

                  <div className="px-3 pt-2 pb-1">
                    <Input
                      type="text"
                      placeholder="Search clients..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className={`h-8 text-xs ${
                        theme === "dark"
                          ? "bg-neutral-950 border-[#cccccc20] text-zinc-200 placeholder:text-neutral-500"
                          : "bg-white border-neutral-200 text-neutral-700 placeholder:text-neutral-400"
                      }`}
                    />
                  </div>

                  <ScrollArea type="always" className="max-h-[300px]">
                    <div className="p-4 space-y-3">
                      {clientsData?.data
                        ?.filter((client: any) =>
                          client?.name
                            ?.toLowerCase()
                            .includes(clientSearchQuery.toLowerCase()),
                        )
                        ?.map((client: any) => {
                        const checked = selectedClientId.includes(client.id);
                        return (
                          <div
                            key={client.id}
                            className="cursor-pointer flex items-center space-x-2 py-0.5"
                          >
                            <Checkbox
                              id={`column-${client.id}`}
                              checked={checked}
                              onCheckedChange={(value) =>
                                setSelectedClientId((prev) =>
                                  value
                                    ? [...prev, client.id]
                                    : prev.filter((id) => id !== client.id),
                                )
                              }
                              className={`${
                                theme === "dark"
                                  ? "border-[#cccccc20]"
                                  : "border-zinc-900"
                              }`}
                            />
                            <div className="flex items-center gap-2 w-5 h-5">
                              {client?.logo_file?.file_path ? (
                                <img
                                  src={assetUrl(client?.logo_file?.file_path)}
                                  alt={client.name}
                                  crossOrigin="use-credentials"
                                  className="h-5 w-5 object-contain"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                    (
                                      e.currentTarget.parentNode as HTMLElement
                                    ).innerHTML =
                                      `<div className="w-5 h-5 flex items-center justify-center bg-primary/5 text-[#F9B418] font-semibold text-xs">
                                        ${client.name
                                          .substring(0, 2)
                                          .toUpperCase()}
                                      </div>`;
                                  }}
                                />
                              ) : (
                                <div className="w-5 h-5 flex items-center justify-center bg-primary/5 text-[#F9B418] font-semibold text-xs">
                                  {client.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <label
                              htmlFor={`column-${client.id}`}
                              className={`text-sm font-sans cursor-pointer ${
                                theme === "dark"
                                  ? "text-neutral-300"
                                  : "!text-neutral-700"
                              }`}
                            >
                              {client?.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`flex shrink-0 items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                    theme === "dark"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-white/5 hover:text-neutral-300"
                      : "hover:bg-transparent bg-transparent border-neutral-200 text-neutral-700 hover:text-[#494949] hover:border-[#F9B418]"
                  }`}
                >
                  <Filter
                    className={`h-4 w-4  ${
                      theme == "dark" ? "text-gray-300" : "text-neutral-700"
                    }`}
                  />
                  <span
                    className={`font-sans font-normal ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                    }`}
                  >
                    Status
                  </span>
                  {filterOption.length ? (
                    <span className="h-5 w-5 font-sans rounded-full bg-[#F9B418] text-black">
                      {filterOption.length}
                    </span>
                  ) : (
                    ""
                  )}
                  <ChevronDown
                    className={`h-3 w-3 ${
                      theme === "dark" ? "text-gray-300" : "text-foreground"
                    }`}
                  />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                sideOffset={8}
                className={`w-[240px] p-0 ${
                  theme === "dark"
                    ? "bg-neutral-900 border border-[#cccccc20]"
                    : ""
                }`}
              >
                {/* Client list */}
                <ScrollArea type="always" className="max-h-[320px]">
                  <div
                    className={`font-bold font-sans px-4 pt-3 text-sm ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                    }`}
                  >
                    Filter by Status
                  </div>
                  <div className="font-sans p-3">
                    {PATENT_LEGAL_STATUS_VALUES.map((value) => {
                      const status = {
                        value,
                        label: PATENT_LEGAL_STATUS_META[value].label,
                      };
                      const checked = filterOption.includes(status.value);

                      return (
                        <div
                          key={status.value}
                          className={`flex items-center font-sans gap-2 cursor-pointer  p-1.5 ${
                            theme === "dark"
                              ? "hover:bg-neutral-900"
                              : "hover:bg-white"
                          }`}
                        >
                          <Checkbox
                            id={`status-${status.value}`}
                            checked={checked}
                            onCheckedChange={(value) => {
                              setFilterOption((prev) =>
                                value
                                  ? [...prev, status.value]
                                  : prev.filter((id) => id !== status.value),
                              );
                            }}
                            className={
                              theme === "dark"
                                ? "bg-transparent border-white/10"
                                : "border-zinc-900"
                            }
                          />

                          <label
                            htmlFor={`status-${status.value}`}
                            className={`text-sm cursor-pointer ${
                              theme === "dark"
                                ? "text-zinc-200"
                                : "text-neutral-700"
                            }`}
                          >
                            {status.label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`flex shrink-0 items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                    theme === "dark"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-white/5 hover:text-neutral-300"
                      : "hover:bg-transparent bg-transparent border-neutral-200 text-neutral-700 hover:text-[#494949] hover:border-[#F9B418]"
                  }`}
                >
                  <TagsIcon
                    className={`h-4 w-4 ${
                      theme == "dark" ? "text-gray-300" : "text-neutral-700"
                    }`}
                  />
                  <span
                    className={`font-sans font-normal ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                    }`}
                  >
                    Tags
                  </span>
                  {selectedTags.length ? (
                    <span className="h-5 w-5 font-sans rounded-full bg-[#F9B418] text-black">
                      {selectedTags.length}
                    </span>
                  ) : (
                    ""
                  )}
                  <ChevronDown
                    className={`h-3 w-3 ${
                      theme === "dark" ? "text-gray-300" : "text-foreground"
                    }`}
                  />
                </Button>
              </PopoverTrigger>

              <PopoverContent
                sideOffset={8}
                className={`w-[240px] p-0 ${
                  theme === "dark"
                    ? "bg-neutral-900 border border-[#cccccc20]"
                    : ""
                }`}
              >
                <div
                  className={`font-bold font-sans px-4 pt-3 text-sm ${
                    theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                  }`}
                >
                  Filter by Tags
                </div>
                <div className="px-3 pt-2 pb-1">
                  <Input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    className={`h-8 text-xs ${
                      theme === "dark"
                        ? "bg-neutral-950 border-[#cccccc20] text-zinc-200 placeholder:text-neutral-500"
                        : "bg-white border-neutral-200 text-neutral-700 placeholder:text-neutral-400"
                    }`}
                  />
                </div>
                <ScrollArea type="always" className="max-h-[300px]">
                  <div className="font-sans p-3 pt-1">
                    {(() => {
                      const filtered = tagOptions.filter((t) =>
                        t
                          .toLowerCase()
                          .includes(tagSearchQuery.toLowerCase()),
                      );
                      if (filtered.length === 0) {
                        return (
                          <div
                            className={`px-1.5 py-2 text-sm ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-neutral-400"
                            }`}
                          >
                            {tagOptions.length === 0
                              ? "No tags yet"
                              : "No matching tags"}
                          </div>
                        );
                      }
                      return filtered.map((tag) => {
                        const checked = selectedTags.includes(tag);
                        return (
                          <div
                            key={tag}
                            className={`flex items-center font-sans gap-2 cursor-pointer p-1.5 ${
                              theme === "dark"
                                ? "hover:bg-neutral-900"
                                : "hover:bg-white"
                            }`}
                          >
                            <Checkbox
                              id={`tag-${tag}`}
                              checked={checked}
                              onCheckedChange={(value) => {
                                setSelectedTags((prev) =>
                                  value
                                    ? [...prev, tag]
                                    : prev.filter((t) => t !== tag),
                                );
                              }}
                              className={
                                theme === "dark"
                                  ? "bg-transparent border-white/10"
                                  : "border-zinc-900"
                              }
                            />
                            <label
                              htmlFor={`tag-${tag}`}
                              className={`text-sm cursor-pointer truncate ${
                                theme === "dark"
                                  ? "text-zinc-200"
                                  : "text-neutral-700"
                              }`}
                              title={tag}
                            >
                              {tag}
                            </label>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`flex shrink-0 items-center gap-2 px-4 py-5 border rounded font-normal text-sm transition-colors whitespace-nowrap ${
                    theme === "dark"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-[#F9B418]/50 hover:bg-white/5 hover:text-neutral-300"
                      : "hover:bg-transparent bg-transparent border-neutral-200 text-neutral-700 hover:text-[#494949] hover:border-[#F9B418]"
                  }`}
                >
                  <CalendarDays
                    className={`h-4 w-4 ${
                      theme == "dark" ? "text-gray-300" : "text-neutral-700"
                    }`}
                  />
                  <span
                    className={`font-sans font-normal ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                    }`}
                  >
                    Date
                  </span>
                  {dateFilterActive && (
                    <span className="h-2 w-2 rounded-full bg-[#F9B418]" />
                  )}
                  <ChevronDown
                    className={`h-3 w-3 ${
                      theme === "dark" ? "text-gray-300" : "text-foreground"
                    }`}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                sideOffset={8}
                className={`w-[260px] p-0 ${
                  theme === "dark"
                    ? "bg-neutral-900 border border-[#cccccc20]"
                    : ""
                }`}
              >
                <div
                  className={`font-bold font-sans px-4 pt-3 text-sm ${
                    theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                  }`}
                >
                  Filter by Filing Date
                </div>
                <div className="font-sans p-3 space-y-0.5">
                  {(
                    ["all", "last30", "last60", "last90", "custom"] as DatePreset[]
                  ).map((preset) => {
                    const active = datePreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleDatePresetChange(preset)}
                        className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                          active
                            ? "bg-[#F9B418]/15 text-[#F9B418]"
                            : theme === "dark"
                              ? "text-zinc-200 hover:bg-white/5"
                              : "text-neutral-700 hover:bg-neutral-100"
                        }`}
                      >
                        <span>{DATE_PRESET_LABELS[preset]}</span>
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}

                  {datePreset === "custom" && (
                    <div className="mt-2 space-y-2 border-t pt-3 dark:border-[#cccccc20]">
                      <div className="space-y-1">
                        <label
                          className={`text-xs ${
                            theme === "dark"
                              ? "text-neutral-400"
                              : "text-neutral-500"
                          }`}
                        >
                          From
                        </label>
                        <Input
                          type="date"
                          value={customFrom}
                          max={customTo || undefined}
                          onChange={(e) => {
                            setCustomFrom(e.target.value);
                            setCurrentPage(1);
                          }}
                          className={`h-8 text-xs ${
                            theme === "dark"
                              ? "bg-neutral-950 border-[#cccccc20] text-zinc-200 [color-scheme:dark]"
                              : "bg-white border-neutral-200 text-neutral-700"
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          className={`text-xs ${
                            theme === "dark"
                              ? "text-neutral-400"
                              : "text-neutral-500"
                          }`}
                        >
                          To
                        </label>
                        <Input
                          type="date"
                          value={customTo}
                          min={customFrom || undefined}
                          onChange={(e) => {
                            setCustomTo(e.target.value);
                            setCurrentPage(1);
                          }}
                          className={`h-8 text-xs ${
                            theme === "dark"
                              ? "bg-neutral-950 border-[#cccccc20] text-zinc-200 [color-scheme:dark]"
                              : "bg-white border-neutral-200 text-neutral-700"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {dateFilterActive && (
                    <button
                      type="button"
                      onClick={clearDateFilter}
                      className="mt-2 w-full rounded px-2 py-1.5 text-left text-xs text-neutral-400 transition-colors hover:bg-[#F9B418]/10 hover:text-[#F9B418]"
                    >
                      Clear date filter
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`shrink-0 gap-1 hover:bg-transparent border py-5 rounded hover:border-[#F9B418] ${
                    theme === "dark"
                      ? "bg-zinc-900 border-[#cccccc20] hover:bg-zinc-900 hover:border-[#F9B418]/50"
                      : "hover:text-foreground bg-white text-neutral-700"
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
                    className={`mr-1 ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                    }`}
                    aria-hidden="true"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                    <path d="M9 3v18"></path>
                    <path d="M15 3v18"></path>
                  </svg>
                  <span
                    className={`font-sans font-normal ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                    }`}
                  >
                    Columns
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 ml-1 ${
                      theme === "dark" ? "text-zinc-200" : "text-foreground"
                    }`}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className={`w-[240px] p-0 ${
                  theme === "dark"
                    ? "bg-zinc-900 border-[#cccccc20]"
                    : "bg-white border-photon-border-light"
                }`}
              >
                <div
                  className={`p-4 pb-0 ${
                    theme === "dark" && "border-[#cccccc20]"
                  }`}
                >
                  <p
                    className={`text-sm font-sans font-semibold ${
                      theme === "dark" ? "text-zinc-200" : "text-foreground"
                    }`}
                  >
                    Toggle Columns
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-600"
                    }`}
                  >
                    Select which columns to display
                  </p>
                </div>
                <ScrollArea className="max-h-[440px] overflow-y-visible">
                  <div className="p-4 space-y-3">
                    {columns.map((column) => (
                      <div
                        key={column.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`column-${column.id}`}
                          checked={column.visible || column.sticky}
                          onCheckedChange={() =>
                            toggleColumnVisibility(column.id)
                          }
                          disabled={column.sticky}
                          className={`${
                            theme === "dark"
                              ? "bg-[#cccccc20] border-none"
                              : "border-zinc-900"
                          }`}
                        />
                        <label
                          htmlFor={`column-${column.id}`}
                          className={`text-sm ${
                            column.sticky
                              ? `${
                                  theme === "dark"
                                    ? "text-white/50"
                                    : "text-neutral-700/50"
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`shrink-0 gap-1 hover:bg-transparent border py-5 rounded hover:border-[#F9B418] ${
                    theme === "dark"
                      ? "bg-zinc-900 border-[#cccccc20] hover:bg-zinc-900 hover:border-[#F9B418]/50"
                      : "hover:text-foreground bg-white text-neutral-700"
                  }`}
                >
                  <ArrowUpDown
                    className={`h-4 w-4 mr-1 ${
                      theme == "dark" ? "text-gray-300" : "text-neutral-700"
                    }`}
                  />
                  <span
                    className={`font-sans font-normal ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-700"
                    }`}
                  >
                    Sort
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 ml-1 ${
                      theme === "dark" ? "text-gray-300" : "text-foreground"
                    }`}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className={`w-[180px] p-2 ${
                  theme === "dark"
                    ? "bg-zinc-900 border-[#cccccc20]"
                    : "bg-white border-photon-border-light"
                }`}
              >
                <DropdownMenuLabel
                  className={`font-sans ${
                    theme === "dark" ? "text-zinc-200" : "text-foreground"
                  }`}
                >
                  Sort Patents
                </DropdownMenuLabel>

                <DropdownMenuRadioGroup
                  value={activeSortPreset}
                  onValueChange={(value: string) =>
                    handleSortChange(value as SortOption)
                  }
                  className="w-[180px]"
                >
                  <DropdownMenuRadioItem
                    value="newest"
                    className={`cursor-pointer font-sans ${
                      theme === "dark"
                        ? "text-zinc-200 hover:!text-zinc-200 hover:!bg-transparent focus:!bg-transparent data-[state=checked]:bg-photon-background-light"
                        : "text-neutral-700 hover:!bg-white hover:!text-neutral-700 hover:bg-photon-background-light hover:text-foreground data-[state=checked]:bg-photon-background-light"
                    }`}
                  >
                    Newest First
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="oldest"
                    className={`cursor-pointer font-sans ${
                      theme === "dark"
                        ? "text-zinc-200 hover:!text-zinc-200 hover:!bg-transparent focus:!bg-transparent data-[state=checked]:bg-photon-background-light"
                        : "text-neutral-700 hover:!bg-white hover:!text-neutral-700 hover:bg-photon-background-light hover:text-foreground data-[state=checked]:bg-photon-background-light"
                    }`}
                  >
                    Oldest First
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="titleAZ"
                    className={`cursor-pointer font-sans ${
                      theme === "dark"
                        ? "text-zinc-200 hover:!text-zinc-200 hover:!bg-transparent focus:!bg-transparent data-[state=checked]:bg-photon-background-light"
                        : "text-neutral-700 hover:!bg-white hover:!text-neutral-700 hover:bg-photon-background-light hover:text-foreground data-[state=checked]:bg-photon-background-light"
                    }`}
                  >
                    Title (A-Z)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="titleZA"
                    className={`cursor-pointer font-sans ${
                      theme === "dark"
                        ? "text-zinc-200 hover:!text-zinc-200 hover:!bg-transparent focus:!bg-transparent data-[state=checked]:bg-photon-background-light"
                        : "text-neutral-700 hover:!bg-white hover:!text-neutral-700 hover:bg-photon-background-light hover:text-foreground data-[state=checked]:bg-photon-background-light"
                    }`}
                  >
                    Title (Z-A)
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(filterOption.length > 0 ||
            selectedTags.length > 0 ||
            dateFilterActive) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-neutral-500">Active Filters:</span>
              {dateFilterActive && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-neutral-100 border-neutral-300 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-900 dark:border-[#27272a]">
                  <span>Filed: {getDateFilterLabel()}</span>
                  <button
                    className="hover:text-[#F9B418]"
                    onClick={clearDateFilter}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {filterOption.map((option) => (
                <div key={option} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-neutral-100 border-neutral-300 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-900 dark:border-[#27272a]">
                  <span>
                    Status:{" "}
                    {PATENT_LEGAL_STATUS_META[option as PatentLegalStatus]
                      ?.label ?? option}
                  </span>
                  <button
                    className="hover:text-[#F9B418]"
                    onClick={() => {
                      setFilterOption((prev) =>
                        prev.filter((id) => id !== option),
                      );
                    }}
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
                      className="lucide lucide-x w-3 h-3"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18"></path>
                      <path d="m6 6 12 12"></path>
                    </svg>
                  </button>
                </div>
              ))}
              {selectedTags.map((tag) => (
                <div
                  key={`tag-chip-${tag}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-neutral-100 border-neutral-300 text-neutral-700 dark:text-neutral-300 dark:bg-neutral-900 dark:border-[#27272a]"
                >
                  <span className="max-w-[160px] truncate" title={tag}>
                    Tag: {tag}
                  </span>
                  <button
                    className="hover:text-[#F9B418]"
                    onClick={() =>
                      setSelectedTags((prev) => prev.filter((t) => t !== tag))
                    }
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setFilterOption([]);
                  setSelectedTags([]);
                  clearDateFilter();
                }}
                className="text-xs px-2.5 py-1 rounded hover:bg-[#F9B418]/10 transition-colors text-neutral-400 hover:text-[#F9B418]"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {isFetchingPatents ? (
          <Loader />
        ) : (
          <div
            className={`pulse-table-frame !mx-0 !mb-3 flex min-w-0 w-auto flex-col ${
              theme === "dark" ? "border-[#cccccc20]" : ""
            }`}
          >
            {patentData?.data?.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center ${
                  theme === "dark"
                    ? "border-[#cccccc20]"
                    : "bg-white border-gray-200"
                } p-8 text-center shadow-sm h-full`}
              >
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-full ${
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
                  No patents found
                </h3>

                <p className="mt-3 max-w-md text-gray-600 text-center">
                  We couldn't find any patents matching your search criteria.
                </p>
              </div>
            ) : (
              <div
                className={`overflow-hidden rounded-2xl ${
                  theme === "dark"
                    ? "bg-transparent"
                    : "bg-white border-photon-gray-200 border"
                } flex flex-col`}
              >
                <div
                  className="overflow-x-auto"
                >
                  <table className="pulse-data-table min-w-[1384px] w-full table-fixed">
                    <colgroup>
                      <col style={{ width: "64px" }} />
                      <col style={{ width: "140px" }} />
                      {visibleColumns.map((column) => (
                        <col
                          key={column.id}
                          className={
                            CORE_COLUMN_WIDTHS[column.id]
                              ? undefined
                              : column.width
                          }
                          style={
                            CORE_COLUMN_WIDTHS[column.id]
                              ? { width: CORE_COLUMN_WIDTHS[column.id] }
                              : undefined
                          }
                        />
                      ))}
                    </colgroup>
                    <thead
                      className={`sticky top-0 z-10 border-b ${
                        theme === "dark"
                          ? "bg-neutral-950 border-[#cccccc20]"
                          : "bg-[#FAFAFA] border-[#E8E8E8]"
                      }`}
                    >
                      <tr className="relative">
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-[#727272] dark:text-neutral-500"
                        >
                          S.No
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${
                            sortConfig.sortBy === "application_number"
                              ? "text-[#444444] dark:text-neutral-200"
                              : "text-[#727272] dark:text-neutral-500"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleHeaderSort("application_number")}
                            className="flex items-center gap-1 transition-colors hover:text-[#0C0C0C] dark:hover:text-neutral-200"
                          >
                            Application No.
                            {renderSortIndicator("application_number")}
                          </button>
                        </th>

                        {visibleColumns.map((column) => {
                          const active =
                            !!column.sortField &&
                            sortConfig.sortBy === column.sortField;
                          return (
                            <th
                              key={column.id}
                              className={`${
                                column.id === "Sr"
                                  ? "text-center"
                                  : column.id === "dateOfFiling"
                                    ? "text-right"
                                    : "text-left"
                              } px-4 py-3 text-xs font-semibold whitespace-nowrap ${
                                active
                                  ? "text-[#444444] dark:text-neutral-200"
                                  : "dark:text-neutral-500 text-[#727272]"
                              }`}
                              style={column.id === "Sr" ? { width: "70px" } : {}}
                              aria-sort={
                                active
                                  ? sortConfig.sortOrder === "asc"
                                    ? "ascending"
                                    : "descending"
                                  : undefined
                              }
                            >
                              {column.sortField ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleHeaderSort(column.sortField!)
                                  }
                                  className={`flex items-center gap-1 transition-colors hover:text-[#444444] dark:hover:text-neutral-200 ${
                                    column.id === "dateOfFiling"
                                      ? "ml-auto flex-row-reverse"
                                      : ""
                                  }`}
                                >
                                  {column.label}
                                  {renderSortIndicator(column.sortField)}
                                </button>
                              ) : (
                                column.label
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody>
                      {patentData?.data?.map((client: any, index: number) => (
                        <tr
                          key={index}
                          className={`border-b group ${
                            theme === "dark"
                              ? "border-[#cccccc20] hover:bg-neutral-900/30"
                              : "border-[#E8E8E8] bg-white hover:bg-[#FAFAFA]"
                          } cursor-pointer transition-colors`}
                          onClick={() => handleRowClick(client.id)}
                        >
                          <td
                            className={`px-4 py-2.5 text-left text-sm font-sans
                            ${
                              theme === "dark"
                                ? "bg-[#0a0a0a] text-neutral-400 group-hover:bg-neutral-900"
                                : "bg-white text-gray-500 group-hover:bg-neutral-100"
                            }`}
                          >
                            {startIndex + index + 1}
                          </td>
                          <td
                            className={`px-4 py-2.5
                            ${
                              theme === "dark"
                                ? "bg-[#0a0a0a] group-hover:bg-neutral-900"
                                : "bg-white group-hover:bg-[#FAFAFA]"
                            }`}
                            style={{ minWidth: "140px" }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`${
                                  theme === "dark"
                                    ? "text-neutral-300"
                                    : "text-[#0C0C0C]"
                                } text-[13px] tabular-nums whitespace-nowrap flex items-center gap-2`}
                              >
                                                {client.application_number}
                              </span>
                              {client?.IdeaPatentLink?.[0]?.idea?.id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/ideas/${client.IdeaPatentLink[0].idea.id}`,
                                    );
                                  }}
                                  className="ml-6 text-left text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300 truncate"
                                  title={client.IdeaPatentLink[0].idea.title}
                                >
                                  ↳ Linked to idea
                                </button>
                              )}
                            </div>
                          </td>

                          {visibleColumns.map((column) => (
                            <React.Fragment key={column.id}>
                              {renderCellContent(column.id, client, index)}
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                      {patentData?.data?.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-center p-4 text-gray-500"
                          >
                            No clients found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {patentData?.pagination && renderPagination()}
    </div>
  );
};

export default PatentsContent;
