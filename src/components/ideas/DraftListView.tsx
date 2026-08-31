import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";
import useUserCookie from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle,
  CircleCheck,
  Copy,
  Eye,
  File,
  FileLineChart,
  FileTextIcon,
  Lightbulb,
  Loader2,
  Pencil,
  Trash,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import moment from "moment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { toast } from "@/lib/toast";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundAnalysis } from "@/contexts/BackgroundAnalysisContext";

interface DraftListViewProps {
  inventorIdeas: any[];
  selectedDraftId: string | null;
  submittedDraftId: string | null;
  mainIdeaData: any;
  handleDraftSelection: (draftId: string) => void;
  handleEditDraft: (draftId: string) => void;
  handleCopyDraft: (draftId: string) => void;
  setDraftReport: (data: any) => void;
  setShowPatentReportModal: (show: boolean) => void;
  mapStatusCodeToLabel: (status: string) => string;
  handleCreateDraft: () => void;
  isAddingDraft: boolean;
  setDraftApiEvaluationId: (id: string) => void;
  setDraftId: (id: string) => void;
  setSelectedDraftForReport: (id: string) => void;
  /** When parent is running score calculation for a draft (e.g. from idea detail page), pass its id so "Calculating..." shows on the list even before server updates (e.g. for >20k char drafts). */
  draftIdBeingCalculated?: string | null;
  userRole?: string;
  onSendToIHC?: (draftId: string) => void;
  isSendingToIHC?: boolean;
  draftIdBeingSentToIHC?: string | null;
}

