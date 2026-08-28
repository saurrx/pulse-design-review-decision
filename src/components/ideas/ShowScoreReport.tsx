import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  InfoIcon,
} from "lucide-react";
import { Card } from "../ui/card";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import ConciseEvaluationReport from "./DownloadReport";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import API_CONFIG from "@/lib/apiConfig";
import React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

// Extended interfaces for the report
interface ScoringResult {
  score: number | null;
  score_meta_data: any;
  evaluationId?: string;
  summary: string;
  noveltyScore: number | null;
  similarityScore: number | null;
  confidenceLevel: string;
  scoringMethod?: string;
  detailedAnalysis: {
    marketScore: number | null;
    technicalScore: number | null;
    feasibilityScore: number | null;
    implementationScore: number | null;
    directNoveltyScore?: number;
    confidenceFactors?: {
      dataQuality: number;
      dataPrecision: number;
      evaluationCount: number;
      technicalCoverage: number;
    };
  };
  evaluationMetrics: {
    evaluationCount: number;
    maxSimilarity: number;
    avgSimilarity: number;
  };
  closestMatchesSummary?: Array<{
    score: number;
    title: string;
    noveltyScore: number;
    keySimilarities: string[];
    publicationNumber?: string;
    distinctDifferences: string[];
    overlappingConcepts: string[];
  }>;
  closestMatches: Array<{
    title: string;
    abstract: string;
    publicationNumber: string;
    score: number;
    analysis: string;
    url: string;
    noveltyScore: number;
    keySimilarities: string[];
    distinctDifferences: string[];
    overlappingConcepts: string[];
  }>;
  recommendations: string[];
}

interface PriorArt {
  url: string;
  title: string;
  abstract: string;
  publicationNumber?: string;
}

interface PatentNoveltyReportProps {
  scoringResult: ScoringResult;
  api_evaluation_id: string;
  priorArt: PriorArt[];
  title: string;
  report: {
    id: string;
    score: number;
    report: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    scoringResult: ScoringResult;
  };
  embedded?: boolean;
}

