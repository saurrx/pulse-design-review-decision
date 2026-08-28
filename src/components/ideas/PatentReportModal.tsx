import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  BarChart3,
  FileText,
  Info,
  Lightbulb,
  Scale,
  Search,
  ThumbsUp,
} from "lucide-react";
import ConciseEvaluationReport from "./DownloadReport";
import type { ConciseEvaluationReportProps } from "./DownloadReport";

interface PatentAnalysisContentProps {
  data: any;
}

export function PatentAnalysisContent({ data }: PatentAnalysisContentProps) {
  if (!data) {
    return <p>loading...</p>;
  }
  // Parse the report JSON string into an object
  const report = JSON.parse(data.report);

  // Extract the closest matches
  const closestMatches = report.closestMatches || [];

  /**
   * NOTE: this component is unreachable in mock mode — no fixture carries a
   * `report` payload — which is how three separate type errors survived in it.
   * It was annotated `EvaluationResult`, a shape from types.ts that neither the
   * producer nor the consumer of this object uses.
   *
   * Typed against the consumer's own prop type now, and built only from data
   * that genuinely exists on the payload. This is the natural home for the
   * patent-agent-v2 integration and should be rewritten against that contract
   * rather than extended.
   */
  const evaluationResult: ConciseEvaluationReportProps["result"] = {
    id: data.id,
    score: report.score ?? null,
    report: data.report,
    // The consumer expects summary, confidenceLevel and detailedAnalysis NESTED
    // here. They were being spread flat onto the top level, where nothing read
    // them — so the report rendered without them.
    scoringResult: report.scoringResult ?? report,
    // Required by the consumer and genuinely present on the evaluation record.
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt ?? data.createdAt,
    evaluationId: data.id,
    recommendations: report.recommendations ?? [],
    priorArt: report.priorArt ?? [],
  };

  return (
    <div className="py-4 px-2 md:px-4">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Patent Novelty Analysis
            </h1>
            <p className="text-muted-foreground">
              Analysis report generated on{" "}
              {new Date(data?.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="mt-2 md:mt-0">
            <ConciseEvaluationReport result={evaluationResult} priorArt={report.priorArt ?? closestMatches} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                Overall Novelty Score
              </CardTitle>
              <CardDescription>
                Based on weighted similarity analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-5xl font-bold">
                    {report?.score?.toFixed(1)}
                  </div>
                  <Badge
                    variant={
                      report?.score > 7
                        ? "default"
                        : report?.score > 5
                        ? "secondary"
                        : "outline"
                    }
                    className="px-3 py-1"
                  >
                    {report?.score > 7
                      ? "High Novelty"
                      : report?.score > 5
                      ? "Moderate Novelty"
                      : "Low Novelty"}
                  </Badge>
                </div>
                <Progress value={report.score * 10} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {report.summary}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                Evaluation Metrics
              </CardTitle>
              <CardDescription>
                Analysis confidence and coverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Documents Evaluated</span>
                  </div>
                  <span className="font-medium">
                    {report?.evaluationMetrics?.evaluationCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Highest Similarity</span>
                  </div>
                  <span className="font-medium">
                    {report?.evaluationMetrics?.maxSimilarity?.toFixed(1)}/10
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Average Similarity</span>
                  </div>
                  <span className="font-medium">
                    {report?.evaluationMetrics?.avgSimilarity?.toFixed(1)}/10
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Confidence Level</span>
                  </div>
                  <span className="font-medium">{report?.confidenceLevel}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                Detailed Analysis
              </CardTitle>
              <CardDescription>Component scores breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Technical Score</span>
                    <span className="font-medium">
                      {report?.detailedAnalysis?.technicalScore?.toFixed(1)}/10
                    </span>
                  </div>
                  <Progress
                    value={report?.detailedAnalysis?.technicalScore * 10}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Implementation Score</span>
                    <span className="font-medium">
                      {report?.detailedAnalysis?.implementationScore?.toFixed(1)}
                      /10
                    </span>
                  </div>
                  <Progress
                    value={report?.detailedAnalysis?.implementationScore * 10}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Market Score</span>
                    <span className="font-medium">
                      {report?.detailedAnalysis?.marketScore?.toFixed(1)}/10
                    </span>
                  </div>
                  <Progress
                    value={report?.detailedAnalysis?.marketScore * 10}
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Feasibility Score</span>
                    <span className="font-medium">
                      {report?.detailedAnalysis?.feasibilityScore?.toFixed(1)}/10
                    </span>
                  </div>
                  <Progress
                    value={report?.detailedAnalysis?.feasibilityScore * 10}
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="closest-matches">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
            <TabsTrigger value="closest-matches">Closest Matches</TabsTrigger>
            <TabsTrigger value="patent-idea">Patent Idea</TabsTrigger>
          </TabsList>

          <TabsContent value="closest-matches" className="space-y-6 pt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {closestMatches.slice(0, 4).map((match, index) => (
                <Card
                  key={index}
                  className={
                    index === 0
                      ? " dark:bg-amber-950/10 dark:border-amber-800/30"
                      : ""
                  }
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle
                        className="text-lg font-medium truncate"
                        title={match.documentTitle}
                      >
                        {match.documentTitle}
                      </CardTitle>
                      <Badge variant={"outline"} className="ml-2 shrink-0">
                        {match.similarityScore.toFixed(1)}/10
                      </Badge>
                    </div>
                    <CardDescription className="truncate">
                      {match.documentId || "No ID available"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
                          <ThumbsUp className="h-4 w-4" /> Key Similarities
                        </h4>
                        <ul className="text-sm space-y-1 list-disc pl-5">
                          {match.keySimilarities.map((similarity, i) => (
                            <li key={i}>{similarity}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Evaluated Patents</CardTitle>
                <CardDescription>
                  Comparison with {report?.evaluationMetrics?.evaluationCount}{" "}
                  existing patents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {closestMatches.map((match, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span
                            className="text-sm font-medium truncate max-w-[300px]"
                            title={match.documentTitle}
                          >
                            {match.documentTitle || "Untitled Patent"}
                          </span>
                        </div>
                        <span className="text-sm font-medium">
                          {match.similarityScore.toFixed(1)}/10
                        </span>
                      </div>
                      <Progress
                        value={match.similarityScore * 10}
                        className="h-1.5"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patent-idea" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Patent Idea Summary
                </CardTitle>
                <CardDescription>
                  Key details about the proposed patent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Technological Field
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The invention lies at the intersection of immersive
                    multimedia streaming, real‑time 3‑D graphics, and web‑based
                    content delivery. It combines adaptive 360‑degree video
                    streaming with dynamically editable 3‑D model overlays that
                    are rendered and modified inside a standard browser without
                    plug‑ins.
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">Problem Solved</h3>
                  <p className="text-sm text-muted-foreground">
                    Content owners want to let viewers explore panoramic video
                    scenes and interact with the real objects depicted—change
                    colours, explode parts, buy items—directly within the same
                    view. Today they must bolt together separate 360‑video
                    players, static hotspot links, and stand‑alone 3‑D
                    configurators. The result is high latency, heavy bandwidth
                    consumption (full 3‑D assets reload on every change), and
                    jarring context‑switches that break immersion.
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">Core Mechanism</h3>
                  <p className="text-sm text-muted-foreground">
                    Server pipeline transcodes HDRI 360 footage into adaptive
                    HLS/DASH segments and generates an interaction manifest that
                    maps video timestamps to hotspot triggers and editable 3‑D
                    parameters. Patch server stores canonical glTF models plus
                    layered geometry/texture "diffs." When a viewer changes a
                    parameter, the server ships only the compact patch ({"<"}{" "}
                    250 kB) instead of the full model. Client runtime (a small
                    JavaScript payload) reconstructs a WebGL/WebGPU panorama,
                    applies manifest events frame‑accurately using
                    requestVideoFrameCallback, decodes incoming patches, and
                    updates the GPU buffers in ≤ 16 ms—faster than a single 60
                    fps frame.
                  </p>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2">Key Advantages</h3>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    <li>
                      Seamless immersion – viewers never leave the video context
                      while editing or purchasing.
                    </li>
                    <li>
                      Bandwidth efficiency – diff delivery sends ~5‑10 × less
                      data than full‑asset reloads.
                    </li>
                    <li>
                      Frame‑accurate synchronisation – overlay events never
                      drift from the video narrative.
                    </li>
                    <li>
                      Low integration effort – publishers paste one embed line;
                      no native apps or plug‑ins.
                    </li>
                    <li>
                      Granular security – JWT tokens lock both video segments
                      and 3‑D patches to authorised domains and individual
                      viewers.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>Report ID: {data.id}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Generated on {new Date(data.createdAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
