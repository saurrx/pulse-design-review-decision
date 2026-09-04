import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import useUserCookie from "@/hooks/use-auth";
import { Download } from "lucide-react";
import { toast } from "@/lib/toast";

async function svgToPngDataUrl(
  svgUrl: string,
  width = 60,
  height = 60,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout loading SVG image: ${svgUrl}`));
    }, 10000);
    img.onload = function () {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = function () {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load SVG image: ${svgUrl}`));
    };
    img.src = svgUrl;
  });
}

export async function pngToDataUrl(
  pngUrl: string,
  width = 60,
  height = 130,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "use-credentials";
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout loading PNG image: ${pngUrl}`));
    }, 10000);
    img.onload = function () {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = function () {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load PNG image: ${pngUrl}`));
    };
    img.src = pngUrl;
  });
}

export interface ConciseEvaluationReportProps {
  result: {
    id: string;
    score: number | null;
    report: string;
    scoringResult: {
      score: number | null;
      summary: string;
      noveltyScore: number | null;
      similarityScore: number | null;
      confidenceLevel: string;
      detailedAnalysis: {
        marketScore?: number | null;
        technicalScore: number | null;
        feasibilityScore?: number | null;
        implementationScore: number | null;
        directNoveltyScore?: number;
        confidenceFactors?: {
          dataQuality: number;
          dataPrecision: number;
          evaluationCount: number;
          technicalCoverage: number;
        };
      };
      evaluationMetrics?: {
        evaluationCount: number;
        maxSimilarity: number;
        avgSimilarity: number;
      };
      closestMatches?: Array<{
        documentId?: string;
        documentTitle?: string;
        title?: string;
        abstract?: string;
        publicationNumber?: string;
        score?: number;
        similarityScore?: number;
        analysis?: string;
        url?: string;
        noveltyScore?: number;
        keySimilarities: string[];
        distinctDifferences: string[];
        overlappingConcepts: string[];
        evaluationMetadata?: {
          llmModel: string;
          rawScore: number;
          evaluationStatus: string;
          evaluationTimestamp: string;
        };
      }>;
    };
    status: string;
    createdAt: string;
    updatedAt: string;
    evaluationId?: string;
    recommendations?: string[];
    priorArt?: Array<{
      url: string;
      title: string;
      abstract: string;
      publicationNumber?: string;
    }>;
  };
  priorArt: any;
}

const ConciseEvaluationReport: React.FC<ConciseEvaluationReportProps> = ({
  result,
  priorArt,
}) => {
  const [exporting, setExporting] = useState(false);

  const { user } = useUserCookie();

  const handleDownload = async () => {
    setExporting(true);

    try {
      const { generatePatentReportPDFReact } = await import("./patentReportPdf");
      const pdfOutput = await generatePatentReportPDFReact(
        result,
        priorArt || [],
        user
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      pdfOutput.save(`patent-evaluation-report-${timestamp}.pdf`);
      toast.success("PDF generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(
        error instanceof Error
          ? `Failed to generate PDF: ${error.message}`
          : "Failed to generate PDF. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={exporting}
      className="rounded-sm text-zinc-900 bg-[#F9B418] hover:bg-[#F9B418] shadow-lg shadow-[#F9B41820] hover:bg-[#F9B418]/90"
    >
      <Download size={15} /> {exporting ? "Generating PDF..." : "Download PDF"}
    </Button>
  );
};

export default ConciseEvaluationReport;