export default function PatentNoveltyReport({
  scoringResult,
  priorArt,
  title,
  report,
  api_evaluation_id,
  embedded = false,
}: PatentNoveltyReportProps) {
  const { theme } = useTheme();
  const [reEvalOpen, setReEvalOpen] = React.useState(false);
  const [patentInput, setPatentInput] = React.useState("");
  // First prior-art reference expanded by default; the rest collapse to rows.
  const [expandedArts, setExpandedArts] = React.useState<Set<number>>(
    () => new Set([0])
  );
  const [summaryExpanded, setSummaryExpanded] = React.useState(false);
  const toggleArt = (i: number) =>
    setExpandedArts((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const {
    mutate: reEvalMutate,
    isPending: isReEvalLoading,
    error: reEvalError,
    reset: resetReEval,
  } = useMutation({
    mutationKey: ["re_evaluate_patent", api_evaluation_id],
    mutationFn: async (patentNumbers: string[]) => {
      const response = await API_CONFIG.post(
        `/api/v1/idea/re-evaluate/${api_evaluation_id}`,
        { patent_numbers: patentNumbers }
      );
      return response.data;
    },
    onSuccess: () => {
      setReEvalOpen(false);
      setPatentInput("");
      toast.success("Re-evaluation started successfully.");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          "Failed to re-evaluate. Please try again."
      );
    },
  });

  const handleReEvalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetReEval();
    // Split by comma or newline, trim, and filter empty
    const patentNumbers = patentInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (patentNumbers.length === 0) {
      toast.error("Please enter at least one patent number.");
      return;
    }
    reEvalMutate(patentNumbers);
  };

  /**
   * Styling Helpers
   */
  // Determine score color based on score threshold
  const getScoreColor = (score: number | null | undefined) => {
    const numScore = typeof score === "number" ? score : 0;
    if (numScore >= 8) return "text-green-700";
    if (numScore >= 5) return "text-green-500";
    return "text-green-500";
  };

  // Determine score background color based on score threshold
  const getScoreBackground = (score: number | null | undefined) => {
    const numScore = typeof score === "number" ? score : 0;
    if (numScore >= 8) return "bg-blue-50";
    if (numScore >= 5) return "bg-blue-50/70";
    return "bg-blue-50/50";
  };

  // Determine progress bar color based on score threshold
  const getBarColor = (score: number | null | undefined) => {
    const numScore = typeof score === "number" ? score : 0;
    if (numScore >= 8) return "bg-blue-600";
    if (numScore >= 5) return "bg-blue-400";
    return "bg-blue-300";
  };

  // Format date string
  const formatDate = (dateString?: string) => {
    if (!dateString)
      return new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format a label from camelCase to Title Case with spaces
  const formatLabel = (label: string) => {
    return label
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  };

const enrichedPriorArt = priorArt.map((art, index) => {
  const matchSummary =
    scoringResult.closestMatches?.[index] ||
    null;

  const similarityScore =
    typeof (matchSummary as any)?.similarityScore === "number"
      ? (matchSummary as any).similarityScore
      : typeof (matchSummary as any)?.score === "number"
        ? (matchSummary as any).score
        : null;

  return {
    art,
    noveltyScore:
      typeof matchSummary?.noveltyScore === "number"
        ? matchSummary.noveltyScore
        : null,
    similarityScore,
    matchSummary,
  };
});

const sortedPriorArt = [...enrichedPriorArt].sort((a, b) => {
  if (a.noveltyScore === null) return 1;
  if (b.noveltyScore === null) return -1;
  if (a.noveltyScore !== b.noveltyScore)
    return a.noveltyScore - b.noveltyScore;
  // same novelty score: lower similarityScore first
  const sa = a.similarityScore;
  const sb = b.similarityScore;
  if (sa === null && sb === null) return 0;
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sa - sb;
});

// Show only the first 5 items after sorting
const topPriorArt = sortedPriorArt.slice(0, 5);

  return (
    <div className={embedded ? "w-full space-y-6" : "max-w-7xl mx-auto p-6 space-y-6"}>
      {!embedded && (
      <Dialog open={reEvalOpen} onOpenChange={setReEvalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Re-evaluate with New Patent Numbers</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReEvalSubmit} className="space-y-4">
            <label className="block font-medium mb-1">
              Enter patent numbers (comma or newline separated):
            </label>
            <textarea
              rows={4}
              placeholder="US1234567A1, US7654321B2, ..."
              value={patentInput}
              onChange={(e) => setPatentInput(e.target.value)}
              disabled={isReEvalLoading}
              name="patent_numbers"
              className="resize-y min-h-[80px] flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {reEvalError && (
              <div className="text-red-500 text-sm">
                {reEvalError instanceof Error
                  ? reEvalError.message
                  : "Failed to re-evaluate. Please try again."}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReEvalOpen(false)}
                disabled={isReEvalLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isReEvalLoading}>
                {isReEvalLoading ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}
      {/* Report Container */}
      <div
        className={`${
          theme === "dark" ? "bg-[#0e0e0e]" : "bg-white"
        } print:shadow-none font-sans`}
      >
        {/* ---------- HEADER SECTION ---------- */}
        {/* <div className="mb-12 text-center border-b pb-6">
          <h1 className="text-3xl font-bold text-blue-900 mb-3">
            Photon Pulse Evaluation Report
          </h1>
          <p className="text-sm text-gray-500 flex justify-center items-center gap-2">
            <FileText className="h-4 w-4" />
            Generated on {formatDate()}
            {scoringResult.evaluationId && <span className="mx-1">•</span>}
            {scoringResult.evaluationId && (
              <span>ID: {scoringResult.evaluationId.substring(0, 8)}</span>
            )}
          </p>
        </div> */}

        {/* ---------- SCORE STAT HEADER ---------- */}
        <div className="mb-8 flex min-h-[80px] items-start gap-6 font-sans">
          {typeof scoringResult?.noveltyScore === "number" ? (
            <>
              <div
                className={`text-5xl font-semibold leading-none ${
                  theme === "dark" ? "text-zinc-100" : "text-[#0C0C0C]"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(scoringResult.noveltyScore)}
                <span
                  className={`ml-1 text-xl font-normal ${
                    theme === "dark" ? "text-gray-400" : "text-[#727272]"
                  }`}
                >
                  /100
                </span>
              </div>
              <div>
                <div
                  className={`text-sm font-medium ${
                    theme === "dark" ? "text-zinc-100" : "text-[#0C0C0C]"
                  }`}
                >
                  Patentability Score
                </div>
                {scoringResult?.summary && (
                  <div>
                    <p
                      className={`mt-1 text-sm ${
                        theme === "dark" ? "text-neutral-400" : "text-gray-600"
                      } ${
                        scoringResult.summary.length > 200 && !summaryExpanded
                          ? "line-clamp-3"
                          : ""
                      }`}
                    >
                      {scoringResult.summary}
                    </p>
                    {scoringResult.summary.length > 200 && (
                      <button
                        type="button"
                        onClick={() => setSummaryExpanded((v) => !v)}
                        className={`mt-1 text-sm font-medium underline-offset-2 hover:underline ${
                          theme === "dark" ? "text-zinc-300" : "text-zinc-700"
                        }`}
                      >
                        {summaryExpanded ? "Less" : "More"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              className={`text-sm font-medium ${
                theme === "dark" ? "text-gray-400" : "text-[#727272]"
              }`}
            >
              Scoring in progress
            </div>
          )}
        </div>

        {/* ---------- PRIOR ART ANALYSIS SECTION ---------- */}
        <div className="mb-12">
          <h2
            className={`text-xl font-semibold mb-5 pb-2 ${
              theme === "dark" ? "text-zinc-200" : "text-zinc-800"
            }`}
          >
            Prior Art Analysis
            {typeof scoringResult?.evaluationMetrics?.evaluationCount ===
              "number" && (
              <span
                className={`ml-2 text-sm font-normal ${
                  theme === "dark" ? "text-neutral-400" : "text-gray-600"
                }`}
              >
                ·{" "}
                {scoringResult.evaluationMetrics.evaluationCount} references
                evaluated
                {topPriorArt.length <
                  scoringResult.evaluationMetrics.evaluationCount &&
                  ` · ${topPriorArt.length} shown`}
              </span>
            )}
          </h2>
          <div className="space-y-6">
            {topPriorArt && topPriorArt?.length > 0 ? (
              topPriorArt.map((item, index) => {
                // Get the corresponding match summary if exists
                const matchSummary = item?.matchSummary;
                const art = item?.art;
                return (
                  <Card
                    key={index}
                    className={`overflow-hidden border ${
                      theme === "dark" && "border-[#cccccc20] bg-white/5"
                    }`}
                  >
                    {/* Header — click to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => toggleArt(index)}
                      aria-expanded={expandedArts.has(index)}
                      className="w-full p-6 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <h3
                            className={`font-semibold ${
                              theme === "dark" ? "text-white" : "text-zinc-800"
                            }`}
                          >
                            {matchSummary?.title ||
                              art?.title ||
                              "Untitled Document"}
                          </h3>
                          {(matchSummary?.publicationNumber ||
                            art?.publicationNumber) && (
                            <span
                              className={`font-mono text-xs ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-600"
                              }`}
                            >
                              {matchSummary?.publicationNumber ||
                                art?.publicationNumber}
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          className={`mt-1 h-4 w-4 shrink-0 text-[#727272] transition-transform ${
                            expandedArts.has(index) ? "" : "-rotate-90"
                          }`}
                        />
                      </div>
                    </button>

                    {/* Content */}
                    {expandedArts.has(index) && (
                    <div className="px-5">
                      {/* Abstract */}
                      {(matchSummary?.abstract || art?.abstract) && (
                        <div className="mb-5">
                          <h4
                            className={`${
                              theme === "dark"
                                ? "text-gray-500"
                                : "text-gray-800"
                            } text-xs uppercase font-semibold mb-3`}
                          >
                            Abstract
                          </h4>
                          <p
                            className={`text-sm font-sans ${
                              theme === "dark"
                                ? "text-neutral-400"
                                : "text-gray-600"
                            }`}
                          >
                            {matchSummary?.abstract || art?.abstract}
                          </p>
                        </div>
                      )}

                      {/* Analysis Grid */}
                      <div className="grid gap-6">
                        {/* Left Col - Similarities & Differences */}
                        <div>
                          {/* Similarities */}
                          {matchSummary &&
                            matchSummary?.keySimilarities &&
                            matchSummary?.keySimilarities.length > 0 && (
                              <div className="mb-4">
                                <h4
                                  className={`text-sm font-semibold flex items-center gap-2 mb-2 ${
                                    theme === "dark"
                                      ? "text-gray-300"
                                      : "text-gray-800"
                                  }`}
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  Key Similarities
                                </h4>
                                <ul className="space-y-1">
                                  {matchSummary?.keySimilarities.map(
                                    (item, i) => (
                                      <li
                                        key={i}
                                        className={`text-sm flex gap-2 ${
                                          theme === "dark"
                                            ? "text-neutral-400 font-sans"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        <span className="text-[#F9B418]">
                                          •
                                        </span>
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                          {/* Differences */}
                          {matchSummary &&
                            matchSummary?.distinctDifferences &&
                            matchSummary?.distinctDifferences.length > 0 && (
                              <div>
                                <h4
                                  className={`text-sm font-semibold flex items-center gap-2 mb-2 ${
                                    theme === "dark"
                                      ? "text-gray-300"
                                      : "text-gray-800"
                                  }`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Distinct Differences
                                </h4>
                                <ul className="space-y-1">
                                  {matchSummary?.distinctDifferences.map(
                                    (item, i) => (
                                      <li
                                        key={i}
                                        className={`text-sm flex gap-2 ${
                                          theme === "dark"
                                            ? "text-neutral-400 font-sans"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        <span className="text-[#F9B418]">
                                          •
                                        </span>
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                        </div>

                        {/* Right Col - Novelty Score & Overlapping Concepts */}
                        <div>
                          {/* Novelty Score */}
                          {matchSummary &&
                            typeof matchSummary?.noveltyScore === "number" && (
                              <div className="">
                                <h4
                                  className={`${
                                    theme === "dark"
                                      ? "text-zinc-300"
                                      : "text-zinc-800"
                                  } text-sm font-medium mb-2`}
                                >
                                  Novelty Score
                                </h4>
                                <div className="flex items-center gap-3">
                                  <Progress
                                    value={
                                      typeof matchSummary?.noveltyScore ===
                                      "number"
                                        ? matchSummary?.noveltyScore ?? 0
                                        : 0
                                    }
                                    className="h-2 flex-1"
                                  />
                                </div>
                                <span
                                  className={`font-semibold text-[#F9B418] text-xl flex justify-end mt-2 items-center`}
                                >
                                  {typeof matchSummary?.noveltyScore ===
                                  "number"
                                    ? Math.round(matchSummary?.noveltyScore ?? 0)
                                    : "N/A"}
                                  <span
                                    className={`${
                                      theme === "dark"
                                        ? "text-gray-300"
                                        : "text-gray-500"
                                    } ml-1 font-normal text-sm`}
                                  >
                                    {" "}
                                    /100
                                  </span>
                                </span>
                              </div>
                            )}

                          {/* Overlapping Concepts */}
                          {matchSummary &&
                            matchSummary?.overlappingConcepts &&
                            matchSummary?.overlappingConcepts.length > 0 && (
                              <div>
                                <h4
                                  className={`text-sm font-semibold mb-2 ${
                                    theme === "dark"
                                      ? "text-gray-300"
                                      : "text-gray-800"
                                  }`}
                                >
                                  Overlapping Concepts
                                </h4>
                                <ul className="space-y-1">
                                  {matchSummary?.overlappingConcepts.map(
                                    (item, i) => (
                                      <li
                                        key={i}
                                        className={`text-sm flex gap-2 ${
                                          theme === "dark"
                                            ? "text-neutral-400 font-sans"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        <span className="text-[#F9B418]">
                                          •
                                        </span>
                                        {item}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Link to Document */}
                      {matchSummary?.url && (
                        <div className="mt-5 pb-7 pt-4">
                          <a
                            href={matchSummary?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#F9B418] hover:text-[#F9B418] hover:underline flex items-center gap-2 text-sm"
                          >
                            View Original Document
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      )}
                    </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <Card className="p-5 text-center">
                <p className="text-gray-500">
                  No prior art documents found in the analysis.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* ---------- RECOMMENDATIONS SECTION ---------- */}
        {!embedded && scoringResult?.recommendations &&
          scoringResult?.recommendations.length > 0 && (
            <Card className="mb-10 p-6 border-l-4 border-l-blue-700 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-center gap-2 mb-4">
                <InfoIcon className="h-5 w-5 text-blue-700" />
                <h2 className="text-lg font-semibold text-blue-900">
                  Expert Recommendations
                </h2>
              </div>

              <ul className="space-y-3">
                {scoringResult?.recommendations.map((recommendation, idx) => (
                  <li key={idx} className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <ChevronRight className="h-4 w-4 text-blue-700" />
                    </div>
                    <p className="text-gray-700">{recommendation}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

        {/* ---------- FOOTER SECTION ---------- */}
        {!embedded && (
        <>
          <Separator className="my-6" />
          <div
          className={`text-sm text-gray-500 flex flex-col md:flex-row justify-between border-t items-center gap-3 fixed -bottom-0 rounded-b-lg left-0 px-8 py-4 h-20 ${
            theme === "dark" ? "bg-zinc-900 border-[#cccccc20]" : "bg-gray-50"
          } w-[100%]`}
          >
          <div className="flex items-center gap-1">
            <span
              className={`${
                theme == "dark" ? "text-gray-400" : "text-gray-700"
              } font-medium text-xs font-sans`}
            >
              Photon Legal Patent Analytics
            </span>
            {/* Scoring method (e.g. weighted_with_business_scope) is internal
                scoring metadata — not rendered client-side; OC-only surface TBD. */}
          </div>
          {/* <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Report generated on {formatDate()}
          </div> */}
          {/* {scoringResult.scoringMethod && (
            <div>Evaluation Method: {scoringResult.scoringMethod}</div>
          )} */}
          </div>
        </>
        )}
      </div>
    </div>
  );
}
