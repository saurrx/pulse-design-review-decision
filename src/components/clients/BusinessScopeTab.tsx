import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Save, Edit, Pen, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import businessScopeQuestions from "@/lib/businessScopeQuestion";
import { useMutation, useQuery } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { useTheme } from "@/hooks/useTheme";

interface BusinessScopeFormData {
  // Core Business
  primaryProducts: string;
  industriesMarkets: string;
  keyIP: string;
  technicalCapabilities: string;
  primaryCustomers: string;

  // Strategic Vision
  strategicPriorities: string;
  emergingTrends: string;
  longTermChallenges: string;
  rdFocusAreas: string;
  expansionPlans: string;

  // Patent Strategy
  patentTypes: string;
  technicalWhiteSpaces: string;
  patentabilityCriteria: string;
  innovationType: string;
  legalBoundaries: string;

  // Resources
  budgetAllocation: string;
  partnerships: string;
  limitations: string;
  timeToMarketPriority: string;

  // Competitive Landscape
  mainCompetitors: string;
  competitorTrends: string;
  uniqueAdvantages: string;

  // Evaluation Criteria
  successMetrics: string;
  implementationFactors: string;
  aiPrioritization: string;

  // Patent Search Mode
  patentSearchMode: "BUSINESS_SCOPE" | "AI_AGENT" | "BUSINESS_SCOPE_AI_AGENT";
}

