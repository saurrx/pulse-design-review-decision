import { PRIOR_ART } from "./content";
import type { Rng } from "../runtime/prng";

/**
 * The evaluation report as Pulse stores it: pulse-backend evaluation-translate.ts,
 * REPORT_SHAPE_VERSION 3. Scores are 0 to 100.
 */
export function makeReport(rng: Rng, evaluationId: string, title: string, score: number, opts: { partial?: boolean } = {}) {
  const matches = [PRIOR_ART[Math.floor(rng() * PRIOR_ART.length)], PRIOR_ART[Math.floor(rng() * PRIOR_ART.length)], PRIOR_ART[Math.floor(rng() * PRIOR_ART.length)]]
    .filter((m, i, arr) => arr.findIndex((x) => x.publicationNumber === m.publicationNumber) === i)
    .map((m, i) => {
      const similarity = Math.round((0.82 - i * 0.14) * 100) / 100;
      return {
        title: m.title, publicationNumber: m.publicationNumber, similarityScore: similarity, noveltyScore: Math.round((1 - similarity) * 100) / 100,
        abstract: m.abstract,
        analysis: `Shares the ${i === 0 ? "core mechanism" : "general arrangement"} with the disclosure but does not describe the closed-loop correction.`,
        keySimilarities: ["Same field of application", i === 0 ? "Comparable mechanical element" : "Comparable sensing approach"],
        distinctDifferences: ["No self-correcting control loop", "Requires an external reference"],
        overlappingConcepts: ["tension control", "joint routing"],
      };
    });
  const priorArt = matches.map((m, i) => ({ publicationId: `pa-${i + 1}`, publicationNumber: m.publicationNumber, title: m.title, abstract: m.abstract, url: null, similarity: m.similarityScore, novelty: m.noveltyScore, analysis: m.analysis }));
  return {
    id: evaluationId,
    shapeVersion: 3,
    scoringResult: {
      score, noveltyScore: score, similarityScore: Math.round(matches[0].similarityScore * 100),
      summary: opts.partial
        ? `Partial result for "${title}": the prior-art search completed but the obviousness analysis timed out. Treat the score as provisional.`
        : `"${title}" appears novel over the closest art found. The closest reference shares the mechanical arrangement but lacks the self-correcting loop.`,
      overlappingConcepts: ["tension control", "joint routing", "closed-loop correction"],
      distinctDifferences: ["Passive element plus control loop in one assembly", "No external reference signal"],
      confidenceLevel: opts.partial ? "LOW" : "MEDIUM",
      closestMatches: matches,
      recommendations: [
        { text: "Claim the combination of the passive element and the correction loop.", rationale: "The closest art has one without the other.", basis: [matches[0].publicationNumber] },
        { text: "Add dependent claims on the alignment feature.", rationale: "Not found in the search set.", basis: [] },
      ],
      reviewFlags: opts.partial ? [{ kind: "DISCLOSURE_SUFFICIENCY", severity: "MEDIUM", rationale: "The novelty section is short; the search relied on the solution text." }] : [],
      detailedAnalysis: { marketScore: null, technicalScore: null, feasibilityScore: null, implementationScore: null, directNoveltyScore: score },
      evaluationMetrics: { evaluationCount: matches.length, maxSimilarity: matches[0].similarityScore, avgSimilarity: Math.round((matches.reduce((a, m) => a + m.similarityScore, 0) / matches.length) * 100) / 100 },
    },
    priorArt,
    raw: { resultSchemaVersion: "1.4.0", state: opts.partial ? "PARTIAL" : "SUCCEEDED", aiDisclosure: { generatedByAi: true, notLegalAdvice: true, humanReviewRequired: true } },
  };
}
