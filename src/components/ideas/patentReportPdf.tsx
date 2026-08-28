import { pdf } from "@react-pdf/renderer";
import React from "react";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import { pngToDataUrl } from "./DownloadReport";
import {
  PatentReportDocument,
  type PatentReportPayload,
  type PriorArtItem,
} from "./PatentReportDocument";

const LOGO_WIDTH = 300;
const LOGO_HEIGHT = 150;

function findMatchForArt(
  art: { publicationNumber?: string; title?: string },
  closestMatches: any[]
) {
  const artPub = (art.publicationNumber ?? "").trim().toUpperCase();
  const artTitle = (art.title ?? "").trim();
  for (const m of closestMatches) {
    const matchPub = String(m?.publicationNumber ?? "").trim().toUpperCase();
    const matchTitle = (m?.title ?? m?.documentTitle ?? "").trim();
    if (artPub && matchPub && artPub === matchPub) return m;
    if (artTitle && matchTitle && artTitle === matchTitle) return m;
  }
  return null;
}

function preparePayload(
  result: any,
  priorArt: any[],
  user: any
): PatentReportPayload {
  const scoringResult = result?.scoringResult || {};
  const evaluations = result?.evaluations || [];
  const closestMatches = scoringResult.closestMatches || [];

  const enrichedPriorArt: PriorArtItem[] = priorArt.map((art) => {
    const matchSummary = findMatchForArt(art, closestMatches);
    const similarityScore =
      typeof (matchSummary as any)?.similarityScore === "number"
        ? (matchSummary as any).similarityScore
        : typeof (matchSummary as any)?.score === "number"
          ? (matchSummary as any).score
          : null;
    return {
      art,
      matchSummary: matchSummary || null,
      noveltyScore:
        typeof (matchSummary as any)?.noveltyScore === "number"
          ? (matchSummary as any).noveltyScore
          : null,
      similarityScore,
    };
  });

  const sortedPriorArt = [...enrichedPriorArt].sort((a, b) => {
    if (a.noveltyScore === null) return 1;
    if (b.noveltyScore === null) return -1;
    if (a.noveltyScore !== b.noveltyScore)
      return a.noveltyScore - b.noveltyScore;
    const sa = a.similarityScore;
    const sb = b.similarityScore;
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    // Both non-null by now, but the guards above narrow them separately.
    return (sa as number) - (sb as number);
  });

  const topPriorArt = sortedPriorArt.slice(0, 5);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  const photonLogoUrl = `${baseUrl}/assets/photon-legal.png`;
  const clientLogoPath = user?.client?.logo_file?.file_path;
  const clientLogoUrl = clientLogoPath
    ? assetUrl(clientLogoPath)
    : photonLogoUrl;

  return {
    result: {
      id: result?.id ?? "",
      scoringResult,
      recommendations: result?.recommendations || [],
    },
    topPriorArt,
    evaluations,
    photonLogoUrl,
    clientLogoUrl,
  };
}

/**
 * Generate the patent report PDF using @react-pdf/renderer.
 * Uses pngToDataUrl to embed logo images as data URLs for reliable PDF rendering.
 * Returns an object with save(filename) for download; renders correctly in browser PDF viewers.
 */
export async function generatePatentReportPDFReact(
  result: any,
  priorArt: any[],
  user: any
): Promise<{ save: (filename: string) => void; getBlob: () => Blob }> {
  const payload = preparePayload(result, priorArt || [], user);

  // Embed logos as data URLs so the PDF has image data inline (avoids CORS/load issues)
  try {
    payload.photonLogoUrl = await pngToDataUrl(
      payload.photonLogoUrl,
      LOGO_WIDTH,
      LOGO_HEIGHT
    );
  } catch (e) {
    console.warn("Could not embed Photon logo as data URL, using URL", e);
  }
  try {
    payload.clientLogoUrl = await pngToDataUrl(
      payload.clientLogoUrl,
      LOGO_WIDTH,
      LOGO_HEIGHT
    );
  } catch (e) {
    console.warn("Could not embed client logo as data URL, using URL", e);
  }

  const blob = await pdf(
    React.createElement(PatentReportDocument, { payload }) as React.ReactElement
  ).toBlob();

  return {
    save(filename: string) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    getBlob: () => blob,
  };
}