const BusinessScopeTab: React.FC<{
  clientId: string;
  businessScopeData: any;
}> = ({ clientId, businessScopeData }) => {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [patentSearchMode, setPatentSearchMode] = useState<
    "BUSINESS_SCOPE" | "AI_AGENT" | "BUSINESS_SCOPE_AI_AGENT"
  >(businessScopeData?.type || "BUSINESS_SCOPE");
  const [isSavingMode, setIsSavingMode] = useState(false);

  const [businessScopeSections, setBusinessScopeSections] = useState(
    businessScopeData && businessScopeData?.meta_data
      ? businessScopeData?.meta_data
      : businessScopeQuestions,
  );

  const handleEdit = () => {
    setIsEditing(true);
  };

  const saveSearchMode = () => {
    setIsSavingMode(true);
    updateBusinessScope({
      type: patentSearchMode,
    });
  };

  const { isPending: isSavingBusinessScope, mutate: updateBusinessScope } =
    useMutation({
      mutationKey: ["update_business_scope"],
      mutationFn: async (payload: any) => {
        try {
          const response = await API_CONFIG.put(
            `/api/v1/clients/update-business-scope/${clientId}`,
            payload,
          );

          if (response.status === 201) {
            toast.success("Business scope information saved");
          }
          return response.data;
        } catch (error) {
          console.error("Error saving business scope:", error);
          toast.error(
            error?.response?.data?.message || "Error saving business scope"
          );
          throw error;
        }
      },
      onSettled: () => {
        setIsSavingMode(false);
      },
    });

  const handleAnswerChange = (
    sectionId: string,
    questionId: string,
    value: string,
  ) => {
    setBusinessScopeSections((prevSections) =>
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

  return (
    <div className="space-y-6">
      <div
        className={`border rounded-xl p-6 backdrop-blur-xl ${
          theme === "dark"
            ? "bg-neutral-900 border-[#cccccc20]"
            : "bg-white/80 border-neutral-200"
        }`}
      >
        <h2
          className={`mb-4 text-lg font-bold font-sans ${
            theme === "dark" ? "text-zinc-200" : "text-neutral-900"
          }`}
        >
          Patent Search Mode
        </h2>
        <div className="space-y-3 relative z-10 font-sans">
          <label className="flex items-center gap-3 cursor-pointer group relative">
            <div className="relative">
              <input
                type="radio"
                name="patentSearchMode"
                className="sr-only"
                value="BUSINESS_SCOPE"
                checked={patentSearchMode === "BUSINESS_SCOPE"}
                onChange={() => setPatentSearchMode("BUSINESS_SCOPE")}
              />
              <div
                className={`w-5 h-5 rounded-full border-2 transition-all relative ${
                  patentSearchMode === "BUSINESS_SCOPE"
                    ? "border-[#F9B418] bg-[#F9B418]/20"
                    : "border-neutral-300 group-hover:border-neutral-400"
                }`}
              >
                {patentSearchMode === "BUSINESS_SCOPE" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F9B418]"></div>
                  </div>
                )}
              </div>
            </div>
            <span
              className={`text-sm transition-colors ${
                patentSearchMode === "BUSINESS_SCOPE"
                  ? theme === "dark"
                    ? "text-zinc-200"
                    : "text-neutral-900"
                  : theme === "dark"
                    ? "text-zinc-200"
                    : "text-neutral-600 group-hover:text-neutral-700"
              }`}
            >
              Business Scope
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group relative">
            <div className="relative">
              <input
                type="radio"
                name="patentSearchMode"
                className="sr-only"
                value="AI_AGENT"
                checked={patentSearchMode === "AI_AGENT"}
                onChange={() => setPatentSearchMode("AI_AGENT")}
              />
              <div
                className={`w-5 h-5 rounded-full border-2 transition-all relative ${
                  patentSearchMode === "AI_AGENT"
                    ? "border-[#F9B418] bg-[#F9B418]/20"
                    : "border-neutral-300 group-hover:border-neutral-400"
                }`}
              >
                {patentSearchMode === "AI_AGENT" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F9B418]"></div>
                  </div>
                )}
              </div>
            </div>
            <span
              className={`text-sm transition-colors ${
                patentSearchMode === "AI_AGENT"
                  ? theme === "dark"
                    ? "text-zinc-200"
                    : "text-neutral-900"
                  : theme === "dark"
                    ? "text-zinc-200"
                    : "text-neutral-600 group-hover:text-neutral-700"
              }`}
            >
              AI Agent
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group relative">
            <div className="relative">
              <input
                type="radio"
                name="patentSearchMode"
                className="sr-only"
                value="BUSINESS_SCOPE_AI_AGENT"
                checked={patentSearchMode === "BUSINESS_SCOPE_AI_AGENT"}
                onChange={() => setPatentSearchMode("BUSINESS_SCOPE_AI_AGENT")}
              />
              <div
                className={`w-5 h-5 rounded-full border-2 transition-all relative ${
                  patentSearchMode === "BUSINESS_SCOPE_AI_AGENT"
                    ? "border-[#F9B418] bg-[#F9B418]/20"
                    : "border-neutral-300 group-hover:border-neutral-400"
                }`}
              >
                {patentSearchMode === "BUSINESS_SCOPE_AI_AGENT" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F9B418]"></div>
                  </div>
                )}
              </div>
            </div>
            <span
              className={`text-sm transition-colors ${
                patentSearchMode === "BUSINESS_SCOPE_AI_AGENT"
                  ? theme === "dark"
                    ? "text-zinc-200"
                    : "text-neutral-900"
                  : theme === "dark"
                    ? "text-zinc-200"
                    : "text-neutral-600 group-hover:text-neutral-700"
              }`}
            >
              Business Scope + AI Agent
            </span>
          </label>
        </div>
        <button
          onClick={saveSearchMode}
          disabled={isSavingMode}
          className={`${
            theme === "dark"
              ? "text-neutral-400 border-[#cccccc20]"
              : "text-neutral-600 border-neutral-200"
          } mt-4 flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs transition-colors hover:text-[#F9B418] hover:border-[#F9B418] disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Save className={`w-4 h-4 ${theme === "dark" && "text-gray-400"}`} />
          {isSavingMode ? "Saving..." : "Save"}
        </button>
      </div>

      <div
        className={`border rounded-xl p-6 backdrop-blur-xl ${
          theme === "dark"
            ? "bg-neutral-900 border-[#cccccc20]"
            : "bg-white/80 border-neutral-200"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className={`text-lg font-bold font-sans ${
              theme === "dark" ? "text-zinc-200" : "text-neutral-900"
            }`}
          >
            Business Scope Assessment
          </h2>
          {isEditing ? (
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors text-neutral-500 hover:text-[#F9B418]"
            >
              <Eye className="w-4 h-4" />
              View Mode
            </button>
          ) : (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors text-neutral-500 hover:text-[#F9B418]"
            >
              <Pen className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="space-y-8">
          {businessScopeSections?.map((section, sectionIndex) => (
            <div
              key={section.id}
              className={
                sectionIndex < businessScopeSections.length - 1 ? "mb-8" : ""
              }
            >
              <h3 className="mb-4 text-[#F9B418] font-bold font-sans">
                {section.title}
              </h3>
              <div className="space-y-6">
                {section?.questions?.map((question) => (
                  <div key={question.id}>
                    <label
                      className={`block text-sm mb-2 font-sans ${
                        theme === "dark"
                          ? "text-neutral-200"
                          : "text-neutral-700"
                      }`}
                    >
                      {question.text}
                    </label>
                    {isEditing ? (
                      <Textarea
                        value={question.answer || ""}
                        onChange={(e) =>
                          handleAnswerChange(
                            section.id,
                            question.id,
                            e.target.value,
                          )
                        }
                        placeholder={
                          question?.placeholder || "Enter your answer here..."
                        }
                        className={`${theme === "dark" ? "bg-zinc-800 border-[#cccccc20] text-zinc-200" : "bg-white border-neutral-200"} p-4 border rounded-lg min-h-[100px] focus:border-[#F9B418] focus:ring-2 focus:ring-[#F9B418]/20 transition-all w-full resize-y`}
                      />
                    ) : (
                      <div
                        className={`${
                          theme === "dark"
                            ? "bg-zinc-800 border-[#cccccc20] text-neutral-400"
                            : "bg-neutral-50 border-neutral-200 text-neutral-600"
                        } p-4 border rounded-md min-h-[100px]`}
                      >
                        {question.answer || "No information provided"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {isEditing && (
          <div className="flex justify-end mt-6">
            <button
              onClick={() => {
                updateBusinessScope({
                  meta_data: businessScopeSections,
                });
                setIsEditing(false);
              }}
              disabled={isSavingBusinessScope}
              className="flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs transition-colors border-neutral-200 text-neutral-600 hover:text-[#F9B418] hover:border-[#F9B418] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSavingBusinessScope ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessScopeTab;
