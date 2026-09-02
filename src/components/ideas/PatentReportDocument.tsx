import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
  },
  coverLogos: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 50
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1A365D",
    textAlign: "center",
    marginBottom: 32,
  },
  scoreBox: {
    alignItems: "center",
    marginBottom: 28,
  },
  scoreValue: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#1A365D",
  },
  scoreLine: {
    width: 44,
    height: 3,
    backgroundColor: "#D4AF37",
    marginTop: 6,
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 12,
    color: "#1A365D",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1A365D",
    textAlign: "center",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.5,
    marginBottom: 12,
    textAlign: "left",
  },
  recommendationsBox: {
    backgroundColor: "#F5F8FA",
    borderWidth: 1,
    borderColor: "#4A7BA7",
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
    marginBottom: 24,
    paddingRight: 30 
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1A365D",
    textAlign: "center",
    marginBottom: 10,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4A7BA7",
    marginRight: 8,
    marginTop: 5,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 9,
    color: "#1A365D",
    textAlign: "center",
  },
  // Prior art pages
  priorArtHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#4A7BA7",

  },
  priorArtSectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#4A7BA7",
  },
  priorArtPageNum: {
    fontSize: 9,
    color: "#333333",
  },
  topPriorArt: {
    fontSize: 20,
     color: "#1A365D",
     fontWeight: "bold",
     arginBottom: 15,
     textAlign: "center",
  },
  priorArtTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1A365D",
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 8,
  },
  priorArtScoreBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    alignSelf: "flex-end",
  },
  priorArtScoreText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1A365D",
    marginLeft: 8,
    
  },
  meta: {
    fontSize: 10,
    color: "#333333",
    marginBottom: 8,
  },
  link: {
    fontSize: 10,
    color: "#4A7BA7",
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#4A7BA7"
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1A365D",
    textAlign: "center",
    marginTop: 25,
    marginBottom: 10,
  },
  // Table
  table: {
    marginTop: 12,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1A365D"
  },
  tableHeaderCell: {
    flex: 1,
    padding: 8,
  },
  tableHeaderText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#4A7BA7",
  },
  tableRowAlt: {
    backgroundColor: "#F5F8FA",
  },
  tableCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 0.5,
    borderRightColor: "#4A7BA7",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableCellText: {
    fontSize: 9,
    color: "#333333",
    lineHeight: 1.4,
  },
});

export type PriorArtItem = {
  art: {
    title?: string;
    abstract?: string;
    publicationNumber?: string;
    url?: string;
    [key: string]: unknown;
  };
  matchSummary: {
    title?: string;
    documentTitle?: string;
    abstract?: string;
    analysis?: string;
    publicationNumber?: string;
    documentId?: string;
    keySimilarities?: string[];
    distinctDifferences?: string[];
    overlappingConcepts?: string[];
    noveltyScore?: number;
    similarityScore?: number;
    [key: string]: unknown;
  } | null;
  noveltyScore: number | null;
  similarityScore?: number | null;
};

export type PatentReportPayload = {
  result: {
    id: string | number;
    scoringResult: {
      noveltyScore?: number;
      summary?: string;
      [key: string]: unknown;
    };
    recommendations?: string[];
  };
  topPriorArt: PriorArtItem[];
  evaluations: Array<{ analysis?: string; [key: string]: unknown }>;
  photonLogoUrl: string;
  clientLogoUrl: string;
};

