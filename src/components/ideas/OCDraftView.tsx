import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import AudioInput from "../AudioInput";

interface OCDraftViewProps {
  ideaDraft: any;
  theme?: 'dark' | 'light';
}

const OCDraftView: React.FC<OCDraftViewProps> = ({ ideaDraft, theme = "light" }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="mx-auto w-full space-y-6 px-6 pb-10">
        {ideaDraft[0]?.meta_data?.map((section) => (
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
                        // onChange={(e) => {
                        //   if (e.target.value !== question.answer) {
                        //     handleAnswerChange(
                        //       section.id,
                        //       question.id,
                        //       e.target.value
                        //     );
                        //   }
                        // }}
                        required
                        disabled
                        placeholder="Enter your reponse..."
                        className={`min-h-[70px] bg-gray-50/5 text-sm rounded-lg ${theme === "dark"
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
                        <Sparkles
                          size={16}
                          className={
                            theme === "dark"
                              ? "text-gray-300"
                              : "text-gray-500"
                          }
                        />
                      </div> */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OCDraftView; 