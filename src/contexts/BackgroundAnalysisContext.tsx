import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useRef,
} from "react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  EyeOff,
  LoaderCircle,
  CheckCircle,
  Minimize2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import API_CONFIG from "@/lib/apiConfig";
import { useQuery } from "@tanstack/react-query";

interface AnalysisStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed";
}

interface BackgroundAnalysisState {
  isRunning: boolean;
  isCompleted?: boolean;
  ideaId: string | null;
  ideaTitle: string | null;
  analysisSteps: AnalysisStep[];
  progress: number;
  score?: number | null;
  onExpand?: () => void;
  onHide?: () => void;
  onGoToIdea?: () => void;
}

interface BackgroundAnalysisContextType {
  setBackgroundAnalysis: (state: BackgroundAnalysisState | null) => void;
  backgroundAnalysis: BackgroundAnalysisState | null;
  openModal: () => void;
  closeModal: () => void;
  openChange: () => void;
  setAnalysisSteps: (data: any) => void;
  analysisSteps: any;
  setTitle: (data: string) => void;
  setIdeaId: (data: string) => void;
  ideaId: string | null;
  setIdeaScore: (data: any) => void;
  setDisplayedProgress: (data: any) => void;
  displayedProgress: number;
  setEnableScorePolling: (data: any) => void;
  enableScorePolling: boolean;
  animatedSteps: any;
  setAnimatedSteps: (data: any) => void;
  shouldResetTimerRef: React.MutableRefObject<boolean>;
  pollingStartTimeRef: React.MutableRefObject<number | null>;
  hasCheckedInitialScoreRef: React.MutableRefObject<boolean>;
  recheckStartTimeRef: React.MutableRefObject<number | null>;
  setIsCalculatingScore: (data: boolean) => void;
  isCalculatingScore: boolean;
  resetBackgroundAnalysis: () => void;
}

const BackgroundAnalysisContext = createContext<
  BackgroundAnalysisContextType | undefined
>(undefined);

export const useBackgroundAnalysis = () => {
  const context = useContext(BackgroundAnalysisContext);
  if (!context) {
    throw new Error(
      "useBackgroundAnalysis must be used within BackgroundAnalysisProvider",
    );
  }
  return context;
};

interface BackgroundAnalysisProviderProps {
  children: ReactNode;
}

export const BackgroundAnalysisProvider: React.FC<
  BackgroundAnalysisProviderProps
