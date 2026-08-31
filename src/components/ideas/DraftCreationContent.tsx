import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Sparkles,
  ArrowLeft,
  LoaderCircle,
  X,
  FileUp,
  Upload,
  FileTextIcon,
  CheckIcon,
  Minimize2,
  Loader2,
  CircleCheck,
  Trash2,
  FileText,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import { useLocation } from "react-router-dom";
import Loader from "../Loader";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/lib/api-service/commonApi.service";
import { PatentAnalysisContent } from "./PatentReportModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PatentNoveltyReport from "./ShowScoreReport";
import AudioInput from "@/components/AudioInput";
import CoInventorsField from "@/components/ideas/CoInventorsField";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundAnalysis } from "@/contexts/BackgroundAnalysisContext.tsx";

export interface Section {
  CheckDraftSoreLog: any;
  score: number;
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export interface Question {
  id: string;
  text: string;
  answer: string;
}

interface AnalysisStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed";
}

interface DraftCreationContentProps {
  ideaId?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const DraftCreationContent: React.FC<DraftCreationContentProps> = ({
  ideaId,
}) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const {
    setBackgroundAnalysis,
    resetBackgroundAnalysis,
    openModal: openAnalysisModal,
    closeModal: closeAnalysisModal,
    setAnalysisSteps: setAnalysisStepsPopup,
    analysisSteps,
    setTitle: setTitleForAnalysisPopup,
    setIdeaId: setIdeaIdForAnalysisPopup,
    ideaId: ideaIdForAnalysisPopup,
    setIdeaScore: setIdeaScoreForAnalysisPopup,
    displayedProgress,
    setDisplayedProgress,
    setEnableScorePolling,
    enableScorePolling,
    setIsCalculatingScore: setContextCalculatingScore,
    setAnimatedSteps,
    hasCheckedInitialScoreRef,
    recheckStartTimeRef,
    pollingStartTimeRef,
    shouldResetTimerRef,
  } = useBackgroundAnalysis();

  // get search params - memoize to prevent unnecessary recalculations
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const draftId = useMemo(() => {
    const id = params.get("draftId");
    if (ideaId) setIdeaIdForAnalysisPopup(ideaId);
    return id;
  }, [location.search]);

