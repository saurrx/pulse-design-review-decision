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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import useUserCookie from "@/hooks/use-auth";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import appConfig from "@/lib/appConfig";
import ideaDraftQuestions from "@/lib/IdeaDraftQuestion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  ChevronDown,
  Check,
  CheckCircle,
  Copy,
  Download,
  Eye,
  File,
  FileEdit,
  FileLineChart,
  Lightbulb,
  Pencil,
  Send,
  UserPlus,
  X,
  Circle,
  Info,
  Clock,
  CircleCheck,
  FileTextIcon,
  Calendar,
  Plus,
  Users,
  Trash2,
  RefreshCcw,
  Upload,
  FileText,
  User,
  MessageSquare,
  TriangleAlert,
  MoreHorizontal,
} from "lucide-react";
import moment from "moment";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactSelect from "react-select/creatable";
import { toast } from "@/lib/toast";
import Loader from "../Loader";
import { Textarea } from "../ui/textarea";
import ConciseEvaluationReport from "./DownloadReport";
import FileIdeaModal from "./FileIdeaModal";
import RequestUpdate from "./RequestUpdate";
import PatentNoveltyReport from "./ShowScoreReport";
import ViewRequestUpdate from "./ViewRequestUpdate";
import { Section } from "./draftSections";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUp, PlusCircle, ArrowRight, LoaderCircle } from "lucide-react";
import EmptyDraftsView from "./EmptyDraftsView";
import PatentPaperView from "./PatentPaperView";
import StatusChip from "@/components/ui/StatusChip";
import StatusTimeline from "./StatusTimeline";
import { isOutsideCounselRole } from "@/lib/roleAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import OCDraftView from "./OCDraftView";
import DraftListView from "./DraftListView";
import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";
import { SendToOCModal } from "./SendToOCModal";
import { RejectIdeaModal } from "./RejectIdeaModal";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE } from "@/utils/constants";

interface Inventor {
  id: string;
  name: string;
  employeeId: string;
  country: string;
  phone: string;
  email: string;
  address: string;
  isPrimary: boolean;
}

interface AnalysisStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed";
}

interface IdeaDetailsContentProps {
  ideaId?: string;
}

type OCWorkflowStatus =
  | "UNDER_REVIEW"
  | "PRIOR_ART_SEARCH"
  | "DRAFTING_INITIATED"
  | "FILED";

const OC_WORKFLOW_OPTIONS: Array<{
  value: OCWorkflowStatus;
  label: string;
}> = [
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "PRIOR_ART_SEARCH", label: "Prior Art Search" },
  { value: "DRAFTING_INITIATED", label: "Drafting Initiated" },
  { value: "FILED", label: "Filed" },
];

