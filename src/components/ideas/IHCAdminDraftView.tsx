import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { Section } from "./DraftCreationContent";
import AudioInput from "../AudioInput";

interface IHCAdminDraftViewProps {
  theme?: 'dark' | 'light';
  sections: Section[];
  user: any;
  mainIdeaData: any;
  isScoreCalculateError: boolean;
  handleAnswerChange: (
    sectionId: string,
    questionId: string,
    value: string
  ) => void;
  handleCheckScore: () => void;
  isCalculatingScore: boolean;
  isAddingEvaluation: boolean;
  getSupportingFilesSection: () => JSX.Element;
}

const IHCAdminDraftView: React.FC<IHCAdminDraftViewProps> = ({
  theme = 'light',
  sections,
  user,
  mainIdeaData,
  handleAnswerChange,
  handleCheckScore,
  isCalculatingScore,
  isAddingEvaluation,
  getSupportingFilesSection,
  isScoreCalculateError,
}) => {
  return (
    <>
      <div className="flex flex-col h-full gap-4 overflow-y-auto px-6 pb-10">
        {sections?.map((section) => (
          <div key={section.id} id={section.id} className={`rounded-lg backdrop-blur-sm border p-6 ${theme === "light"
            ? "border-gray-200 bg-white/80"
            : "border-white/10 bg-black/40"
            }`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-base ${theme === "light" ? "text-gray-900" : "text-white"}`}>
                {section.title}
              </h4>
              <span className={`text-xs ${theme === "light" ? "text-gray-500" : "text-neutral-500"}`}>
                {
                  section.questions.filter(
                    (q: any) => q.answer.trim().length > 0
                  ).length
                }
                /{section.questions.length} completed
              </span>
            </div>

            <div className="space-y-6 w-full">
              <div className="space-y-6 w-full">
                {section.questions.map((question, idx) => (
                  <div key={question.id} className="space-y-3 w-full">
                    <div className="flex items-start justify-between">
                      <label
                        className={`block font-sans text-xs font-medium uppercase tracking-wide ${theme === "dark"
                          ? "text-gray-400"
                          : "text-gray-700"
                          }`}
                      >
                        Q{idx + 1}: {question.text}{" "}
                        <span className="text-[#F9B418] ml-1">*</span>
                      </label>
                    </div>
                    <div className="relative">
                      <Textarea
                        value={question.answer}
                        onChange={(e) => {
                          if (e.target.value !== question.answer) {
                            handleAnswerChange(
                              section.id,
                              question.id,
                              e.target.value
                            );
                          }
                        }}
                        required
                        disabled
                        placeholder="Enter your reponse..."
                        className={`min-h-[70px] bg-gray-50/5 text-sm rounded-lg pr-8 pb-2 ${theme === "dark"
                          ? "border-[#cccccc20] text-neutral-200"
                          : "border-gray-200 text-zinc-900"
                          } border transition-all w-full resize-y`}
                      />
                      {/* <div className="absolute opacity-50 hover:opacity-100 bottom-4 right-4 flex items-center gap-5">
                        <AudioInput
                          onTranscript={(transcript) => {
                            // Append transcribed text to existing content
                            const currentText =
                              question.answer.trim();
                            const newText = currentText
                              ? `${currentText} ${transcript}`
                              : transcript;
                            handleAnswerChange(
                              section.id,
                              question.id,
                              newText
                            );
                          }}
                          languageCode="en-IN"
                          disabled={[
                            "SEND_TO_OC",
                            "UNDER_REVIEW",
                          ]?.includes(mainIdeaData?.idea?.status)}
                        />
                      
                      </div> */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {getSupportingFilesSection()}

        {/* {user?.role === "LEGAL_COUNSEL" &&
          user?.id !== mainIdeaData?.created_by_id &&
          mainIdeaData?.status === "UNDER_REVIEW" ? (
          <div className="w-full flex justify-center">
            <Button
              onClick={handleCheckScore}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-md font-medium mt-4 mb-6"
              disabled={isCalculatingScore && !isScoreCalculateError}
            >
              {isAddingEvaluation ? (
                <>
                  <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Calculate Score
                </>
              )}
            </Button>
          </div>
        ) : null} */}
      </div>


    </>

  );
};

export default IHCAdminDraftView;
