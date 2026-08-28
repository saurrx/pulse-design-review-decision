import jsPDF from "jspdf";
import API_CONFIG, { assetUrl } from "@/lib/apiConfig";
import { pngToDataUrl } from "./DownloadReport";

import helveticaBold from "/fonts/Helvetica-Bold.ttf";
import helveticaBoldOblique from "/fonts/Helvetica-BoldOblique.ttf";
import helveticaLight from "/fonts/helvetica-light-587ebe5a59211.ttf";
import helveticaOblique from "/fonts/Helvetica-Oblique.ttf";
import helveticaRegular from "/fonts/Helvetica.ttf";

if (typeof window !== "undefined" && (window as any).jsPDF) {
  const jsPDFInstance = (window as any).jsPDF;
  if (jsPDFInstance.API) {
    if (
      !jsPDFInstance.API.events ||
      !jsPDFInstance.API.events.some((e: any) => e.name === "addFileToVFS")
    ) {
      jsPDFInstance.API.addFileToVFS("Helvetica.ttf", helveticaRegular);
      jsPDFInstance.API.addFont("Helvetica.ttf", "Helvetica", "normal");
      jsPDFInstance.API.addFileToVFS("Helvetica-Bold.ttf", helveticaBold);
      jsPDFInstance.API.addFont("Helvetica-Bold.ttf", "Helvetica", "bold");
      jsPDFInstance.API.addFileToVFS("Helvetica-Oblique.ttf", helveticaOblique);
      jsPDFInstance.API.addFont("Helvetica-Oblique.ttf", "Helvetica", "italic");
      jsPDFInstance.API.addFileToVFS(
        "Helvetica-BoldOblique.ttf",
        helveticaBoldOblique,
      );
      jsPDFInstance.API.addFont(
        "Helvetica-BoldOblique.ttf",
        "Helvetica",
        "bolditalic",
      );
      jsPDFInstance.API.addFileToVFS(
        "helvetica-light-587ebe5a59211.ttf",
        helveticaLight,
      );
      jsPDFInstance.API.addFont(
        "helvetica-light-587ebe5a59211.ttf",
        "HelveticaLight",
        "normal",
      );
    }
  }
}

