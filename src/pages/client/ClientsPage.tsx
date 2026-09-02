import React, { useState, useEffect } from "react";
import { track, useTrackOnce } from "@/lib/analytics";
import {
  Plus,
  Calendar,
  File,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Trash2,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  ArrowUpDown,
  ChevronDown,
  LayoutGridIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import BlockedRedirect from "@/lib/BlockedRedirect";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import { MainClass, PageHeader } from "@/components/DashboardChrome";
import { Button } from "@/components/ui/button";
import OnboardClientModal from "@/components/clients/OnboardClientModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import Loader from "@/components/Loader";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import moment from "moment";
import DuplicatePatentsModal from "@/components/clients/DuplicatePatentsModal";
import ClientLogo from "@/components/clients/ClientLogo";
import { useTheme } from "@/hooks/useTheme";
import useUserCookie from "@/hooks/use-auth";

type SortField = "name" | "type" | "patents" | "updatedAt";
type SortDirection = "asc" | "desc";
type ViewType = "card" | "table";

type ClientType = "EXISTING" | "POTENTIAL" | "";

const clientOnboardSchema = Yup.object().shape({
  name: Yup.string().required("Name is required"),
  type: Yup.string().required("Type is required"),
  logo: Yup.mixed().optional(),
  admin_users: Yup.array()
    .of(Yup.string().email("Invalid email format").required())
    .min(1, "At least one admin user is required")
    .test(
      "has-valid-emails",
      "At least one valid admin email is required",
      function (value) {
        const validEmails = value?.filter(
          (email) => email && email.trim() !== "",
        );
        return validEmails && validEmails.length > 0;
      },
    ),
  allowed_domain: Yup.string()
    .required("Allowed Domains are required")
    .matches(
      /^@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/,
      "Domain must be in format @domain.com (e.g., @example.com)",
    ),
  patent_file: Yup.mixed().optional(),
});

export interface iClientOnboardForm {
  name: string;
  type?: ClientType;
  logo?: any;
  allowed_domain: string;
  admin_users: string[];
  patent_file?: any;
}

const clientOnboardInitialValues: iClientOnboardForm = {
  name: "",
  type: "EXISTING",
  logo: "",
  allowed_domain: "",
  admin_users: [""],
  patent_file: "",
};

export interface iClientOnboardModal {
  open: boolean;
  data: iClientOnboardForm;
}

const initialValuesClientOnboardModal: iClientOnboardModal = {
  open: false,
  data: clientOnboardInitialValues,
};

const getTypeBadgeVariant = (type: string) => {
  const upperType = type?.toUpperCase();
  switch (upperType) {
    case "POTENTIAL":
      return "default";
    case "EXISTING":
      return "outline";
    default:
      return "outline";
  }
};

const ClientsPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { user } = useUserCookie();
  const isCaseOwner = user?.role === "CASE_OWNER";
  // `scope` is the enum that makes this readable: a case owner sees only their
  // assigned clients, an OC admin the whole book, and the two are not the same
  // screen even though they share a route.
  useTrackOnce("client_book_viewed", { scope: isCaseOwner ? "assigned" : "all" },
    !!user && isOutsideCounselRole(user.role));
  const [isOnboardModalOpen, setIsOnboardModalOpen] =
    useState<iClientOnboardModal>(initialValuesClientOnboardModal);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState<ClientType>("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [viewType, setViewType] = useState<ViewType>("card");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDuplicatePatentsModalOpen, setIsDuplicatePatentsModalOpen] =
    useState(false);
  const [duplicatePatents, setDuplicatePatents] = useState<any[]>([]);
  const [excelDuplicateEntries, setExcelDuplicateEntries] = useState<any[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const queryClient = useQueryClient();

  const {
    mutate,
    isPending,
    data: addClientData,
  } = useMutation({
    mutationKey: ["add_client"],
    mutationFn: async (data: any) => {
      try {
        const response = await API_CONFIG.post("/api/v1/clients", data);

        if (response?.status === 201) {
          toast.success("Client added successfully");
          // call get all clients query to refresh the list
          setIsOnboardModalOpen(initialValuesClientOnboardModal);
          formik.resetForm();
        }
        return response?.data;
      } catch (error) {
        console.error("Error adding client", error);
        toast.error(error?.response?.data?.message || "Error adding client");
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({
        queryKey: ["fetch_clients"],
      });

      if (data?.data?.patentFile?.data) {
        const patentData = data.data.patentFile.data;
        setDuplicatePatents(patentData.duplicate_patents || []);
        setExcelDuplicateEntries(patentData.excel_duplicate_entries || []);
        setErrorCount(patentData.error_count || 0);
        setSuccessCount(patentData.success_count || 0);
        setIsDuplicatePatentsModalOpen(true);

        if (patentData.duplicate_entry_count > 0) {
          toast.warning(
            `Client added successfully but ${patentData.duplicate_entry_count} patents were found to be duplicate entries.`
            
          );
        }
      }
    },
  });

  const { mutate: deleteClient, isPending: isDeleting } = useMutation({
    mutationKey: ["delete_client"],
    mutationFn: async (clientId: number) => {
      try {
        const response = await API_CONFIG.delete(
          `/api/v1/clients/remove/${clientId}`,
        );

        if (response?.status === 200 || response?.status === 204) {
          toast.success("Client deleted successfully");
          setClientToDelete(null);
        }
        return response?.data;
      } catch (error) {
        console.error("Error deleting client", error);
        toast.error(error?.response?.data?.message || "Error deleting client");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["fetch_clients"],
      });
    },
  });

  const formik = useFormik({
    validationSchema: clientOnboardSchema,
    initialValues: isOnboardModalOpen.data,
    enableReinitialize: true,
    onSubmit: async (values: iClientOnboardForm) => {
      const payload: any = {
        name: values.name,
        type: values.type,
        allowed_domain: values.allowed_domain,
        admin_users: values.admin_users,
        plan: "FREE",
      };
      if (values.logo) {
        payload.logo = values.logo?.id;
      }
      // If patent file attached, upload to S3 first
      if (values.patent_file) {
        try {
          const { s3UploadForImport } = await import("@/lib/api-service/s3Upload");
          const uploaded = await s3UploadForImport(values.patent_file, "patent");
          payload.patent_file_key = uploaded.key;
          payload.patent_file_name = uploaded.originalName;
          payload.patent_file_size = uploaded.size;
          payload.patent_file_type = uploaded.contentType;
        } catch (err) {
          toast.error("Failed to upload patent file");
          return;
        }
      }
      mutate(payload);
    },
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [clientTypeFilter, sortField, sortDirection]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "fetch_clients",
      itemsPerPage,
      currentPage,
      debouncedSearchQuery,
      clientTypeFilter,
      sortField,
      sortDirection,
      user?.role,
    ],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append("page", currentPage.toString());
        // itemsPerPage was in the query key and in the row numbering but never
        // actually sent, so the API fell back to its 500 cap and returned all
        // 82 workspaces — 79 logo streams on one page load, and the S.No column
        // numbered from a page size the server had never heard of.
        params.append("limit", itemsPerPage.toString());

        if (debouncedSearchQuery) {
          params.append("search", debouncedSearchQuery);
        }

        if (clientTypeFilter) {
          params.append("client_type", clientTypeFilter);
        }

        if (sortField) {
          params.append("sort", sortField);
          params.append("order", sortDirection);
        }

        const response = await API_CONFIG.get(
          `/api/v1/clients?${params.toString()}`,
        );
        return response?.data;
      } catch (error) {
        console.error("Error getting clients", error);
        throw error;
      }
    },
  });

  // Extract data from API response
  // API response structure: { message, data: [...], pagination: { page, totalPages, total, limit } }
  const clientsData: any[] = Array.isArray(data?.data) ? data.data : [];
  const paginationMeta = data?.pagination || {};

  const totalItems = paginationMeta.total || 0;
  const totalPages = paginationMeta.totalPages || 1;
  const currentPageFromApi = paginationMeta.page || currentPage;
  const startIndex = (currentPageFromApi - 1) * itemsPerPage;

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleClientClick = (clientId: number) => {
    navigate(`/clients/${clientId}?tab=overview`);
  };

  const handleDeleteClick = (e: React.MouseEvent, clientId: number) => {
    e.stopPropagation(); // Prevent card click navigation
    setClientToDelete(clientId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (clientToDelete) {
      deleteClient(clientToDelete);
      setIsDeleteConfirmOpen(false);
    }
  };

  const RadioIndicator = ({ checked }: { checked: boolean }) => (
    <div
      className={`w-4 h-4 rounded-full border-2 mr-2 flex items-center justify-center transition-all
      ${checked ? "border-[#F9B418]" : "border-neutral-600"}
    `}
    >
      {checked && <div className="w-2 h-2 rounded-full bg-[#F9B418]" />}
    </div>
  );

   // Client portfolio access is available to OC admins (which includes
   // superadmins — see isOCAdminRole) and scoped case owners.
   if (user && !isOutsideCounselRole(user.role)) {
     return <BlockedRedirect from="/clients" to="/" />;
   }

  return (
    <>
      <MainClass className="relative" />
      <PageHeader
        primaryAction={isCaseOwner
          ? undefined
          : {
              label: "Onboard a client",
              icon: <Plus className="h-4 w-4" />,
              onClick: () => {
                track("client_onboard_opened");
                setIsOnboardModalOpen((prev) => ({ ...prev, open: true }));
              },
            }}
      />
      <div className="pulse-product-page pulse-table-page relative mx-auto flex min-h-0 flex-1 w-full max-w-[1680px] flex-col overflow-hidden px-6 py-6 lg:px-8">
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
        <div
          className={`pulse-toolbar !mx-0 !mb-5 !mt-0 ${
            theme === "dark" ? "bg-[#0a0a0a] border-b-[#cccccc20]" : "bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="relative min-w-[300px]">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 pointer-events-none ${
                    theme === "dark" ? "text-neutral-500" : "text-neutral-400"
                  }`}
                />
                <Input
                  name="search"
                  className={`w-full rounded-xl border pl-10 pr-4 h-[42px] text-sm focus:outline-none focus:border-[var(--pulse-brand)] transition-colors ${
                    theme === "dark"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                      : "bg-neutral-50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400"
                  }`}
                  placeholder="Search by client name..."
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
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="pulse-filter-control flex items-center font-normal font-sans py-5"
                    title="View Type"
                  >
                    {viewType === "card" ? (
                      <LayoutGridIcon
                        className={`w-4 h-4 text-neutral-700 dark:text-neutral-300`}
                      />
                    ) : (
                      <TableIcon
                        className={`w-4 h-4 text-neutral-700 dark:text-neutral-300`}
                      />
                    )}
                    <span className="text-neutral-700 dark:text-neutral-300">
                      View
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 ${
                        theme === "dark" ? "text-gray-300" : "text-foreground"
                      }`}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={`w-[160px] font-sans p-2 ${
                    theme === "dark"
                      ? "bg-[#171717] border border-[#cccccc20]"
                      : "bg-white"
                  }`}
                >
                  <DropdownMenuLabel
                    className={`font-bold font-sans ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                    }`}
                  >
                    View Mode
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setViewType("table")}>
                    <div
                      className={`w-4 h-4 rounded-full border-2 mr-2 flex items-center justify-center cursor-pointer transition-all  ${
                        viewType !== "card"
                          ? "border-[#F9B418]"
                          : "border-neutral-600"
                      }`}
                    >
                      {viewType !== "card" ? (
                        <div className="w-2 h-2 rounded-full bg-[#F9B418]"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent"></div>
                      )}
                    </div>
                    <label
                      className={`text-sm cursor-pointer flex items-center gap-2 ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
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
                        className="lucide lucide-table w-4 h-4"
                        aria-hidden="true"
                      >
                        <path d="M12 3v18"></path>
                        <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                        <path d="M3 9h18"></path>
                        <path d="M3 15h18"></path>
                      </svg>
                      Table View
                    </label>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewType("card")}>
                    <div
                      className={`w-4 h-4 rounded-full border-2 mr-2 flex items-center justify-center cursor-pointer transition-all ${
                        viewType === "card"
                          ? "border-[#F9B418]"
                          : "border-neutral-600"
                      }`}
                    >
                      {viewType === "card" ? (
                        <div className="w-2 h-2 rounded-full bg-[#F9B418]"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-transparent"></div>
                      )}
                    </div>
                    <label
                      className={`text-sm cursor-pointer flex items-center gap-2 ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
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
                        className="lucide lucide-layout-grid w-4 h-4"
                        aria-hidden="true"
                      >
                        <rect width="7" height="7" x="3" y="3" rx="1"></rect>
                        <rect width="7" height="7" x="14" y="3" rx="1"></rect>
                        <rect width="7" height="7" x="14" y="14" rx="1"></rect>
                        <rect width="7" height="7" x="3" y="14" rx="1"></rect>
                      </svg>
                      Card View
                    </label>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center font-normal gap-2 rounded py-5 bg-white hover:bg-white dark:bg-zinc-900 border dark:border-[#cccccc20]  hover:border-[#F9B418]  outline-none dark:hover:border-[#f9b51886]"
                  >
                    <Building2
                      className={`w-4 h-4 text-neutral-700 dark:text-neutral-300`}
                    />
                    <span className="text-neutral-700 font-sans dark:text-neutral-300">
                      {clientTypeFilter
                        ? clientTypeFilter === "EXISTING"
                          ? "Existing"
                          : "Potential"
                        : "All"}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 ${
                        theme === "dark" ? "text-gray-300" : "text-foreground"
                      }`}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={`w-[160px] font-sans p-2 ${
                    theme === "dark"
                      ? "bg-zinc-900 border border-[#cccccc20]"
                      : "bg-white"
                  }`}
                >
                  <DropdownMenuLabel
                    className={`font-bold font-sans ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                    }`}
                  >
                    Client Type
                  </DropdownMenuLabel>
                  {/* ALL CLIENTS */}
                  <DropdownMenuItem
                    onClick={() => setClientTypeFilter("")}
                    className="flex items-center"
                  >
                    <RadioIndicator checked={!clientTypeFilter} />
                    <label
                      className={`text-sm cursor-pointer ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Show All
                    </label>
                  </DropdownMenuItem>

                  {/* EXISTING */}
                  <DropdownMenuItem
                    onClick={() => setClientTypeFilter("EXISTING")}
                    className="flex items-center"
                  >
                    <RadioIndicator checked={clientTypeFilter === "EXISTING"} />
                    <label
                      className={`text-sm cursor-pointer ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Existing
                    </label>
                  </DropdownMenuItem>

                  {/* POTENTIAL */}
                  <DropdownMenuItem
                    onClick={() => setClientTypeFilter("POTENTIAL")}
                    className="flex items-center"
                  >
                    <RadioIndicator
                      checked={clientTypeFilter === "POTENTIAL"}
                    />
                    <label
                      className={`text-sm cursor-pointer ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Potential
                    </label>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 font-normal font-sans rounded py-5 bg-white hover:bg-white dark:bg-zinc-900 border dark:border-[#cccccc20] outline-none dark:hover:border-[#f9b51886] hover:border-[#F9B418]"
                  >
                    <ArrowUpDown
                      className={`w-4 h-4 text-neutral-700 dark:text-neutral-300`}
                    />
                    <span className="text-neutral-700 dark:text-neutral-300">
                      Sort
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 ${
                        theme === "dark" ? "text-gray-300" : "text-foreground"
                      }`}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className={`w-[180px] font-sans p-2 ${
                    theme === "dark"
                      ? "border border-[#cccccc20] bg-zinc-900"
                      : "bg-white"
                  }`}
                >
                  <DropdownMenuLabel
                    className={`font-bold font-sans ${
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900"
                    }`}
                  >
                    Sort Clients
                  </DropdownMenuLabel>
                  {/* NAME */}
                  <DropdownMenuItem
                    onClick={() => toggleSort("name")}
                    className="flex items-center"
                  >
                    <RadioIndicator checked={sortField === "name"} />
                    <span
                      className={`text-sm flex items-center ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Name
                    </span>
                  </DropdownMenuItem>

                  {/* TYPE */}
                  <DropdownMenuItem
                    onClick={() => toggleSort("type")}
                    className="flex items-center"
                  >
                    <RadioIndicator checked={sortField === "type"} />
                    <span
                      className={`text-sm flex items-center ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Type
                    </span>
                  </DropdownMenuItem>

                  {/* PATENTS */}
                  <DropdownMenuItem
                    onClick={() => toggleSort("patents")}
                    className="flex items-center"
                  >
                    <RadioIndicator checked={sortField === "patents"} />
                    <span
                      className={`text-sm flex items-center ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Patents
                    </span>
                  </DropdownMenuItem>

                  {/* LAST UPDATED */}
                  <DropdownMenuItem
                    onClick={() => toggleSort("updatedAt")}
                    className="flex items-center"
                  >
                    <RadioIndicator checked={sortField === "updatedAt"} />
                    <span
                      className={`text-sm flex items-center gap-2 ${
                        theme === "dark"
                          ? "text-neutral-300"
                          : "text-neutral-700"
                      }`}
                    >
                      Last Updated
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {isLoading && !data ? (
          <Loader />
        ) : viewType === "card" ? (
          /* The page is a fixed-height flex column with overflow-hidden, so this
             region must own its scrolling: flex-none clipped everything past the
             fold. The demo has a handful of mock clients and never showed it;
             there are 82 real ones. min-h-0 is what lets a flex child shrink
             enough to actually scroll. */
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-3">
            {clientsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-sidebar-foreground">
                <p className="text-lg mb-2">No clients found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 pb-4 pt-2 md:grid-cols-2 lg:grid-cols-3">
                {clientsData.map((client: any, clientIndex: number) => (
                  <div key={clientIndex} className="relative px font-sans">
                    <Card
                      className={`pulse-content-card group overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-34px_rgba(17,16,60,0.48)] ${
                        theme === "dark"
                          ? "bg-zinc-900 border-[#cccccc20] hover:bg-[#cccccc20]"
                          : "bg-white border-[#E0E0E0]"
                      }`}
                      onClick={() => handleClientClick(client.id)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex">
                            <div
                              className={`mr-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] ${
                                theme === "dark" && "bg-[#00000030]"
                              }`}
                            >
                              <ClientLogo
                                client={client}
                                className="max-h-11 max-w-12 object-contain"
                                fallbackClassName="text-xs font-semibold text-amber-700"
                              />
                            </div>
                          </div>
                          <div className="mb-4 flex items-center gap-3 font-sans">
                            {client.type?.toUpperCase() === "POTENTIAL" ? (
                              <div className="inline-flex rounded-lg border border-[#7057C7]/20 bg-[#7057C7]/10 px-3 py-1 text-xs font-medium text-[#5943A6]">
                                Potential
                              </div>
                            ) : (
                              <div className="inline-flex rounded-lg border border-[var(--pulse-success)]/20 bg-[var(--pulse-success-soft)] px-3 py-1 text-xs font-medium text-[var(--pulse-success)]">
                                Existing
                              </div>
                            )}
                            {!isCaseOwner && (
                              <button
                                onClick={(e) => handleDeleteClick(e, client.id)}
                                className="rounded-lg p-1 text-neutral-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                                aria-label={`Delete ${client.name}`}
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
                          </div>
                        </div>

                        <h3
                          className={`border-b py-5 text-lg font-semibold tracking-[-0.01em] ${
                            theme === "dark"
                              ? "border-[#cccccc30] text-zinc-200"
                              : "border-gray-300 text-zinc-900"
                          }`}
                        >
                          {client.name}
                        </h3>

                        <div
                          className={`grid grid-cols-2 text-[#1F1F1F] mt-5 font-sans`}
                        >
                          <div className="">
                            <div
                              className={`flex items-center text-xs ${
                                theme === "dark"
                                  ? "text-[#cccccc80]"
                                  : "text-[#7D7D7D]"
                              }`}
                            >
                              <FileText
                                size={16}
                                className="mr-2 flex-shrink-0"
                              />{" "}
                              Patents
                            </div>
                            <div
                              className={`text-3xl mt-2 font-semibold ${
                                theme === "dark"
                                  ? "text-zinc-200"
                                  : " text-zinc-900"
                              }`}
                            >
                              {client?._count?.Patent}
                            </div>
                          </div>

                          <div className="">
                            <div
                              className={`flex items-center text-xs ${
                                theme === "dark"
                                  ? "text-[#cccccc80]"
                                  : "text-[#7D7D7D]"
                              }`}
                            >
                              <Clock size={16} className="mr-2 flex-shrink-0" />
                              Updated
                            </div>
                            <div
                              className={`text-[13px] mt-2 ${
                                theme === "dark"
                                  ? "text-zinc-400"
                                  : " text-zinc-700"
                              }`}
                            >
                              {moment(client.updatedAt).format("MMM D, YYYY")}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`${
              theme === "dark"
                ? "bg-transparent"
                : "bg-white border-photon-gray-200 "
            } pulse-table-frame !mx-0 !mb-3 min-h-0 flex-1 overflow-hidden flex flex-col`}
          >
            <div
              className={`flex-shrink-0 overflow-x-auto border-b ${
                theme === "dark" && "border-[#cccccc20]"
              }`}
            >
              <table className="pulse-data-table w-full">
                <thead
                  className={`sticky top-0 z-10 ${
                    theme === "dark" ? "bg-neutral-950" : "bg-white"
                  }`}
                >
                  <tr>
                    <th
                      className="text-center p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ width: "70px" }}
                    >
                      S.No
                    </th>
                    <th
                      className="text-center p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ width: "100px" }}
                    >
                      Logo
                    </th>
                    <th
                      className="text-left p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ minWidth: "150px" }}
                    >
                      Client Name
                    </th>
                    <th
                      className="text-left p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ minWidth: "140px" }}
                    >
                      Type
                    </th>
                    <th
                      className="text-left p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ minWidth: "120px" }}
                    >
                      Patents
                    </th>
                    <th
                      className="text-left p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ minWidth: "120px" }}
                    >
                      Last Updated
                    </th>
                    {!isCaseOwner && <th
                      className="text-left p-4 text-xs uppercase tracking-wider text-neutral-600 dark:text-[#737373]"
                      style={{ width: "130px" }}
                    >
                      Actions
                    </th>}
                  </tr>
                </thead>
              </table>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <table className="pulse-data-table w-full">
                <tbody>
                  {clientsData?.map((client: any, index: number) => (
                    <tr
                      key={index}
                      className={`border-b ${
                        theme === "dark"
                          ? "border-[#cccccc20] hover:bg-[#cccccc05]"
                          : "border-gray-200 bg-neutral-50 hover:bg-neutral-40"
                      } cursor-pointer transition-colors`}
                      onClick={() => handleClientClick(client.id)}
                    >
                      <td
                        className={`text-center p-4 text-sm ${
                          theme === "dark"
                            ? "text-neutral-400"
                            : "text-gray-500"
                        }`}
                        style={{ width: "70px" }}
                      >
                        {startIndex + index + 1}
                      </td>
                      <td
                        className="text-center p-4"
                        style={{ width: "100px" }}
                      >
                        <div className="flex items-center justify-center">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded border p-1.5 ${
                              theme === "dark" &&
                              "bg-[#00000030] border-zinc-900"
                            }`}
                          >
                            <ClientLogo
                              client={client}
                              className="max-h-7 max-w-8 object-contain"
                              fallbackClassName="text-[10px] font-semibold text-amber-700"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4" style={{ minWidth: "150px" }}>
                        <span
                          className={`text-sm ${
                            theme === "dark"
                              ? "text-zinc-200"
                              : "text-neutral-900"
                          }`}
                        >
                          {client.name}
                        </span>
                      </td>
                      <td className="p-4" style={{ minWidth: "140px" }}>
                        {client.type?.toUpperCase() === "POTENTIAL" ? (
                          <div className="inline-flex rounded-lg border border-[#7057C7]/20 bg-[#7057C7]/10 px-3 py-1 text-xs font-medium text-[#5943A6]">
                            Potential
                          </div>
                        ) : (
                          <div className="inline-flex rounded-lg border border-[var(--pulse-success)]/20 bg-[var(--pulse-success-soft)] px-3 py-1 text-xs font-medium text-[var(--pulse-success)]">
                            Existing
                          </div>
                        )}
                      </td>
                      <td className="p-4" style={{ minWidth: "120px" }}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-neutral-500" />
                          <span
                            className={`text-sm ${
                              theme === "dark"
                                ? "text-zinc-200"
                                : "text-gray-700"
                            }`}
                          >
                            {client?._count?.Patent || 0}
                          </span>
                        </div>
                      </td>
                      <td className="p-4" style={{ minWidth: "50px" }}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {moment(client.updatedAt).format("MMM D, YYYY")}
                          </span>
                        </div>
                      </td>
                      {!isCaseOwner && <td className="text-left p-4" style={{ width: "130px" }}>
                        <div
                          className="p-2 rounded-full cursor-pointer transition-colors inline-flex"
                          onClick={(e) => handleDeleteClick(e, client.id)}
                          title="Delete Client"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </div>
                      </td>}
                    </tr>
                  ))}
                  {clientsData.length === 0 && (
                    <tr>
                      <td colSpan={isCaseOwner ? 6 : 7} className="text-center p-4 text-gray-500">
                        No clients found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {clientsData.length > 0 && totalItems > 0 && (
          <div
            className={`pulse-pagination-bar !mx-0 !mb-0 !mt-0 rounded-xl border ${
              theme === "dark"
                ? "bg-transparent border-[#cccccc20]"
                : "bg-white border-photon-gray-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm ${
                    theme === "dark" ? "text-neutral-500" : "text-gray-500"
                  }`}
                >
                  Showing {startIndex + 1} to{" "}
                  {Math.min(startIndex + clientsData.length, totalItems)} of{" "}
                  {totalItems} entries
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                    theme === "dark"
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
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                    theme === "dark"
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
                  <ChevronRight className={`w-4 h-4`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#F9B418] focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed p-1 w-7 h-7 ${
                    theme === "dark"
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

      <OnboardClientModal
        formik={formik}
        open={isOnboardModalOpen.open}
        isSubmitting={isPending}
        onOpenChange={() => {
          setIsOnboardModalOpen(initialValuesClientOnboardModal);
          formik.resetForm();
        }}
      />

      <DuplicatePatentsModal
        open={isDuplicatePatentsModalOpen}
        onOpenChange={setIsDuplicatePatentsModalOpen}
        duplicatePatents={duplicatePatents}
        excelDuplicateEntries={excelDuplicateEntries}
        errorCount={errorCount}
        successCount={successCount}
      />

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent
          className={`${
            theme === "dark" ? "bg-[#0a0a0a] border-[#cccccc20]" : "bg-white"
          } rounded-lg`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className={`font-sans ${
                theme === "dark" ? "text-zinc-200" : "text-zinc-900"
              }`}
            >
              Delete Client
            </AlertDialogTitle>
            <AlertDialogDescription
              className={`font-sans ${
                theme === "dark" ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              This action cannot be undone. This will permanently delete the
              client and all associated data including patents, files, and
              records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className={`bg-transparent border font-sans rounded-lg ${
                theme === "dark"
                  ? "border-[#cccccc20] text-zinc-300 hover:bg-transparent hover:text-zinc-300 border-white bg-input/30"
                  : ""
              }`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className={`text-zinc-100 font-bold font-sans rounded-lg bg-[#ff0000] hover:bg-[#db0f0f]`}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClientsPage;