  // Use ref to track if draftId actually changed
  const draftIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (draftId !== draftIdRef.current) {
      draftIdRef.current = draftId;
      // Reset skip flag when draftId changes to ensure data loads properly
      skipInitialSectionsLoad.current = true;
      // Clear sections when draftId changes to show loading state
      setSections([]);
    }
  }, [draftId]);

  const [showPatentReportModal, setShowPatentReportModal] = useState(false);
  const [showAutofillModal, setShowAutofillModal] = useState(false);
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);

  const queryClient = useQueryClient();

  const [sections, setSections] = useState<Section[]>([]);
  // Ref to skip the auto-save effect until initial server-loaded sections arrive
  const skipInitialSectionsLoad = useRef(true);

  const { isFetching: isFetchingDraft, data: mainDraftData } = useQuery({
    queryKey: ["fetch_draft", draftId],
    queryFn: async () => {
      if (!draftId) {
        console.log("[Draft Query] Skipping - no draftId");
        return null;
      }

      const timestamp = new Date().toISOString();
      console.log("[Draft Query] ⚠️ FETCHING DRAFT:", draftId, "at", timestamp);
      console.trace("[Draft Query] Stack trace:"); // This will show what triggered the fetch
      try {
        const response = await API_CONFIG.get(
          `/api/v1/idea/single-draft/${draftId}`,
        );

        if (response.status === 200) {
          const data = response?.data?.data;
          // Set sections with the loaded data
          // skipInitialSectionsLoad is already set to true when draftId changes
          setSections(data?.meta_data || []);
        }
        return response?.data?.data;
      } catch (error) {
        console.error("[Draft Query] Error fetching draft:", error);
        toast.error(error?.response?.data?.message || "Error fetching draft", {
          position: "top-center",
        });
        return null;
      }
    },
    enabled: !!draftId, // Only run query if draftId exists
    staleTime: 0, // Consider data stale immediately to allow refetching
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: true, // Refetch when navigating to this page to ensure fresh data
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on network reconnect
    refetchInterval: false, // Explicitly disable polling
    refetchIntervalInBackground: false, // Don't poll in background
  });

  const { mutate: updateFileMutation, isPending: isUploadingFile } =
    useMutation({
      mutationKey: ["upload_idea_file"],
      mutationFn: async (files: File[]) => {
        try {
          const { s3UploadForImport } = await import("@/lib/api-service/s3Upload");
          // Upload each file to S3 and collect keys
          const uploadedFiles: { key: string; originalName: string; size: number; contentType: string }[] = [];
          for (const file of files) {
            const uploaded = await s3UploadForImport(file, "idea");
            uploadedFiles.push(uploaded);
          }
          // Confirm with backend (creates IdeaFiles records)
          const response = await API_CONFIG.post(
            `/api/v1/idea/upload-idea-file/${ideaId}`,
            { files: uploadedFiles },
          );

          if (response?.status === 201) {
            toast.success("Files uploaded successfully", {
              position: "top-center",
            });
          }
          return response?.data;
        } catch (error) {
          console.error("upload file Error", error);
          toast.error(
            error?.response?.data?.message || "Failed to upload file!",
            { position: "top-center" },
          );
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["fetch_draft", draftId],
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
          toast.success("File deleted successfully", {
            position: "top-center",
          });
          queryClient.invalidateQueries({
            queryKey: ["fetch_draft", draftId],
          });
        }
      } catch (error) {
        console.error("Error deleting file:", error);
        toast.error(
          error?.response?.data?.message || "Error deleting draft file",
          { position: "top-center" },
        );
      } finally {
        setDeletingFileId(null);
      }
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [ideaScore, setIdeaScore] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [scoreCalculationError, setScoreCalculationError] = useState<any>("");
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [runningInBackground, setRunningInBackground] = useState(false);
  const [isDisableScoreTransition, setIsDisableScoreTransition] =
    useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
  const [blurredFields, setBlurredFields] = useState<Set<string>>(new Set());
  const justFinishedRecordingRef = useRef<boolean>(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptBufferRef = useRef<{
    sectionId: string;
    questionId: string;
    originalText: string; // Text that existed before recording started
    lastPartial: string; // Track last partial to replace it
  } | null>(null);
  const hasCalledGenerateSummaryRef = useRef<boolean>(false);

  // Timer state for second-by-second countdown
  const [timerSeconds, setTimerSeconds] = useState(120); // Start with 2 minutes
  // Calculate target progress percentage and estimated time - aligned with step completion

  // Animate progress smoothly with gradual increase aligned to step completion

  const renderAnalysisStep = (step: AnalysisStep, index: number) => {
    return (
      <div className="flex flex-col">
        <span
          className={cn(
            "font-sans",
            step.status === "active"
              ? theme === "dark"
                ? "text-zinc-200 font-medium"
                : "text-black font-medium"
              : step.status === "completed"
                ? theme === "dark"
                  ? "text-zinc-300"
                  : "text-gray-700"
                : theme === "dark"
                  ? "text-zinc-500"
                  : "text-gray-400",
          )}
        >
          {step.label}
        </span>
        {step.status === "active" && (
          <span
            className={cn(
              "text-xs mt-1",
              theme === "dark" ? "text-zinc-500" : "text-gray-500",
            )}
          >
            Processing...
          </span>
        )}
        {step.status === "completed" && (
          <span
            className={cn(
              "text-xs mt-1",
              theme === "dark" ? "text-zinc-500" : "text-gray-500",
            )}
          >
            Completed
          </span>
        )}
      </div>
    );
  };

  const handleGoToIdea = () => {
    if (ideaId) {
      navigate(`/ideas/${ideaId}`);
    }
    resetBackgroundAnalysis();
  };

  const { mutate: calculateScoreMutation, isPending: isAddingEvaluation } =
    useMutation({
      mutationKey: ["calculate_score"],
      mutationFn: async () => {
        try {
          const response = await API_CONFIG.get(
            `/api/v1/idea/check-score/${draftId}`,
          );

          if (response.status === 200) {
            toast.success("Evaluation underway", { position: "top-center" });
            setIsDisableScoreTransition(false);
          }
        } catch (error) {
          console.error("Error calculating score:", error);
          toast.error(
            error?.response?.data?.message || "Error calculating score",
            { position: "top-center" },
          );
          throw error; // Re-throw so onError runs and context state is reset
        }
      },
      onError: () => {
        setIsCalculatingScore(false);
        setContextCalculatingScore(false);
        setEnableScorePolling(false);
      },
    });

  const { mutate: generateSummaryMutation } = useMutation({
    mutationKey: ["generate_summary"],
    mutationFn: async () => {
      try {
        const response = await API_CONFIG.post(
          `/api/v1/idea/generate-summary/${draftId}`,
        );

        if (response.status === 200 || response.status === 201) {
          console.log("Summary generated successfully");
        }
        return response?.data;
      } catch (error) {
        console.error("Error generating summary:", error);
        toast.error(
          error?.response?.data?.message || "Error generating summary",
          { position: "top-center" },
        );
      }
    },
  });

  // // Check if running in background on mount
  // useEffect(() => {
  //   const isRunningInBg =
  //     localStorage.getItem(`run-bg-score-${ideaId}`) === "YES";
  //     setIdeaIdForAnalysisPopup(ideaId);
  //   if (isRunningInBg) {
  //     setRunningInBackground(true);
  //   }
  // }, [ideaId]);

  // Reset initial score check when draftId changes
  useEffect(() => {
    hasCheckedInitialScoreRef.current = false;
    hasCalledGenerateSummaryRef.current = false; // Reset generate summary flag when draftId changes
    refetchScore();
  }, [draftId]);

  const { data: scoreData, refetch: refetchScore } = useQuery({
    queryKey: ["fetch_score_status", draftId],
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          `/api/v1/idea/fetch-score/${draftId}`,
        );
        if (response.status !== 200) return null;
        const data = response?.data?.data;
        if (!data) {
          return null;
        }

        // const isExists = localStorage.getItem(`run-bg-score-${ideaId}`);

        // // Wait 5 seconds after recheck before processing any score data
        // // This prevents old scores from immediately marking steps as completed
        // const waitTime = 5000; // 5 seconds in milliseconds
        // const timeSinceRecheck = recheckStartTimeRef.current
        //   ? Date.now() - recheckStartTimeRef.current
        //   : Infinity; // If no recheck time, proceed normally

        // // Skip all processing if we're within the 5-second wait period
        // if (
        //   timeSinceRecheck < waitTime &&
        //   recheckStartTimeRef.current !== null
        // ) {
        //   // Return null to keep steps as pending during the wait
        //   return null;
        // }

        // if (isExists) {
        //   setScoreDialogOpen(false);
        //   setIsCalculatingScore(true);
        //   setRunningInBackground(true);
        // }

        // // Mark that we've checked the initial score
        // hasCheckedInitialScoreRef.current = true;

        // if (data?.score_meta_data === null && data?.score === null) {
        //   setIsCalculatingScore(true);
        // }

        // // Step progression is now handled by timer-based useEffect
        // // Only mark all steps as completed when score is ready
        // if (data?.score_meta_data && enableScorePolling) {
        //   const metaData = data.score_meta_data;

        //   // If score is ready, mark all steps as completed
        //   if (data.score !== null || metaData.status === "completed") {
        //     setAnalysisStepsPopup((prevSteps) => {
        //       return prevSteps.map((step) => ({
        //         ...step,
        //         status: "completed" as const,
        //       }));
        //     });
        //   }
        // }

        // if (
        //   data?.score_meta_data &&
        //   data?.score_meta_data?.status !== "completed"
        // ) {
        //   setIsCalculatingScore(false);
        //   setIsDisableScoreTransition(true);
        //   setScoreDialogOpen(false);
        // }

        // // Only mark as completed if we were actually polling (calculation in progress)
        // // Don't mark as completed if this is just an initial check and score already exists
        // if (
        //   (data.score !== null && data.score > -1) ||
        //   data.score_meta_data?.noveltyScore !== null
        // ) {
        //   // Check if we're within the 5-second wait period after recheck
        //   const waitTime = 5000; // 5 seconds in milliseconds
        //   const timeSinceRecheck = recheckStartTimeRef.current
        //     ? Date.now() - recheckStartTimeRef.current
        //     : Infinity; // If no recheck time, treat as if wait period has passed

        //   // If we're within the 5-second wait period, don't mark as completed yet
        //   // This prevents old scores from immediately marking steps as completed
        //   if (timeSinceRecheck < waitTime) {
        //     // Keep steps as pending during the wait period
        //     return response?.data?.data || null;
        //   }

        //   // If we're polling and score is ready, calculation is complete
        //   if (enableScorePolling) {
        //     setIdeaScore(
        //       data?.score_meta_data?.noveltyScore || data.score || 0,
        //     );
        //     setIdeaScoreForAnalysisPopup(
        //       data?.score_meta_data?.noveltyScore || data.score || 0,
        //     );
        //     setScoreVisible(true);
        //     setIsCalculatingScore(false);
        //     setEnableScorePolling(false);
        //     setRunningInBackground(false);
        //     setTimerSeconds(0); // Stop timer
        //     pollingStartTimeRef.current = null; // Reset polling start time
        //     recheckStartTimeRef.current = null; // Reset recheck start time
        //     setAnalysisStepsPopup((prev) =>
        //       prev.map((step) => ({
        //         ...step,
        //         status: "completed",
        //       })),
        //     );
        //     setDisplayedProgress(100);
        //     setScoreDialogOpen(false);
        //     setCompletionDialogOpen(true);
        //     // localStorage.removeItem(`run-bg-score-${ideaId}`);
        //   } else {
        //     // Score exists but we're not polling - this is an initial load or existing score
        //     // Reset everything and set the score
        //     setIdeaScore(
        //       data?.score_meta_data?.noveltyScore || data?.score || 0,
        //     );
        //     setIdeaScoreForAnalysisPopup(
        //       data?.score_meta_data?.noveltyScore || data?.score || 0,
        //     );
        //     setScoreVisible(true);
        //     setIsCalculatingScore(false);
        //     setEnableScorePolling(false);
        //     setRunningInBackground(false);
        //     setTimerSeconds(0);
        //     pollingStartTimeRef.current = null;
        //     setDisplayedProgress(100);
        //     setAnalysisStepsPopup((prev) =>
        //       prev.map((step) => ({
        //         ...step,
        //         status: "completed",
        //       })),
        //     );
        //   }

        //   // Update background analysis to show completion state
        //   if (runningInBackground) {
        //     setBackgroundAnalysis({
        //       isRunning: false,
        //       isCompleted: true,
        //       ideaId: ideaId || null,
        //       ideaTitle: mainDraftData?.idea?.title || null,
        //       analysisSteps: analysisSteps.map((step) => ({
        //         ...step,
        //         status: "completed" as const,
        //       })),
        //       progress: 100,
        //       score: data.score,
        //       onGoToIdea: handleGoToIdea,
        //       onHide: () => {
        //         resetBackgroundAnalysis();
        //         setRunningInBackground(false);
        //       },
        //     });
        //   } else {
        //     setBackgroundAnalysis(null);
        //   }
        // }
        // if (
        //   data.score_meta_data !== null &&
        //   data.score === null &&
        //   data?.score_meta_data?.status === "completed"
        // ) {
        //   setIsCalculatingScore(false);
        //   setScoreDialogOpen(false);
        //   setEnableScorePolling(false);
        //   setTimerSeconds(0); // Stop timer
        //   setIdeaScore(0);
        //   pollingStartTimeRef.current = null; // Reset polling start time
        //   recheckStartTimeRef.current = null; // Reset recheck start time
        //   setIsDisableScoreTransition(true);
        //   setScoreCalculationError("Failed to calculate score");
        // }

        // if (
        //   response?.data?.data?.score_meta_data !== null &&
        //   response?.data?.data?.score_meta_data?.noveltyScore === null
        // ) {
        //   setIdeaScore(0);
        // }

        return response?.data?.data || null;
      } catch (error) {
        console.error("Error fetching score status:", error);
        return null;
      }
    },
    // Only poll when score calculation is in progress - every 5 seconds
    refetchInterval: enableScorePolling ? 5000 : false,
    // Run once on mount to check for existing score, then continue polling if enabled
    enabled: false,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: true, // Check on mount
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    const totalQuestions = sections?.reduce(
      (acc, section) => acc + section.questions.length,
      0,
    );
    const answeredQuestions = sections?.reduce((acc, section) => {
      return (
        acc + section.questions.filter((q) => q.answer.trim().length > 0).length
      );
    }, 0);
    const percentage = Math.round((answeredQuestions / totalQuestions) * 100);
    setCompletionPercentage(percentage);
    setAllQuestionsAnswered(answeredQuestions === totalQuestions);
  }, [sections]);

  useEffect(() => {
    const saveTimer = setTimeout(() => {
      if (isSaving) {
        setIsSaving(false);
        toast.success("Saved!", { position: "top-center" });
      }
    }, 1500);
    return () => clearTimeout(saveTimer);
  }, [isSaving]);

  const { isPending: isSavingData, mutate: updatemetsDataMutation } =
    useMutation({
      mutationKey: ["update_draft"],
      mutationFn: async (data: any) => {
        try {
          const response = await API_CONFIG.post(
            `/api/v1/idea/update/draft/${draftId}`,
            data,
          );

          if (response.status === 201) {
            toast.success("Saved!", { position: "top-center" });
            return response?.data?.data;
          }
        } catch (error) {
          console.error("Error updating draft:", error);
          toast.error(
            error?.response?.data?.message || "Error updating draft",
            { position: "top-center" },
          );
        }
      },
      onSuccess: () => {
        // Invalidate drafts list so it refreshes when navigating back
        if (ideaId) {
          queryClient.invalidateQueries({
            queryKey: ["idea_draft", ideaId],
          });
        }
      },
    });

  const handleAnswerChange = (
    sectionId: string,
    questionId: string,
    value: string,
  ) => {
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

  // Clear autosave timer when recording starts
  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Skip until initial sections are loaded from server
    // This prevents autosave from triggering when draft data is first loaded
    if (skipInitialSectionsLoad.current) {
      if (sections.length > 0) {
        // Set a small delay before allowing autosave to ensure initial load is complete
        setTimeout(() => {
          skipInitialSectionsLoad.current = false;
        }, 100);
      }
      return;
    }

    // Clear any existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    // If voice recording is active or we just finished recording, skip autosave
    if (isVoiceRecording || justFinishedRecordingRef.current) {
      return;
    }

    // execute when sections change after initial load
    autosaveTimerRef.current = setTimeout(() => {
      // Double-check that we're still not recording before saving
      if (isVoiceRecording || justFinishedRecordingRef.current) {
        return;
      }

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
      const percentage = Math.round((answeredQuestions / totalQuestions) * 100);
      updatemetsDataMutation({
        meta_data: sections,
        completion_percentage: Number(percentage),
      });

      autosaveTimerRef.current = null;
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [sections, isVoiceRecording]);

  // Save when recording stops
  useEffect(() => {
    if (!isVoiceRecording) {
      // Set flag to prevent autosave from interfering
      justFinishedRecordingRef.current = true;

      // Clear buffer
      transcriptBufferRef.current = null;

      // Trigger save after a delay to ensure state is updated
      const saveTimer = setTimeout(() => {
        setSections((prevSections) => {
          const totalQuestions = prevSections.reduce(
            (acc, section) => acc + section.questions.length,
            0,
          );
          const answeredQuestions = prevSections.reduce((acc, section) => {
            return (
              acc +
              section.questions.filter((q) => q.answer.trim().length > 0).length
            );
          }, 0);
          const percentage = Math.round(
            (answeredQuestions / totalQuestions) * 100,
          );
          updatemetsDataMutation({
            meta_data: prevSections,
            completion_percentage: Number(percentage),
          });
          return prevSections;
        });

        // Clear the flag after save
        justFinishedRecordingRef.current = false;
      }, 2500); // Wait 2.5 seconds after recording stops

      return () => {
        clearTimeout(saveTimer);
        // Clear flag if component unmounts or effect re-runs
        justFinishedRecordingRef.current = false;
        // Clear transcript save timer
        if (transcriptSaveTimerRef.current) {
          clearTimeout(transcriptSaveTimerRef.current);
          transcriptSaveTimerRef.current = null;
        }
      };
    }
  }, [isVoiceRecording]);

  const handleGoBack = () => {
    navigate(`/ideas/${ideaId}`);
  };

  const handleCheckScore = () => {
    resetBackgroundAnalysis();
    // Reset everything when rechecking score
    localStorage.removeItem(`run-bg-score-${ideaId}`);
    localStorage.setItem("analysisDraftID", params.get("draftId") || "");
    setTitleForAnalysisPopup(mainDraftData?.idea?.title?.toUpperCase());
    openAnalysisModal();
    setIsCalculatingScore(true);
    setContextCalculatingScore(true); // Sync context so progress bar and timer run (fixes progress stuck at 0 e.g. when draft >20k chars and first poll hasn't run yet)
    // setScoreDialogOpen(true);
    setRunningInBackground(false);
    setIsDisableScoreTransition(false);
    setDisplayedProgress(0); // Reset progress to 0 when starting new analysis
    setAnimatedSteps(new Set()); // Reset animation tracking
    shouldResetTimerRef.current = true; // Flag to reset timer in the countdown effect
    pollingStartTimeRef.current = null; // Reset polling start time
    recheckStartTimeRef.current = Date.now(); // Track when recheck was clicked
    hasCheckedInitialScoreRef.current = false; // Reset initial check flag to allow refetch
    setEnableScorePolling(true); // Enable polling for new calculation
    // Set first step as active when starting new calculation
    setAnalysisStepsPopup([
      {
        id: "prior-art",
        label: "Retrieving prior art",
        status: "active",
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const allowedExtensions = [
      ".xls",
      ".xlsx",
      ".csv",
      ".txt",
      ".doc",
      ".docx",
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
      ".tiff",
      ".ico",
    ];

    // Validate file types
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of files) {
      if (file?.size >= MAX_FILE_SIZE) {
        toast.error("File must be less than 1GB", { position: "top-center" });
        return;
      }

      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.substring(fileName.lastIndexOf("."));

      if (allowedExtensions.includes(fileExtension)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }
    // Show error if any invalid files are found
    if (invalidFiles.length > 0) {
      toast.error(
        `Invalid file format(s): ${invalidFiles.join(", ")}. Only .xls, .xlsx, .csv, .txt, .doc, .docx, .pdf .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg, .tiff, .ico files are allowed.`,
        { position: "top-center" },
      );
      // Reset the input
      event.target.value = "";
      return;
    }
    updateFileMutation(validFiles);
    event.target.value = "";
  };

  const handleRemoveFile = (fileId: string) => {
    setDeletingFileId(fileId);
    removeDraftFile(fileId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kBytes = bytes / 1024;
    if (kBytes < 1024) return `${Math.round(kBytes)} KB`;
    const mBytes = kBytes / 1024;
    return `${Math.round(mBytes * 10) / 10} MB`;
  };

  // Helper function to count words in a string
  const countWords = (text: string): number => {
    if (!text || text.trim() === "") return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  };

  // Helper function to check if answer has minimum word count
  const hasMinimumWords = (answer: string, minWords: number = 10): boolean => {
    return countWords(answer) >= minWords;
  };

  // Helper function to get validation error for a question
  const getQuestionValidationError = (
    answer: string | undefined,
  ): string | null => {
    const safeAnswer = answer || "";
    const wordCount = countWords(safeAnswer);
    if (wordCount < 10) {
      return `Please enter at least 10 words`;
    }
    return null;
  };

  // Helper function to check if answer matches any other answer
  const getDuplicateAnswerError = (
    sectionId: string,
    questionId: string,
    answer: string | undefined,
  ): string | null => {
    const safeAnswer = (answer || "").trim().toLowerCase();

    // Don't check if answer is empty or too short
    if (!safeAnswer || safeAnswer.length < 10) {
      return null;
    }

    // Check if this answer matches any other question's answer
    const hasDuplicate = sections.some((section) =>
      section.questions.some((question) => {
        // Skip the current question
        if (section.id === sectionId && question.id === questionId) {
          return false;
        }

        const otherAnswer = (question.answer || "").trim().toLowerCase();

        // Only compare if the other answer is not empty and has sufficient length
        if (!otherAnswer || otherAnswer.length < 10) {
          return false;
        }

        // Check for exact match (case-insensitive, trimmed)
        return safeAnswer === otherAnswer;
      }),
    );

    if (hasDuplicate) {
      return "This answer matches another answer you've provided.";
    }

    return null;
  };

  // Helper function to get field key for tracking touched state
  const getFieldKey = (sectionId: string, questionId: string): string => {
    return `${sectionId}-${questionId}`;
  };

  // Handler to mark field as blurred (unfocused)
  const handleFieldBlur = (sectionId: string, questionId: string) => {
    const fieldKey = getFieldKey(sectionId, questionId);
    setBlurredFields((prev) => new Set(prev).add(fieldKey));
  };

  const hasIncompleteAnswers = useMemo(() => {
    if (!sections || sections.length === 0) return true;

    return sections.some((section) =>
      section.questions.some((question) => {
        const answer = question.answer || "";
        return (
          !answer.trim() ||
          !hasMinimumWords(answer, 10) ||
          getDuplicateAnswerError(section.id, question.id, answer) !== null
        );
      }),
    );
  }, [sections]);

  // Call generate-summary API when completion is 100%, score is not generated, and all answers have at least 10 words
  useEffect(() => {
    // Check if conditions are met
    const shouldCallGenerateSummary =
      completionPercentage === 100 &&
      (ideaScore === null || ideaScore === undefined) &&
      !hasIncompleteAnswers &&
      draftId &&
      !hasCalledGenerateSummaryRef.current;

    if (shouldCallGenerateSummary) {
      hasCalledGenerateSummaryRef.current = true;
      // Wait 2 seconds before calling the API
      const timeoutId = setTimeout(() => {
        generateSummaryMutation();
      }, 2000);

      // Cleanup timeout if component unmounts or conditions change
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    completionPercentage,
    ideaScore,
    hasIncompleteAnswers,
    draftId,
    generateSummaryMutation,
  ]);

  const getSupportingFilesSection = () => {
    return (
      <div
        id="supporting-files"
        className={`mb-32 border rounded-xl ${
          theme === "dark" ? "bg-white/5 border-[#cccccc20]" : "bg-white"
        }`}
      >
        <div className="px-6 py-4">
          <h2
            className={`text-md font-semibold tracking-wide ${
              theme === "dark" ? "text-zinc-200" : "text-zinc-900"
            }`}
          >
            Supporting FIles
          </h2>
          <div
            className={`text-xs font-sans mt-1 uppercase font-normal ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            Optional • Diagrams, documents, etc.
          </div>
        </div>
        <Separator
          className={`mb-6 h-[0.5px] opacity-50 ${
            theme === "dark" ? "bg-[#cccccc20]" : "bg-gray-400"
          }`}
        />

        <div className="px-6 py-1 mb-5">
          {!["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
            mainDraftData?.idea?.status,
          ) && (
            <>
              <div
                onClick={() => document.getElementById("file-upload")?.click()}
                className={`w-full border-2 border-dashed cursor-pointer ${
                  theme === "dark"
                    ? "bg-white/5 border-white/10"
                    : "bg-neutral-50 border-neutral-200 hover:bg-gray-50"
                } rounded-xl p-6 text-center transition-colors`}
              >
                <Upload className="mx-auto h-6 w-6 text-neutral-500 dark:text-neutral-400 mb-3" />
                <p
                  className={`font-sans ${
                    theme === "dark" ? "text-neutral-300" : "text-neutral-700"
                  } mb-2 text-sm`}
                >
                  Click to upload supporing documents
                </p>
                <p
                  className={`font-sans ${
                    theme === "dark" ? "text-neutral-400" : "text-neutral-500"
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
                    disabled={
                      isCalculatingScore ||
                      (!scoreData?.score_meta_data && scoreData) ||
                      ["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                        mainDraftData?.idea?.status,
                      )
                    }
                    onChange={handleFileUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  />
                </div>
              </div>
            </>
          )}

          {mainDraftData?.idea?.IdeaFiles?.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-row gap-4 flex-wrap">
                {mainDraftData?.idea?.IdeaFiles?.map((file: any) => (
                  <div
                    key={file?.id}
                    className="flex items-center justify-between p-3 border border-neutral-200 bg-neutral-50 dark:border-white/10 w-full rounded dark:bg-white/5 max-w-full group"
                  >
                    <p
                      className="flex items-center space-x-3"
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-4 w-4 text-neutral-500" />
                      <div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 font-normal font-sans">
                          {file?.original_name}
                        </p>
                      </div>
                    </p>
                    {!["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                      mainDraftData?.idea?.status,
                    ) && (
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            window.open(
                              assetUrl(file?.file_path),
                              "_blank",
                            )
                          }
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full ml-2 hover:bg-transparent"
                        >
                          <Eye className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                          <span className="sr-only">Show file</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full ml-1 hover:bg-transparent"
                          onClick={() => {
                            handleRemoveFile(file?.id);
                          }}
                          disabled={
                            isDeletingFile && deletingFileId === file?.id
                          }
                        >
                          {isDeletingFile && deletingFileId === file?.id ? (
                            <LoaderCircle className="h-4 w-4 text-gray-500 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-neutral-500 dark:text-neutral-400 hover:text-red-500" />
                          )}
                          <span className="sr-only">Remove file</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const { mutate: analyzeDocumentMutation, isPending } = useMutation({
    mutationKey: ["analyze_document"],
    mutationFn: async (file: File) => {
      try {
        const { s3UploadForImport } = await import("@/lib/api-service/s3Upload");
        // Upload to S3 with temp key
        const uploaded = await s3UploadForImport(file, "idea");
        // Call backend with S3 key
        const response = await API_CONFIG.post(
          `/api/v1/idea/analyze-document`,
          { key: uploaded.key, contentType: uploaded.contentType },
        );

        if (response.status === 201) {
          if (response?.data?.data) {
            toast.success("Document analyzed successfully", {
              position: "top-center",
            });
            setShowAutofillModal(false);
            setSections(response?.data?.data);
          } else {
            toast.error("Error analyzing document", { position: "top-center" });
            setSelectedFile(null);
            setIsAnalyzingDocument(false);
          }
          if (fileInputRef && fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
        return response?.data;
      } catch (error) {
        console.error("Error analyzing document:", error);
        toast.error(
          error?.response?.data?.message || "Error analyzing document",
          { position: "top-center" },
        );
      }
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file?.size >= MAX_FILE_SIZE) {
        toast.error("File size must be less than 100MB", {
          position: "top-center",
        });
        return;
      }
      setSelectedFile(file);
      analyzeDocumentMutation(file, {
        onSettled: () => {
          setIsAnalyzingDocument(false);
        },
      });
    }
  };

  const handleAnalyzeDocument = () => {
    if (!selectedFile) return;

    setIsAnalyzingDocument(true);
    analyzeDocumentMutation(selectedFile, {
      onSettled: () => {
        setIsAnalyzingDocument(false);
      },
    });
  };

  return (
    <div
      className={`w-full h-screen flex flex-col overflow-hidden relative ${
        theme === "dark" ? "bg-black" : "bg-gray-50"
      }`}
    >
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
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
        className={`${
          theme === "dark"
            ? "bg-neutral-950/80 border-[#cccccc20]"
            : "bg-gray-50 border-photon-gray-300"
        } w-full flex items-center justify-between px-6 py-[22px] border-b z-10`}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-md p-1.5">
            <button
              onClick={handleGoBack}
              className="flex items-center justify-center"
            >
              <ArrowLeft
                className={`h-5 w-5 ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              />
            </button>
          </div>
          <div>
            <span
              className={`text-xl font-bold ${
                theme === "dark" ? "text-zinc-200" : "text-zinc-900"
              }`}
            >
              {mainDraftData?.idea?.title || "D001"}
            </span>
            <div
              className={`${
                theme === "dark" ? "text-gray-500" : "text-gray-600"
              } uppercase text-xs tracking-wide`}
            >
              Draft Submission • {mainDraftData?.created_by?.name}
            </div>
          </div>
        </div>

        <div className="ml-auto mr-6 max-w-[360px]">
          <CoInventorsField ideaId={ideaId} />
        </div>

        <div className="w-[180px]">
          <div>
            <span className="text-xs font-sans text-neutral-600 dark:text-neutral-500 block mb-1 tracking-wider uppercase">
              Completion
            </span>
            <div className="flex items-center space-x-2">
              <Progress
                value={completionPercentage}
                className={`h-2 w-full ${
                  theme === "dark" ? "bg-neutral-800" : "bg-neutral-200"
                }`}
              />
              <span
                className={`font-sans ${
                  theme === "dark" ? "text-gray-200" : "text-gray-700"
                } text-sm font-medium min-w-[22px] text-right`}
              >
                {completionPercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {showPatentReportModal && (
        <AlertDialog open={showPatentReportModal}>
          <AlertDialogContent className="max-w-5xl p-0 overflow-hidden border border-gray-200">
            <div className="bg-white p-6 border-b border-gray-100">
              <AlertDialogHeader>
                <div className="flex justify-between items-center">
                  <AlertDialogTitle className="text-lg text-gray-800 font-semibold">
                    Patent Analysis Report
                  </AlertDialogTitle>
                  <AlertDialogCancel
                    onClick={() => setShowPatentReportModal(false)}
                    className="h-8 w-8 rounded-md p-0 border-none hover:bg-gray-100"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </AlertDialogCancel>
                </div>
              </AlertDialogHeader>
            </div>
            <div className="overflow-y-auto max-h-[80vh] p-6">
              {/* <PatentAnalysisContent data={scoreData?.score_meta_data} /> */}
              <PatentNoveltyReport
                title={mainDraftData?.idea?.title}
                api_evaluation_id={scoreData?.api_evaluation_id}
                scoringResult={scoreData?.score_meta_data?.scoringResult}
                priorArt={scoreData?.score_meta_data?.priorArt}
                report={scoreData?.score_meta_data}
              />
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isFetchingDraft && !mainDraftData ? (
        <Loader />
      ) : (
        <div className="flex-1 overflow-hidden mt-2">
          <ResizablePanelGroup direction="horizontal" className="h-full px-5">
            <ResizablePanel defaultSize={80}>
              <div
                className={`h-full flex flex-col overflow-hidden ${
                  theme === "dark" ? "" : "bg-gray-50"
                }`}
              >
                <ScrollArea className="h-full p-6 px-0 py-[16px] pb-20">
                  <div className="max-w-[991px] mx-auto mb-6">
                    <div
                      className={`border-2 border-yellow-500/40 rounded-xl ${
                        theme === "dark"
                          ? "bg-[#F9B418]/5 border-[#F9B418]/30 backdrop-blur-xl"
                          : "bg-[#F9B418]/5 border-[#F9B418]/30"
                      }  px-6 py-6 flex gap-5`}
                    >
                      <div
                        className={`bg-[#F9B418]/20 rounded-xl p-3 w-12 h-12 flex justify-center items-center`}
                      >
                        <Sparkles className="text-[#F9B418]" />
                      </div>
                      <div className="">
                        <p
                          className={`font-sans font-medium tracking-wide ${
                            theme === "dark" ? "text-zinc-200" : "font-zinc-900"
                          }`}
                        >
                          Auto-Fill from Document (Recommended)
                        </p>
                        <p
                          className={`text-sm font-sans mt-1.5 ${
                            theme === "dark"
                              ? "text-neutral-400"
                              : "text-neutral-600"
                          }`}
                        >
                          Upload your invention document and let AI populate all
                          fields instantly. Review and edit before submission.
                        </p>
                        {!selectedFile && !isPending && (
                          <button
                            type="button"
                            disabled={
                              isCalculatingScore ||
                              (!scoreData?.score_meta_data && scoreData) ||
                              ["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                                mainDraftData?.idea?.status,
                              )
                            }
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-[#F9B418] disabled:opacity-50 disabled:cursor-not-allowed mt-4 w-fit rounded-lg px-4 py-2.5 text-sm font-sans tracking-wide font-medium flex items-center gap-2 justify-center"
                          >
                            <Upload size={16} /> Upload Document to Auto-Fill
                          </button>
                        )}{" "}
                        {selectedFile && !isPending && (
                          <div
                            className={`${
                              theme === "dark"
                                ? "bg-green-500/10 border-green-500/20"
                                : "bg-green-50"
                            } border border-green-400/10 rounded-xl py-4 px-6 w-[113%] mt-4 flex items-center justify-between`}
                          >
                            <p className="flex items-center gap-3">
                              <FileTextIcon
                                size={20}
                                className="text-green-500"
                              />
                              <p>
                                <p
                                  className={`${
                                    theme === "dark" && "text-neutral-100"
                                  } text-sm font-sans font-medium`}
                                >
                                  {selectedFile?.name}
                                </p>
                                <p className="text-xs text-green-500 font-sans flex items-center gap-1">
                                  <CheckIcon size={13} />
                                  Form auto-filled successfully
                                </p>
                              </p>
                            </p>
                            <button
                              onClick={() => setSelectedFile(null)}
                              className={`${
                                theme === "dark"
                                  ? "text-neutral-400"
                                  : "text-neutral-500"
                              } font-sans text-sm`}
                            >
                              Clear
                            </button>
                          </div>
                        )}
                        {isPending && (
                          <div
                            className={`${
                              theme === "dark" ? "bg-black" : "bg-green-50"
                            } border-green-400/10 rounded-xl py-4 px-6 w-[113%] mt-4 flex items-center justify-between`}
                          >
                            <p className="flex items-center gap-3">
                              <Loader2
                                size={18}
                                className="animate-spin text-[#F9B418]"
                              />
                              <p>
                                <p
                                  className={`${
                                    theme === "dark" && "text-neutral-100"
                                  } text-sm font-sans font-semibold`}
                                >
                                  Processing your document...
                                </p>
                                <p className="text-xs text-neutral-500 font-sans flex items-center gap-1">
                                  Extracting information and filling the form...
                                </p>
                              </p>
                            </p>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={handleFileSelect}
                        />
                        {!selectedFile && (
                          <p
                            className={`text-xs mt-2.5 font-sans ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-neutral-600"
                            }`}
                          >
                            Supported: PDF, DOC, DOCX
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="max-w-[991px] mx-auto w-full">
                    {sections?.map((section) => (
                      <div
                        key={section.id}
                        id={section.id}
                        className={`mb-6 border rounded-xl ${
                          theme === "dark"
                            ? "bg-white/5 border-[#cccccc20]"
                            : "bg-white"
                        }`}
                      >
                        <div className="px-6 py-4">
                          <h2
                            className={`text-md font-medium font-sans text-base tracking-wide ${
                              theme === "dark"
                                ? "text-zinc-200"
                                : "text-zinc-900"
                            }`}
                          >
                            {section.title}
                          </h2>
                          <div
                            className={`text-xs font-sans mt-1 uppercase font-normal ${
                              theme === "dark"
                                ? "text-neutral-500"
                                : "text-neutral-600"
                            }`}
                          >
                            {section?.description}
                          </div>
                        </div>
                        <Separator
                          className={`mb-1 h-[0.5px] opacity-50 ${
                            theme === "dark" ? "bg-[#cccccc20]" : "bg-gray-400"
                          }`}
                        />

                        <div className="space-y-6 w-full p-5">
                          {section.questions.map((question, idx) => (
                            <div key={question.id} className="space-y-3 w-full">
                              <div className="flex items-start justify-between">
                                <label
                                  className={`block font-sans text-xs font-medium uppercase tracking-wide ${
                                    theme === "dark"
                                      ? "text-gray-400"
                                      : "text-gray-700"
                                  }`}
                                >
                                  Q{idx + 1}: {question.text}{" "}
                                  <span className="text-[#F9B418] ml-1">*</span>
                                </label>
                              </div>
                              <div className="space-y-2">
                                <div className="relative">
                                  <Textarea
                                    value={question.answer || ""}
                                    onChange={(e) => {
                                      if (e.target.value !== question.answer) {
                                        handleAnswerChange(
                                          section.id,
                                          question.id,
                                          e.target.value,
                                        );
                                      }
                                    }}
                                    onBlur={() =>
                                      handleFieldBlur(section.id, question.id)
                                    }
                                    required
                                    disabled={
                                      isCalculatingScore ||
                                      (!scoreData?.score_meta_data &&
                                        scoreData) ||
                                      ["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                                        mainDraftData?.idea?.status,
                                      )
                                    }
                                    placeholder="Enter your reponse..."
                                    className={`min-h-[70px] bg-gray-50/5 text-sm rounded-lg pr-8 pb-2 ${
                                      theme === "dark"
                                        ? "border-[#cccccc20] text-neutral-200"
                                        : "border-gray-200 text-zinc-900"
                                    } border transition-all w-full resize-y`}
                                  />
                                  {!(
                                    isCalculatingScore ||
                                    (!scoreData?.score_meta_data &&
                                      scoreData) ||
                                    ["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                                      mainDraftData?.idea?.status,
                                    )
                                  ) && (
                                    <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-50 hover:opacity-100">
                                      <AudioInput
                                        onTranscript={(transcript) => {
                                          // Append transcribed text to existing content
                                          const currentText = (
                                            question.answer || ""
                                          ).trim();
                                          const newText = currentText
                                            ? `${currentText} ${transcript}`
                                            : transcript;
                                          handleAnswerChange(
                                            section.id,
                                            question.id,
                                            newText,
                                          );
                                        }}
                                        languageCode="en-IN"
                                        disabled={[
                                          "SEND_TO_OC",
                                          "UNDER_REVIEW",
                                        ]?.includes(
                                          mainDraftData?.idea?.status,
                                        )}
                                      />
                                    </div>
                                  )}
                                </div>
                                {(() => {
                                  const fieldKey = getFieldKey(
                                    section.id,
                                    question.id,
                                  );
                                  const wordCountError = blurredFields.has(
                                    fieldKey,
                                  )
                                    ? getQuestionValidationError(
                                        question.answer,
                                      )
                                    : null;
                                  const duplicateError = blurredFields.has(
                                    fieldKey,
                                  )
                                    ? getDuplicateAnswerError(
                                        section.id,
                                        question.id,
                                        question.answer,
                                      )
                                    : null;
                                  const validationError =
                                    wordCountError || duplicateError;

                                  return validationError ? (
                                    <p className="text-red-500 text-xs font-sans mt-1">
                                      {validationError}
                                    </p>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {getSupportingFilesSection()}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      <div
        className={`absolute bottom-0 border-t ${
          theme === "dark"
            ? "bg-neutral-950 border-[#cccccc20]"
            : "bg-white border-photon-gray-300"
        } w-full py-4 px-6`}
      >
        <div className="w-full flex justify-between items-center">
          <div>
            {hasIncompleteAnswers ? (
              <p className="font-sans text-sm text-neutral-700 dark:text-neutral-400">
                💡 Complete all required fields to enable scoring
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <CircleCheck size={20} className="text-green-500" />
                <p className="font-sans text-sm text-neutral-700 dark:text-neutral-300">
                  All fields completed
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleCheckScore}
            className={`px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium tracking-wider font-sans ${
              isCalculatingScore ||
              (!scoreData?.score_meta_data && scoreData) ||
              hasIncompleteAnswers ||
              ["SEND_TO_OC", "UNDER_REVIEW"]?.includes(
                mainDraftData?.idea?.status,
              )
                ? `${
                    theme === "dark"
                      ? "bg-neutral-800 text-neutral-700"
                      : "bg-neutral-300 text-neutral-500"
                  }`
                : "bg-[#F9B418] shadow-[#F9B418]/20 shadow-lg"
            }`}
            disabled={
              (isCalculatingScore && ideaId === ideaIdForAnalysisPopup) ||
              hasIncompleteAnswers ||
              ["SEND_TO_OC", "UNDER_REVIEW"].includes(
                mainDraftData?.idea?.status,
              )
            }
          >
            <Sparkles size={16} />{" "}
            {ideaScore !== null && ideaScore > -1
              ? "RECHECK AI SCORE"
              : "FINISH AND GET SCORE"}
          </button>
        </div>
      </div>

      {/* <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-lg max-w-xl backdrop-blur-xl",
            theme === "dark"
              ? "bg-zinc-900/95 border-zinc-800"
              : "bg-white/95 border-neutral-200",
          )}
        >
          <DialogHeader>
            <DialogTitle
              className={cn(
                "font-semibold text-xl",
                theme === "dark" ? "text-zinc-200" : "text-neutral-900",
              )}
            >
              Analyzing Your Patent Idea
            </DialogTitle>
            <DialogDescription
              className={cn(
                "text-xs uppercase tracking-wider mt-1",
                theme === "dark" ? "text-zinc-400" : "text-neutral-600",
              )}
            >
              {mainDraftData?.idea?.title?.toUpperCase() ||
                "AI-POWERED SMART PET COLLAR WITH HEALTH MONITORING"}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark"
                  ? "bg-blue-900/30 border-blue-700"
                  : "bg-blue-50 border-blue-200",
              )}
            >
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-blue-300" : "text-blue-700",
                )}
              >
                ⏱️ This might take a 5 - 6 minutes. You can continue using the
                platform while we analyse your idea.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span
                  className={cn(
                    theme === "dark" ? "text-zinc-300" : "text-neutral-600",
                  )}
                >
                  Overall Progress
                </span>
                <div className="flex items-center gap-3">
                  {/* <span
                    className={cn(
                      "text-xs",
                      theme === "dark" ? "text-zinc-400" : "text-neutral-600"
                    )}
                  >
                    Est. {progressData.timeRemaining} remaining
                  </span> 
                  <span
                    className={cn(
                      "font-medium",
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900",
                    )}
                  >
                    {Math.round(displayedProgress)}%
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "h-2 rounded-full overflow-hidden",
                  theme === "dark" ? "bg-zinc-800" : "bg-neutral-200",
                )}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#F9B418] to-[#F9B418]/70 transition-all duration-300"
                  style={{ width: `${displayedProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              {analysisSteps.map((step, index) => {
                // Track if this step should animate (only when status changes to active/completed)
                const shouldAnimate =
                  (step.status === "active" || step.status === "completed") &&
                  !animatedSteps.has(step.id);

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border transition-all",
                      step.status === "active"
                        ? theme === "dark"
                          ? "border-[#F9B418]/30 bg-[#F9B418]/10"
                          : "border-[#F9B418]/30 bg-[#F9B418]/5"
                        : step.status === "completed"
                          ? theme === "dark"
                            ? "border-green-500 bg-green-900/20"
                            : "border-green-500 bg-green-50"
                          : theme === "dark"
                            ? "border-zinc-700 bg-zinc-800/50"
                            : "border-neutral-200 bg-neutral-50",
                    )}
                    style={{
                      opacity: 1,
                      transform: "none",
                      animation: shouldAnimate
                        ? "slideInFromLeft 0.5s ease-out"
                        : "none",
                      animationFillMode: "forwards",
                    }}
                    onAnimationEnd={() => {
                      if (shouldAnimate) {
                        setAnimatedSteps((prev) => new Set([...prev, step.id]));
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                        step.status === "active"
                          ? theme === "dark"
                            ? "bg-[#F9B418]/20"
                            : "bg-[#F9B418]/20"
                          : step.status === "completed"
                            ? theme === "dark"
                              ? "bg-green-800"
                              : "bg-green-100"
                            : theme === "dark"
                              ? "bg-zinc-700"
                              : "bg-neutral-200",
                      )}
                    >
                      {step.status === "active" ? (
                        <LoaderCircle className="h-4 w-4 text-[#F9B418] animate-spin" />
                      ) : step.status === "completed" ? (
                        <CheckCircle
                          className={cn(
                            "h-4 w-4",
                            theme === "dark"
                              ? "text-green-400"
                              : "text-green-500",
                          )}
                        />
                      ) : (
                        <span
                          className={cn(
                            "text-sm",
                            theme === "dark"
                              ? "text-zinc-400"
                              : "text-neutral-400",
                          )}
                        >
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          step.status === "active"
                            ? theme === "dark"
                              ? "text-zinc-200"
                              : "text-neutral-900"
                            : step.status === "completed"
                              ? theme === "dark"
                                ? "text-zinc-300"
                                : "text-neutral-700"
                              : theme === "dark"
                                ? "text-zinc-400"
                                : "text-neutral-500",
                        )}
                      >
                        {renderAnalysisStep(step, index)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleCancelAnalysis}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-md border transition-colors",
                  theme === "dark"
                    ? "border-red-600/50 text-red-400 hover:text-red-400 hover:border-red-600 hover:bg-red-900/20 bg-transparent"
                    : "border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50 bg-transparent",
                )}
              >
                <X className="w-4 h-4" />
                <span className="text-sm">Cancel</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleRunInBackground}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-md border transition-colors",
                  theme === "dark"
                    ? "border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 bg-transparent hover:text-zinc-100"
                    : "border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 bg-transparent",
                )}
                disabled={analysisSteps.every(
                  (step) => step.status === "completed",
                )}
              >
                <Minimize2 className="w-4 h-4" />
                <span className="text-sm">Run in Background</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog> */}

      {/* <style>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style> */}

      {/* Completion Dialog */}
      {/* <Dialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
      >
        <DialogContent
          className={cn(
            "w-full sm:max-w-lg max-w-xl",
            theme === "dark" ? "bg-neutral-950/95 border-white/10" : "bg-white",
          )}
        >
          <DialogHeader>
            <div
              data-slot="dialog-header"
              className="flex flex-col gap-2 text-center sm:text-left"
            >
              <div>
                <h2
                  id="radix-:r1s:"
                  data-slot="dialog-title"
                  className="font-semibold text-xl text-neutral-900 dark:text-neutral-100"
                >
                  Analysis Complete!
                </h2>
                <p
                  id="radix-:r1t:"
                  data-slot="dialog-description"
                  className="text-xs uppercase tracking-wider mt-1 text-neutral-600 dark:text-neutral-500"
                >
                  {mainDraftData?.idea?.title?.toUpperCase() || "UNKNOWN"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div className="p-6 rounded-xl border text-center space-y-4 bg-green-50 border-green-200">
              <div className="flex justify-center">
                <div className="p-3 bg-green-500/20 rounded-full">
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
                    className="lucide lucide-circle-check w-8 h-8 text-green-500"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg text-neutral-100 dark:text-neutral-900">
                  Your Idea Score
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="flex items-center justify-center w-20 h-20 bg-[#F9B418]/20 border-2 border-[#F9B418] rounded-xl">
                    <span className="text-3xl font-bold text-[#F9B418]">
                      {ideaScore?.toFixed(2) || "0.0"}
                    </span>
                  </div>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Your idea has been analyzed and scored. View the detailed
                  report to see insights, prior art analysis, and
                  recommendations.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                data-slot="button"
                onClick={handleGoToIdea}
                disabled={isCalculatingScore || enableScorePolling}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-9 py-2 has-[&gt;svg]:px-3 bg-[#F9B418] hover:bg-[#F9B418]/90 text-black px-3 rounded-xl"
              >
                Go to Your Idea
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
                  className="lucide lucide-arrow-right w-4 h-4 ml-2"
                  aria-hidden="true"
                >
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog> */}

      <Dialog open={showAutofillModal} onOpenChange={setShowAutofillModal}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl text-center mb-2 text-gray-800">
              Upload Document
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-500">
              Upload a document to automatically fill the form fields
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {isAnalyzingDocument ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-4 border-primary-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                </div>
                <p className="text-sm text-gray-600">
                  Extracting data from file...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                  <FileUp className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-gray-600 mb-2">
                    {selectedFile
                      ? selectedFile.name
                      : "Drag and drop file here, or click to browse"}
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    PDF, DOC, DOCX (max 10MB)
                  </p>
                  <div>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      onClick={() =>
                        document.getElementById("autofill-file-upload")?.click()
                      }
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedFile ? "Change File" : "Select File"}
                    </Button>
                    <input
                      id="autofill-file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              variant="outline"
              onClick={() => setShowAutofillModal(false)}
              className="mr-2"
              disabled={isAnalyzingDocument}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAnalyzeDocument}
              disabled={!selectedFile || isAnalyzingDocument}
              className="bg-primary hover:bg-primary/90"
            >
              {isAnalyzingDocument ? (
                <>
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DraftCreationContent;