function drawFooter(
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
  marginLeft: number,
  marginBottom: number,
  pageNum: number,
  pageCount: number,
  dateStr: string,
) {
  pdf.setFont("Helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor("#CC0000");
  pdf.text("Confidential", marginLeft, pageHeight - marginBottom + 10);
  pdf.setFont("Helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor("#333");
  pdf.text(
    `Page ${pageNum} of ${pageCount}`,
    pageWidth / 2,
    pageHeight - marginBottom + 10,
    { align: "center" },
  );
  pdf.setFont("Helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor("#333");
  pdf.text(dateStr, pageWidth - marginLeft, pageHeight - marginBottom + 10, {
    align: "right",
  });
}

function drawCircularGauge(
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  score: number,
  maxScore: number,
) {
  pdf.setDrawColor("#E5EAF2");
  pdf.setLineWidth(2);
  pdf.circle(centerX, centerY, radius, "S");

  const angle = (score / maxScore) * 270;
  const startAngle = -225;
  const endAngle = startAngle + angle;
  const steps = 120;
  let prevX = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
  let prevY = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
  pdf.setDrawColor("#1A365D");
  pdf.setLineWidth(5);
  for (let i = 1; i <= steps * (angle / 270); i++) {
    const theta = ((startAngle + (i * angle) / steps) * Math.PI) / 180;
    const x = centerX + radius * Math.cos(theta);
    const y = centerY + radius * Math.sin(theta);
    pdf.line(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
  const endX = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
  const endY = centerY + radius * Math.sin((endAngle * Math.PI) / 180);
  pdf.setFillColor("#1A365D");
  pdf.circle(endX, endY, 2.5, "F");

  pdf.setFont("Helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor("#1A365D");
  pdf.text(`${score.toFixed(2)}`, centerX, centerY + 8, { align: "center" });
  pdf.setFont("Helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor("#333");
  pdf.text("Novelty Score", centerX, centerY + radius + 10, {
    align: "center",
  });
}

function drawSectionBreak(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor("#4A7BA7");
  pdf.setLineWidth(0.5);
  pdf.line(x, y, x + 50.8, y);
  return y + 4;
}

function drawNoveltyScoreBar(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  score: number,
) {
  pdf.setDrawColor("#4A7BA7");
  pdf.setLineWidth(0.5);
  pdf.rect(x, y, w, 16, "S");
  pdf.setFillColor("#4A7BA7");
  pdf.rect(x, y, w / 2, 16, "F");
  pdf.setFillColor("#1A365D");
  pdf.rect(x + w / 2, y, w / 2, 16, "F");
  const indicatorX = x + (score / 10) * w;
  pdf.setDrawColor("#F1C85F");
  pdf.setLineWidth(2);
  pdf.line(indicatorX, y, indicatorX, y + 16);
  pdf.setDrawColor("#333");
  pdf.setLineWidth(0.5);
  for (let i = 0; i <= 10; i += 5) {
    const tickX = x + (i / 10) * w;
    pdf.line(tickX, y + 16, tickX, y + 20);
    pdf.setFont("Helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`${i}`, tickX, y + 24, { align: "center" });
  }
  pdf.setFont("Helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor("#FFF");
  pdf.text(`${score.toFixed(2)}/10`, x + w / 2, y + 11, { align: "center" });
}

function drawPriorArtTableWithOverflow(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  similarities: string[],
  differences: string[],
  pageHeight: number,
  marginBottom: number,
  marginTop: number,
  addPageAndHeader: () => void,
  forBrowserPreview: boolean,
  fontFamily: string,
) {
  const colW = w / 2;
  const cellPad = forBrowserPreview ? 14 : 7;
  const colGap = forBrowserPreview ? 4 : 0;
  const wrapWidth = forBrowserPreview
    ? colW - cellPad - colGap
    : colW - 12;
  const lineHeight = forBrowserPreview ? 7 : 6;
  const rowPadding = forBrowserPreview ? 6 : 4;

  pdf.setFillColor("#1A365D");
  pdf.setTextColor("#FFF");
  pdf.setFont(fontFamily, "bold");
  const headerH = 9;
  pdf.rect(x, y, colW, headerH, "F");
  pdf.rect(x + colW, y, colW, headerH, "F");
  pdf.text("Key Similarities", x + colW / 2, y + 7, { align: "center" });
  pdf.text("Distinct Differences", x + colW + colW / 2, y + 7, {
    align: "center",
  });
  let tableY = y + headerH;
  const maxRows = Math.max(similarities.length, differences.length);

  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(10);

  for (let i = 0; i < maxRows; i++) {
    const simText =
      similarities[i] && similarities[i].trim() ? similarities[i] : "NA";
    const diffText =
      differences[i] && differences[i].trim() ? differences[i] : "NA";
    const simLines = pdf.splitTextToSize(simText, wrapWidth);
    const diffLines = pdf.splitTextToSize(diffText, wrapWidth);
    const numLines = Math.max(simLines.length, diffLines.length) || 1;
    const rowH = numLines * lineHeight + rowPadding;
    if (tableY + rowH > pageHeight - marginBottom) {
      addPageAndHeader();
      tableY = marginTop;
      pdf.setFillColor("#1A365D");
      pdf.setTextColor("#FFF");
      pdf.setFont(fontFamily, "bold");
      pdf.rect(x, tableY, colW, headerH, "F");
      pdf.rect(x + colW, tableY, colW, headerH, "F");
      pdf.text("Key Similarities", x + colW / 2, tableY + 7, {
        align: "center",
      });
      pdf.text("Distinct Differences", x + colW + colW / 2, tableY + 7, {
        align: "center",
      });
      tableY += headerH;
    }
    if (i % 2 === 0) {
      pdf.setFillColor("#F5F8FA");
      pdf.rect(x, tableY, w, rowH, "F");
    }
    pdf.setDrawColor("#4A7BA7");
    pdf.setLineWidth(0.5);
    pdf.rect(x, tableY, colW, rowH, "S");
    pdf.rect(x + colW, tableY, colW, rowH, "S");
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor("#333");
    const cellTop = tableY + 8;
    simLines.forEach((line, idx) => {
      pdf.setFont(fontFamily, "normal");
      pdf.setFontSize(10);
      pdf.text(line, x + cellPad, cellTop + idx * lineHeight);
    });
    const rightStartX = x + colW + colGap;
    diffLines.forEach((line, idx) => {
      pdf.setFont(fontFamily, "normal");
      pdf.setFontSize(10);
      pdf.text(line, rightStartX, cellTop + idx * lineHeight);
    });
    tableY += rowH;
  }
  return tableY + 10;
}

function drawRecommendationsBoxWithOverflow(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  recommendations: string[] | undefined | null,
  pageHeight: number,
  marginBottom: number,
  mainX: number,
  mainW: number,
  marginTop: number,
  forBrowserPreview: boolean,
  fontFamily: string,
) {
  if (!recommendations || recommendations.length === 0) {
    return y;
  }

  const recFontSize = 11;
  const recLineHeight = 6;
  const boxPad = 6;
  const leftPad = 4;
  const bulletGap = 2;
  const bulletRadius = 1.5;
  let currY = y + boxPad + 6;
  let idx = 0;
  let page = 1;
  while (idx < recommendations.length) {
    const rightPad = forBrowserPreview ? 18 : 8;
    const textStartX = mainX + leftPad + bulletGap + bulletRadius;
    const availableWidth =
      mainW - (leftPad + bulletGap + bulletRadius + rightPad);
    let linesUsed = 0;
    let recsThisPage = 0;
    let linesArr: string[][] = [];
    let tempY = currY;
    for (let i = idx; i < recommendations.length; i++) {
      const wrapped = pdf.splitTextToSize(recommendations[i], availableWidth);
      linesArr.push(wrapped);
      if (
        tempY + wrapped.length * recLineHeight + 16 >
        pageHeight - marginBottom
      ) {
        break;
      }
      tempY += wrapped.length * recLineHeight + 4;
      recsThisPage++;
    }
    const boxHeight =
      boxPad +
      6 +
      linesArr
        .slice(0, recsThisPage)
        .reduce((acc, l) => acc + l.length * recLineHeight + 4, 0) +
      8;
    pdf.setFillColor("#F5F8FA");
    pdf.setDrawColor("#4A7BA7");
    pdf.setLineWidth(0.5);
    pdf.rect(mainX, y, mainW, boxHeight, "FD");
    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(16);
    pdf.setTextColor("#1A365D");
    pdf.text(
      "Recommendations" + (page > 1 ? " (contd.)" : ""),
      mainX + mainW / 2,
      y + boxPad,
      { align: "center" },
    );
    currY = y + boxPad + 14;
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(recFontSize);
    pdf.setTextColor("#333");
    for (let i = 0; i < recsThisPage; i++) {
      pdf.setDrawColor("#4A7BA7");
      pdf.setFillColor("#4A7BA7");
      pdf.circle(mainX + leftPad, currY - 1, bulletRadius, "F");
      linesArr[i].forEach((line, j) => {
        pdf.text(line, textStartX, currY + j * recLineHeight);
      });
      currY += linesArr[i].length * recLineHeight + 4;
    }
    idx += recsThisPage;
    if (idx < recommendations.length) {
      pdf.addPage();
      y = marginTop;
      currY = y + boxPad + 6;
      page++;
    }
  }
  return currY + 8;
}

function drawMiniScoreBar(
  pdf: jsPDF,
  x: number,
  y: number,
  score: number,
  fontFamily: string = "Helvetica",
) {
  const barW = 25.4;
  const barH = 4;
  pdf.setDrawColor("#4A7BA7");
  pdf.setLineWidth(0.5);
  pdf.rect(x, y, barW, barH, "S");
  let fillColor = "#4A7BA7";
  if (score > 8.5) fillColor = "#4A7BA7";
  else if (score >= 7) fillColor = "#F1C85F";
  else fillColor = "#CC0000";
  pdf.setFillColor(fillColor);
  pdf.rect(x, y, (score / 10) * barW, barH, "F");
  const indicatorX = x + (score / 10) * barW;
  pdf.setDrawColor("#1A365D");
  pdf.setLineWidth(1);
  pdf.line(indicatorX, y, indicatorX, y + barH);
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor("#1A365D");
  pdf.text(`${score.toFixed(2)}/10`, x + barW + 8, y + barH);
}

function drawContentHeaderFooter(
  pdf: jsPDF,
  pageWidth: number,
  marginLeft: number,
  marginTop: number,
  section: string,
  pageNum: number,
  pageCount: number,
  fontFamily: string,
) {
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor("#4A7BA7");
  pdf.text(section, marginLeft, marginTop - 10);
  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor("#333");
  pdf.text(
    `${section}: Page ${pageNum} of ${pageCount}`,
    pageWidth - marginLeft,
    marginTop - 10,
    { align: "right" },
  );
}

export async function generatePatentReportPDF(
  result: any,
  priorArt: any[],
  user: any,
  options?: { forBrowserPreview?: boolean },
) {
  const forBrowserPreview = options?.forBrowserPreview ?? false;
  const fontFamily = forBrowserPreview ? "Times" : "Helvetica";

  const reportData =
    typeof result.report === "string"
      ? JSON.parse(result.report)
      : result.report;
  const { scoringResult } = result;

  const evaluations = result?.evaluations || [];

  const findMatchForArt = (art: { publicationNumber?: string; title?: string }) => {
    const artPub = (art.publicationNumber ?? "").trim().toUpperCase();
    const artTitle = (art.title ?? "").trim();
    const sources = scoringResult.closestMatches || [];
    for (const m of sources) {
      const matchPub = (
        (m as any).publicationNumber ||
        ""
      )
        .toString()
        .trim()
        .toUpperCase();
      const matchTitle = ((m as any).title ?? (m as any).documentTitle ?? "").trim();
      if (artPub && matchPub && artPub === matchPub) return m;
      if (artTitle && matchTitle && artTitle === matchTitle) return m;
    }
    return null;
  };

  const enrichedPriorArt = priorArt.map((art) => {
    const matchSummary = findMatchForArt(art);

    const similarityScore =
    typeof (matchSummary as any)?.similarityScore === "number"
      ? (matchSummary as any).similarityScore
      : typeof (matchSummary as any)?.score === "number"
        ? (matchSummary as any).score
        : null;

    return {
      art,
      noveltyScore:
        typeof (matchSummary as any)?.noveltyScore === "number"
          ? (matchSummary as any).noveltyScore
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
    const sa = a.similarityScore;
    const sb = b.similarityScore;
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  });

  const topPriorArt = sortedPriorArt.slice(0, 5);

  const marginTop = 25.4;
  const marginBottom = 25.4;
  const marginLeft = 15;
  const marginRight = 10;
  const pageWidth = 210;
  const pageHeight = 297;
  const maxContentWidth = pageWidth - marginLeft - marginRight;
  const contentWidth = maxContentWidth;
  const contentHeight = pageHeight - marginTop - marginBottom;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: forBrowserPreview ? false : true,
  });

  const summaryContentWidth = pageWidth - marginLeft - marginRight;
  const summaryMarginLeft = marginLeft;
  function drawTextWithOverflow(
    pdf,
    textLines,
    startY,
    sectionTitle,
    lineHeight = 6,
    leftPad = 0,
  ) {
    let y = startY;
    const maxY = pageHeight - 40;
    let idx = 0;
    while (idx < textLines.length) {
      if (y > maxY) {
        pdf.addPage();
        pdf.setFillColor("#FFFFFF");
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        y = marginTop;
        pdf.setFont(fontFamily, "bold");
        pdf.setFontSize(16);
        pdf.setTextColor("#1A365D");
        pdf.text(sectionTitle + " (contd.)", pageWidth / 2, y, {
          align: "center",
        });
        y += 8;
      }
      pdf.setFont(fontFamily, "normal");
      pdf.setFontSize(12);
      pdf.setTextColor("#333");
      pdf.text(textLines[idx], summaryMarginLeft + leftPad, y);
      y += lineHeight;
      idx++;
    }
    return y;
  }

  const photonLogoPng = await pngToDataUrl("/assets/photon-legal.png", 300, 75);

  let clientLogoPng;
  try {
    const clientLogoPath = user?.client?.logo_file?.file_path;

    if (clientLogoPath) {
      clientLogoPng = await pngToDataUrl(
        assetUrl(clientLogoPath),
        300,
        75,
      );
    } else {
      clientLogoPng = await pngToDataUrl("/assets/photon-legal.png", 300, 75);
    }
  } catch (error) {
    console.error("Error loading client logo, using default", error);
    clientLogoPng = await pngToDataUrl("/assets/photon-legal.png", 300, 75);
  }

  pdf.setFillColor("#FFFFFF");
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  const logoWidth = 114 / 5;
  const logoHeight = 60 / 5;
  const clientLogoWidth = 114 / 5;
  const clientLogoHeight = 33 / 5;
  const logosTotalWidth = logoWidth + clientLogoWidth + 16;
  const logosStartX = (pageWidth - logosTotalWidth) / 2;
  const logosY = 32;
  pdf.addImage(
    photonLogoPng,
    "PNG",
    logosStartX,
    logosY,
    logoWidth,
    logoHeight,
    undefined,
    "FAST",
  );
  pdf.addImage(
    clientLogoPng,
    "PNG",
    logosStartX + logoWidth + 16,
    logosY + (logoHeight - clientLogoHeight) / 2,
    clientLogoWidth,
    clientLogoHeight,
    undefined,
    "FAST",
  );

  const titleY = logosY + logoHeight + 18;
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(26);
  pdf.setTextColor("#1A365D");
  pdf.text("Photon Pulse Evaluation Report", pageWidth / 2, titleY, {
    align: "center",
  });

  const scoreY = titleY + 38;
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(48);
  pdf.setTextColor("#1A365D");
  pdf.text(
    `${scoringResult?.noveltyScore?.toFixed(2) || 0}`,
    pageWidth / 2,
    scoreY,
    {
      align: "center",
    },
  );
  pdf.setDrawColor("#D4AF37");
  pdf.setLineWidth(2.5);
  pdf.line(pageWidth / 2 - 22, scoreY + 6, pageWidth / 2 + 22, scoreY + 6);

  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(14);
  pdf.setTextColor("#1A365D");
  pdf.text("Novelty Score", pageWidth / 2, scoreY + 18, { align: "center" });

  let y = scoreY + 38;
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(16);
  pdf.setTextColor("#1A365D");
  pdf.text("Summary", pageWidth / 2, y, { align: "center" });
  y += 8;
  const splitSummary = pdf.splitTextToSize(
    scoringResult.summary,
    pageWidth + 50,
  );
  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(12);
  pdf.setTextColor("#333");
  splitSummary.forEach((line) => {
    pdf.text(line, marginLeft, y);
    y += 6;
  });
  y += 10;

  if (result.recommendations && result.recommendations.length > 0) {
    y = drawRecommendationsBoxWithOverflow(
      pdf,
      marginLeft,
      y,
      summaryContentWidth,
      result.recommendations,
      pageHeight,
      marginBottom,
      marginLeft,
      summaryContentWidth,
      marginTop,
      forBrowserPreview,
      fontFamily,
    );
  }

  pdf.setFont(fontFamily, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor("#1A365D");
  pdf.text(
    `Generated on: ${new Date().toLocaleDateString()} | Document ID: ${result.id
    }`,
    pageWidth / 2,
    pageHeight - 18,
    { align: "center" },
  );

  pdf.addPage();
  let priorArtY = marginTop;
  const priorArtContentWidth = pageWidth - marginLeft - marginRight;
  drawContentHeaderFooter(
    pdf,
    pageWidth,
    marginLeft,
    marginTop,
    "Prior Art Analysis",
    1,
    topPriorArt.length || 1,
    fontFamily,
  );
  priorArtY += 24 * 0.3528;
  priorArtY = drawSectionBreak(pdf, marginLeft, priorArtY);
  pdf.setFont(fontFamily, "bold");
  pdf.setFontSize(20);
  pdf.setTextColor("#1A365D");
  pdf.text("Top 3 Prior Art", pageWidth / 2, priorArtY + 12, {
    align: "center",
  });
  priorArtY += 18;

  topPriorArt.forEach((item, idx) => {
    const match = item.matchSummary || {};
    const priorArtEntry = item.art;
    if (idx > 0) {
      pdf.addPage();
      priorArtY = marginTop;
      drawContentHeaderFooter(
        pdf,
        pageWidth,
        marginLeft,
        marginTop,
        "Prior Art Analysis",
        idx + 1,
        topPriorArt.length,
        fontFamily,
      );
    }

    const evaluationEntry = evaluations[idx];

    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(16);
    pdf.setTextColor("#1A365D");
    const priorArtTitle = `Prior Art #${idx + 1}: ${match.title || match.documentTitle || priorArtEntry?.title || "Untitled"
      }`;
    const splitTitle = pdf.splitTextToSize(
      priorArtTitle,
      priorArtContentWidth - 40,
    );
    pdf.text(splitTitle, pageWidth / 2, priorArtY, { align: "center" });
    priorArtY += splitTitle.length * 7 + 14;
    drawMiniScoreBar(
      pdf,
      marginLeft + priorArtContentWidth - 40,
      priorArtY - 8,
      item.noveltyScore || match.noveltyScore || match.similarityScore || 0,
      fontFamily,
    );
    priorArtY += 10;

    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(11);
    pdf.setTextColor("#333");
    pdf.text(
      `Publication Number: ${match.publicationNumber ||
      match.documentId ||
      priorArtEntry?.publicationNumber ||
      "N/A"
      }`,
      marginLeft,
      priorArtY,
    );
    priorArtY += 6;
    if (priorArtEntry?.url && priorArtEntry.url.trim()) {
      pdf.setTextColor("#4A7BA7");
      pdf.textWithLink("View Patent", marginLeft, priorArtY, {
        url: priorArtEntry.url,
      });
      priorArtY += 6;
    }

    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(12);
    pdf.setTextColor("#1A365D");
    pdf.text("Abstract", pageWidth / 2, priorArtY, { align: "center" });
    priorArtY += 6;
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(11);
    pdf.setTextColor("#333");

    const priorArtWrapMargin = forBrowserPreview ? 24 : 8;
    const abstract =
      priorArtEntry?.abstract || match.abstract || "No abstract available";
    const splitAbstract = pdf.splitTextToSize(
      abstract,
      priorArtContentWidth - priorArtWrapMargin,
    );

    if (
      priorArtY + splitAbstract.length * 5.5 + 2 >
      pageHeight - marginBottom
    ) {
      pdf.addPage();
      priorArtY = marginTop;
      drawContentHeaderFooter(
        pdf,
        pageWidth,
        marginLeft,
        marginTop,
        "Prior Art Analysis",
        idx + 1,
        topPriorArt.length,
        fontFamily,
      );
      pdf.setFont(fontFamily, "bold");
      pdf.setFontSize(12);
      pdf.setTextColor("#1A365D");
      pdf.text("Abstract", pageWidth / 2, priorArtY, { align: "center" });
      priorArtY += 6;
      pdf.setFont(fontFamily, "normal");
      pdf.setFontSize(11);
      pdf.setTextColor("#333");
    }
    pdf.text(splitAbstract, marginLeft, priorArtY);
    priorArtY += splitAbstract.length * 5.5 + 2;

    const analysisText = evaluationEntry?.analysis || match.analysis;

    if (analysisText) {
      pdf.setFont(fontFamily, "bold");
      pdf.setFontSize(12);
      pdf.setTextColor("#1A365D");
      pdf.text("Analysis", pageWidth / 2, priorArtY, { align: "center" });
      priorArtY += 6;
      pdf.setFont(fontFamily, "normal");
      pdf.setFontSize(11);
      pdf.setTextColor("#333");

      const splitAnalysis = pdf.splitTextToSize(
        analysisText,
        priorArtContentWidth - priorArtWrapMargin,
      );
      if (
        priorArtY + splitAnalysis.length * 5.5 + 2 >
        pageHeight - marginBottom
      ) {
        pdf.addPage();
        priorArtY = marginTop;
        drawContentHeaderFooter(
          pdf,
          pageWidth,
          marginLeft,
          marginTop,
          "Prior Art Analysis",
          idx + 1,
          topPriorArt.length,
          fontFamily,
        );
        pdf.setFont(fontFamily, "bold");
        pdf.setFontSize(12);
        pdf.setTextColor("#1A365D");
        pdf.text("Analysis", pageWidth / 2, priorArtY, { align: "center" });
        priorArtY += 6;
        pdf.setFont(fontFamily, "normal");
        pdf.setFontSize(11);
        pdf.setTextColor("#333");
      }
      pdf.text(splitAnalysis, marginLeft, priorArtY);
      priorArtY += splitAnalysis.length * 5.5 + 2;
    }

    priorArtY = drawPriorArtTableWithOverflow(
      pdf,
      marginLeft,
      priorArtY,
      priorArtContentWidth,
      match.keySimilarities || [],
      match.distinctDifferences || [],
      pageHeight,
      marginBottom,
      marginTop,
      () => {
        pdf.addPage();
        priorArtY = marginTop;
        drawContentHeaderFooter(
          pdf,
          pageWidth,
          marginLeft,
          marginTop,
          "Prior Art Analysis",
          idx + 1,
          topPriorArt.length,
          fontFamily,
        );
      },
      forBrowserPreview,
      fontFamily,
    );
    pdf.setFont(fontFamily, "bold");
    pdf.setFontSize(12);
    pdf.setTextColor("#1A365D");
    pdf.text("Overlapping Concepts", pageWidth / 2, priorArtY, {
      align: "center",
    });
    priorArtY += 6;
    pdf.setFont(fontFamily, "normal");
    pdf.setFontSize(11);
    pdf.setTextColor("#333");
    if (match.overlappingConcepts && match.overlappingConcepts.length > 0) {
      const conceptsText = match.overlappingConcepts.join(", ");
      const splitConcepts = pdf.splitTextToSize(
        conceptsText,
        priorArtContentWidth - priorArtWrapMargin,
      );
      if (
        priorArtY + splitConcepts.length * 5.5 + 2 >
        pageHeight - marginBottom
      ) {
        pdf.addPage();
        priorArtY = marginTop;
        drawContentHeaderFooter(
          pdf,
          pageWidth,
          marginLeft,
          marginTop,
          "Prior Art Analysis",
          idx + 1,
          topPriorArt.length,
          fontFamily,
        );
        pdf.setFont(fontFamily, "bold");
        pdf.setFontSize(12);
        pdf.setTextColor("#1A365D");
        pdf.text("Overlapping Concepts", pageWidth / 2, priorArtY, {
          align: "center",
        });
        priorArtY += 6;
        pdf.setFont(fontFamily, "normal");
        pdf.setFontSize(11);
        pdf.setTextColor("#333");
      }
      pdf.text(splitConcepts, marginLeft, priorArtY);
      priorArtY += splitConcepts.length * 5.5 + 2;
    } else {
      pdf.text("No overlapping concepts identified.", marginLeft, priorArtY);
      priorArtY += 6;
    }
    priorArtY += 10;
  });

  return pdf;
}