export function PatentReportDocument({ payload }: { payload: PatentReportPayload }) {
  const { result, topPriorArt, evaluations, photonLogoUrl, clientLogoUrl } = payload;
  const { scoringResult } = result;
  const recommendations = result.recommendations || [];

  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverLogos}>
          <Image src={photonLogoUrl} style={styles.logo} />
          <Image src={clientLogoUrl} style={styles.logo} />
        </View>

        <Text style={styles.title}>Photon Pulse Evaluation Report</Text>

        <View style={styles.scoreBox}>
          {/* Out of 10, like every screen and like the per-reference scores
              further down this same document, which were already /10 while this
              headline printed the raw 0-100 value with no scale at all. */}
          <Text style={styles.scoreValue}>
            {scoringResult?.noveltyScore != null
              ? (Number(scoringResult.noveltyScore) / 10).toFixed(1)
              : "0.0"}
          </Text>
          <View style={styles.scoreLine} />
          <Text style={styles.scoreLabel}>Novelty Score /10</Text>
        </View>

        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.bodyText}>{scoringResult?.summary || "—"}</Text>

        {recommendations.length > 0 && (
          <View style={styles.recommendationsBox}>
            <Text style={styles.recommendationsTitle}>Recommendations</Text>
            {recommendations.map((rec, i) => (
              <View key={i} style={styles.bulletItem}>
                <View style={styles.bullet} />
                <Text style={[styles.bodyText, { marginBottom: 0 }]}>{rec}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          Generated on: {new Date().toLocaleDateString()} | Reference: {result.id}
        </Text>
      </Page>

      {/* Prior art pages */}
      {topPriorArt.map((item, idx) => {
        const match = item.matchSummary || {};
        const art = item.art || {};
        const evaluationEntry = evaluations[idx];
        const analysisText = evaluationEntry?.analysis ?? match.analysis;
        const similarities = match.keySimilarities || [];
        const differences = match.distinctDifferences || [];
        const overlapping = match.overlappingConcepts || [];
        const pubNum =
          match.publicationNumber ||
          match.documentId ||
          art.publicationNumber ||
          "N/A";
        const title =
          match.title || match.documentTitle || art.title || "Untitled";
        const abstract =
          art.abstract || match.abstract || "No abstract available";
        const score =
          item.noveltyScore ??
          match.noveltyScore ??
          match.similarityScore ??
          0;
        const maxRows = Math.max(similarities.length, differences.length, 1);

        return (
          <Page key={idx} size="A4" style={styles.page}>
            <View style={styles.priorArtHeader}>
              <Text style={styles.priorArtSectionTitle}>
                Prior Art Analysis
              </Text>
              <Text style={styles.priorArtPageNum}>
                Prior Art Analysis: Page {idx + 1} of {topPriorArt.length}
              </Text>
            </View>

          {
            idx==0 ?  <Text style={styles.topPriorArt}> Top 5 Prior Art </Text> : null
          }
            <Text style={styles.priorArtTitle}>
              Prior Art #{idx + 1}: {title}
            </Text>

            <View style={styles.priorArtScoreBar}>
              <View
                style={{
                  width: 72,
                  height: 10,
                  backgroundColor: "#E0E0E0",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${(score / 10) * 100}%`,
                    height: 10,
                    backgroundColor: "#F9B418",
                  }}
                />
              </View>
              <Text style={styles.priorArtScoreText}>
                {Number(score).toFixed(2)}/10
              </Text>
            </View>

            <Text style={styles.meta}>Publication Number: {pubNum}</Text>
            {art.url && art.url.trim() ? (
              <Link src={art.url} style={styles.link}>
                View Patent
              </Link>
            ) : null}

            <Text style={styles.subsectionTitle}>Abstract</Text>
            <Text style={styles.bodyText}>{abstract}</Text>

            {analysisText ? (
              <>
                <Text style={styles.subsectionTitle}>Analysis</Text>
                <Text style={styles.bodyText}>{analysisText}</Text>
              </>
            ) : null}

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <View style={styles.tableHeaderCell}>
                  <Text style={styles.tableHeaderText}>Key Similarities</Text>
                </View>
                <View style={styles.tableHeaderCell}>
                  <Text style={styles.tableHeaderText}>
                    Distinct Differences
                  </Text>
                </View>
              </View>
              {Array.from({ length: maxRows }).map((_, rowIdx) => (
                <View
                  key={rowIdx}
                  style={[
                    ...(rowIdx % 2 === 0 ? [styles.tableRow, styles.tableRowAlt] : [styles.tableRow]),
                    
                  ]}
                >
                  <View style={styles.tableCell}>
                    <Text style={styles.tableCellText}>
                      {similarities[rowIdx]?.trim()
                        ? similarities[rowIdx]
                        : "NA"}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellLast]}>
                    <Text style={styles.tableCellText}>
                      {differences[rowIdx]?.trim()
                        ? differences[rowIdx]
                        : "NA"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.subsectionTitle}>Overlapping Concepts</Text>
            <Text style={styles.bodyText}>
              {overlapping.length > 0
                ? overlapping.join(", ")
                : "No overlapping concepts identified."}
            </Text>
          </Page>
        );
      })}
    </Document>
  );
}
