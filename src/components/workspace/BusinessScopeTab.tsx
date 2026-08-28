import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Edit, FileText, Upload, Save, X, Check, Eye, Pen } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Separator } from "@/components/ui/separator";
import businessScopeQuestions from "@/lib/businessScopeQuestion";
import { useMutation } from "@tanstack/react-query";
import API_CONFIG from "@/lib/apiConfig";
import { toast } from "sonner";
import { useFileUpload } from "@/lib/api-service/commonApi.service";
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
import { useTheme } from "@/hooks/useTheme";
import { MAX_FILE_SIZE } from "@/utils/constants";

// Form validation schema
const formSchema = z.object({
  // Core Business and Current Operations
  primaryProducts: z.string().min(10, "Answer must be at least 10 characters"),
  marketsIndustries: z
    .string()
    .min(10, "Answer must be at least 10 characters"),
  existingIP: z.string().min(10, "Answer must be at least 10 characters"),
  technicalCapabilities: z
    .string()
    .min(10, "Answer must be at least 10 characters"),
  primaryCustomers: z.string().min(10, "Answer must be at least 10 characters"),

  // Strategic Vision and Future Goals
  strategicPriorities: z
    .string()
    .min(10, "Answer must be at least 10 characters"),
  emergingTrends: z.string().min(10, "Answer must be at least 10 characters"),
  longTermChallenges: z
    .string()
    .min(10, "Answer must be at least 10 characters"),
  rdFocusAreas: z.string().min(10, "Answer must be at least 10 characters"),
  expansionPlans: z.string().min(10, "Answer must be at least 10 characters"),

  // Patent and Innovation Strategy
  patentTypes: z.string().min(10, "Answer must be at least 10 characters"),
  technicalWhiteSpaces: z
    .string()
    .min(10, "Answer must be at least 10 characters"),
  patentCriteria: z.string().min(10, "Answer must be at least 10 characters"),
  innovationType: z.string().min(10, "Answer must be at least 10 characters"),
  legalBoundaries: z.string().min(10, "Answer must be at least 10 characters"),

  // Resources and Constraints
  rdBudget: z.string().min(10, "Answer must be at least 10 characters"),
  partnerships: z.string().min(10, "Answer must be at least 10 characters"),
  limitations: z.string().min(10, "Answer must be at least 10 characters"),
  priorityApproach: z.string().min(10, "Answer must be at least 10 characters"),

  // Competitive Landscape
  mainCompetitors: z.string().min(10, "Answer must be at least 10 characters"),
  competitorTrends: z.string().min(10, "Answer must be at least 10 characters"),
  uniqueAdvantages: z.string().min(10, "Answer must be at least 10 characters"),

  // Idea Evaluation Criteria
  successMetrics: z.string().min(10, "Answer must be at least 10 characters"),
  implementationFactors: z
    .string()
    .min(10, "Answer must be at least 10 characters"),
  aiPriorities: z.string().min(10, "Answer must be at least 10 characters"),
});