const DraftListView: React.FC<DraftListViewProps> = ({
  inventorIdeas,
  selectedDraftId,
  submittedDraftId,
  mainIdeaData,
  handleDraftSelection,
  handleEditDraft: rawHandleEditDraft,
  handleCopyDraft,
  setDraftReport,
  setShowPatentReportModal,
  mapStatusCodeToLabel,
  handleCreateDraft,
  isAddingDraft,
  setDraftApiEvaluationId,
  setDraftId,
  setSelectedDraftForReport,
  draftIdBeingCalculated: draftIdBeingCalculatedFromParent = null,
  userRole,
  onSendToIHC,
  isSendingToIHC = false,
  draftIdBeingSentToIHC = null,
}) => {
  // The questionnaire is the inventor's to write. Reviewers open drafts to
  // READ them (selection), never to edit — the review surface is the queue.
  const { user: sessionUser } = useUserCookie();
  const canEditDrafts = sessionUser?.role === "INVENTOR";
  const handleEditDraft = (draftId: string) => {
    if (canEditDrafts) rawHandleEditDraft(draftId);
    else handleDraftSelection?.(draftId);
  };

  const isInventor = userRole === "INVENTOR";
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { enableScorePolling, isCalculatingScore } = useBackgroundAnalysis();
  const analysisDraftIdFromContext =
    typeof window !== "undefined"
      ? localStorage.getItem("analysisDraftID")
      : null;
  const draftIdBeingCalculated =
    draftIdBeingCalculatedFromParent ?? analysisDraftIdFromContext ?? null;
  const isCalculatingFromContext =
    (enableScorePolling || isCalculatingScore) &&
    draftIdBeingCalculated !== null;

  const { mutate: deleteDraftMutation, isPending: isDeletingDraft } =
    useMutation({
      mutationKey: ["delete_draft"],
      mutationFn: async (draftId: string) => {
        try {
          const response = await API_CONFIG.delete(
            `/api/v1/idea/draft/${draftId}`,
          );
          if (response?.status === 200) {
            toast.success("Draft deleted successfully");
            return response?.data;
          }
        } catch (error) {
          console.error("Error deleting draft:", error);
          toast.error(error?.response?.data?.message || "Error deleting draft");
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["idea_draft", mainIdeaData?.id],
        });
      },
    });

  const handleDeleteDraft = (draftId: string) => {
    const confirm = window.confirm(
      "Are you sure you want to delete this draft? This action cannot be undone.",
    );
    if (confirm) {
      deleteDraftMutation(draftId);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] overflow-hidden pl-6">
      <ScrollArea className="flex-1 pr-4">
        {inventorIdeas?.map((draft: any, draftIndex: number) => {
          const isCalculatingFromServer =
            draft.completion_percentage === 100 &&
            draft?.CheckDraftSoreLog &&
            draft?.CheckDraftSoreLog?.length > 0 &&
            (draft?.CheckDraftSoreLog?.[0]?.score === null ||
              draft?.CheckDraftSoreLog?.[0]?.score === undefined);
          const isCalculating =
            isCalculatingFromServer ||
            (isCalculatingFromContext && draft.id === draftIdBeingCalculated);
          const isComplete =
            draft.completion_percentage === 100 &&
            draft?.CheckDraftSoreLog?.[0]?.score_meta_data;
          return (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: draftIndex * 0.1 }}
              className="mb-6"
            >
              <RadioGroup
                value={selectedDraftId || ""}
                onValueChange={handleDraftSelection}
                className="space-y-4"
                disabled={draft?.idea?.status === "UNDER_REVIEW"}
              >
                <Card
                  className={`border backdrop-blur-sm transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-black/40 border-[#cccccc20] hover:border-white/20"
                      : "bg-white/80 border-slate-200 hover:border-gray-300 hover:shadow-lg"
                  } rounded-xl ${
                    selectedDraftId === draft.id
                      ? `!border-[#F9B418] shadow-lg ring-2 ring-[#F9B418]/20 ${theme === "dark" ? "bg-[#F5A623]/5" : "bg-orange-50/80"}`
                      : submittedDraftId === draft.id
                        ? "border-green-500 ring-1 ring-green-500/20"
                        : ""
                  }`}
                >
                  <CardContent className="p-5 relative flex gap-5">
                    {!isInventor && (
                      <div
                        className={`flex items-center bg-black/5 dark:bg-white/10 border rounded-full p-0.5 h-fit mt-1 ${
                          (draft.completion_percentage < 100 ||
                            (draft?.ihc_sent === true &&
                              mainIdeaData?.status === "REJECTED")) &&
                          (theme === "dark"
                            ? "border-[#5d5d5f]"
                            : "border-[#f2f2f2]")
                        }`}
                      >
                        <RadioGroupItem
                          value={draft.id}
                          onClick={() => setDraftId(draft?.id?.toString())}
                          id={draft.id}
                          disabled={
                            draft.completion_percentage < 100 ||
                            !isComplete ||
                            (draft?.ihc_sent === true &&
                              mainIdeaData?.status === "REJECTED")
                          }
                          className={
                            draft?.ihc_sent &&
                            mainIdeaData?.status === "UNDER_REVIEW" &&
                            mainIdeaData?.status === "REJECTED" &&
                            "hidden"
                          }
                        />
                      </div>
                    )}
                    <div className="w-full -mt-0.5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="">
                          <h3
                            className={`flex flex-row items-center text-base font-bold font-sans ${
                              theme === "dark"
                                ? "text-zinc-200"
                                : "text-zinc-900"
                            }`}
                          >
                            <button
                              className="cursor-pointer"
                              onClick={() => handleEditDraft(draft.id)}
                            >
                              {draft.title}
                            </button>
                            {/* {draft?.ihc_sent === true && (
                              <div className="mt-[-5px] mr-2">
                                <Badge className="bg-photon-primary text-photon-gray-800 border-photon-light hover:bg-photon-light ml-2">
                                  {mapStatusCodeToLabel(mainIdeaData?.status)}
                                </Badge>
                              </div>
                            )} */}
                          </h3>
                          <div
                            className={`text-xs font-sans ${
                              theme === "dark"
                                ? "text-neutral-400"
                                : "text-gray-500"
                            } flex items-center gap-2 mt-2`}
                          >
                            <User size={16} className="text-neutral-500" />
                            <p>
                              {draft.created_by?.name ||
                                draft.created_by?.email}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 mb-1 mt-2">
                            <div
                              className={`text-xs font-sans ${
                                theme === "dark"
                                  ? "text-neutral-400"
                                  : "text-gray-500"
                              } flex items-center gap-2 mt-2`}
                            >
                              <Calendar size={16} className="text-neutral-500" />
                              <p>{moment(draft.updatedAt).format("MMM DD")}</p>
                            </div>
                            <span
                              className={`mx-3 h-5 w-[1px] ${
                                theme === "dark" ? "bg-neutral-800" : "bg-gray-300"
                              }`}
                            />
                            <div
                              className={`text-xs font-sans ${
                                theme === "dark"
                                  ? "text-neutral-400"
                                  : "text-gray-500"
                              } flex items-center gap-2 mt-2`}
                            >
                              <CircleCheck
                                size={16}
                                className="text-neutral-500"
                              />
                              <p>
                                {draft.completion_percentage || 0}% Completion
                                {draft?.api_evaluation_id && !(Array.isArray(draft?.CheckDraftSoreLog) && draft.CheckDraftSoreLog.length > 0) && (
                                  <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#B37E00]">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F9B418]" />
                                    Scoring in progress…
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        {/* Idea Score Display */}
                        {draft?.CheckDraftSoreLog &&
                        draft?.CheckDraftSoreLog?.length > 0 &&
                        (draft?.CheckDraftSoreLog?.[0]?.score !== null || draft?.CheckDraftSoreLog?.[0]?.score_meta_data !== null) ? (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-shrink-0 ${
                              theme === "light"
                                ? "bg-orange-50/50 border-[#F5A623]/20"
                                : "bg-[#F5A623]/5 border-[#F5A623]/20"
                            }`}
                          >
                            <TrendingUp className="w-4 h-4 text-[#F5A623]" />
                            <span
                              className={`text-xs ${theme === "light" ? "text-gray-500" : "text-neutral-400"}`}
                            >
                              Idea Score
                            </span>
                            <span className="text-xs text-[#F5A623]">
                              {
                                draft?.CheckDraftSoreLog?.[0]?.score_meta_data
                                  ?.noveltyScore || 0
                              }
                            </span>
                          </div>
                        ) : isCalculating ? (
                          <button
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border flex-shrink-0 transition-opacity hover:opacity-70 ${
                              theme === "light"
                                ? "bg-gray-50 border-gray-200 text-gray-500"
                                : "bg-white/5 border-white/10 text-neutral-400"
                            }`}
                          >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs">Calculating...</span>
                          </button>
                        ) : null}
                      </div>

                      <div className="mb-4">
                        <Progress
                          value={draft.completion_percentage || 0}
                          className={`h-1.5 w-full ${
                            draft.completion_percentage === 100
                              ? theme === "dark"
                                ? "bg-zinc-500"
                                : "bg-slate-100"
                              : theme === "dark"
                                ? "bg-zinc-800"
                                : "bg-slate-200"
                          }`}
                          disabled={
                            draft.completion_percentage < 100 ||
                            (draft?.ihc_sent === true &&
                              mainIdeaData?.status === "REJECTED")
                          }
                          theme={theme === "dark" ? "dark" : "light"}
                        />
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <div className="flex items-center gap-2">
                          {[
                            "UPDATE_REQUEST",
                            "IN_DRAFT",
                            "REJECT_BY_OC",
                            "REJECT_BY_IHC",
                            "SEND_TO_OC",
                          ]?.includes(mainIdeaData?.status) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditDraft(draft.id)}
                              className={`rounded-lg border font-sans ${
                                theme === "dark"
                                  ? "bg-transparent hover:bg-white/5 hover:text-white text-gray-300 border-[#cccccc20]"
                                  : "bg-transparent hover:bg-white text-gray-700 border-slate-300 hover:text-gray-700"
                              }  hover:shadow-sm`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {draft.completion_percentage < 100
                                ? "Resume"
                                : "Edit"}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditDraft(draft.id)}
                              className={`rounded-lg border font-sans ${
                                theme === "dark"
                                  ? "bg-transparent hover:bg-white/5 hover:text-white text-gray-300 border-[#cccccc20]"
                                  : "bg-transparent hover:bg-white/10 text-gray-700 border-slate-300"
                              } hover:shadow-sm`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {"View"}
                            </Button>
                          )}

                          {draft?.CheckDraftSoreLog?.[0]?.score_meta_data && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDraftForReport(draft?.id?.toString());
                                setDraftReport(
                                  draft?.CheckDraftSoreLog?.[0]
                                    ?.score_meta_data,
                                );
                                setDraftApiEvaluationId(
                                  draft?.CheckDraftSoreLog?.[0]
                                    ?.score_meta_data?.id,
                                );
                                // The stored prior-art report was opened from
                                // the draft list. evaluation_report_opened covers
                                // the in-draft rail; this is the other door.
                                track("patent_report_opened", {
                                  evaluation_id:
                                    draft?.CheckDraftSoreLog?.[0]?.score_meta_data?.id,
                                });
                                setShowPatentReportModal(true);
                              }}
                              className={`rounded-lg border font-medium font-sans ${
                                theme === "dark"
                                  ? "bg-transparent hover:bg-white/5 hover:text-white text-gray-300 border-[#cccccc20]"
                                  : "bg-transparent hover:bg-white/10 text-gray-700 border-slate-300"
                              } hover:shadow-sm`}
                            >
                              <FileTextIcon className="h-3.5 w-3.5" />
                              {"View AI Report"}
                            </Button>
                          )}

                          {(() => {
                            const sendableStatuses = [
                              "IN_DRAFT",
                              "UPDATE_REQUEST",
                              // An appeal is a resubmission with a required
                              // reason (collected on click) — no cap.
                              "REJECT_BY_IHC",
                            ];
                            const statusDisabledReasons: Record<string, string> =
                              {
                                // REJECT_BY_IHC is deliberately absent: a
                                // rejection can be APPEALED — resubmission
                                // with a required reason, no cap.
                                UNDER_REVIEW: "Under review",
                                SEND_TO_OC: "Sent to Photon Legal",
                                REJECT_BY_OC: "Rejected by OC",
                                UPDATE_REQUEST_BY_OC: "Update requested by OC",
                              };
                            if (!isInventor) return null;
                            const isSendableStatus = sendableStatuses.includes(
                              mainIdeaData?.status,
                            );
                            const statusDisabledReason =
                              statusDisabledReasons[mainIdeaData?.status] ??
                              null;
                            if (!isSendableStatus && !statusDisabledReason)
                              return null;
                            if (isSendableStatus && draft?.ihc_sent === true)
                              return null;

                            const isSendingThisDraft =
                              isSendingToIHC &&
                              draftIdBeingSentToIHC === draft.id;
                            const hasScoreLog =
                              Array.isArray(draft?.CheckDraftSoreLog) &&
                              draft.CheckDraftSoreLog.length > 0;
                            const scoringFailed =
                              hasScoreLog &&
                              draft.CheckDraftSoreLog[0]?.success === false;
                            const scoringComplete =
                              hasScoreLog &&
                              !!draft.CheckDraftSoreLog[0]?.score_meta_data &&
                              !scoringFailed;

                            let disabledReason: string | null = null;
                            if (statusDisabledReason) {
                              disabledReason = statusDisabledReason;
                            } else if (draft.completion_percentage < 100) {
                              disabledReason = "Complete the draft first";
                            } else if (isCalculating) {
                              // A run in flight should finish before sending;
                              // an ABSENT score must not block submission —
                              // when the scoring service is offline the
                              // questionnaire is still the submission.
                              disabledReason = "Scoring in progress…";
                            }

                            const canSend =
                              !disabledReason && !isSendingToIHC;

                            const button = (
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => {
                                  if (canSend && onSendToIHC) {
                                    onSendToIHC(draft.id);
                                  }
                                }}
                                disabled={!canSend}
                                className={`rounded-lg font-semibold font-sans gap-2 ${
                                  canSend
                                    ? theme === "dark"
                                      ? "bg-[#F9B418] text-neutral-900 hover:bg-[#F9B418]"
                                      : "bg-[#F9B418] text-gray-900 hover:bg-[#F9B418]"
                                    : theme === "dark"
                                      ? "bg-neutral-800 text-neutral-500 hover:bg-neutral-800 cursor-not-allowed"
                                      : "bg-gray-200 text-gray-400 hover:bg-gray-200 cursor-not-allowed"
                                }`}
                              >
                                {isSendingThisDraft ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  "Send for review"
                                )}
                              </Button>
                            );

                            if (disabledReason) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex">
                                        {button}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{disabledReason}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return button;
                          })()}
                        </div>

                        <div className="flex flex-row gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleCopyDraft(draft.id)}
                                  className="h-8 w-8 rounded-full border-none border-slate-200 bg-transparent hover:bg-slate-50 cursor-pointer"
                                >
                                  <Copy
                                    className={`h-3.5 w-3.5 ${
                                      theme === "dark"
                                        ? "text-gray-400"
                                        : "text-gray-500"
                                    }`}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Clone draft</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {isInventor && (() => {
                            const isOnlyDraft =
                              (inventorIdeas?.length ?? 0) <= 1;
                            const wasSent = !!draft?.sent_to_ihc_at;
                            const disabled =
                              isDeletingDraft || wasSent || isOnlyDraft;
                            const tooltip = wasSent
                              ? "Cannot delete a draft that is in review"
                              : isOnlyDraft
                                ? "An idea must have at least one draft"
                                : "Delete draft";
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() =>
                                          handleDeleteDraft(draft.id)
                                        }
                                        disabled={disabled}
                                        className="h-8 w-8 rounded-full border-none border-slate-200 bg-transparent hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2
                                          className={`h-3.5 w-3.5 ${
                                            theme === "dark"
                                              ? "text-gray-400"
                                              : "text-gray-500"
                                          }`}
                                        />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </motion.div>
          );
        })}
      </ScrollArea>
    </div>
  );
};

export default DraftListView;