const IdeaDetailsContent: React.FC<IdeaDetailsContentProps> = ({
  ideaId,
}): JSX.Element => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [openInventors, setOpenInventors] = useState<Record<string, boolean>>(
    {},
  );
  const [isScoreLoading, setIsScoreLoading] = useState(false);
  const [submittedDraftId, setSubmittedDraftId] = useState<string | null>(null);
  const [openEvaluatePopup, setOpenEvaluatePopup] = useState(false);
  const [patentInput, setPatentInput] = useState("");

  const [inventors, setInventors] = useState<any[]>([]);
  const [showRequestUpdateModal, setShowRequestUpdateModal] = useState(false);
  const [showViewContentsModal, setShowViewContentsModal] = useState(false);
  const [showPatentReportModal, setShowPatentReportModal] = useState(false);
  const [showFileIdeaModal, setShowFileIdeaModal] = useState(false);
  const [selectedDraftForReport, setSelectedDraftForReport] = useState<
    string | null
  >(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [draftReport, setDraftReport] = useState<any>(null);
  const [draftApiEvaluationId, setDraftApiEvaluationId] = useState<
    string | null
  >(null);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [ideaScore, setIdeaScore] = useState<number | null>(null);
  const [scoreCalculationError, setScoreCalculationError] = useState<any>("");
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [runningInBackground, setRunningInBackground] = useState(false);
  const [isDisableScoreTransition, setIsDisableScoreTransition] =
    useState<boolean>(false);
  const [extraInventors, setExtraInventors] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [deletedInventorIds, setDeletedInventorIds] = useState<string[]>([]);
  const [originalInventorIds, setOriginalInventorIds] = useState<string[]>([]);
  const [openSendToOCModal, setOpenSendToOCModal] = useState<boolean>(false);
  const [openRejectIdeaModal, setOpenRejectIdeaModal] =
    useState<boolean>(false);
  const [reason, setReason] = useState("");
  const [instructions, setInstructions] = useState("");

  const [isScoreCalculateError, setIsScoreCalculateError] =
    useState<boolean>(false);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    {
      id: "prior-art",
      label: "Retrieving prior art",
      status: "pending",
    },
    {
      id: "similarities",
      label: "Analyzing similarities",
      status: "pending",
    },
    {
      id: "novelty",
      label: "Calculating novelty score",
      status: "pending",
    },
    {
      id: "report",
      label: "Generating report",
      status: "pending",
    },
  ]);
  const [enableScorePolling, setEnableScorePolling] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const { user } = useUserCookie();

  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [reEvalOpen, setReEvalOpen] = React.useState(false);

  const [inventorIdeas, setInventorIdeas] = useState<any[]>([]);

  const isUpdatingDraftRef = useRef(false);

  const handleEdit = () => {
    setIsEditing(true);
    setTitle(mainIdeaData?.title || "");
    setSummary(
      mainIdeaData?.about ||
      "This is a newly submitted idea. Add more details by creating and editing drafts below.",
    );
    // Store original inventor IDs to track deletions
    const originalIds =
      mainIdeaData?.IdeaInventor?.map((idea: any) => idea.id) || [];
    setOriginalInventorIds(originalIds);
    setDeletedInventorIds([]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setExtraInventors([]);
    setDeletedInventorIds([]);
    setOriginalInventorIds([]);
    setTitle(mainIdeaData?.title || "");
    setSummary(
      mainIdeaData?.about ||
      "This is a newly submitted idea. Add more details by creating and editing drafts below.",
    );
  };

  const { data: mainIdeaData, isPending: isFetchingIdea } = useQuery({
    queryKey: ["ideaDetails", ideaId],
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(`/api/v1/idea/fetch/${ideaId}`);

        if (response.status === 200) {
          return response?.data?.data;
        }
      } catch (error) {
        console.error("Error fetching idea details:", error);
      }
    },
    enabled: !!ideaId, // Only run query when ideaId is available
    refetchOnMount: true, // Refetch when navigating back to this page
    refetchOnWindowFocus: false, // Don't refetch on window focus
    staleTime: 0, // Always consider data stale to ensure fresh fetch on navigation
  });

  const { mutate: updateOCWorkflowStatus, isPending: isUpdatingOCStatus } =
    useMutation({
      mutationFn: async (status: Exclude<OCWorkflowStatus, "FILED">) => {
        const response = await API_CONFIG.put(
          `/api/v1/idea/${ideaId}/oc-workflow-status`,
          { status },
        );
        return response?.data?.data;
      },
      onSuccess: (idea) => {
        queryClient.setQueryData(["ideaDetails", ideaId], idea);
        queryClient.invalidateQueries({ queryKey: ["fetch_ideas"] });
        toast.success("Status updated");
      },
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.message || "Unable to update status",
        );
      },
    });

  // Initialize title and summary when mainIdeaData loads
  useEffect(() => {
    if (mainIdeaData && !isEditing) {
      setTitle(mainIdeaData?.title || "");
      setSummary(
        mainIdeaData?.summary ||
        "This is a newly submitted idea. Add more details by creating and editing drafts below.",
      );
    }
  }, [mainIdeaData, isEditing]);

  const { mutate: removeInventorMutation, isPending: isRemovingInventor } =
    useMutation({
      mutationKey: ["removeInventor"],
      mutationFn: async (idea_inventor_id: string) => {
        try {
          const response = await API_CONFIG.delete(
            `/api/v1/idea/remove/inventor/${idea_inventor_id}`,
          );

          if (response?.status === 200) {
            toast.success("Inventor removed successfully", { position: "top-center" });
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error removing inventor:", error);
          toast.error(
            error?.response?.data?.message || "Error removing inventor", { position: "top-center" }
          );
        }
      },
      onSuccess: () => {
        if (dialogRef.current) {
          dialogRef.current.click();
        }
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
      },
    });

  const { mutate: addNewInventor, isPending } = useMutation({
    mutationKey: ["add_new_inventor"],
    mutationFn: async (invite_payload: {

      email: string;
      role: string;
    }) => {
      try {
        const response = await API_CONFIG.post(
          "/api/v1/auth/ihc/invite-user",
          invite_payload,
        );

        if (response?.status === 200) {
          setInventors((prev) => [
            ...prev,
            {
              id: response?.data?.data?.id,

              email: invite_payload?.email,
            },
          ]);
        }
      } catch (error) {
        console.error("Error inviting user:", error);
        toast.error(error?.response?.data?.message || "Error inviting user", { position: "top-center" });
      }
    },
  });

  const {
    isLoading: isFechingIdeaDraft,
    data: ideaDraft,
    refetch: refetchIdeaDraft,
  } = useQuery({
    queryKey: ["idea_draft", ideaId],
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          `/api/v1/idea/fetch-drafts/${ideaId}`,
        );

        setInventorIdeas(response?.data?.data);

        return response?.data?.data;
      } catch (error) {
        console.error("Error fetching idea drafts:", error);
        toast.error(
          error?.response?.data?.message || "Error fetching idea drafts", { position: "top-center" }
        );
      }
    },
    enabled: !!ideaId, // Only run query when ideaId is available
    refetchOnMount: true, // Refetch when navigating back to this page
    refetchOnWindowFocus: true, // Refetch on window focus
    staleTime: 0, // Always consider data stale to ensure fresh fetch on navigation
  });

  const dialogRef = useRef<HTMLButtonElement>(null);

  useQuery({
    queryKey: ["fetch_inventors", user?.client_id],
    // The roster feeds the co-inventor picker — an inventor affordance.
    // Photon-side roles lack the capability and would only collect a 403.
    enabled: user?.role === "INVENTOR" && !!user?.client_id,
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          `/api/v1/clients/fetch-all-inventors/${user?.client_id}`,
        );

        if (response.status === 200) {
          const data = response?.data?.data;

          const formattedData = data.map((inventor: any) => ({
            id: inventor?.id,
            name: inventor?.email,
          }));

          setInventors(formattedData);
        }
      } catch (error) {
        // Handle error
        console.error("Error fetching inventors:", error);
        toast.error(
          error?.response?.data?.message || "Error fetching inventors", { position: "top-center" }
        );
      }
    },
    refetchOnMount: true,
  });

  const { mutate: createDraftMutate, isPending: isAddingDraft } = useMutation({
    mutationKey: ["add_draft"],
    mutationFn: async (payload) => {
      try {
        const response = await API_CONFIG.post(
          "/api/v1/idea/create-new/draft",
          payload,
        );

        if (response?.status === 201) {
          toast.success("Draft added successfully", { position: "top-center" });
          navigate(
            `/ideas/${ideaId}/draft?draftId=${response?.data?.data?.id}`,
          );
          return response?.data?.data;
        }
      } catch (error) {
        console.error("Error adding draft:", error);
        toast.error(error?.response?.data?.message || "Error adding draft", { position: "top-center" });
      }
    },
  });

  const { mutate: updateIdeaMutation, mutateAsync: updateIdeaMutationAsync } =
    useMutation({
      mutationKey: ["update_idea", ideaId],
      mutationFn: async (data: any) => {
        try {
          const response = await API_CONFIG.put(
            `/api/v1/idea/update-idea/${ideaId}`,
            data,
          );

          if (response.status == 200) {
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Failed to update idea!");
          throw error;
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
      },
    });

  const { mutate: rejectIdeaByIHC, isPending: isRejectingIdeaByIHC } =
    useMutation({
      mutationKey: ["reject_idea_by_ihc"],
      mutationFn: async (payload?: { reject_reason?: string | null }) => {
        try {
          const response = await API_CONFIG.post(
            `/api/v1/idea/reject-from-ihc/${ideaId}`,
            {
              reject_reason:
                payload?.reject_reason !== undefined
                  ? payload.reject_reason
                  : null,
            }
          );

          if (response?.status === 200) {
            toast.success("Idea rejected successfully", { position: "top-center" });
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error rejecting idea by IHC:", error);
          toast.error(
            error?.response?.data?.message || "Error rejecting idea", { position: "top-center" }
          );
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
        queryClient.invalidateQueries({
          queryKey: ["idea_draft", ideaId],
        });
      },
    });

  const handleDraftSelection = (draftId: string) => {
    setSelectedDraftId(draftId);
  };

  const handleCreateDraft = () => {
    // navigate(`/ideas/${ideaId}/draft`);
    const payload: any = {
      meta_data: ideaDraftQuestions,
      idea_id: ideaId,
    };
    createDraftMutate(payload);
  };
  const handleEditDraft = (draftId: string) => {
    navigate(`/ideas/${ideaId}/draft?draftId=${draftId}`);
  };
  const { mutate: cloneDraftMutation, isPending: isCloningDraft } = useMutation(
    {
      mutationKey: ["clone_draft"],
      mutationFn: async (draftId: string) => {
        try {
          const response = await API_CONFIG.post(
            `/api/v1/idea/clone-draft/${draftId}`,
          );
          if (response.status === 200) {
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error cloning draft:", error);
          throw error;
        }
      },
      onSuccess: () => {
        toast.success("Draft cloned successfully", { position: "top-center" });
        queryClient.invalidateQueries({
          queryKey: ["idea_draft", ideaId],
        });
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || "Error cloning draft", { position: "top-center" });
      },
    },
  );

  const handleCopyDraft = (draftId: string) => {
    const confirm = window.confirm(
      "Are you sure you want to clone this draft?",
    );
    if (confirm) {
      cloneDraftMutation(draftId);
    }
  };

  const {
    mutate: sendToIHC,
    isPending: isSendingToIHC,
    variables: sendToIHCVariables,
  } = useMutation({
    mutationKey: ["send_to_ihc"],
    mutationFn: async (payload: { draft_id: string; ihc_id: string }) => {
      // An appeal must say why — collected here so every send path (including
      // the co-inventor prompt) gathers it; the chain enforces it server-side.
      let appealComment: string | undefined;
      if (mainIdeaData?.status === "REJECT_BY_IHC") {
        const why = window.prompt("This idea was rejected. Say why it should be reconsidered:");
        if (!why || !why.trim()) return;
        appealComment = why.trim();
      }
      try {
        const response = await API_CONFIG.post(
          `/api/v1/idea/send-to-ihc/${payload.draft_id}/${payload.ihc_id}`,
          { ...payload, comment: appealComment },
        );

        if (response?.status === 200) {
          toast.success("Draft sent for review", { position: "top-center" });
        }
      } catch (error) {
        console.error("Error sending to IHC:", error);
        toast.error(error?.response?.data?.message || "Error sending for review", { position: "top-center" });
      }
    },
    onSuccess: () => {
      setSelectedDraftId(null);

      queryClient.invalidateQueries({
        queryKey: ["ideaDetails", ideaId],
      });

      queryClient.invalidateQueries({
        queryKey: ["idea_draft", ideaId],
      });
    },
  });

  const { mutate: sendToOC, isPending: isLoadingToOC } = useMutation({
    mutationKey: ["send_to_oc"],
    mutationFn: async () => {
      try {
        const response = await API_CONFIG.post(
          `/api/v1/idea/send-to-oc/${selectedDraftId || inventorIdeas?.[0]?.id
          }/oc`,
          {
            instructions,
          },
        );
        if (response?.status === 200) {
          toast.success("Draft sent to Photon Legal successfully", { position: "top-center" });
          setInstructions("");
        }
      } catch (error) {
        console.error("Error sending to OC:", error);
        toast.error(error?.response?.data?.message || "Error sending to OC", { position: "top-center" });
      }
    },
    onSuccess: () => {
      setSelectedDraftId(null);

      queryClient.invalidateQueries({
        queryKey: ["ideaDetails", ideaId],
      });

      queryClient.invalidateQueries({
        queryKey: ["idea_draft", ideaId],
      });
    },
  });

  // Non-blocking co-inventor nudge shown once at submission when the idea
  // lists no co-inventors. Inventors can always skip.
  const [coInventorPromptDraftId, setCoInventorPromptDraftId] = useState<
    string | null
  >(null);

  const submitDraftToIHC = (targetDraftId: string) => {
    sendToIHC({
      ihc_id: user?.client_id ?? "",
      draft_id: targetDraftId,
    });
  };

  const handleSendToIHC = (draftId?: string) => {
    const targetDraftId = draftId ?? selectedDraftId;
    if (!targetDraftId) return;
    const hasCoInventors =
      (mainIdeaData?.IdeaInventor || []).filter(
        (x: any) => x?.inventor?.id !== user?.id,
      ).length > 0;
    if (user?.role === "INVENTOR" && !hasCoInventors) {
      setCoInventorPromptDraftId(targetDraftId);
      return;
    }
    submitDraftToIHC(targetDraftId);
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status.includes("sent to IHC")) {
      return "dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30 bg-green-100 text-green-700 border-green-300";
    }
    switch (status) {
      case "In-Draft":
        return " dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 bg-blue-100 text-blue-700 border-blue-300";
      case "Idea Rejected":
        return "dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 bg-red-100 text-red-700 border-red-300";
      default:
        return "dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30 bg-orange-100 text-orange-700 border-orange-300";
    }
  };

  // Capitalize first letter of each word
  const capitalize = (str: string): string => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleStatusChange = (e: string) => {
    if (e === "REJECTED" && user?.role === "LEGAL_COUNSEL") {
      rejectIdeaByIHC({});
    } else if (e === "UPDATE_REQUEST" && user?.role === "LEGAL_COUNSEL") {
      setShowRequestUpdateModal(true);
    }
  };

  const handleSave = async () => {
    try {
      // Prepare update payload
      const updatePayload: any = {};

      // Add title if changed
      if (title !== mainIdeaData?.title) {
        updatePayload.title = title;
      }

      // Add summary if changed
      if (
        summary !==
        (mainIdeaData?.about ||
          "This is a newly submitted idea. Add more details by creating and editing drafts below.")
      ) {
        updatePayload.about = summary;
      }

      // Save title and summary first
      if (Object.keys(updatePayload).length > 0) {
        await updateIdeaMutationAsync(updatePayload);
      }

      // Check if there are any inventor changes
      const hasInventorChanges =
        deletedInventorIds.length > 0 || extraInventors.length > 0;

      if (hasInventorChanges) {
        // Validate all inventor emails before proceeding
        if (extraInventors.length > 0) {
          const invalidEmails = extraInventors.filter(
            (inv) => inv.email.trim() && !validateEmail(inv.email.trim()),
          );

          if (invalidEmails.length > 0) {
            toast.error(
              `Please fix invalid email addresses: ${invalidEmails
                .map((inv) => inv.email)
                .join(", ")}`, { position: "top-center" }
            );
            return; // Stop saving if there are invalid emails
          }
        }

        // First, handle deletions
        if (deletedInventorIds.length > 0) {
          for (const ideaInventorId of deletedInventorIds) {
            try {
              await API_CONFIG.delete(
                `/api/v1/idea/remove/inventor/${ideaInventorId}`,
              );
            } catch (error: any) {
              console.error("Error removing inventor:", error);
              toast.error(
                error?.response?.data?.message || "Error removing inventor", { position: "top-center" }
              );
            }
          }
        }

        // Then, handle adding new inventors
        if (extraInventors.length > 0) {
          // Filter out inventors with empty email, and validate email format
          const validInventors = extraInventors.filter((inv) => {
            const hasEmail = inv.email.trim();
            const isValidEmail = hasEmail && validateEmail(inv.email.trim());

            if (hasEmail && !isValidEmail) {
              toast.error(
                `Invalid email format for ${inv.name || inv.email}`,
                { position: "top-center" },
              );
            }

            return hasEmail && isValidEmail;
          });

          if (validInventors.length > 0) {
            // Add each new inventor
            for (const inventor of validInventors) {
              try {
                let inventorId: string | null = null;
                const normalizedEmail = inventor.email.trim().toLowerCase();

                // First, check if the user already exists in the local list
                let existingInventor = inventors.find(
                  (inv) => inv.name?.toLowerCase() === normalizedEmail,
                );

                // If not found locally, fetch from API to get the latest data
                if (!existingInventor) {
                  try {
                    const inventorsResponse = await API_CONFIG.get(
                      `/api/v1/clients/fetch-all-inventors/${user?.client_id}`,
                    );
                    if (inventorsResponse?.status === 200) {
                      const data = inventorsResponse?.data?.data;
                      const formattedData = data.map((inv: any) => ({
                        id: inv?.id,
                        name: inv?.name,
                        email: inv?.email,
                      }));
                      setInventors(formattedData);
                      existingInventor = formattedData.find(
                        (inv) => inv.email?.toLowerCase() === normalizedEmail,
                      );
                    }
                  } catch (fetchError) {
                    console.error("Error fetching inventors:", fetchError);
                  }
                }

                // If user exists, use their ID
                if (existingInventor) {
                  inventorId = existingInventor.id;
                } else {
                  // User doesn't exist, invite them
                  try {
                    const inviteResponse = await API_CONFIG.post(
                      "/api/v1/auth/ihc/invite-user",
                      {

                        email: inventor.email,
                        role: "INVENTOR",
                      },
                    );

                    if (inviteResponse?.status === 200) {
                      inventorId = inviteResponse?.data?.data?.id;
                      // Update the inventors list with the new user
                      setInventors((prev) => [
                        ...prev,
                        {
                          id: inventorId!,

                        },
                      ]);
                    }
                  } catch (inviteError: any) {
                    // Check if error response contains user ID (user exists but wasn't in our list)
                    const errorData = inviteError?.response?.data;
                    if (errorData?.data?.id) {
                      inventorId = errorData.data.id;
                    } else if (errorData?.id) {
                      inventorId = errorData.id;
                    } else if (errorData?.user?.id) {
                      inventorId = errorData.user.id;
                    } else {
                      console.error("Error inviting user:", inviteError);
                      toast.error(
                        inviteError?.response?.data?.message ||
                        "Error inviting user", { position: "top-center" }
                      );
                      continue; // Skip to next inventor
                    }
                  }
                }

                // Add the inventor to the idea
                if (inventorId) {
                  try {
                    const addResponse = await API_CONFIG.post(
                      `api/v1/idea/add/inventor/${ideaId}/${inventorId}`,
                    );
                    if (addResponse?.status === 200) {
                      toast.success(
                        `Inventor ${inventor.email} added successfully`, { position: "top-center" }
                      );
                    }
                  } catch (addError: any) {
                    console.error("Error adding inventor to idea:", addError);
                    // Check if it's because they're already added
                    if (
                      addError?.response?.status === 400 ||
                      addError?.response?.status === 409
                    ) {
                      toast.info(
                        `Inventor ${inventor.email} is already associated with this idea`, { position: "top-center" }
                      );
                    } else {
                      toast.error(
                        addError?.response?.data?.message ||
                        "Error adding inventor to idea", { position: "top-center" }
                      );
                    }
                  }
                }
              } catch (error: any) {
                console.error("Unexpected error adding inventor:", error);
                toast.error(
                  error?.response?.data?.message || "Error adding inventor", { position: "top-center" }
                );
              }
            }
          }
        }

        // Invalidate queries after inventor changes
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
      }

      // Reset editing state
      setIsEditing(false);
      setExtraInventors([]);
      setDeletedInventorIds([]);
      setOriginalInventorIds([]);
      toast.success("Changes saved successfully", { position: "top-center" });
    } catch (error) {
      console.error("Error saving changes:", error, { position: "top-center" });
      toast.error("Failed to save changes", { position: "top-center" });
    }
  };

  const mapStatusCodeToLabel = (status: string) => {
    switch (status) {
      case "IN_DRAFT":
        return "In Draft";
      case "UNDER_REVIEW":
        if (user?.role === "INVENTOR")
          return "Under Review";
        else
          return "Review Pending";
      case "REJECT_BY_IHC":
        return "Rejected in Client Review";
      case "UPDATE_REQUEST":
        if (user?.role === "INVENTOR")
          return "Update Requested by Reviewers"
        else
          return "Sent back to Inventor";
      case "SEND_TO_OC":
        if (user?.role === "INVENTOR" || user?.role === "LEGAL_COUNSEL")
          return "Sent to Photon Legal";
        else
          return "Sent by Legal Counsel"
      case "REJECT_BY_OC":
        return "Rejected by OC";
      case "REJECTED":
        return "Rejected";
      case "SENT_TO_IHC":
        return user?.role === "INVENTOR" ? "Under Review" : "Review Pending";
      case "UPDATE_REQUEST_BY_OC":
        if (user?.role === "INVENTOR" || user?.role === "LEGAL_COUNSEL")
          return "Update Requested by OC";
        else
          return "Update Requested";
      case "FILED":
        return "Filed";
      default:
        return capitalize(status);
    }
  };

  const handleDownloadFiles = async () => {
    try {
      if (!selectedDraftId && !ideaDraft?.[0]?.id) {
        toast.error("No drafts available to download", { position: "top-center" });
        return;
      }

      // Using axios directly to handle binary data
      const response = await axios({
        url: `${appConfig.API_HOST_URL}/api/v1/idea/download-draft-files/${selectedDraftId || ideaDraft?.[0]?.id
          }`,
        method: "GET",
        responseType: "blob",
        withCredentials: true,
      });

      // Create a blob from the response data
      const blob = new Blob([response.data]);

      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Get filename from content-disposition header or use default name
      const contentDisposition = response.headers["content-disposition"];
      const fileName = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : `draft-files-${ideaDraft?.[0]?.id}.zip`;

      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Surface any files the server couldn't include in the zip.
      const failedRaw = response.headers["x-failed-files"];
      if (failedRaw) {
        try {
          const failed: string[] = JSON.parse(decodeURIComponent(failedRaw));
          if (failed.length) {
            toast.error(
              `Some files could not be downloaded: ${failed.join(", ")}`,
              { position: "top-center" },
            );
          }
        } catch {
          // Header malformed — ignore.
        }
      }

      // Also download the patent report if available
      const selectedDraft = ideaDraft?.find(
        (draft) => draft.id === (selectedDraftId || ideaDraft?.[0]?.id),
      );
      if (selectedDraft?.CheckDraftSoreLog?.[0]?.score_meta_data) {
        const reportData = selectedDraft.CheckDraftSoreLog[0].score_meta_data;

        // Create a result object expected by the PDF generator
        const reportResult = {
          // The PDF footer prints this as "Document ID". A draft's uuid means
          // nothing to whoever opens the file months later; the idea's
          // reference is what the workspace files it under.
          id: mainIdeaData?.reference_number || selectedDraft.id,
          score: reportData.scoringResult?.score || 0,
          report: JSON.stringify(reportData),
          scoringResult: reportData.scoringResult || {},
          status: "completed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          evaluations: reportData.evaluations || [],
          recommendations: reportData.recommendations || [],
        };

        const { generatePatentReportPDFReact } = await import("./patentReportPdf");
        const pdfOutput = await generatePatentReportPDFReact(
          reportResult,
          reportData.priorArt || [],
          user,
        );
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        pdfOutput.save(`patent-evaluation-report-${timestamp}.pdf`);

        toast.success("Patent report downloaded", { position: "top-center" });
      }
    } catch (error) {
      console.error("Error downloading files:", error);
      if (error?.response?.status === 404 || error?.response?.status === 500) {
        toast.error("No files found for this draft", { position: "top-center" });
      } else {
        toast.error("Error occured!", { position: "top-center" });
      }
    }
  };

  const { mutate: calculateScoreMutation, isPending: isAddingEvaluation } =
    useMutation({
      mutationKey: ["calculate_score"],
      mutationFn: async () => {
        try {
          const response = await API_CONFIG.get(
            `/api/v1/idea/check-score/${ideaDraft?.[0]?.id}`,
          );

          if (response.status === 200) {
            const data = response?.data?.data;
            toast.success("Evaluation underway", { position: "top-center" });
            setIsDisableScoreTransition(false);
            setEnableScorePolling(true);
          }
        } catch (error) {
          console.error("Error calculating score:", error);
          toast.error(
            error?.response?.data?.message || "Error calculating score", { position: "top-center" }
          );
        }
      },
    });

  const {
    mutate: reEvalMutate,
    isPending: isReEvalLoading,
    error: reEvalError,
    reset: resetReEval,
  } = useMutation({
    mutationKey: ["re_evaluate_patent", draftApiEvaluationId],
    mutationFn: async (patentNumbers: string[]) => {
      const response = await API_CONFIG.post(
        `/api/v1/idea/re-evaluate/${draftApiEvaluationId}`,
        { patent_numbers: patentNumbers },
      );
      return response.data;
    },
    onSuccess: () => {
      setOpenEvaluatePopup(false);
      setPatentInput("");
      toast.success("Re-evaluation started successfully.", { position: "top-center" });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
        "Failed to re-evaluate. Please try again.", { position: "top-center" }
      );
    },
  });

  // Check if score_meta_data is null to enable polling
  const shouldPollForScore = useMemo(() => {
    const scoreMetaData =
      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data;
    return scoreMetaData === null || scoreMetaData === undefined;
  }, [ideaDraft]);

  // Check if score calculation is complete (should stop polling)
  const isScoreCalculationComplete = useMemo(() => {
    const scoreMetaData =
      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data;
    if (!scoreMetaData) return false;
    return (
      scoreMetaData.status === "completed" || scoreMetaData.status === "error"
    );
  }, [ideaDraft]);

  // Track previous score_meta_data to detect when score is received
  const prevScoreMetaDataRef = useRef(
    ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data,
  );

  // Refetch idea data when score is received
  useEffect(() => {
    const currentScoreMetaData =
      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data;
    const prevScoreMetaData = prevScoreMetaDataRef.current;

    // Check if score_meta_data changed from null/undefined to having a value
    if (
      (prevScoreMetaData === null || prevScoreMetaData === undefined) &&
      currentScoreMetaData !== null &&
      currentScoreMetaData !== undefined &&
      refetchIdeaDraft
    ) {
      refetchIdeaDraft();
    }

    // Update the ref for next comparison
    prevScoreMetaDataRef.current = currentScoreMetaData;
  }, [ideaDraft, refetchIdeaDraft]);

  useQuery({
    queryKey: ["fetch_score_status", ideaDraft?.[0]?.id],
    queryFn: async () => {
      // Don't fetch if we're updating the draft
      if (isUpdatingDraftRef.current) {
        return;
      }

      try {
        const response = await API_CONFIG.get(
          `/api/v1/idea/fetch-score/${localStorage.getItem("selectedDraftID") ? localStorage.getItem("selectedDraftID") : ideaDraft?.[0]?.id}`,
        );
        if (response.status !== 200) return;
        const data = response?.data?.data;
        if (!data) {
          return;
        }

        const isExists = localStorage.getItem(`run-bg-score-${ideaId}`);

        if (
          data?.score_meta_data &&
          data?.score_meta_data?.status !== "completed"
        ) {
          setIsCalculatingScore(true);
          setIsDisableScoreTransition(true);
          setAnalysisSteps([
            {
              id: "prior-art",
              label: "Retrieving prior art",
              status: "completed",
            },
            {
              id: "similarities",
              label: "Analyzing similarities",
              status: "completed",
            },
            {
              id: "novelty",
              label: "Calculating novelty score",
              status: "completed",
            },
            {
              id: "report",
              label: "Generating report",
              status: "active",
            },
          ]);
          setScoreDialogOpen(false);
        }

        if (data.score_meta_data === null) {
          setIsCalculatingScore(true);
          setIsDisableScoreTransition(true);
          setAnalysisSteps([
            {
              id: "prior-art",
              label: "Retrieving prior art",
              status: "completed",
            },
            {
              id: "similarities",
              label: "Analyzing similarities",
              status: "completed",
            },
            {
              id: "novelty",
              label: "Calculating novelty score",
              status: "completed",
            },
            {
              id: "report",
              label: "Generating report",
              status: "active",
            },
          ]);
        }

        // Update cache whenever score_meta_data is available (not null)
        if (
          data.score_meta_data !== null &&
          data.score_meta_data !== undefined
        ) {
          if (ideaDraft?.[0]) {
            const updatedDraft = {
              ...ideaDraft[0],
              CheckDraftSoreLog: [
                {
                  ...ideaDraft[0].CheckDraftSoreLog?.[0],
                  score: data.score,
                  score_meta_data: data.score_meta_data,
                },
              ],
            };
            queryClient.setQueryData(["idea_draft", ideaId], [updatedDraft]);
          }
        }

        if (data.score !== null) {
          setIdeaScore(data.score);
          setScoreVisible(true);
          setIsCalculatingScore(false);
          setEnableScorePolling(false);
          localStorage.removeItem("selectedDraftID");
          setAnalysisSteps((prev) =>
            prev.map((step) => ({
              ...step,
              status: "completed",
            })),
          );
        }

        // Stop polling if score_meta_data is filled and calculation is done (completed/errored)
        // But keep polling if score_meta_data exists but calculation is still in progress
        if (
          data.score_meta_data !== null &&
          data.score_meta_data !== undefined &&
          (data.score_meta_data?.status === "completed" ||
            data.score_meta_data?.status === "error")
        ) {
          setEnableScorePolling(false);
        }

        if (
          data.score_meta_data !== null &&
          data.score === null &&
          data?.score_meta_data?.status === "completed"
        ) {
          setIsCalculatingScore(false);
          setIsCalculatingScore(false);
          setScoreDialogOpen(false);
          setEnableScorePolling(false);
          setIsDisableScoreTransition(true);
          setScoreCalculationError("Failed to calculate score");
        }

        if (
          data?.score_meta_data !== null &&
          data?.score === null &&
          data?.score_meta_data?.status === "error"
        ) {
          setIsScoreCalculateError(true);
        }

        if (isExists) {
          setScoreDialogOpen(false);
        }

        return response?.data?.data;
      } catch (error) {
        console.error("Error fetching score status:", error);
      }
    },
    // Enable polling when:
    // 1. enableScorePolling is true (explicit calculation)
    // 2. score_meta_data is null (waiting for score to be calculated)
    // 3. User is LEGAL_COUNSEL (but only if score calculation is not complete)
    refetchInterval:
      ((enableScorePolling || shouldPollForScore) &&
        !isUpdatingDraftRef.current) ||
        (user?.role === "LEGAL_COUNSEL" && !isScoreCalculationComplete)
        ? 5000
        : false,
    enabled:
      !!ideaDraft?.[0]?.id &&
      (((enableScorePolling || shouldPollForScore) &&
        !isUpdatingDraftRef.current) ||
        (user?.role === "LEGAL_COUNSEL" && !isScoreCalculationComplete)),
    staleTime: Infinity, // Prevent automatic refetches
  });

  const { mutate: updateDraftMutation, isPending: isUpdatingDraft } =
    useMutation({
      mutationKey: ["update_draft"],
      mutationFn: async (data: any) => {
        isUpdatingDraftRef.current = true;
        try {
          const response = await API_CONFIG.post(
            `/api/v1/idea/update/draft/${ideaDraft?.[0]?.id}`,
            data,
          );

          if (response.status === 201) {
            toast.success("Draft updated successfully", { position: "top-center" });
            // Update local state with new data
            if (ideaDraft?.[0]) {
              const updatedDraft = {
                ...ideaDraft[0],
                ...data,
                updatedAt: new Date().toISOString(),
                // Preserve the existing score data
                CheckDraftSoreLog: ideaDraft[0].CheckDraftSoreLog,
              };
              queryClient.setQueryData(["idea_draft", ideaId], [updatedDraft]);
            }
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error updating draft:", error);
          toast.error(error?.response?.data?.message || "Error updating draft", { position: "top-center" });
        } finally {
          isUpdatingDraftRef.current = false;
        }
      },
      onSuccess: () => {
        // No need to invalidate queries since we're using local state
      },
    });

  // Update useEffect to only check for background score calculation
  useEffect(() => {
    if (ideaDraft?.[0]?.id) {
      const isExists = localStorage.getItem(`run-bg-score-${ideaId}`);
      if (isExists) {
        setEnableScorePolling(true);
        setIsCalculatingScore(true);
      }
    }
  }, [ideaDraft, ideaId]);

  const handleCheckScore = () => {
    localStorage.removeItem(`run-bg-score-${ideaId}`);
    setIsCalculatingScore(true);
    if (selectedDraftId) localStorage.setItem("selectedDraftID", selectedDraftId);
    // setScoreDialogOpen(true);
    setRunningInBackground(false);
    setIsDisableScoreTransition(false);
    setEnableScorePolling(true);
    setShowPatentReportModal(false);
    setAnalysisSteps([
      {
        id: "prior-art",
        label: "Retrieving prior art",
        status: "pending",
      },
      {
        id: "similarities",
        label: "Analyzing similarities",
        status: "pending",
      },
      {
        id: "novelty",
        label: "Calculating novelty score",
        status: "pending",
      },
      {
        id: "report",
        label: "Generating report",
        status: "pending",
      },
    ]);
    calculateScoreMutation();
  };

  const handleRunInBackground = () => {
    setRunningInBackground(true);
    setScoreDialogOpen(false);
    localStorage.setItem(`run-bg-score-${ideaId}`, "YES");
    toast.info("Score calculation running in background", { position: "top-center" });
  };

  const addExtraInventor = () => {
    setExtraInventors((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", email: "" },
    ]);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const updateInventor = (
    id: string,
    field: "name" | "email",
    value: string,
  ) => {
    setExtraInventors((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)),
    );
  };

  const removeInventor = (id: string) => {
    setExtraInventors((prev) => prev.filter((inv) => inv.id !== id));
  };

  const markInventorForDeletion = (ideaInventorId: string) => {
    setDeletedInventorIds((prev) => [...prev, ideaInventorId]);
  };

  const unmarkInventorForDeletion = (ideaInventorId: string) => {
    setDeletedInventorIds((prev) => prev.filter((id) => id !== ideaInventorId));
  };

  const { mutate: updateFileMutation, isPending: isUploadingFile } =
    useMutation({
      mutationKey: ["upload_idea_file"],
      mutationFn: async (files: File[]) => {
        try {
          const { s3UploadForImport } = await import("@/lib/api-service/s3Upload");
          const uploadedFiles: { key: string; originalName: string; size: number; contentType: string }[] = [];
          for (const file of files) {
            const uploaded = await s3UploadForImport(file, "idea");
            uploadedFiles.push(uploaded);
          }
          const response = await API_CONFIG.post(
            `/api/v1/idea/upload-idea-file/${ideaId}`,
            { files: uploadedFiles },
          );

          if (response?.status === 201) {
            toast.success("Files uploaded successfully", { position: "top-center" });
          }
          return response?.data;
        } catch (error) {
          console.error("upload file Error", error);
          toast.error(
            error?.response?.data?.message || "Failed to upload file!", { position: "top-center" }
          );
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["ideaDetails", ideaId],
        });
      },
    });

  const { mutate: removeDraftFile, isPending: isDeletingFile } = useMutation({
    mutationKey: ["delete_idea_file", ideaId],
    mutationFn: async (ideaFileId: string) => {
      try {
        const response = await API_CONFIG.delete(
          `/api/v1/idea/remove-idea-file/${ideaFileId}`,
        );

        if (response.status === 200) {
          toast.success("File deleted successfully", { position: "top-center" });
          queryClient.invalidateQueries({
            queryKey: ["ideaDetails", ideaId],
          });
        }
      } catch (error) {
        console.error("Error deleting file:", error);
        toast.error(
          error?.response?.data?.message || "Error deleting file", { position: "top-center" }
        );
      } finally {
        setDeletingFileId(null);
      }
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (file?.size >= MAX_FILE_SIZE) {
        toast.error("File must be less than 1GB", { position: "top-center" });
        return;
      }
      validFiles.push(file);
    }

    updateFileMutation(validFiles);
  };

  const handleRemoveFile = (fileId: string) => {
    setDeletingFileId(fileId);
    removeDraftFile(fileId);
  };

  useEffect(() => {
    if (!Array.isArray(ideaDraft) || !ideaDraft.length) return;
    // The disclosure pane must show the draft that was SENT, not whichever row
    // the API returned first. An idea can carry several drafts, and reading
    // [0] rendered an empty 0%-complete one beside a populated summary —
    // "the disclosure is blank" with the content sitting right there.
    const preferred =
      ideaDraft.find((d: any) => d?.status === "SUBMITTED") ??
      [...ideaDraft].sort(
        (a: any, b: any) =>
          new Date(b?.updatedAt || b?.updated_at || 0).getTime() -
          new Date(a?.updatedAt || a?.updated_at || 0).getTime(),
      )[0];
    if (preferred?.meta_data) setSections(preferred.meta_data);
  }, [ideaDraft]);

  // Autosave must only run after a real user edit — `sections` also changes
  // when it is initialized from the fetched draft on mount, and saving then
  // fires a spurious "Draft updated successfully" toast on page load.
  const hasUserEditedRef = useRef(false);

  const handleAnswerChange = (
    sectionId: string,
    questionId: string,
    value: string,
  ) => {
    hasUserEditedRef.current = true;
    setSections((prevSections) =>
      prevSections.map((section) =>
        section.id === sectionId
          ? {
            ...section,
            questions: section.questions.map((question) =>
              question.id === questionId
                ? {
                  ...question,
                  answer: value,
                }
                : question,
            ),
          }
          : section,
      ),
    );
  };

  useEffect(() => {
    // Calculate completion percentage
    if (!mainIdeaData || !user) return;
    if (!hasUserEditedRef.current) return;

    if (user?.role !== "INVENTOR" && !isOutsideCounselRole(user?.role)) {
      if (
        user?.role === "LEGAL_COUNSEL" &&
        mainIdeaData?.created_by_id !== user?.id
      ) {
        const saveTimer = setTimeout(() => {
          const totalQuestions = sections.reduce(
            (acc, section) => acc + section.questions.length,
            0,
          );
          const answeredQuestions = sections.reduce((acc, section) => {
            return (
              acc +
              section.questions.filter((q) => q.answer.trim().length > 0).length
            );
          }, 0);
          const percentage = Math.round(
            (answeredQuestions / totalQuestions) * 100,
          );
          if (
            mainIdeaData?.created_by_id !== user?.id &&
            mainIdeaData?.status === "UNDER_REVIEW"
          ) {
            updateDraftMutation({
              meta_data: sections,
              completion_percentage: Number(percentage),
            });
          }
        }, 1500);

        return () => clearTimeout(saveTimer);
      }
    }
  }, [sections, user, mainIdeaData]);

  const handleReEvalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetReEval();
    // Split by comma or newline, trim, and filter empty
    const patentNumbers = patentInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (patentNumbers.length === 0) {
      toast.error("Please enter at least one patent number.", { position: "top-center" });
      return;
    }
    reEvalMutate(patentNumbers);
  };

  const renderAnalysisStep = (step: AnalysisStep, index: number) => {
    const stepIcon = () => {
      switch (step.status) {
        case "completed":
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        case "active":
          return <Circle className="h-4 w-4 text-photon-light animate-pulse" />;
        default:
          return <Circle className="h-4 w-4 text-gray-300" />;
      }
    };
    return (
      <div
        key={step.id}
        className={`flex items-center gap-3 p-3 rounded-md ${step.status === "active" ? "bg-primary/10" : ""
          }`}
      >
        {stepIcon()}
        <span
          className={`${step.status === "active"
            ? "text-photon-light font-medium"
            : step.status === "completed"
              ? "text-gray-700"
              : "text-gray-400"
            }`}
        >
          {step.label}
        </span>
      </div>
    );
  };

  const getSupportingFilesSection = () => {
    return (
      <div
        id="supporting-files"
        className={`mb-10 border rounded-lg ${theme === "dark" ? "bg-zinc-900 border-[#cccccc20]" : "bg-white"
          }`}
      >
        <div className="px-6 py-4">
          <h2
            className={`text-md font-semibold tracking-wide ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"
              }`}
          >
            Supporting FIles
          </h2>
          <div
            className={`text-xs font-sans mt-1 uppercase font-normal ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"
              }`}
          >
            Optional • Diagrams, documents, etc.
          </div>
        </div>
        <Separator
          className={`mb-6 h-[0.5px] opacity-50 ${theme === "dark" ? "bg-[#cccccc20]" : "bg-gray-400"
            }`}
        />

        <div className="px-6 py-4 mb-5">
          <p
            className={`text-xs mb-3 ${theme === "dark" ? "text-neutral-400" : "text-neutral-500"
              }`}
          >
            Visible across all drafts of this idea.
          </p>
          {!["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
            mainIdeaData?.status,
          ) && (
              <>
                <div
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className={`w-full border-2 border-dashed cursor-pointer ${theme === "dark"
                    ? "bg-[#cccccc20] border-[#cccccc20]"
                    : "bg-[#cccccc10] border-gray-300 hover:bg-gray-50"
                    } rounded-lg p-6 text-center transition-colors`}
                >
                  <Upload className="mx-auto h-6 w-6 text-gray-500 mb-3" />
                  <p
                    className={`${theme === "dark" ? "text-gray-300" : "text-gray-700"
                      } mb-2 text-sm`}
                  >
                    Click to upload supporing documents
                  </p>
                  <p
                    className={`${theme === "dark" ? "text-gray-400" : "text-gray-500"
                      } text-xs mb-4`}
                  >
                    PDF, DOC,images, diagrams, etc.
                  </p>
                  <div>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileUpload}
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    />
                  </div>
                </div>
              </>
            )}

          {mainIdeaData?.IdeaFiles?.length > 0 && (
            <div className="space-y-2 w-full mt-4">
              {mainIdeaData?.IdeaFiles?.map((file: any, index: number) => (
                <div
                  key={file?.id ?? index}
                  className={`flex w-full items-center justify-between p-3 rounded border ${theme === "dark"
                    ? "border-white/10 bg-white/5"
                    : "border-neutral-200 bg-neutral-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText
                      className={`w-4 h-4 ${theme === "dark"
                        ? "text-neutral-400"
                        : "text-neutral-600"
                        }`}
                    />
                    <span
                      className={`text-sm ${theme === "dark"
                        ? "text-neutral-300"
                        : "text-neutral-700"
                        }`}
                    >
                      {file.original_name}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        window.open(
                          assetUrl(file.file_path),
                          "_blank",
                        )
                      }
                      className={`p-1.5 rounded transition-colors ${theme === "dark"
                        ? "hover:bg-white/10 text-neutral-400 hover:text-neutral-200"
                        : "hover:bg-neutral-200 text-neutral-500 hover:text-neutral-700"
                        }`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {!["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                      mainIdeaData?.status,
                    ) && (
                        <button
                          onClick={() => {
                            const confirmDelete = window.confirm(
                              "Are you sure you want to delete this file?",
                            );
                            if (confirmDelete) {
                              handleRemoveFile(file?.id);
                            }
                          }}
                          disabled={isDeletingFile && deletingFileId === file?.id}
                          className={`p-1.5 rounded transition-colors ${theme === "dark"
                            ? "hover:bg-red-500/10 text-neutral-400 hover:text-red-400"
                            : "hover:bg-red-50 text-neutral-500 hover:text-red-600"
                            }`}
                        >
                          {isDeletingFile && deletingFileId === file?.id ? (
                            <LoaderCircle className="h-4 w-4 text-gray-500 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // The disclosure under review is the most recently updated draft.
  //
  // This used to require EXACTLY one draft. That held for the design's mock
  // data, where every idea has a single draft, but a real disclosure is often
  // revised: 30 of the imported ideas carry several, 9 of them sitting in a
  // review state. For those, a reviewer fell through to the inventor's
  // draft-card layout and had no approve, request-changes or reject at all —
  // the idea simply could not be actioned.
  const reviewDraft = (() => {
    if (!Array.isArray(ideaDraft) || !ideaDraft.length) return undefined;
    const byRecency = [...ideaDraft].sort(
      (a: any, b: any) =>
        new Date(b?.updatedAt || b?.updated_at || 0).getTime() -
        new Date(a?.updatedAt || a?.updated_at || 0).getTime(),
    );
    // Prefer the draft the inventor actually SENT. An inventor may keep working
    // on another draft after submitting one, so "most recent" is not the same
    // thing — it picks the wrong draft in 4 of the 14 imported multi-draft
    // ideas, showing the reviewer something that was never submitted.
    return byRecency.find((d: any) => d?.status === "SUBMITTED") ?? byRecency[0];
  })();

  const isReviewWorkspace =
    !!reviewDraft &&
    reviewDraft?.idea?.status !== "IN_DRAFT" &&
    reviewDraft?.idea?.clientId === user?.client_id &&
    ["LEGAL_COUNSEL", "TECH_COMMITTEE"].includes(user?.role ?? "") &&
    user?.id !== reviewDraft?.idea?.created_by_id;

  // Two-stage chain: the committee acts at UNDER_REVIEW, counsel at
  // SENT_TO_IHC. Counsel used to be offered UNDER_REVIEW as well, on the
  // theory that a client with no committee needs it — but an idea only ever
  // REACHES that state when the client HAS a committee (review-chain
  // firstStage), so the concession bought nothing and every decision taken
  // through it came back 403 "You cannot review at this stage". The queue has
  // gated this correctly since the last round; the detail page, which is what
  // every link in the product opens, did not. See findings.md F-045.
  const isUnderCommitteeReview =
    mainIdeaData?.status?.toUpperCase() === "UNDER_REVIEW";
  const isReviewPending =
    user?.role === "TECH_COMMITTEE"
      ? isUnderCommitteeReview
      : mainIdeaData?.status?.toUpperCase() === "SENT_TO_IHC";

  const isOCReadOnlyWorkspace =
    isOutsideCounselRole(user?.role) &&
    mainIdeaData?.status?.toUpperCase() !== "IN_DRAFT";
  const isInventorDraftWorkspace =
    user?.role === "INVENTOR" &&
    mainIdeaData?.status?.toUpperCase() === "IN_DRAFT";
  const isInventorOverview =
    user?.role === "INVENTOR" && !isInventorDraftWorkspace;
  const useDisclosureWorkspace =
    isReviewWorkspace || isOCReadOnlyWorkspace;

  const inventorDrafts = Array.isArray(ideaDraft)
    ? [...ideaDraft].sort(
        (a: any, b: any) =>
          new Date(b?.updatedAt || 0).getTime() -
          new Date(a?.updatedAt || 0).getTime(),
      )
    : [];
  const latestInventorDraft = inventorDrafts[0];
  const latestScoreReport =
    latestInventorDraft?.CheckDraftSoreLog?.[0]?.score_meta_data;

  useEffect(() => {
    if (
      isInventorDraftWorkspace &&
      latestInventorDraft?.id &&
      ideaId
    ) {
      navigate(
        `/ideas/${ideaId}/draft?draftId=${latestInventorDraft.id}`,
        { replace: true },
      );
    }
  }, [ideaId, isInventorDraftWorkspace, latestInventorDraft?.id, navigate]);

  const inventorStatus = (() => {
    switch (mainIdeaData?.status?.toUpperCase()) {
      case "UNDER_REVIEW":
      case "SENT_TO_IHC":
        return {
          eyebrow: "No action needed",
          title: "Your idea is in review",
          description:
            "They are reviewing the submission. We’ll email you when a decision is made.",
          needsAction: false,
        };
      case "SEND_TO_OC":
        return {
          eyebrow: "No action needed",
          title: "Your idea is with Photon Legal",
          description:
            "Photon Legal is assessing the next filing steps. We’ll email you when the review progresses.",
          needsAction: false,
        };
      case "UPDATE_REQUEST":
      case "UPDATE_REQUEST_BY_OC":
        return {
          eyebrow: "Your input is needed",
          title: "More information has been requested",
          description:
            "Review the request and update your draft so the evaluation can continue.",
          needsAction: true,
        };
      case "FILED":
        return {
          eyebrow: "No action needed",
          title: "Your patent application has been filed",
          description:
            "Examination can take time. We’ll keep you informed as the application progresses.",
          needsAction: false,
        };
      case "GRANTED":
        return {
          eyebrow: "Complete",
          title: "Your idea is now a granted patent",
          description:
            "The application has completed prosecution and the patent has been granted.",
          needsAction: false,
        };
      case "REJECT_BY_IHC":
      case "REJECT_BY_OC":
      case "REJECTED":
        return {
          eyebrow: "Review complete",
          title: "This idea will not proceed at this time",
          description:
            "You can review the record and evaluation for the decision context.",
          needsAction: false,
        };
      default:
        return {
          eyebrow: "Status update",
          title: "Your idea is being processed",
          description: "We’ll notify you when the status changes.",
          needsAction: false,
        };
    }
  })();

  const ocWorkflowStatus: OCWorkflowStatus =
    mainIdeaData?.status?.toUpperCase() === "FILED"
      ? "FILED"
      : mainIdeaData?.oc_workflow_status || "UNDER_REVIEW";
  const ocWorkflowLabel =
    OC_WORKFLOW_OPTIONS.find(
      (option) => option.value === ocWorkflowStatus,
    )?.label || "Under Review";

  const handleOCWorkflowChange = (next: string) => {
    const status = next as OCWorkflowStatus;
    if (status === ocWorkflowStatus) return;
    if (status === "FILED") {
      setShowFileIdeaModal(true);
      return;
    }
    // There IS no free status write on the photon side — the API's one OC
    // transition is SENT_TO_PHOTON -> FILED, through the filing flow above.
    // The old branch PUT to a rule the adapter answers with a read, so the
    // toast said "Status updated" while nothing changed and the next refetch
    // put the real state back. Say so instead of pretending.
    toast.info("Status moves on its own as the idea progresses — the one action here is filing it.");
  };

  return (
    /* h-screen is the full viewport, but this sits 64px below the top of it —
       so the page overhung by exactly that, and overflow-hidden meant the tail
       of a long disclosure was unreachable rather than merely below the fold.
       h-full + min-h-0 fills the space the layout actually gives it. */
    <div className="pulse-product-page relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
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

      {/* Header Section with Gradient */}
      <motion.div
        className={`w-full px-6 py-6 border-b backdrop-blur-sm ${theme === "dark"
          ? "bg-[#0c0c0c]/80 border-[#cccccc20]"
          : "bg-white/80 border-photon-gray-300"
          } sticky top-0 z-10`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`${theme === "dark" ? "text-zinc-500" : "text-gray-600"
              } text-sm font-sans tracking-wide`}
          >
            {/* The reference, not the uuid. A uuid is not an identity anyone
                can read down a phone or spot twice in a list; the workspace's
                own reference is. Older ideas are backfilled server-side, so
                the fallback is the title rather than the raw id. */}
            Ideas <span className="mx-1 text-gray-500">/</span>{" "}
            {mainIdeaData?.reference_number || mainIdeaData?.title || ""}
          </span>
        </div>
        <div className="mt-5 flex items-center gap-7">
          <div>
            <motion.span
              className={`text-2xl font-bold ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                }`}
            >
              {mainIdeaData?.title || "-"}
            </motion.span>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-[#444444] dark:text-neutral-400">
              <StatusChip
                status={mainIdeaData?.status?.toUpperCase()}
                label={mapStatusCodeToLabel(mainIdeaData?.status?.toUpperCase())}
              />
              {user?.role !== "INVENTOR" &&
                mainIdeaData?.IdeaInventor?.[0]?.inventor?.name && (
                <>
                  <span className="text-[#C8C8C8]">·</span>
                  <span>
                    {mainIdeaData.IdeaInventor[0].inventor.name}{" "}
                    <span className="text-[#727272]">(primary)</span>
                  </span>
                </>
              )}
              {mainIdeaData?.submission_date && (
                <>
                  <span className="text-[#C8C8C8]">·</span>
                  <span>
                    Submitted{" "}
                    {moment(mainIdeaData.submission_date).format("MMM D, YYYY")}
                  </span>
                </>
              )}
              {(mainIdeaData?.IdeaFiles?.length || 0) > 0 && (
                <>
                  <span className="text-[#C8C8C8]">·</span>
                  <button
                    onClick={handleDownloadFiles}
                    disabled={!selectedDraftId && !ideaDraft?.[0]?.id}
                    className="inline-flex items-center gap-1 text-[#444444] transition-colors hover:text-[#0C0C0C] disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400"
                  >
                    {mainIdeaData.IdeaFiles.length} file
                    {mainIdeaData.IdeaFiles.length === 1 ? "" : "s"}
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isOCReadOnlyWorkspace && (
            <div className="ml-auto self-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isUpdatingOCStatus}
                    className="inline-flex h-10 min-w-[190px] items-center justify-between gap-3 rounded-xl border border-[#E8E8E8] bg-white px-3.5 text-[13px] font-medium text-[#444444] transition-colors hover:border-[#C8C8C8] hover:text-[#0C0C0C] disabled:cursor-wait disabled:opacity-60"
                    aria-label={`OC workflow status: ${ocWorkflowLabel}`}
                  >
                    <span className="flex items-center gap-2">
                      <CircleCheck className="h-4 w-4 text-[#727272]" />
                      <span>Status: {ocWorkflowLabel}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#727272]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Update status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={ocWorkflowStatus}
                    onValueChange={handleOCWorkflowChange}
                  >
                    {/* Filing is the only transition this side owns; the
                        other three describe where the idea already is. They
                        used to be selectable and answered with a toast, which
                        is a menu that argues with you — they are disabled now,
                        and the note below says who moves them. */}
                    {OC_WORKFLOW_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                        disabled={
                          option.value !== "FILED" &&
                          option.value !== ocWorkflowStatus
                        }
                        className={
                          option.value === "FILED" ||
                          option.value === ocWorkflowStatus
                            ? "cursor-pointer"
                            : "cursor-not-allowed opacity-60"
                        }
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                    <p className="border-t border-[var(--pulse-line)] px-2 py-2 text-xs text-[var(--pulse-ink-muted)]">
                      Stages advance on their own as the idea progresses. Filing
                      is the one action taken here.
                    </p>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {isReviewWorkspace && user?.role !== "TECH_COMMITTEE" && isUnderCommitteeReview && (
            <p className="ml-auto self-center rounded-lg border border-dashed border-[var(--pulse-line-strong)] bg-[var(--pulse-surface-subtle)] px-4 py-2.5 text-sm text-[var(--pulse-ink-muted)]">
              Under Tech Committee review — it reaches your queue once the committee sends it on.
            </p>
          )}

          {isReviewWorkspace && isReviewPending && (
            <div className="ml-auto flex items-center gap-3 self-center">
              {isReviewWorkspace && isReviewPending && (
                <button
                  type="button"
                  disabled={isLoadingToOC}
                  onClick={() => setOpenSendToOCModal(true)}
                  className="flex h-9 items-center gap-2 rounded-xl bg-[#F9B418] px-5 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {user?.role === "TECH_COMMITTEE" ? "Send to Legal Counsel" : "Send to Photon Legal"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <Button
                className={`h-9 gap-2 !bg-transparent hover:!bg-transparent transition-colors border ${theme === "light"
                  ? "!border-gray-200 hover:!border-[#F9B418] text-gray-600 hover:text-[#F9B418]"
                  : "!border-neutral-800 hover:!border-[#F9B418]/50 text-neutral-400 hover:text-[#F9B418]"
                  }`}
                size="sm"
                onClick={() => setShowRequestUpdateModal(true)}
                disabled={
                  isOutsideCounselRole(user?.role)
                    ? [
                      "REJECT_BY_OC",
                      "REJECT_BY_IHC",
                      "UNDER_REVIEW",
                      "UPDATE_REQUEST",
                      "UPDATE_REQUEST_BY_OC",
                    ].includes(mainIdeaData?.status)
                    : [
                      "REJECT_BY_OC",
                      "REJECT_BY_IHC",
                      "UPDATE_REQUEST",
                      "SEND_TO_OC",
                      "UPDATE_REQUEST_BY_OC",
                    ].includes(mainIdeaData?.status)
                }
              >
                <MessageSquare size={14} /> Request Update
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${theme === "light"
                      ? "border-gray-200 text-gray-600 hover:bg-[#F5F5F5]"
                      : "border-neutral-800 text-neutral-400 hover:bg-white/5"
                      }`}
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-[#8E2B25] focus:text-[#8E2B25]"
                    disabled={
                      isOutsideCounselRole(user?.role)
                        ? [
                          "REJECT_BY_OC",
                          "REJECT_BY_IHC",
                          "UPDATE_REQUEST",
                          "UNDER_REVIEW",
                          "UPDATE_REQUEST_BY_OC",
                        ].includes(mainIdeaData?.status)
                        : [
                          "REJECT_BY_OC",
                          "REJECT_BY_IHC",
                          "UPDATE_REQUEST",
                          "SEND_TO_OC",
                          "UPDATE_REQUEST_BY_OC",
                        ].includes(mainIdeaData?.status)
                    }
                    onClick={() => setOpenRejectIdeaModal(true)}
                  >
                    <TriangleAlert className="mr-2 h-4 w-4" />
                    {isRejectingIdeaByIHC ? "Rejecting..." : "Reject idea"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </motion.div>

      {/* Status timeline — inventor view only for now; directly under the
          title, above the disclosure. Admin gets the same component later
          with the review action attached to the current node. */}
      {user?.role === "INVENTOR" && !isFetchingIdea && mainIdeaData && (
        <StatusTimeline
          idea={mainIdeaData}
          onAction={() => setShowViewContentsModal(true)}
          showStatusLine={false}
        />
      )}

      {isFetchingIdea ? (
        <Loader />
      ) : isInventorOverview ? (
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto bg-[var(--pulse-canvas)] pb-10">
          <div className="mx-auto w-full max-w-[1160px] px-6 py-8">
            <section className="overflow-hidden rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] [box-shadow:var(--pulse-shadow-card)]">
              <div className="flex items-start gap-4 border-l-4 border-l-[#F9B418] px-6 py-5">
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    inventorStatus.needsAction
                      ? "bg-[#FAF1DA] text-[#7E5A00]"
                      : "bg-[#E9F1EC] text-[#1E7B4D]"
                  }`}
                >
                  {inventorStatus.needsAction ? (
                    <Info className="h-4 w-4" />
                  ) : (
                    <CircleCheck className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.08em] ${
                      inventorStatus.needsAction
                        ? "text-[#7E5A00]"
                        : "text-[#1E7B4D]"
                    }`}
                  >
                    {inventorStatus.eyebrow}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em] text-[var(--pulse-ink)]">
                    {inventorStatus.title}
                  </h2>
                  <p className="mt-1 max-w-[720px] text-sm text-[var(--pulse-ink-secondary)]">
                    {inventorStatus.description}
                  </p>
                </div>
                {inventorStatus.needsAction && (
                  <button
                    type="button"
                    onClick={() => setShowViewContentsModal(true)}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#F9B418] px-4 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#DA9700]"
                  >
                    View request <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </section>

            {isFechingIdeaDraft ? (
              <div className="py-20">
                <Loader />
              </div>
            ) : latestInventorDraft ? (
              <>
                <div className="mt-6 flex w-full flex-col items-start gap-6 lg:flex-row">
                  <main className="w-full lg:w-[60%]">
                    <PatentPaperView
                      title={mainIdeaData?.title}
                      irn={mainIdeaData?.id?.toUpperCase()}
                      submissionDate={
                        mainIdeaData?.submission_date
                          ? moment(mainIdeaData.submission_date).format(
                              "MMM D, YYYY",
                            )
                          : undefined
                      }
                      sections={sections}
                      panelLabel="Your submission"
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-[var(--pulse-ink-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CircleCheck className="h-3.5 w-3.5 text-[#1E7B4D]" />
                        Submitted version
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Updated {moment(latestInventorDraft.updatedAt).format("MMM D, YYYY")}
                      </span>
                    </div>
                  </main>

                  <aside className="w-full lg:sticky lg:top-4 lg:w-[40%]">
                    {latestScoreReport ? (
                      <div className="overflow-hidden rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)]">
                        <div className="border-b border-[var(--pulse-line)] bg-[var(--pulse-surface-subtle)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">
                          AI evaluation
                        </div>
                        <div className="px-5 py-5">
                          <PatentNoveltyReport
                            reference={mainIdeaData?.reference_number}
                            embedded
                            expandFirstReference={false}
                            title={mainIdeaData?.title}
                            api_evaluation_id={latestScoreReport?.id}
                            scoringResult={latestScoreReport?.scoringResult}
                            priorArt={latestScoreReport?.priorArt || []}
                            report={latestScoreReport}
                          />
                        </div>
                      </div>
                    ) : (
                      <section className="pulse-content-card p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--pulse-ink-muted)]">
                          AI evaluation
                        </p>
                        <p className="mt-3 text-sm text-[var(--pulse-ink-secondary)]">
                          No evaluation is available for this submission yet.
                        </p>
                      </section>
                    )}
                  </aside>
                </div>

                {(mainIdeaData?.IdeaFiles?.length || 0) > 0 && (
                  <section className="pulse-content-card mt-6 flex items-center justify-between gap-5 px-6 py-5">
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--pulse-ink)]">
                        Attachments
                      </h2>
                      <p className="mt-1 text-xs text-[var(--pulse-ink-muted)]">
                        {mainIdeaData.IdeaFiles.length} supporting file
                        {mainIdeaData.IdeaFiles.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadFiles}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--pulse-line)] px-3.5 text-sm font-medium text-[var(--pulse-ink-secondary)] hover:border-[var(--pulse-line-strong)] hover:text-[var(--pulse-ink)]"
                    >
                      <Download className="h-4 w-4" /> Download files
                    </button>
                  </section>
                )}

                {inventorDrafts.length > 1 && (
                  <details className="pulse-content-card mt-6 overflow-hidden">
                    <summary className="cursor-pointer list-none px-6 py-5 text-sm font-semibold text-[var(--pulse-ink)]">
                      Version history · {inventorDrafts.length} versions
                    </summary>
                    <div className="border-t border-[var(--pulse-line)] px-6 py-2">
                      {inventorDrafts.slice(1).map((draft: any, index: number) => (
                        <button
                          key={draft.id}
                          type="button"
                          onClick={() => handleEditDraft(draft.id)}
                          className="flex w-full items-center justify-between border-b border-[var(--pulse-line)] py-3 text-left text-sm last:border-0"
                        >
                          <span className="font-medium text-[var(--pulse-ink)]">
                            Version {inventorDrafts.length - index - 1}
                          </span>
                          <span className="text-xs text-[var(--pulse-ink-muted)]">
                            {moment(draft.updatedAt).format("MMM D, YYYY")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <section className="pulse-content-card mt-6 px-6 py-12 text-center">
                <FileText className="mx-auto h-6 w-6 text-[var(--pulse-ink-muted)]" />
                <h2 className="mt-3 text-base font-semibold text-[var(--pulse-ink)]">
                  No submission is available
                </h2>
                <p className="mt-1 text-sm text-[var(--pulse-ink-secondary)]">
                  The submitted record will appear here when it is ready.
                </p>
              </section>
            )}
          </div>
        </div>
      ) : useDisclosureWorkspace ? (
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-10">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start gap-8 px-6 py-8 lg:flex-row">
            {/* Disclosure — primary reading pane */}
            <div className="w-full lg:w-[60%]">
              {isFechingIdeaDraft ? (
                <Loader />
              ) : (
                <PatentPaperView
                  title={mainIdeaData?.title}
                  irn={mainIdeaData?.id?.toUpperCase()}
                  inventors={(mainIdeaData?.IdeaInventor || [])
                    .map((x: any) => x?.inventor?.name)
                    .filter(Boolean)}
                  submissionDate={
                    mainIdeaData?.submission_date
                      ? moment(mainIdeaData.submission_date).format(
                          "MMM D, YYYY",
                        )
                      : undefined
                  }
                  sections={sections}
                />
              )}
            </div>

            {/* Evidence rail */}
            <div className="w-full lg:sticky lg:top-4 lg:w-[40%]">
              {/* Review checklist: co-inventors are collected from the
                  inventor without blocking — surfaced here for IHC. */}
              {(() => {
                const coInvs = (mainIdeaData?.IdeaInventor || []).filter(
                  (x: any) => x?.inventor?.id !== mainIdeaData?.created_by_id,
                );
                return (
                  <div className="mb-4 flex items-center justify-between rounded-xl border border-[#E8E8E8] bg-white px-4 py-3">
                    <span className="text-[13px] font-medium text-[#0C0C0C]">
                      Co-inventors
                    </span>
                    <span className="text-xs text-[#727272]">
                      {coInvs.length > 0
                        ? coInvs
                            .map((x: any) => x?.inventor?.name)
                            .filter(Boolean)
                            .join(", ")
                        : "None listed — confirm with inventor"}
                    </span>
                  </div>
                );
              })()}
              {ideaDraft?.[0]?.api_evaluation_id &&
                !ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data && (
                <div className="mb-4 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[1px] text-[#444444]">
                    Patent Analysis Report
                  </div>
                  <div className="flex items-center gap-3 px-4 py-5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#F9B418]" />
                    <div>
                      <p className="text-sm font-medium text-[#0C0C0C]">Evaluation in progress…</p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#727272]">
                        {mainIdeaData?.reference_number ? `${mainIdeaData.reference_number} · ` : ""}prior-art search and scoring usually take a few minutes
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data && (
                <div className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[1px] text-[#444444]">
                    Patent Analysis Report
                  </div>
                  <PatentNoveltyReport
                    reference={mainIdeaData?.reference_number}
                    title={mainIdeaData?.title}
                    api_evaluation_id={
                      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                        ?.id
                    }
                    scoringResult={
                      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                        ?.scoringResult
                    }
                    priorArt={
                      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                        ?.priorArt
                    }
                    report={
                      ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-1 h-[calc(100vh-2.5rem)]">
          <motion.div
            className={`${isInventorDraftWorkspace ? "hidden" : "w-[48%]"} h-[calc(100vh)] border-r backdrop-blur-sm ${theme === "dark"
              ? "bg-#f9f7f8 border-[#cccccc20]"
              : "bg-neutral-50 border-photon-gray-300"
              } flex flex-col sticky left-0`}
          >
            <div className="p-6 pt-8 pb-44 flex-1 overflow-auto">
              {ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data &&
                mainIdeaData?.status?.toUpperCase() !== "IN_DRAFT" &&
                (user?.role === "LEGAL_COUNSEL" || isOutsideCounselRole(user?.role)) && (
                  <div className="mb-8 overflow-hidden rounded-xl border border-[#E8E8E8] bg-white">
                    <div className="border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[1px] text-[#444444]">
                      Patent Analysis Report
                    </div>
                    <PatentNoveltyReport
                    reference={mainIdeaData?.reference_number}
                      title={mainIdeaData?.title}
                      api_evaluation_id={
                        ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                          ?.id
                      }
                      scoringResult={
                        ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                          ?.scoringResult
                      }
                      priorArt={
                        ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                          ?.priorArt
                      }
                      report={
                        ideaDraft?.[0]?.CheckDraftSoreLog?.[0]?.score_meta_data
                      }
                    />
                  </div>
                )}
            </div>

          </motion.div>


          <motion.div
            className={`${isInventorDraftWorkspace ? "w-full max-w-[960px]" : "w-[70%]"} mx-auto flex flex-col h-full backdrop-blur-sm ${theme === "dark" ? "bg-black/40" : "bg-neutral-50"
              }`}
          >
            <div className=" flex flex-col h-full overflow-y-auto mb-20">
              <div
                className={`${theme === "dark" ? "bg-black" : "bg-neutral-50"
                  } flex items-center justify-between sticky top-0 z-10 h-20 px-6 mt-1`}
              >
                <div />
                <div className="flex flex-row gap-2 items-center">
                  <div
                    className={`${theme === "dark" ? "bg-transparent" : "bg-transparent"
                      } py-4 flex justify-center sticky bottom-0 gap-4 `}
                  >
                    {(user?.role === "INVENTOR" ||
                      (user?.role !== "INVENTOR" &&
                        mainIdeaData?.status?.toUpperCase() ===
                        "IN_DRAFT")) && (
                        <Button
                          className={`flex items-center gap-2 px-4 py-2 rounded-md h-9 border transition-colors bg-transparent hover:bg-transparent ${theme === "dark"
                            ? "border-neutral-800 hover:border-[#F5A623]/50 text-neutral-400"
                            : "border-gray-200 hover:border-[#F5A623] text-neutral-600"
                            } hover:text-[#F5A623]`}
                          type="button"
                          disabled={isAddingDraft}
                          onClick={handleCreateDraft}
                        >
                          <Plus className="h-4 w-4" />
                          <span className="text-sm font-sans">
                            {isAddingDraft ? "Creating..." : "Create New Draft"}
                          </span>
                        </Button>
                      )}

                    {/* Same stage gate as the header action: this second
                        "Send To OC" had none at all, so it stayed clickable on
                        a committee-stage idea and 403'd exactly like the
                        first one. */}
                    {selectedDraftId && user?.role === "LEGAL_COUNSEL" && isReviewPending && (
                      <Button
                        className={` bg-[#F9B418] font-semibold h-9 font-sans ${theme === "dark"
                          ? "text-neutral-900 hover:bg-[#F9B418]"
                          : "text-gray-900 hover:bg-[#F9B418]"
                          } gap-2 rounded-lg`}
                        type="button"
                        disabled={!selectedDraftId}
                        onClick={() => setOpenSendToOCModal(true)}
                      >
                        Send To OC
                      </Button>
                    )}
                  </div>

                  {/* {mainIdeaData?.IdeaInventor?.find(
                    (inv: any) => inv?.inventor?.id === user?.id
                  ) &&
                    !["IN_DRAFT"]?.includes(mainIdeaData?.status) && (
                      <span className="text-sm text-blue-500 flex items-center gap-1">
                        <Info className="h-4 w-4" />
                        Request Update from Inventor
                      </span>
                    )} */}
                </div>
              </div>


              {isFechingIdeaDraft ? (
                <Loader />
              ) : ideaDraft?.length === 0 ? (
                <EmptyDraftsView onCreateDraft={handleCreateDraft} />
              ) : ideaDraft?.length === 1 &&
                ideaDraft?.[0]?.idea?.send_to_oc_id === user?.client_id &&
                isOutsideCounselRole(user?.role) ? (
                <OCDraftView theme={theme} ideaDraft={ideaDraft} />
              ) : (
                <DraftListView
                  inventorIdeas={inventorIdeas}
                  selectedDraftId={selectedDraftId}
                  submittedDraftId={submittedDraftId}
                  mainIdeaData={mainIdeaData}
                  handleDraftSelection={handleDraftSelection}
                  handleEditDraft={handleEditDraft}
                  handleCopyDraft={handleCopyDraft}
                  setDraftReport={setDraftReport}
                  setShowPatentReportModal={setShowPatentReportModal}
                  mapStatusCodeToLabel={mapStatusCodeToLabel}
                  handleCreateDraft={handleCreateDraft}
                  isAddingDraft={isAddingDraft}
                  setDraftApiEvaluationId={setDraftApiEvaluationId}
                  setDraftId={setSelectedDraftId}
                  setSelectedDraftForReport={setSelectedDraftForReport}
                  draftIdBeingCalculated={
                    isCalculatingScore || enableScorePolling
                      ? selectedDraftId
                      : null
                  }
                  userRole={user?.role}
                  onSendToIHC={handleSendToIHC}
                  isSendingToIHC={isSendingToIHC}
                  draftIdBeingSentToIHC={sendToIHCVariables?.draft_id ?? null}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Non-blocking co-inventor prompt at submission */}
      <AlertDialog
        open={!!coInventorPromptDraftId}
        onOpenChange={(o) => !o && setCoInventorPromptDraftId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Anyone else contribute to this idea?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Add co-inventors so they're credited from the start. You can also
              skip this — co-inventors can be added later in the draft
              workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const draftId = coInventorPromptDraftId!;
                setCoInventorPromptDraftId(null);
                submitDraftToIHC(draftId);
              }}
            >
              Skip & submit
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#F9B418] font-semibold text-[#0C0C0C] hover:bg-[#DA9700]"
              onClick={() => {
                const draftId = coInventorPromptDraftId!;
                setCoInventorPromptDraftId(null);
                navigate(`/ideas/${ideaId}/draft?draftId=${draftId}`);
              }}
            >
              Add co-inventors
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showRequestUpdateModal && (
        <RequestUpdate
          open={showRequestUpdateModal}
          onOpenChange={setShowRequestUpdateModal}
          ideaId={ideaId}
          mainIdeaData={mainIdeaData}
        />
      )}

      {showFileIdeaModal && (
        <FileIdeaModal
          open={showFileIdeaModal}
          onOpenChange={setShowFileIdeaModal}
          ideaId={ideaId ?? ""}
          defaultTitle={mainIdeaData?.title}
          defaultInventors={
            mainIdeaData?.IdeaInventor?.map(
              (i: any) => i?.inventor?.name || i?.inventor?.email,
            ).filter(Boolean) ?? []
          }
          onFiled={() => {
            queryClient.invalidateQueries({
              queryKey: ["ideaDetails", ideaId],
            });
            queryClient.invalidateQueries({ queryKey: ["fetch_ideas"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["patents"] });
            queryClient.invalidateQueries({ queryKey: ["fetch_clients"] });
            if (mainIdeaData?.clientId) {
              queryClient.invalidateQueries({
                queryKey: ["client", mainIdeaData.clientId],
              });
              queryClient.invalidateQueries({
                queryKey: ["client_metrics", mainIdeaData.clientId],
              });
            }
          }}
        />
      )}

      <ViewRequestUpdate
        open={showViewContentsModal}
        onOpenChange={setShowViewContentsModal}
        ideaId={ideaId ?? ""}
      />

      <SendToOCModal
        isOpen={openSendToOCModal}
        onClose={() => setOpenSendToOCModal(false)}
        onSubmit={() => sendToOC()}
        ideaName={mainIdeaData?.title || "-"}
        instructions={instructions}
        setInstructions={setInstructions}
        recipient={user?.role === "TECH_COMMITTEE" ? "LEGAL_COUNSEL" : "PHOTON_LEGAL"}
      />

      <RejectIdeaModal
        isOpen={openRejectIdeaModal}
        onClose={() => setOpenRejectIdeaModal(false)}
        onSubmit={(reject_reason) => rejectIdeaByIHC({ reject_reason })}
        ideaName={mainIdeaData?.title || "-"}
        reason={reason}
        setReason={setReason}
      />

      {showPatentReportModal && (
        <AlertDialog open={showPatentReportModal}>
          <AlertDialogContent
            className={`${theme === "dark"
              ? "bg-neutral-950 border-white/10"
              : "border-gray-200"
              } !rounded-2xl sm:max-w-lg !max-w-[80vw] !bg-transparent w-full p-0 h-[96vh] overflow-none border`}
          >
            <div className="flex rounded-tl-2xl rounded-tr-2xl border-b-[thick] items-center justify-between px-8 py-5 shrink-0 border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-neutral-900">
              <div>
                <h2 className="text-xl font-semibold font-sans text-neutral-900 dark:text-neutral-100">
                  Patent Analysis Report
                </h2>
                <p className="text-sm mt-1 font-sans leading-[calc(1.25 / .875)] text-neutral-600 dark:text-neutral-400">
                  Generated on{" "}
                  {draftReport?.created_at || draftReport?.createdAt
                    ? new Date(
                        draftReport?.created_at || draftReport?.createdAt,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : new Date().toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className={`flex rounded-xl items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:text-neutral-300 dark:hover:text-neutral-300 bg-transparent dark:hover:bg-white/5 dark:hover:border-white/20`}
                  onClick={() => setOpenEvaluatePopup(true)}
                >
                  <RefreshCcw className="h-4 w-4" /> Re-run Analysis
                </Button>
                <ConciseEvaluationReport
                  result={draftReport}
                  priorArt={draftReport?.priorArt}
                />
                <Button
                  className={`p-2.5 rounded-lg transition-all bg-transparent hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 dark:hover:bg-white/10 dark:text-neutral-400 dark:hover:text-neutral-300`}
                  onClick={() => setShowPatentReportModal(false)}
                >
                  <X className="h-5 w-5" size={20} />
                </Button>
              </div>
            </div>

            <div
              className={`${theme === "dark" ? "bg-[#0e0e0e]" : "bg-white"
                } overflow-y-auto max-h-[80vh] -mt-5`}
            >
              {/* <PatentAnalysisContent data={draftReport} /> */}
              <PatentNoveltyReport
                    reference={mainIdeaData?.reference_number}
                title={mainIdeaData?.title ?? ""}
                api_evaluation_id={draftApiEvaluationId ?? ""}
                scoringResult={draftReport?.scoringResult}
                priorArt={draftReport?.priorArt}
                report={draftReport}
              />
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={openEvaluatePopup} onOpenChange={setOpenEvaluatePopup}>
        <AlertDialogContent
          className={`${theme === "dark" ? "bg-[#0a0a0a] border-[#cccccc20]" : "bg-white"
            } rounded-lg`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className={`font-sans ${theme === "dark" ? "text-zinc-200" : "text-zinc-900"
                }`}
            >
              Re-evaluate with New Patent Numbers
            </AlertDialogTitle>
            <AlertDialogDescription
              className={`font-sans ${theme === "dark" ? "text-zinc-400" : "text-zinc-500"
                }`}
            >
              Enter patent numbers (comma or newline separated):
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            onChange={(e) => setPatentInput(e.target.value)}
            className="h-10 bg-transparent uppercase font-sans text-neutral-900 dark:text-neutral-300 dark:bg-neutral-900 border dark:border-[#cccccc20] rounded-md placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
            placeholder="US1234567A1, US342567B1..."
          />
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isReEvalLoading}
              className={`bg-transparent border rounded-lg font-sans ${theme === "dark"
                ? "border-[#cccccc20] text-zinc-300 hover:bg-transparent hover:text-zinc-300 bg-input/30 border-white"
                : ""
                }`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReEvalSubmit}
              //disabled={isDeleting}
              className={`text-zinc-900 font-semibold rounded-lg font-sans bg-[#F9B418] hover:bg-[#F9B41890]`}
            >
              {isReEvalLoading ? "Submitting..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scoreDialogOpen && (
        <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl text-center mb-2 text-gray-800">
                Analyzing your patent idea...
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-gray-500">
                This process takes a few minutes. You can continue working while
                we analyze your idea.
              </DialogDescription>
            </DialogHeader>

            <div className="py-8">
              {isCalculatingScore && (
                <div className="flex justify-center mb-8">
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 rounded-full border-4 border-primary-100"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  </div>
                </div>
              )}

              <div className="space-y-1 bg-gray-100 rounded-lg p-2">
                {analysisSteps.map((step, index) =>
                  renderAnalysisStep(step, index),
                )}
              </div>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button
                variant="outline"
                onClick={handleRunInBackground}
                className="rounded-md"
                disabled={analysisSteps.every(
                  (step) => step.status === "completed",
                )}
              >
                Run in background
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
export default IdeaDetailsContent;