type BusinessScopeFormValues = z.infer<typeof formSchema>;

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
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
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string } | null>(null);

  const [businessScopeSections, setBusinessScopeSections] = useState(
    businessScopeData && businessScopeData?.meta_data
      ? businessScopeData?.meta_data
      : businessScopeQuestions
  );

  // Sync patent search mode from existing data when it becomes available
  useEffect(() => {
    if (businessScopeData?.type) {
      setPatentSearchMode(businessScopeData.type);
    }
  }, [businessScopeData?.type]);

  const {
    mutate: uploadFile,
    isPending: isUploadingFile,
    data: uploadFileData,
  } = useFileUpload();

  useEffect(() => {
    if (!businessScopeData) return;
    if (
      businessScopeData?.BusinessScopeFiles &&
      businessScopeData?.BusinessScopeFiles?.length > 0
    ) {
      setUploadedFiles(
        businessScopeData?.BusinessScopeFiles?.map((e: any) => e?.file)
      );
    }
  }, [businessScopeData]);

  useEffect(() => {
    if (uploadFileData) {
      const file_data = uploadFileData?.data;
      setUploadedFiles((prev) => [...prev, ...file_data]);
    }
  }, [uploadFileData]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Initialize form with default values
  const form = useForm<BusinessScopeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Core Business and Current Operations
      primaryProducts:
        "Cloud-based subscription management and billing software solutions, including Zuora Billing, Zuora Revenue, Zuora Collect, and related analytics tools.",
      marketsIndustries:
        "SaaS, Technology, Financial Services, Media, Telecommunications, Manufacturing, and Healthcare. Primary focus on North America, with growing presence in EMEA and APAC regions.",
      existingIP:
        "Over 25 patents related to subscription billing models, revenue recognition automation, usage-based pricing systems, and predictive analytics for subscription businesses.",
      technicalCapabilities:
        "Advanced billing automation, revenue recognition compliance, subscription analytics, payment processing integration, quote-to-cash workflows, and AI-driven customer insights.",
      primaryCustomers:
        "Enterprise and mid-market B2B companies transitioning to or optimizing subscription-based business models. Particularly strong in technology, media, and telecommunications verticals.",

      // Strategic Vision and Future Goals
      strategicPriorities:
        "1) Expand AI-powered analytics capabilities, 2) Strengthen mid-market presence, 3) Enhance multi-currency/global capabilities, 4) Develop industry-specific solutions, 5) Build partner ecosystem.",
      emergingTrends:
        "Exploring usage-based pricing models, embedded finance opportunities, blockchain for subscription contracts, and advanced ML for churn prediction and prevention.",
      longTermChallenges:
        "Enabling seamless business model transitions for large enterprises, solving complex multi-national compliance challenges, and creating unified subscription experiences across diverse product portfolios.",
      rdFocusAreas:
        "AI/ML for subscription intelligence, no-code/low-code customization frameworks, unified subscription data models, and advanced revenue forecasting algorithms.",
      expansionPlans:
        "Looking to expand into financial services offerings for subscription businesses, embedded billing solutions for vertical SaaS platforms, and industry-specific compliance solutions.",

      // Patent and Innovation Strategy
      patentTypes:
        "Primary focus on utility patents for our core billing and revenue recognition algorithms. Secondary focus on business method patents for subscription monetization approaches.",
      technicalWhiteSpaces:
        "Seeking to fill gaps in unified subscription data architecture, AI-driven payment optimization, cross-vertical subscription metrics standardization, and predictive usage pattern analysis.",
      patentCriteria:
        "Key criteria include uniqueness in the subscription management space, significant improvement over existing methods, alignment with market needs, and technical feasibility.",
      innovationType:
        "Balanced approach favoring both incremental improvements to core platform capabilities and more disruptive innovations in emerging areas like predictive analytics and AI-driven insights.",
      legalBoundaries:
        "Innovations must comply with global financial regulations, data privacy laws (GDPR, CCPA), and industry-specific regulatory requirements (e.g., healthcare, financial services).",

      // Resources and Constraints
      rdBudget:
        "Approximately 15-20% of annual revenue allocated to R&D, with specific innovation projects typically receiving $250K-$1M in initial development funding before broader rollout.",
      partnerships:
        "Active partnerships with CRM platforms, ERP systems, payment processors, and industry-specific solution providers. Also engage with academic institutions for research collaborations.",
      limitations:
        "Integration complexity with legacy systems, regulatory compliance across multiple jurisdictions, and balancing innovation with maintaining platform stability for enterprise customers.",
      priorityApproach:
        "Balance of both approaches: Quick wins for competitive features, but strategic investment in long-term differentiation for core platform capabilities.",

      // Competitive Landscape
      mainCompetitors:
        "Direct competitors include specialized subscription management platforms and larger ERP/CRM vendors adding subscription capabilities. Recent patent activity focused on AI-driven insights and flexible pricing models.",
      competitorTrends:
        "Seeking to counter emerging trends in consumption-based billing models, embedded fintech capabilities, and simplified subscription analytics for non-technical users.",
      uniqueAdvantages:
        "Our core differentiators include revenue recognition automation, subscription data unification, multi-entity management, and flexible monetization models across diverse industries.",

      // Idea Evaluation Criteria
      successMetrics:
        "Primary metrics include market differentiation potential, revenue impact, implementation complexity vs. benefit, strategic alignment, and ability to address multiple customer use cases.",
      implementationFactors:
        "Very important factors, with ideal innovations being highly scalable across customer segments and technically feasible within 6-12 month development cycles.",
      aiPriorities:
        "Balanced approach that prioritizes innovations strengthening core platform while exploring new capabilities that open adjacent market opportunities.",
    },
  });

  const { isPending: isSavingBusinessScope, mutate: updateBusinessScope } =
    useMutation({
      mutationKey: ["update_business_scope"],
      mutationFn: async (payload: any) => {
        try {
          const response = await API_CONFIG.put(
            `/api/v1/clients/update-business-scope/${clientId}`,
            payload
          );

          if (response.status === 201) {
            toast.success("Business scope information saved");
          }
        } catch (error) {
          console.error("Error saving business scope:", error);
          toast.error(
            error?.response?.data?.message || "Error saving business scope"
          );
        }
      },
    });

  // Save only the patent search mode (type) using the same update API
  const handleSavePatentSearchMode = () => {
    updateBusinessScope({
      type: patentSearchMode,
    });
  };

  const { isPending: isDeletingFile, mutate: deleteFile } = useMutation({
    mutationKey: ["delete_business_scope_file"],
    mutationFn: async (fileId: string) => {
      const response = await API_CONFIG.post(
        `/api/v1/clients/remove-business-scope-file/${clientId}/${fileId}`
      );
      if (response.status !== 200 && response.status !== 201) {
        throw new Error("Failed to delete file");
      }
      return response.data;
    },
    onSuccess: () => {
      if (fileToDelete) {
        removeFile(fileToDelete.id);
        toast.success("File removed successfully", {position:"top-center"});
      }
      setIsDeleteDialogOpen(false);
      setFileToDelete(null);
    },
    onError: (error) => {
      // Remove file from state even if API call fails
      if (fileToDelete) {
        removeFile(fileToDelete.id);
      }
      console.error("Error removing file:", error);
      setIsDeleteDialogOpen(false);
      setFileToDelete(null);
    },
  });

  const onSubmit = (data: BusinessScopeFormValues) => {
    setIsEditing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      // Allowed file extensions
      const allowedExtensions = [
        ".xls",
        ".xlsx",
        ".csv",
        ".txt",
        ".doc",
        ".docx",
        ".pdf",
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".ico"
      ];

      // Validate file types
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      for (const file of files) {
        if (file?.size >= MAX_FILE_SIZE) {
          toast.error("File must be less than 1GB", {position:"top-center"});
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
          `Invalid file format(s): ${invalidFiles.join(", ")}. Only .xls, .xlsx, .csv, .txt, .doc, .docx, .pdf .jpg, .jpeg, .png, .gif, .bmp, .webp, .svg, .tiff, .ico files are allowed.`, {position:"top-center"}
        );
        // Reset the input
        e.target.value = "";
        return;
      }

      // Proceed with upload only if all files are valid
      if (validFiles.length > 0) {
        uploadFile({ files: validFiles, category: "image" });
      }

      // Reset the input after processing
      e.target.value = "";
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(uploadedFiles.filter((file) => file.id !== id));
  };

  const handleDeleteClick = (file: { id: string }) => {
    setFileToDelete(file);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!fileToDelete) return;
    deleteFile(fileToDelete.id);
  };

  // Section renderer
  const renderSection = (
    title: string,
    fields: { name: keyof BusinessScopeFormValues; label: string }[]
  ) => {
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="space-y-6">
          {fields.map((field) => (
            <FormField
              key={String(field.name)}
              control={form.control}
              name={field.name}
              render={({ field: fieldProps }) => (
                <FormItem>
                  <FormLabel>{field.label}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...fieldProps}
                      disabled={!isEditing}
                      className={!isEditing ? "bg-gray-50" : ""}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>
    );
  };

  const handleAnswerChange = (
    sectionId: string,
    questionId: string,
    value: string
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
                : question
            ),
          }
          : section
      )
    );
  };

  return (
    <div className="space-y-6 mt-5 mb-10">
      <div
        className={`border rounded-xl p-6 backdrop-blur-xl ${theme === "dark"
            ? "bg-white/5 border-white/10"
            : "bg-white/80 border-neutral-200"
          }`}
      >
        <h2
          className={`mb-4 text-lg font-bold font-sans ${theme === "dark" ? "text-neutral-100" : "text-neutral-900"
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
                className={`w-5 h-5 rounded-full border-2 transition-all relative ${patentSearchMode === "BUSINESS_SCOPE"
                    ? "border-[#F9B418] bg-[#F9B418]/20"
                    : theme === "dark"
                      ? "border-white/20 group-hover:border-white/30"
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
              className={`text-sm transition-colors ${patentSearchMode === "BUSINESS_SCOPE"
                  ? theme === "dark"
                    ? "text-neutral-200"
                    : "text-neutral-900"
                  : theme === "dark"
                    ? "text-neutral-400 group-hover:text-neutral-300"
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
                className={`w-5 h-5 rounded-full border-2 transition-all relative ${patentSearchMode === "AI_AGENT"
                    ? "border-[#F9B418] bg-[#F9B418]/20"
                    : theme === "dark"
                      ? "border-white/20 group-hover:border-white/30"
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
              className={`text-sm transition-colors ${patentSearchMode === "AI_AGENT"
                  ? theme === "dark"
                    ? "text-neutral-200"
                    : "text-neutral-900"
                  : theme === "dark"
                    ? "text-neutral-400 group-hover:text-neutral-300"
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
                className={`w-5 h-5 rounded-full border-2 transition-all relative ${patentSearchMode === "BUSINESS_SCOPE_AI_AGENT"
                    ? "border-[#F9B418] bg-[#F9B418]/20"
                    : theme === "dark"
                      ? "border-white/20 group-hover:border-white/30"
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
              className={`text-sm transition-colors ${patentSearchMode === "BUSINESS_SCOPE_AI_AGENT"
                  ? theme === "dark"
                    ? "text-neutral-200"
                    : "text-neutral-900"
                  : theme === "dark"
                    ? "text-neutral-400 group-hover:text-neutral-300"
                    : "text-neutral-600 group-hover:text-neutral-700"
                }`}
            >
              Business Scope + AI Agent
            </span>
          </label>
        </div>

        <button
          onClick={() => {
            handleSavePatentSearchMode();
          }}
          disabled={isSavingBusinessScope}
          className={`font-sans mt-4 flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${theme === "dark"
              ? "border-white/10 text-neutral-400 hover:text-[#F9B418] hover:border-[#F9B418]/50"
              : "border-neutral-200 text-neutral-600 hover:text-[#F9B418] hover:border-[#F9B418]"
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
            className="lucide lucide-save w-4 h-4"
          >
            <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
            <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path>
            <path d="M7 3v4a1 1 0 0 0 1 1h7"></path>
          </svg>
          Save
        </button>
      </div>

      <div
        className={`border rounded-xl p-6 backdrop-blur-xl ${theme === "dark"
            ? "bg-zinc-900 border-[#cccccc20]"
            : "bg-white/80 border-neutral-200"
          }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className={`text-lg font-bold ${theme === "dark" ? "text-zinc-200" : "text-neutral-900"
              }`}
          >
            Business Scope Assessment
          </h2>
          {isEditing ? (
            <button
              onClick={() => {
                // Persist the latest answers and attached files when switching to view mode
                updateBusinessScope({
                  meta_data: businessScopeSections,
                  files:
                    uploadedFiles?.length > 0
                      ? uploadedFiles.map((file: any) => file?.id)
                      : [],
                });
                setIsEditing(false);
              }}
              disabled={isSavingBusinessScope}
              className="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors text-neutral-500 hover:text-[#F9B418] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="w-4 h-4" />
              {isSavingBusinessScope ? "Saving..." : "View Mode"}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
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
              <h3 className="mb-4 text-[#F9B418] font-bold">{section.title}</h3>
              <div className="space-y-6">
                {section?.questions?.map((question) => (
                  <div key={question.id}>
                    <label
                      className={`block text-sm mb-2 ${theme === "dark"
                          ? "text-neutral-400"
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
                            e.target.value
                          )
                        }
                        placeholder={
                          question?.placeholder || "Enter your answer here..."
                        }
                        className={`${theme === "dark"
                            ? "bg-zinc-800 border-[#cccccc20] text-zinc-200"
                            : "bg-white border-neutral-200"
                          } p-4 border rounded-lg min-h-[100px] focus:border-[#F9B418] focus:ring-2 focus:ring-[#F9B418]/20 transition-all w-full resize-y`}
                      />
                    ) : (
                      <div
                        className={`${theme === "dark"
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
      </div>

      <Card
        className={`rounded-xl border bg-card text-card-foreground shadow-sm ${theme === "dark"
            ? " bg-zinc-900 text-neutral-400 border-[#cccccc20]"
            : "bg-white/80 border-neutral-200"
          }`}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="mb-4 text-[#F9B418] font-bold">
            <h3 className="text-xl font-bold">Supporting Documents</h3>
          </CardTitle>
          {isEditing && (
            <div>
              <label htmlFor="file-upload">
                <Button
                  variant="outline"
                  className="gap-2 cursor-pointer dark:hover:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-transparent dark:border-[#cccccc20] active:text-neutral-400"
                  asChild
                >
                  <div>
                    <Upload size={16} />
                    {isUploadingFile ? "Uploading..." : "Upload Files"}
                    <input
                      disabled={isUploadingFile}
                      id="file-upload"
                      type="file"
                      multiple
                      accept=".xls,.xlsx,.csv,.txt,.doc,.docx,.pdf,.jpg,.jpeg,.svg,.png,.gif,.bmp,.tiff,.ico,.webp"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                </Button>
              </label>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {uploadedFiles.length === 0 ? (
            <div className="text-center py-8 text-neutral-300">
              <FileText className="mx-auto h-12 w-12 opacity-30 mb-2" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadedFiles?.map((file: any) => (
                <div
                  key={file.id}
                  className="border dark:border-[#cccccc20] rounded-lg p-4 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-blue-600" />
                      <span className="font-medium text-sm truncate max-w-[150px]">
                        {file?.original_name}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDeleteClick(file)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 mt-auto">
                    {formatFileSize(file?.size)} • {file?.type?.split("/")[1]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent className="dark:bg-[#0a0a0a] dark:border-[#cccccc20]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-sans dark:text-neutral-300">Are you sure?</AlertDialogTitle>
              <AlertDialogDescription className="font-sans dark:text-neutral-300">
                This action cannot be undone. This will permanently delete the
                file from the business scope.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-sans dark:text-neutral-400 bg-transparent dark:border-[#cccccc20]">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="font-sans bg-[#ff0000] hover:bg-[#db0f0f]">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
};

export default BusinessScopeTab;