> = ({ children }) => {
  const [backgroundAnalysis, setBackgroundAnalysisState] =
    useState<BackgroundAnalysisState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ideaId, setIdeaId] = useState("");
  const [ideaScore, setIdeaScore] = useState(0);
  const [animatedSteps, setAnimatedSteps] = useState<Set<string>>(new Set());
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [runningInBackground, setRunningInBackground] = useState(false);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const shouldResetTimerRef = useRef<boolean>(false);
  const pollingStartTimeRef = useRef<number | null>(null);
  const hasCheckedInitialScoreRef = useRef<boolean>(false);
  const recheckStartTimeRef = useRef<number | null>(null);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const openChange = () => setIsModalOpen(!isModalOpen);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [enableScorePolling, setEnableScorePolling] = useState<boolean>(false);
  // Timer state for second-by-second countdown
  const [timerSeconds, setTimerSeconds] = useState(120); // Start with 2 minutes

  const setBackgroundAnalysis = (state: BackgroundAnalysisState | null) => {
    setBackgroundAnalysisState(state);
  };

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

  const { data: scoreData, refetch: refetchScore } = useQuery({
    queryKey: ["fetch_score_status", localStorage.getItem("analysisDraftID")],
    queryFn: async () => {
      try {
        const response = await API_CONFIG.get(
          `/api/v1/idea/fetch-score/${localStorage.getItem("analysisDraftID")}`,
        );
        if (response.status !== 200) return null;
        const data = response?.data?.data;
        if (!data) {
          return null;
        }

        const isExists = localStorage.getItem(`run-bg-score-${ideaId}`);

        // Wait 5 seconds after recheck before processing any score data
        // This prevents old scores from immediately marking steps as completed
        const waitTime = 5000; // 5 seconds in milliseconds
        const timeSinceRecheck = recheckStartTimeRef.current
          ? Date.now() - recheckStartTimeRef.current
          : Infinity; // If no recheck time, proceed normally

        // Skip all processing if we're within the 5-second wait period
        if (
          timeSinceRecheck < waitTime &&
          recheckStartTimeRef.current !== null
        ) {
          // Return null to keep steps as pending during the wait
          return null;
        }

        if (isExists) {
          setScoreDialogOpen(false);
          setIsCalculatingScore(true);
          setRunningInBackground(true);
        }

        // Mark that we've checked the initial score
        hasCheckedInitialScoreRef.current = true;

        if (data?.score_meta_data === null && data?.score === null) {
          setIsCalculatingScore(true);
        }

        // Step progression is now handled by timer-based useEffect
        // Only mark all steps as completed when score is ready
        if (data?.score_meta_data && enableScorePolling) {
          const metaData = data.score_meta_data;

          // If score is ready, mark all steps as completed
          if (data.score !== null || metaData.status === "completed") {
            setAnalysisSteps((prevSteps) => {
              return prevSteps.map((step) => ({
                ...step,
                status: "completed" as const,
              }));
            });
          }
        }

        if (
          data?.score_meta_data &&
          data?.score_meta_data?.status !== "completed"
        ) {
          setIsCalculatingScore(false);
          // setIsDisableScoreTransition(true);
          setScoreDialogOpen(false);
        }

        // Only mark as completed if we were actually polling (calculation in progress)
        // Don't mark as completed if this is just an initial check and score already exists
        if (data.score !== null && data.score > -1) {
          // Check if we're within the 5-second wait period after recheck
          const waitTime = 5000; // 5 seconds in milliseconds
          const timeSinceRecheck = recheckStartTimeRef.current
            ? Date.now() - recheckStartTimeRef.current
            : Infinity; // If no recheck time, treat as if wait period has passed

          // If we're within the 5-second wait period, don't mark as completed yet
          // This prevents old scores from immediately marking steps as completed
          if (timeSinceRecheck < waitTime) {
            // Keep steps as pending during the wait period
            return response?.data?.data || null;
          }

          // If we're polling and score is ready, calculation is complete
          if (enableScorePolling) {
            setIdeaScore(
              data?.score_meta_data?.noveltyScore || data.score || 0,
            );
            setIsCalculatingScore(false);
            setEnableScorePolling(false);
            setRunningInBackground(false);
            setTimerSeconds(0); // Stop timer
            pollingStartTimeRef.current = null; // Reset polling start time
            recheckStartTimeRef.current = null; // Reset recheck start time
            setAnalysisSteps((prev) =>
              prev.map((step) => ({
                ...step,
                status: "completed",
              })),
            );
            setDisplayedProgress(100);
            setScoreDialogOpen(false);
            setCompletionDialogOpen(true);
            setIsModalOpen(false);
            localStorage.removeItem(`run-bg-score-${ideaId}`);
            localStorage.removeItem("analysisDraftID");
          } else {
            // Score exists but we're not polling - this is an initial load or existing score
            // Reset everything and set the score
            setIdeaScore(
              data?.score_meta_data?.noveltyScore || data.score || 0,
            );
            // setScoreVisible(true);
            setIsCalculatingScore(false);
            setEnableScorePolling(false);
            setRunningInBackground(false);
            setCompletionDialogOpen(true);
            setIsModalOpen(false);
            setTimerSeconds(0);
            pollingStartTimeRef.current = null;
            setDisplayedProgress(100);
            setIsModalOpen(false);
            setAnalysisSteps((prev) =>
              prev.map((step) => ({
                ...step,
                status: "completed",
              })),
            );
          }

          // Update background analysis to show completion state
          if (runningInBackground) {
            setBackgroundAnalysis({
              isRunning: false,
              isCompleted: true,
              ideaId: ideaId || null,
              ideaTitle: title || null,
              analysisSteps: analysisSteps.map((step) => ({
                ...step,
                status: "completed" as const,
              })),
              progress: 100,
              score: data?.score_meta_data?.noveltyScore || data.score || 0,
              onGoToIdea: () => {
                resetBackgroundAnalysis();
                window.location.href = `/ideas/${ideaId}`;
              },
              onHide: () => {
                setBackgroundAnalysis(null);
                setRunningInBackground(false);
              },
            });
          } else {
            setBackgroundAnalysis(null);
          }
        }
        if (
          data.score_meta_data !== null &&
          data.score === null &&
          data?.score_meta_data?.status === "completed"
        ) {
          setIsCalculatingScore(false);
          setScoreDialogOpen(false);
          setEnableScorePolling(false);
          setTimerSeconds(0); // Stop timer
          pollingStartTimeRef.current = null; // Reset polling start time
          recheckStartTimeRef.current = null; // Reset recheck start time
        }

        return response?.data?.data || null;
      } catch (error) {
        console.error("Error fetching score status:", error);
        return null;
      }
    },
    // Only poll when score calculation is in progress - every 5 seconds
    refetchInterval: enableScorePolling ? 5000 : false,
    // Run once on mount to check for existing score, then continue polling if enabled
    enabled:
      !!localStorage.getItem("analysisDraftID") &&
      (!hasCheckedInitialScoreRef.current || enableScorePolling),
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: true, // Check on mount
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Check if running in background on mount
  useEffect(() => {
    const isRunningInBg =
      localStorage.getItem(`run-bg-score-${ideaId}`) === "YES";
    if (isRunningInBg) {
      setRunningInBackground(true);
    }
  }, [ideaId]);

  const resetBackgroundAnalysis = () => {
    setBackgroundAnalysis(null);
    setRunningInBackground(false);
    setIsModalOpen(false);
    setCompletionDialogOpen(false);
    setAnalysisSteps((prev) =>
      prev.map((step) => ({
        ...step,
        status: "pending",
      })),
    );
    setDisplayedProgress(0);
    setIdeaScore(0);
    setEnableScorePolling(false);
    setIsCalculatingScore(false);
    setTimerSeconds(120); // default 2 minutes
  };

  return (
    <BackgroundAnalysisContext.Provider
      value={{
        backgroundAnalysis,
        setBackgroundAnalysis,
        openChange,
        openModal,
        closeModal,
        setAnalysisSteps,
        analysisSteps,
        setTitle,
        setIdeaId,
        ideaId,
        setIdeaScore,
        displayedProgress,
        setDisplayedProgress,
        enableScorePolling,
        setEnableScorePolling,
        animatedSteps,
        setAnimatedSteps,
        shouldResetTimerRef,
        hasCheckedInitialScoreRef,
        recheckStartTimeRef,
        pollingStartTimeRef,
        setIsCalculatingScore,
        isCalculatingScore,
        resetBackgroundAnalysis,
      }}
    >
      {children}
      <BackgroundAnalysisIndicator openModal={openModal} />
      <BackgroundAnalysisPopup
        open={isModalOpen}
        openChange={() => setIsModalOpen(!isModalOpen)}
        close={closeModal}
        setBackgroundAnalysis={setBackgroundAnalysis}
        analysisSteps={analysisSteps}
        setAnalysis={setAnalysisSteps}
        title={title}
        ideaId={ideaId}
        ideaScore={ideaScore}
        displayedProgress={displayedProgress}
        setDisplayedProgress={setDisplayedProgress}
        enableScorePolling={enableScorePolling}
        setEnableScorePolling={setEnableScorePolling}
        setAnimatedSteps={setAnimatedSteps}
        animatedSteps={animatedSteps}
        isCalculatingScore={isCalculatingScore}
        setIsCalculatingScore={setIsCalculatingScore}
        timerSeconds={timerSeconds}
        setTimerSeconds={setTimerSeconds}
        setRunningInBackground={setRunningInBackground}
        runningInBackground={runningInBackground}
        completionDialogOpen={completionDialogOpen}
        setCompletionDialogOpen={setCompletionDialogOpen}
        resetBackgroundAnalysis={resetBackgroundAnalysis}
      />
    </BackgroundAnalysisContext.Provider>
  );
};

interface BackgroundAnalysisIndicatorProps {
  openModal: () => void;
}

const BackgroundAnalysisIndicator: React.FC<
  BackgroundAnalysisIndicatorProps
> = ({ openModal }) => {
  const { 
    backgroundAnalysis, 
    setBackgroundAnalysis,
    setEnableScorePolling,
    setIsCalculatingScore,
    setIdeaId,
    resetBackgroundAnalysis,
  } = useBackgroundAnalysis();
  const { theme } = useTheme();

  if (
    !backgroundAnalysis ||
    (!backgroundAnalysis.isRunning && !backgroundAnalysis.isCompleted)
  ) {
    return null;
  }

  const activeStep = backgroundAnalysis.analysisSteps.find(
    (step) => step.status === "active",
  );
  const isCompleted =
    backgroundAnalysis.isCompleted &&
    backgroundAnalysis.score !== null &&
    backgroundAnalysis.score !== undefined;

  const handleHide = () => {
    // Cancel the background analysis completely
    const currentIdeaId = backgroundAnalysis.ideaId;
    
    // Stop polling and calculation
    setEnableScorePolling(false);
    setIsCalculatingScore(false);
    
    // Remove localStorage items that track the analysis
    if (currentIdeaId) {
      localStorage.removeItem(`run-bg-score-${currentIdeaId}`);
    }
    localStorage.removeItem("analysisDraftID");
    
    // Reset all state
    resetBackgroundAnalysis();
    
    // Clear the background analysis indicator
    setBackgroundAnalysis(null);
    
    // Call the onHide callback if it exists
    if (backgroundAnalysis.onHide) {
      backgroundAnalysis.onHide();
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 w-80 rounded-lg border shadow-lg z-50 transition-all",
        theme === "dark"
          ? "bg-zinc-900 border-zinc-800"
          : "bg-white border-gray-200",
      )}
    >
      <div className="p-4">
        {isCompleted ? (
          // Completion State
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    theme === "dark" ? "bg-green-900/30" : "bg-green-100",
                  )}
                >
                  <CheckCircle
                    className={cn(
                      "w-4 h-4",
                      theme === "dark" ? "text-green-400" : "text-green-500",
                    )}
                  />
                </div>
                <div className="flex-1">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900",
                    )}
                  >
                    Analysis Complete!
                  </div>
                  <div
                    className={cn(
                      "text-xs mt-0.5 line-clamp-1 max-w-[200px] truncate",
                      theme === "dark" ? "text-zinc-400" : "text-neutral-600",
                    )}
                  >
                    {backgroundAnalysis.ideaTitle ||
                      "AI-Powered Smart Pet Collar with Health..."}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {backgroundAnalysis.onGoToIdea && (
                  <button
                    onClick={backgroundAnalysis.onGoToIdea}
                    className={cn(
                      "p-1 rounded transition-colors",
                      theme === "dark"
                        ? "text-zinc-400 hover:bg-zinc-800 hover:text-[#F9B418]"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-[#F9B418]",
                    )}
                    title="Go to Your Idea"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleHide}
                  className={cn(
                    "p-1 rounded transition-colors",
                    theme === "dark"
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  )}
                  title="Hide"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              className={cn(
                "text-xs mb-2",
                theme === "dark" ? "text-zinc-300" : "text-neutral-600",
              )}
            >
              Novelty Score
            </div>
            <div
              className={cn(
                "text-sm font-semibold",
                theme === "dark" ? "text-[#F9B418]" : "text-[#F9B418]",
              )}
            >
              {backgroundAnalysis?.score?.toFixed(2) || "0.0"}/10
            </div>
            {backgroundAnalysis.onGoToIdea && (
              <button
                onClick={backgroundAnalysis.onGoToIdea}
                className={cn(
                  "mt-3 w-full py-2 px-4 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                  theme === "dark"
                    ? "bg-[#F9B418] hover:bg-[#F9B418]/90 text-zinc-900"
                    : "bg-[#F9B418] hover:bg-[#F9B418]/90 text-zinc-900",
                )}
              >
                Go to Your Idea
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          // Analysis in Progress State
          <>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    theme === "dark" ? "bg-[#F9B418]/20" : "bg-[#F9B418]/20",
                  )}
                >
                  <LoaderCircle
                    className={cn("w-4 h-4 text-[#F9B418] animate-spin")}
                  />
                </div>
                <div className="flex-1">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      theme === "dark" ? "text-zinc-200" : "text-neutral-900",
                    )}
                  >
                    Analysing Idea
                  </div>
                  <div
                    className={cn(
                      "text-xs mt-0.5 line-clamp-1 max-w-[200px] truncate",
                      theme === "dark" ? "text-zinc-400" : "text-neutral-600",
                    )}
                  >
                    {backgroundAnalysis.ideaTitle ||
                      "AI-Powered Smart Pet Collar with Health..."}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {backgroundAnalysis.onExpand && (
                  <button
                    onClick={openModal}
                    className={cn(
                      "p-1 rounded transition-colors",
                      theme === "dark"
                        ? "text-zinc-400 hover:bg-zinc-800 hover:text-[#F9B418]"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-[#F9B418]",
                    )}
                    title="View analysis progress"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleHide}
                  className={cn(
                    "p-1 rounded transition-colors",
                    theme === "dark"
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  )}
                  title="Hide"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              className={cn(
                "text-xs mb-2",
                theme === "dark" ? "text-zinc-300" : "text-neutral-600",
              )}
            >
              {activeStep?.label || "Processing..."}
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex-1 h-1.5 rounded-full overflow-hidden",
                  theme === "dark" ? "bg-zinc-800" : "bg-neutral-200",
                )}
              >
                <div
                  className={cn(
                    "h-full bg-[#F9B418] transition-all duration-300",
                  )}
                  style={{ width: `${backgroundAnalysis.progress}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  theme === "dark" ? "text-zinc-300" : "text-neutral-600",
                )}
              >
                {Math.round(backgroundAnalysis.progress)}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const BackgroundAnalysisPopup = ({
  open,
  openChange,
  close,
  setBackgroundAnalysis,
  analysisSteps,
  title,
  ideaId,
  ideaScore,
  displayedProgress,
  setDisplayedProgress,
  enableScorePolling,
  setEnableScorePolling,
  animatedSteps,
  setAnimatedSteps,
  isCalculatingScore,
  setIsCalculatingScore,
  timerSeconds,
  setTimerSeconds,
  setAnalysis,
  runningInBackground,
  setRunningInBackground,
  completionDialogOpen,
  setCompletionDialogOpen,
  resetBackgroundAnalysis,
}) => {
  const { theme } = useTheme();
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const shouldResetTimerRef = useRef<boolean>(false);

  // Calculate target progress percentage and estimated time - aligned with step completion
  const progressData = useMemo(() => {
    const totalSteps = analysisSteps.length;
    if (totalSteps === 0) {
      return {
        targetPercentage: 0,
        activeStep: -1,
        completedSteps: 0,
        totalSteps: 0,
        timeRemaining: "0s",
      };
    }
    const completedSteps = analysisSteps.filter(
      (step) => step.status === "completed",
    ).length;
    const activeStep = analysisSteps.findIndex(
      (step) => step.status === "active",
    );
    const allStepsCompleted = totalSteps > 0 && completedSteps === totalSteps;

    // Calculate base percentage from completed steps
    const basePercentage = (completedSteps / totalSteps) * 100;

    // If a step is active, gradually increase within that step's range
    let targetPercentage = basePercentage;
    if (activeStep >= 0) {
      const stepPercentage = 100 / totalSteps; // 25% per step
      const stepStart = (activeStep / totalSteps) * 100;
      // Gradually increase from stepStart to stepStart + stepPercentage
      // Use a time-based approach for smooth progression
      const progressInStep = Math.min(
        stepPercentage * 0.9,
        stepPercentage * 0.9,
      ); // Cap at 90% of step
      targetPercentage = stepStart + progressInStep;
    }

    // Use timerSeconds for time remaining (reduces second by second)
    const estimatedSecondsRemaining = Math.max(0, timerSeconds);

    const minutes = Math.floor(estimatedSecondsRemaining / 60);
    const seconds = Math.floor(estimatedSecondsRemaining % 60);
    const timeRemaining =
      minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, "0")}m`
        : `${estimatedSecondsRemaining}s`;

    return {
      targetPercentage: Math.min(100, targetPercentage),
      activeStep: activeStep,
      completedSteps: completedSteps,
      totalSteps: totalSteps,
      timeRemaining: timeRemaining,
    };
  }, [analysisSteps, timerSeconds]);

  // Timer countdown - reduces second by second, stops at 2 seconds
  useEffect(() => {
    if (!isCalculatingScore && !enableScorePolling) {
      return;
    }

    // Reset timer if flag is set (when starting new calculation)
    if (shouldResetTimerRef.current) {
      setTimerSeconds(120);
      shouldResetTimerRef.current = false;
    }

    const timerInterval = setInterval(() => {
      setTimerSeconds((prev) => {
        // Stop countdown at 2 seconds - don't go below 2
        if (prev <= 2) {
          return 2;
        }
        return prev - 1;
      });
    }, 1000); // Update every second

    return () => clearInterval(timerInterval);
  }, [isCalculatingScore, enableScorePolling]);

  // Update steps based on timer seconds
  useEffect(() => {
    if (!isCalculatingScore && !enableScorePolling) {
      return;
    }

    setAnalysis((prevSteps) => {
      return prevSteps.map((step, index) => {
        // At 2 seconds: Keep Step 4 active, all previous steps completed
        if (timerSeconds <= 2) {
          if (index < 3) {
            return { ...step, status: "completed" as const };
          } else if (index === 3) {
            return { ...step, status: "active" as const };
          }
          return step;
        }
        // At 30 seconds (0:30): Step 3 completed, Step 4 active
        else if (timerSeconds <= 30) {
          if (index < 3) {
            return { ...step, status: "completed" as const };
          } else if (index === 3) {
            return { ...step, status: "active" as const };
          } else {
            return { ...step, status: "pending" as const };
          }
        }
        // At 60 seconds (1:00): Step 2 completed, Step 3 active
        else if (timerSeconds <= 60) {
          if (index < 2) {
            return { ...step, status: "completed" as const };
          } else if (index === 2) {
            return { ...step, status: "active" as const };
          } else {
            return { ...step, status: "pending" as const };
          }
        }
        // At 90 seconds (1:30): Step 1 completed, Step 2 active
        else if (timerSeconds <= 90) {
          if (index === 0) {
            return { ...step, status: "completed" as const };
          } else if (index === 1) {
            return { ...step, status: "active" as const };
          } else {
            return { ...step, status: "pending" as const };
          }
        }
        // Before 90 seconds: Keep first step active (initial state)
        else {
          if (index === 0) {
            return { ...step, status: "active" as const };
          } else {
            return { ...step, status: "pending" as const };
          }
        }
      });
    });
  }, [timerSeconds, isCalculatingScore, enableScorePolling]);

  // Animate progress smoothly with gradual increase aligned to step completion
  useEffect(() => {
    if (!isCalculatingScore && !runningInBackground) {
      if (!completionDialogOpen) {
        setDisplayedProgress(0);
      }
      return;
    }

    const { targetPercentage, activeStep, completedSteps, totalSteps } =
      progressData;

    // If there's an active step, gradually increase progress within that step's range
    if (activeStep >= 0) {
      const stepPercentage = 100 / totalSteps;
      const stepStart = (activeStep / totalSteps) * 100;
      const stepEnd = ((activeStep + 1) / totalSteps) * 100;

      // Gradually increase within the active step's range
      const interval = setInterval(() => {
        setDisplayedProgress((prev) => {
          // Ensure progress never goes backwards
          const currentTarget = stepStart + stepPercentage * 0.95;

          // If we're below the step start, move towards it quickly
          if (prev < stepStart) {
            const increment = Math.min(2, (stepStart - prev) * 0.3);
            return Math.min(stepStart, prev + increment);
          }
          // If we're within the step range, gradually increase (0% to 25% of step)
          if (prev < currentTarget) {
            const increment = 0.4; // Smooth increment for progress
            const newValue = prev + increment;
            // Cap at 95% of the step to leave room for completion
            return Math.min(currentTarget, newValue);
          }
          // If we've reached the end of the step, maintain it (never decrease)
          return Math.max(prev, currentTarget);
        });
      }, 200); // Update every 200ms for smoother animation

      return () => clearInterval(interval);
    } else {
      // No active step - all steps completed or pending
      // If all completed, ensure we're at 100%
      if (completedSteps === totalSteps) {
        setDisplayedProgress(100);
        return;
      }

      // Animate towards target (for transitions)
      const target = targetPercentage;
      const difference = target - displayedProgress;

      if (Math.abs(difference) < 0.1) {
        setDisplayedProgress(target);
        return;
      }

      const interval = setInterval(() => {
        setDisplayedProgress((prev) => {
          const diff = target - prev;

          // Only allow progress to increase, never decrease
          if (diff < 0) {
            return prev; // Don't go backwards
          }

          const increment = Math.max(0.5, Math.min(2, Math.abs(diff) * 0.2));
          const newValue = prev + increment;

          if (Math.abs(target - newValue) < 0.1) {
            return target;
          }
          return Math.min(100, Math.max(prev, newValue)); // Ensure it never decreases
        });
      }, 150);

      return () => clearInterval(interval);
    }
  }, [
    progressData,
    isCalculatingScore,
    runningInBackground,
    completionDialogOpen,
  ]);
  // Sync background analysis state with global context
  useEffect(() => {
    if (runningInBackground && (isCalculatingScore || enableScorePolling)) {
      setBackgroundAnalysis({
        isRunning: true,
        isCompleted: false,
        ideaId: ideaId || null,
        ideaTitle: title || null,
        analysisSteps: analysisSteps,
        progress: displayedProgress,
        onExpand: () => {
          setScoreDialogOpen(true);
          setRunningInBackground(false);
        },
        onHide: () => {
          // Stop polling and calculation
          setEnableScorePolling(false);
          setIsCalculatingScore(false);
          
          // Remove localStorage items that track the analysis
          if (ideaId) {
            localStorage.removeItem(`run-bg-score-${ideaId}`);
          }
          localStorage.removeItem("analysisDraftID");
          
          // Reset all state
          resetBackgroundAnalysis();
          
          // Clear the background analysis indicator
          setBackgroundAnalysis(null);
          setRunningInBackground(false);
        },
      });
    } else if (
      !runningInBackground &&
      !isCalculatingScore &&
      !enableScorePolling
    ) {
      // Clear global state when not running (unless showing completion)
      // const bgState = localStorage.getItem(`run-bg-score-${ideaId}`);
      // if (!bgState || bgState !== "YES") {
      //   setBackgroundAnalysis(null);
      // }
    }
  }, [
    runningInBackground,
    isCalculatingScore,
    enableScorePolling,
    analysisSteps,
    displayedProgress,
    ideaId,
    title,
    completionDialogOpen,
  ]);

  const handleGoToIdea = () => {
    if (ideaId) {
      localStorage.removeItem("analysisDraftID");
      window.location.href = `/ideas/${ideaId}`;
    }
    resetBackgroundAnalysis();
  };

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

  const handleRunInBackground = () => {
    localStorage.setItem(`run-bg-score-${ideaId}`, "YES");
    setRunningInBackground(true);
    setScoreDialogOpen(false);
    close();

    // Set global background analysis state
    setBackgroundAnalysis({
      isRunning: true,
      isCompleted: false,
      ideaId: ideaId || null,
      ideaTitle: title || null,
      analysisSteps: analysisSteps,
      progress: displayedProgress,
      onExpand: () => {
        setScoreDialogOpen(true);
        setRunningInBackground(false);
      },
      onHide: () => {
        // Stop polling and calculation
        setEnableScorePolling(false);
        setIsCalculatingScore(false);
        
        // Remove localStorage items that track the analysis
        if (ideaId) {
          localStorage.removeItem(`run-bg-score-${ideaId}`);
        }
        localStorage.removeItem("analysisDraftID");
        
        // Reset all state
        resetBackgroundAnalysis();
        
        // Clear the background analysis indicator
        setBackgroundAnalysis(null);
        setRunningInBackground(false);
      },
    });

    toast.info("Score calculation running in background");
  };

  const handleCancelAnalysis = () => {
    setScoreDialogOpen(false);
    close();
    setIsCalculatingScore(false);
    setRunningInBackground(false);
    localStorage.removeItem(`run-bg-score-${ideaId}`);
    setBackgroundAnalysis(null);
    resetBackgroundAnalysis();
    toast.info("Analysis cancelled");
  };

  return (
    <div>
      <Dialog open={open} onOpenChange={openChange}>
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
              {title || "AI-POWERED SMART PET COLLAR WITH HEALTH MONITORING"}
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

            {/* Progress Bar */}
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
      </Dialog>

      <style>{`
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
          `}</style>

      {/* Completion Dialog */}
      <Dialog
        open={completionDialogOpen}
        onOpenChange={() => {
          setCompletionDialogOpen();
          localStorage.removeItem("analysisDraftID");
        }}
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
                  {title || "UNKNOWN"}
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
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
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
                onClick={() => handleGoToIdea()}
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
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
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
      </Dialog>
    </div>
  );
};
