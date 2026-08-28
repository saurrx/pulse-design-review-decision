import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import useUserCookie from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import API_CONFIG from "@/lib/apiConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignVerticalSpaceAround,
  ArrowDownUp,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  FileSearch,
  Filter,
  LayoutList,
  MoreVertical,
  Plus,
  Search,
  Lightbulb,
  Building2,
  Trash2,
  X,
} from "lucide-react";
import moment from "moment";
import StatusChip from "@/components/ui/StatusChip";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import Loader from "../Loader";
import IdeaSubmissionModal from "./IdeaSubmissionModal";
import ShowScoreReport from "./ShowScoreReport";
import { createRoot } from "react-dom/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { isOutsideCounselRole } from "@/lib/roleAccess";




type FilterOption =
  | "all"
  | "IN_DRAFT"
  | "UNDER_REVIEW"
  | "REJECT_BY_IHC"
  | "UPDATE_REQUEST"
  | "UPDATE_REQUEST_BY_OC"
  | "SEND_TO_OC"
  | "REJECT_BY_OC"
  | "FILED"
type SortOption = "newest" | "oldest" | "recently_updated";

const IdeasContent: React.FC = () => {
  const { user } = useUserCookie();
  const isOC = isOutsideCounselRole(user?.role);
  const [viewMode, setViewMode] = useState<string>("list");
  const [rowHeight, setRowHeight] = useState<string>("medium");
  // Seed search from ?search= so dashboard links (e.g. Top Inventors row
  // click) land pre-filtered to that inventor.
  const initialSearch =
    new URLSearchParams(window.location.search).get("search") || "";
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [debouncedSearchQuery, setDebouncedSearchQuery] =
    useState<string>(initialSearch);
  // Seed status filters from ?status= so dashboard links land pre-filtered.
  const initialStatusFilters = React.useRef<FilterOption[]>(
    (
      new URLSearchParams(window.location.search).get("status") || ""
    )
      .split(",")
      .filter(Boolean) as FilterOption[],
  );
  const ocDefaultStatusApplied = React.useRef(isOC);
  const [statusFilters, setStatusFilters] = useState<FilterOption[]>(() => {
    return initialStatusFilters.current.length > 0
      ? initialStatusFilters.current
      : isOC
        ? ["SEND_TO_OC"]
        : [];
  });
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(() =>
    (new URLSearchParams(window.location.search).get("client") || "")
      .split(",")
      .filter(Boolean),
  );
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [selectedeIdea, setSelectedIdea] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Date-window from the dashboard tile (e.g. ?date=last30). Forwarded to the
  // API so the list total matches the "Ideas in Last N Days" tile count.
  const dateFilter = searchParams.get("date") || "";
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  useEffect(() => {
    if (
      !isOC ||
      initialStatusFilters.current.length > 0 ||
      ocDefaultStatusApplied.current
    ) {
      return;
    }
    ocDefaultStatusApplied.current = true;
    setStatusFilters((current) =>
      current.length > 0 ? current : ["SEND_TO_OC"],
    );
  }, [isOC]);

  const queryClient = useQueryClient();

  const { data: clientLookupData } = useQuery({
    queryKey: ["idea_client_lookup"],
    queryFn: async () => {
      const response = await API_CONFIG.get("/api/v1/clients/lookup");
      return response?.data?.data || [];
    },
    enabled: isOC,
  });
  const clientOptions: { id: string; name: string }[] = Array.isArray(
    clientLookupData,
  )
    ? clientLookupData
    : [];
  const clientFilterLabel =
    selectedClientIds.length === 0
      ? "All clients"
      : selectedClientIds.length === 1
        ? clientOptions.find((client) => client.id === selectedClientIds[0])
            ?.name || "1 client"
        : `${selectedClientIds.length} clients`;

  // Typed at the source: the callback below annotated `value` as FilterOption
  // while the literals inferred as plain strings, so the map callback did not
  // match. Declaring it here keeps one source of truth.
  const statusCodeList: { value: FilterOption; label: string }[] = [
    { value: "IN_DRAFT", label: "In Draft" },
    { value: "UNDER_REVIEW", label: `${user?.role==="INVENTOR" ? "Under Review" : "Review Pending"}` },
    { value: "REJECT_BY_IHC", label: "Rejected by IP Committee" },
    { value: "UPDATE_REQUEST", label: `${user?.role==="INVENTOR" ? "Update Requested by IP Committee" :  "Sent back to Inventor"}` },
    { value: "UPDATE_REQUEST_BY_OC", label: `${isOC ? "Update Requested" : "Update Requested by OC" }` },
    { value: "SEND_TO_OC", label: `${user?.role==="INVENTOR" ||  user?.role === "LEGAL_COUNSEL" ? "Sent to Photon Legal" :  "Sent by IP Committee"}` },
    { value: "REJECT_BY_OC", label: "Rejected by OC" },
    { value: "FILED", label: "Filed" },
  ];
  

  // Define the mapStatusCodeToLabel function outside the component to avoid hoisting issues
  const mapStatusCodeToLabel = (status: string) => {
    switch (status) {
      case "IN_DRAFT":
        return "In Draft";
      case "UNDER_REVIEW":
      case "SENT_TO_IHC":
        if (user?.role === "INVENTOR")
          return "Under Review";
        else
          return "Review Pending";
      case "REJECT_BY_IHC":
        return "Rejected by IP Committee";
      case "UPDATE_REQUEST":
        if (user?.role === "INVENTOR")
          return "Update Requested by IP Committee"
        else
          return "Sent back to Inventor";
      case "UPDATE_REQUEST_BY_OC":
        if (user?.role === "INVENTOR" || user?.role === "LEGAL_COUNSEL")
          return "Update Requested by OC";
        else
          return "Update Requested";
      case "SEND_TO_OC":
        if (user?.role === "INVENTOR" || user?.role === "LEGAL_COUNSEL")
          return "Sent to Photon Legal";
        else
          return "Sent by IP Committee"
      case "REJECT_BY_OC":
        return "Rejected by OC";
      case "FILED":
        return "Filed";
      default:
        return status;
    }
  };

  const {
    data: ideaData,
    isPending: isFetchingIdeas,
    refetch: refetchIdeas,
  } = useQuery({
    queryKey: [
      "fetch_ideas",
      currentPage,
      itemsPerPage,
      debouncedSearchQuery,
      sortOption,
      statusFilters,
      selectedClientIds,
      dateFilter,
    ],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append("page", currentPage.toString());
        const order = sortOption === "oldest" ? "asc" : "desc";
        const sort = (sortOption === "oldest" || sortOption === "newest") ? "createdAt" : "updatedAt";
        const response = await API_CONFIG.get(
          `/api/v1/idea/fetch-by-user?${params?.toString()}&limit=10&order=${order}&sort=${sort}&search=${debouncedSearchQuery}${statusFilters?.length ? `&status=${statusFilters.join(",")}` : ""
          }${selectedClientIds.length ? `&filter_client_id=${selectedClientIds.join(",")}` : ""}${dateFilter ? `&date=${dateFilter}` : ""}`,
        );

        if (response.status === 200) {
          return response?.data;
        }
      } catch (error) {
        console.error("Error fetching ideas:", error);
      }
    },
    refetchOnMount: true,
  });

  // Fetch drafts data for all ideas
  const { data: draftData, isPending: isFetchingDrafts } = useQuery({
    queryKey: ["fetch_drafts"],
    queryFn: async () => {
      if (!ideaData?.length) return [];

      const draftsPromises = ideaData.map(async (idea: any) => {
        try {
          const response = await API_CONFIG.get(
            `/api/v1/idea/fetch-drafts/${idea.id}`,
          );
          if (response.status === 200) {
            // Extract drafts array directly from data
            const drafts = response?.data?.data || [];
            return {
              ideaId: idea.id,
              drafts: drafts,
            };
          }
        } catch (error) {
          console.error(`Error fetching drafts for idea ${idea.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(draftsPromises);
      return results.filter(Boolean);
    },
    enabled: !!ideaData?.length, // Only fetch drafts when we have ideas
  });

  // Create a map of drafts by ideaId for efficient lookup
  const ideaDraftsMap = useMemo(() => {
    if (!draftData) return new Map();
    return new Map(draftData.map((draft) => [draft.ideaId, draft.drafts]));
  }, [draftData]);

  // Debounce search query
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Reset to page 1 when search query or status filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilters, selectedClientIds]);

  // Get draft with scoring information for an idea
  const getIHCSentDraft = (ideaId: string) => {
    const drafts = ideaDraftsMap.get(ideaId);

    if (!drafts?.length) return null;

    // Sort drafts by score log creation date (newest first)
    const draftsWithScores = drafts
      .filter((draft) => draft?.CheckDraftSoreLog?.length > 0)
      .sort((a, b) => {
        const aDate = new Date(a.CheckDraftSoreLog[0].createdAt);
        const bDate = new Date(b.CheckDraftSoreLog[0].createdAt);
        return bDate.getTime() - aDate.getTime();
      });

    const draft = draftsWithScores[0];

    if (!draft) return null;

    // Get the first score log
    const scoreLog = draft?.CheckDraftSoreLog[0];

    return {
      ...draft,
      scoreLog,
      scoringResult: scoreLog?.score_meta_data?.scoringResult || null,
      priorArt: scoreLog?.score_meta_data?.priorArt || [],
      score: scoreLog?.score || null,
    };
  };

  // Filter functionality - API handles search, so we only need client-side status filtering if needed
  // Note: API already handles both search and status filtering server-side
  const isInventor = user?.role === "INVENTOR";

  const filteredIdeas = useMemo(() => {
    const data = ideaData?.data;
    if (!ideaData?.data || !Array.isArray(ideaData?.data)) return [];

    // API already handles search and status filtering server-side.
    // Inventors see only ideas they are credited on — their own submissions
    // plus ideas where a colleague added them as co-inventor.
    if (isInventor && user?.id) {
      return data.filter(
        (i: any) =>
          i.created_by_id === user.id ||
          i.IdeaInventor?.some((x: any) => x?.inventor?.id === user.id),
      );
    }
    return [...data];
  }, [ideaData, isInventor, user?.id]);

  // Sort functionality
  const sortedIdeas = useMemo(() => {
    if (!filteredIdeas || !Array.isArray(filteredIdeas)) return [];

    return [...filteredIdeas].sort((a, b) => {
      switch (sortOption) {
        case "newest": {
          if (!a.updatedAt && !a.submission_date) return -1;
          if (!b.updatedAt && !b.submission_date) return 1;
          const aDate = a.updatedAt || a.submission_date || a.dateSubmitted;
          const bDate = b.updatedAt || b.submission_date || b.dateSubmitted;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        }
        case "oldest": {
          if (!a.updatedAt && !a.submission_date) return 1;
          if (!b.updatedAt && !b.submission_date) return -1;
          const aOldDate = a.updatedAt || a.submission_date || a.dateSubmitted;
          const bOldDate = b.updatedAt || b.submission_date || b.dateSubmitted;
          return new Date(aOldDate).getTime() - new Date(bOldDate).getTime();
        }
        default:
          return 0;
      }
    });
  }, [filteredIdeas, sortOption]);

  const { mutate: cloneMutation } = useMutation({
    mutationKey: ["clone_idea"],
    mutationFn: async (ideaId: string) => {
      try {
        const response = await API_CONFIG.post(`/api/v1/idea/clone/${ideaId}`);
        if (response.status === 200) {
          toast.success("Idea cloned successfully");
          return response.data;
        }
      } catch (error) {
        toast.error("Error cloning idea");
        console.error("Error cloning idea:", error);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["fetch_ideas"],
      });
    },
  });

  const { mutateAsync: asyncRemoveIdeaMutation, isPending: isDeleting } =
    useMutation({
      mutationKey: ["removeIdea"],
      mutationFn: async (idea_inventor_id: string) => {
        try {
          const response = await API_CONFIG.delete(
            `/api/v1/idea/remove/${idea_inventor_id}`,
          );

          if (response?.status === 200) {
            toast.success("Idea removed successfully");
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error removing inventor:", error);
          toast.error(
            error?.response?.data?.message || "Error removing inventor"
          );
        } finally {
          setIsDeleteConfirmOpen(false);
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["fetch_ideas"],
        });
      },
    });

  // Extract data from API response
  // API response structure: { message, data: [...], pagination: { page, totalPages, total, limit } }
  const clientsData: any[] = Array.isArray(ideaData?.data) ? ideaData.data : [];
  const paginationMeta = ideaData?.pagination || {};
  const totalItems = paginationMeta.total || 0;
  const totalPages = paginationMeta.totalPages || 1;
  const currentPageFromApi = paginationMeta.page || currentPage;
  const startIndex = (currentPageFromApi - 1) * itemsPerPage;

  // The backend stores scores on a 0–100 scale; the product displays them
  // on the customer-facing 0–10 scale.
  const ScoreChip = ({ score }: { score: number | null | undefined }) => {
    const value = score != null ? (score / 10).toFixed(1) : null;
    const tone =
      score == null
        ? { mark: "#5E6470", text: "#484E59" }
        : score >= 80
          ? { mark: "#1E7B4D", text: "#155C3B" }
          : score >= 60
            ? { mark: "#F9B418", text: "#7E5A00" }
            : { mark: "#B3362F", text: "#8E2B25" };
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--pulse-line)] bg-[var(--pulse-surface)] px-2.5 py-1.5">
        <span className="h-[7px] w-[7px] shrink-0" style={{ background: tone.mark }} />
        <span
          className="font-mono text-xs font-semibold uppercase leading-none"
          style={{ color: tone.text, letterSpacing: 1 }}
        >
          Score {value != null ? `${value}/10` : "--"}
        </span>
      </span>
    );
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "In Draft":
        return "bg-blue-50 text-blue-600";
      case "Sent to IP Committee for review":
        return "bg-green-50 text-green-600";
      case "Idea Rejected":
        return "bg-red-50 text-red-600";
      default:
        return "bg-orange-50 text-orange-600";
    }
  };

  const handleDelete = async () => {
    await asyncRemoveIdeaMutation(selectedeIdea);
    setSelectedIdea("");
  };

  const handleSortChange = (value: SortOption) => {
    setSortOption(value);
    toast.success(`Sort applied: ${getSortLabel(value)}`);
  };

  const handleViewIdea = (ideaId: string) => {
    navigate(`/ideas/${ideaId}`);
  };

  // Toggle a status value in the multi-select statusFilters state
  const toggleStatusFilter = (
    status: FilterOption,
    checked: boolean | "indeterminate",
  ) => {
    setStatusFilters((prev) => {
      const isChecked = checked === true;
      if (isChecked) {
        if (prev.includes(status)) return prev;
        return [...prev, status];
      }
      return prev.filter((s) => s !== status);
    });
  };

  const getSortLabel = (sort: SortOption): string => {
    switch (sort) {
      case "newest":
        return "Newest First";
      case "oldest":
        return "Oldest First";
      case "recently_updated":
        return "Recently Updated";
      default:
        return "Newest First";
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className="pulse-product-page pulse-table-page relative mx-auto min-h-0 flex-1 w-full max-w-[1680px] overflow-hidden px-6 py-6 lg:px-8">
      <div className="flex h-full flex-col">
        {/* Animated Gradient Background */}
        <div className="hidden">
          {theme === "dark" ? (
            <>
              {/* Yellow Gradient Blob */}
              <div
                className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-blob"
                style={{
                  background:
                    "radial-gradient(circle, rgba(245, 166, 35, 0.2) 0%, rgba(245, 166, 35, 0) 70%)",
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
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
          <>
            <div
              className={`pulse-toolbar !mx-0 !mb-5 !mt-0 ${theme === "dark" ? "bg-[#0a0a0a]" : "bg-white"} flex-col sm:flex-row !items-start sm:!items-center`}
            >
              <div className="flex-1 min-w-0">
                <div className="relative min-w-0 sm:min-w-[300px]">
                  <Search
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none ${theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                      }`}
                  />
                  <Input
                    name="search"
                    className={`pl-10 rounded h-[42px] pb-2.5 ${theme === "dark"
                      ? "bg-neutral-900 border border-[#cccccc20] text-zinc-200 placeholder:text-neutral-600"
                      : "text-zinc-900 placeholder:text-neutral-400 bg-neutral-50"
                      }`}
                    placeholder={
                      isInventor
                        ? "Search your ideas by title or status..."
                        : "Search by title, inventor, client, status..."
                    }
                    value={searchQuery}
                    onChange={handleSearch}
                  />
                  <Plus
                    onClick={() => {
                      setSearchQuery("");
                      setDebouncedSearchQuery("");
                    }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 rotate-45 w-4 h-4 z-10 cursor-pointer ${theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                      }`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-3 sm:mt-0">
                {!isOC && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-[42px] gap-1 rounded-lg bg-[#F9B418] font-semibold text-[#0C0C0C] hover:bg-[#DA9700]"
                          onClick={() => setIsSubmitModalOpen(true)}
                          size={isMobile ? "sm" : "default"}
                        >
                          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          {isMobile ? "New" : "Submit an Idea"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={`${
                          theme === "dark"
                            ? "text-neutral-300 bg-neutral-900 border-[#cccccc20]"
                            : "text-neutral-700"
                        } rounded-xl py-2 font-sans text-xs font-normal`}
                      >
                        Submit a new innovation idea for review
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {isOC && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-[42px] min-w-[150px] justify-between gap-2 rounded border px-4 font-sans font-normal hover:border-[#F9B418] ${theme === "dark"
                          ? "bg-neutral-900 border-[#cccccc20] hover:bg-zinc-900 text-neutral-300"
                          : "hover:bg-transparent text-neutral-700 bg-white"
                          }`}
                        aria-label={`Filter ideas by client: ${clientFilterLabel}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="max-w-[130px] truncate">
                            {clientFilterLabel}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className={`w-[280px] rounded-md border p-4 shadow-md ${theme === "dark"
                        ? "bg-neutral-900 border-neutral-800"
                        : "bg-white border-photon-border-light"
                        }`}
                    >
                      <div className="space-y-3">
                        <h4 className={`text-sm font-semibold ${theme === "dark" ? "text-neutral-100" : "text-neutral-900"}`}>
                          Filter by Client
                        </h4>
                        <div className="space-y-2.5">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="idea-client-all"
                              checked={selectedClientIds.length === 0}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedClientIds([]);
                              }}
                              className={theme === "dark" ? "bg-neutral-900/40 border-neutral-700" : "border-neutral-400"}
                            />
                            <label htmlFor="idea-client-all" className={`cursor-pointer text-sm ${theme === "dark" ? "text-neutral-300" : "text-neutral-800"}`}>
                              All clients
                            </label>
                          </div>
                          {clientOptions.map((client) => (
                            <div key={client.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`idea-client-${client.id}`}
                                checked={selectedClientIds.includes(client.id)}
                                onCheckedChange={(checked) =>
                                  setSelectedClientIds((current) =>
                                    checked
                                      ? [...new Set([...current, client.id])]
                                      : current.filter((id) => id !== client.id),
                                  )
                                }
                                className={theme === "dark" ? "bg-neutral-900/40 border-neutral-700" : "border-neutral-400"}
                              />
                              <label htmlFor={`idea-client-${client.id}`} className={`cursor-pointer text-sm ${theme === "dark" ? "text-neutral-300" : "text-neutral-800"}`}>
                                {client.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "sm"}
                      className={`border py-5 px-4 font-sans font-normal rounded hover:border-[#F9B418] ${theme === "dark"
                        ? "bg-neutral-900  border-[#cccccc20] hover:bg-zinc-900"
                        : "hover:bg-transparent text-neutral-700 bg-white"
                        }`}
                    >
                      <Filter
                        className={`w-4 h-4 ${theme === "dark" && "text-neutral-200"
                          }`}
                      />
                      <span className={theme === "dark" ? "text-neutral-300" : undefined}>
                        Status
                      </span>
                      {statusFilters && statusFilters.length > 0 ? (
                        <span
                          className={`w-5 h-5 font-sans text-xs rounded-full text-black bg-[#F9B418] pt-[2px]`}
                        >
                          {statusFilters.length}
                        </span>
                      ) : (
                        ""
                      )}
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
                        className="lucide lucide-chevron-down w-4 h-4 dark:text-neutral-300"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6"></path>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={`w-[280px] rounded-md border shadow-md p-4 ${theme === "dark"
                      ? "bg-neutral-900 border-neutral-800"
                      : "bg-white border-photon-border-light"
                      }`}
                  >
                    <div className="space-y-3">
                      <h4
                        className={`font-semibold text-sm ${theme === "dark"
                          ? "text-neutral-100"
                          : "text-neutral-900"
                          }`}
                      >
                        Filter by Status
                      </h4>
                      <div className="space-y-2.5">
                        {statusCodeList.map(
                          (statusList: {
                            label: string;
                            value: FilterOption;
                          }) => (
                            <div key={statusList.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`status-${statusList.value}`}
                                checked={statusFilters.includes(
                                  statusList.value,
                                )}
                                onCheckedChange={(checked) =>
                                  toggleStatusFilter(statusList.value, checked)
                                }
                                className={
                                  theme === "dark"
                                    ? "bg-neutral-900/40 border-neutral-700"
                                    : "border-neutral-400"
                                }
                              />
                              <label
                                htmlFor={`status-${statusList.value}`}
                                className={`text-sm cursor-pointer ${theme === "dark"
                                  ? "text-neutral-300"
                                  : "text-neutral-800"
                                  }`}
                              >
                                {statusList.label}
                              </label>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={sortOption} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[110px] rounded h-[42px] text-xs md:text-sm font-sans hover:border-[#F9B418] dark:bg-neutral-900">
                    <ArrowUpDown
                      className={`w-4 h-4 ${theme === "dark" && "text-neutral-300"
                        }`}
                    />
                    <span>Sort</span>
                  </SelectTrigger>

                  <SelectContent className="font-sans w-[220px] dark:!bg-neutral-900">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="recently_updated">
                      Recently Updated
                    </SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild className="hidden">
                    <Button variant="outline" size="sm">
                      <LayoutList className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuLabel>View Mode</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={viewMode}
                      onValueChange={(value: string) => setViewMode(value)}
                    >
                      <DropdownMenuRadioItem value="list">
                        List View
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="grid">
                        Grid View
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    {viewMode === "list" && (
                      <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Row Height
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => setRowHeight("small")}
                            >
                              Compact
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRowHeight("medium")}
                            >
                              Default
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRowHeight("large")}
                            >
                              Relaxed
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isFetchingIdeas ||
              (!!ideaData?.length && isFetchingDrafts) ||
              (searchQuery && isFetchingIdeas) ? (
              <Loader />
            ) : viewMode === "list" ? (
              <div
                className={`${theme === "dark"
                  ? "bg-transparent border-[#cccccc20] border-t"
                  : "bg-white border-photon-gray-300 border-t"
                  } flex-1 overflow-hidden flex flex-col md:mb-10`}
              >
                <div
                  /* Owns both axes of scrolling. It was flex-shrink-0 with a
                     fixed h-[72vh] and overflow-x only, so anything past 72% of
                     the viewport was clipped with no way to reach it — the list
                     simply ended mid-row. flex-1 + min-h-0 lets it size to the
                     space the page actually has. */
                  className={`min-h-0 flex-1 overflow-auto ${theme === "dark" ? "border-[#cccccc20]" : ""
                    }`}
                >
                  <div className="grid grid-cols-1 gap-4 px-6 pb-6">
                    {sortedIdeas?.map((idea: any, index: number) => {
                      const status = idea.status?.toUpperCase();
                      // Only the internal IP committee reviews ideas here.
                      // OC Admin receives committee-approved ideas but does not
                      // perform a review from the repository card.
                      const reviewable =
                        !isInventor && !isOC && status === "UNDER_REVIEW";
                      return (
                      <div
                        key={idea.id}
                        onClick={() => handleViewIdea(idea.id)}
                        className="pulse-content-card flex cursor-pointer flex-col gap-3.5 p-[20px_22px] font-sans transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--pulse-line-strong)] hover:shadow-[0_18px_40px_-28px_rgba(17,16,60,0.45)]"
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span
                            className="font-mono text-xs text-[#727272]"
                            title="Idea Reference Number"
                          >
                            {idea.reference_number || idea.id}
                          </span>
                          <div className="flex items-center gap-2">
                            <ScoreChip score={idea?.score} />
                            <StatusChip
                              status={status}
                              label={mapStatusCodeToLabel(status)}
                            />
                          </div>
                        </div>
                        <div className="text-base font-semibold leading-[22px] text-[#0C0C0C]">
                          {idea?.title}
                        </div>
                        <div className="line-clamp-2 text-[13px] leading-[20px] text-[#444444]">
                          {idea?.summary || idea?.about || "No summary yet."}
                        </div>
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5 text-xs text-[#727272]">
                            {!isInventor && (
                              <span>
                                {typeof idea?.created_by === "string"
                                  ? idea?.created_by
                                  : idea?.created_by?.name || idea?.created_by?.email}
                              </span>
                            )}
                            <span className="font-mono">
                              {idea?.submission_date
                                ? moment(idea?.submission_date).format("MMM D")
                                : "--"}
                            </span>
                          </div>
                          {reviewable && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewIdea(idea.id);
                              }}
                              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#F9B418] px-3.5 py-2 text-[13px] font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700]"
                            >
                              Review
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      );
                    })}
                    {isInventor && sortedIdeas?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsSubmitModalOpen(true)}
                        className="self-start px-1 py-2 text-[13px] font-medium text-[#727272] transition-colors hover:text-[#0C0C0C] hover:underline"
                      >
                        + Add another idea
                      </button>
                    )}
                    {sortedIdeas?.length === 0 &&
                      (isInventor && !searchQuery ? (
                        <div className="col-span-full flex h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
                          <Lightbulb
                            className={`h-10 w-10 ${theme === "dark" ? "text-neutral-500" : "text-[#727272]"}`}
                            strokeWidth={1.5}
                          />
                          <h3
                            className={`mt-3 text-xl font-semibold ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"}`}
                          >
                            You haven't submitted an idea yet
                          </h3>
                          <p className="max-w-md text-center text-sm text-gray-600 dark:text-neutral-400">
                            A title and short description is enough to start.
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsSubmitModalOpen(true)}
                            className="mt-4 rounded-xl bg-[#F9B418] px-6 py-3 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700]"
                          >
                            Submit your first idea
                          </button>
                        </div>
                      ) : (
                        <div className="col-span-full flex h-[60vh] flex-col items-center justify-center p-8 text-center">
                          <div
                            className={`flex h-20 w-20 items-center justify-center rounded-full ${theme === "dark" ? "bg-gray-500/20" : "bg-gray-100"}`}
                          >
                            <FileSearch
                              className={`h-10 w-10 ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"}`}
                            />
                          </div>
                          <h3
                            className={`mt-6 text-xl font-semibold ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"}`}
                          >
                            No ideas found
                          </h3>
                          <p className="mt-3 max-w-md text-center text-gray-600">
                            We couldn't find any ideas matching your search criteria.
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedIdeas?.map((idea) => (
                  <Card
                    key={idea.id}
                    className="overflow-hidden border border-input hover:bg-gray-100 hover:shadow-md transition-all cursor-pointer"
                    onClick={(e) => {
                      if (
                        (e.target as HTMLElement).closest(
                          "[data-actions-dropdown]",
                        )
                      ) {
                        return;
                      }
                      handleViewIdea(idea.id);
                    }}
                  >
                    <CardHeader className="p-4 pb-2 space-y-1">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-medium line-clamp-2">
                          {idea?.title}
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full hover:bg-muted -mr-2 -mt-2"
                              data-actions-dropdown="true"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[180px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={() => handleViewIdea(idea.id)}
                            >
                              View Details
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem>Edit</DropdownMenuItem> */}
                            {getIHCSentDraft(idea.id) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  const scoreReportDialog =
                                    document.createElement("div");
                                  scoreReportDialog.style.position = "fixed";
                                  scoreReportDialog.style.top = "0";
                                  scoreReportDialog.style.left = "0";
                                  scoreReportDialog.style.width = "100%";
                                  scoreReportDialog.style.height = "100%";
                                  scoreReportDialog.style.backgroundColor =
                                    "rgba(0,0,0,0.5)";
                                  scoreReportDialog.style.zIndex = "1000";
                                  document.body.appendChild(scoreReportDialog);

                                  const handleClose = () => {
                                    document.body.removeChild(
                                      scoreReportDialog,
                                    );
                                  };

                                  const root = createRoot(scoreReportDialog);
                                  root.render(
                                    <div className="fixed inset-0 flex items-center justify-center p-4">
                                      <div className="bg-white w-full max-w-5xl rounded-lg max-h-[90vh] overflow-auto relative">
                                        <div className="sticky top-0 flex justify-end items-center gap-4 p-4 bg-white border-b z-10">
                                          <button
                                            onClick={handleClose}
                                            className="p-2 hover:bg-gray-100 rounded-full transition-colors ml-4"
                                            aria-label="Close"
                                          >
                                            <X className="h-5 w-5 text-gray-500" />
                                          </button>
                                        </div>
                                        <div className="p-6">
                                          <ShowScoreReport
                                            api_evaluation_id={
                                              getIHCSentDraft(idea.id)
                                                ?.api_evaluation_id
                                            }
                                            title={idea.title}
                                            scoringResult={
                                              getIHCSentDraft(idea.id)
                                                ?.scoringResult
                                            }
                                            priorArt={
                                              getIHCSentDraft(idea.id)
                                                ?.priorArt || []
                                            }
                                            report={{
                                              id: getIHCSentDraft(idea.id)?.id,
                                              score: getIHCSentDraft(idea.id)
                                                ?.scoringResult?.score,
                                              report: getIHCSentDraft(idea.id)
                                                ?.meta_data,
                                              status: idea.status,
                                              createdAt: getIHCSentDraft(
                                                idea.id,
                                              )?.createdAt,
                                              updatedAt: getIHCSentDraft(
                                                idea.id,
                                              )?.updatedAt,
                                              scoringResult: getIHCSentDraft(
                                                idea.id,
                                              )?.scoringResult,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>,
                                  );
                                }}
                              >
                                View Score Report
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                const isConfirm = window.confirm(
                                  "Are you sure you want to clone this idea?",
                                );

                                if (isConfirm) {
                                  cloneMutation(idea?.id);
                                }
                              }}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem className="text-red-600">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="text-xs text-muted-foreground mb-3">
                        <span className="font-medium text-photon-primary">
                          {idea.reference_number || idea.id}
                        </span>
                      </div>
                      <div className="text-sm mb-3">
                        <span className="text-muted-foreground">
                          Inventors:{" "}
                        </span>
                        <span>{idea.inventors}</span>
                      </div>
                      <div className="text-sm mb-3">
                        <span className="text-muted-foreground">
                          Date Submitted:{" "}
                        </span>
                        <span>{idea.dateSubmitted}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 flex justify-between items-center">
                      <div className="mt-3 w-full">
                        <div className="border-t border-input/50 pt-3 w-full"></div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium mt-2 inline-block ${getStatusBadgeStyle(
                            idea.status,
                          )}`}
                        >
                          {isMobile && idea.status === "Sent to IP Committee for review"
                            ? "Sent to IP Committee"
                            : idea.status}
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
                {sortedIdeas?.length === 0 && (
                  <div className="col-span-full text-center py-10">
                    No ideas found matching your criteria.
                  </div>
                )}
              </div>
            )}
          </>
        </div>
        {/* Pagination */}
        {sortedIdeas?.length > 0 && totalItems > 0 && (
          <div
            className={`pulse-pagination-bar absolute bottom-6 left-6 right-6 z-20 mb-[70px] md:mb-0 lg:left-8 lg:right-8 ${theme === "dark"
              ? "bg-[#0a0a0a] border-[#cccccc20]"
              : "bg-white border-photon-gray-300"
              }`}
          >
            <div className="flex items-center justify-evenly md:justify-between ">
              <div className="gap-3 hidden md:flex items-center">
                <span
                  className={`text-sm ${theme === "dark" ? "text-neutral-500" : "text-gray-500"
                    }`}
                >
                  {isInventor
                    ? `Showing ${sortedIdeas.length} idea${sortedIdeas.length === 1 ? "" : "s"}`
                    : `Showing ${startIndex + 1} to ${Math.min(startIndex + clientsData.length, totalItems)} of ${totalItems} entries`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${theme === "dark"
                    ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                    : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                    }`}
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPageFromApi === 1}
                  title="First page"
                >
                  <ChevronsLeft className={`w-4 h-4`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${theme === "dark"
                    ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                    : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                    }`}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPageFromApi === 1}
                  title="Previous page"
                >
                  <ChevronLeft className={`w-4 h-4`} />
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
                      className={`px-3 py-1.5 w-8 text-sm font-sans ${currentPageFromApi === pageNum
                        ? "bg-[#F9B418] text-zinc-900 hover:bg-[#F9B418]"
                        : `text-neutral-300 ${theme === "dark"
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
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${theme === "dark"
                    ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                    : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                    }`}
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPageFromApi === totalPages}
                  title="Next page"
                >
                  <ChevronRight className={`w-4 h-4}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${theme === "dark"
                    ? "hover:bg-white/5 text-neutral-400 hover:text-neutral-200"
                    : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                    }`}
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPageFromApi === totalPages}
                  title="Last page"
                >
                  <ChevronsRight className={`w-4 h-4`} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <IdeaSubmissionModal
        open={isSubmitModalOpen}
        onOpenChange={setIsSubmitModalOpen}
        refetchIdeas={refetchIdeas}
      />

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent
          className={`${theme === "dark" ? "bg-[#0a0a0a] border-[#cccccc20]" : "bg-white"
            } rounded-lg`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className={`font-sans ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                }`}
            >
              Delete Idea
            </AlertDialogTitle>
            <AlertDialogDescription
              className={`font-sans ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"
                }`}
            >
              Are you sure you want to delete this idea? This action cannot be
              undone and will remove all associated drafts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className={`bg-transparent border rounded-lg font-sans ${theme === "dark"
                ? "border-[#cccccc20] text-zinc-300 hover:bg-transparent hover:text-zinc-300 bg-input/30 border-white"
                : ""
                }`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className={`text-zinc-100 font-bold rounded-lg font-sans bg-[#ff0000] hover:bg-[#db0f0f]`}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IdeasContent;
