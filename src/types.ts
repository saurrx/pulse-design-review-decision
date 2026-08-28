// Evaluation Result Types
export interface EvaluationResult {
  id: string;
  score: number;
  status: string;
  metadata: {
    sort: string;
    businessScope: string | null;
  };
  priorArt: Array<{
    url: string;
    title: string;
    abstract: string;
    publicationNumber?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  patentIdea: string;
  noveltyScore: number;
  similarityScore: number;
  noveltyCategory: string;
  evaluations: Array<{
    analysis: string;
    priorArtRef?: string;
    noveltyScore: number;
    similarityScore: number;
  }>;
  scoringResult: {
    score: number;
    summary: string;
    noveltyScore: number;
    scoringMethod: string;
    confidenceLevel: string;
    similarityScore: number;
    detailedAnalysis: {
      technicalScore: number;
      implementationScore: number;
      confidenceFactors: {
        dataQuality: number;
        dataPrecision: number;
        evaluationCount: number;
        technicalCoverage: number;
      };
      directNoveltyScore: number;
    };
    evaluationMetrics: {
      timeoutCount: number;
      avgSimilarity: number;
      maxSimilarity: number;
      evaluationCount: number;
    };
    closestMatches: Array<{
      score: number;
      title: string;
      abstract?: string;
      publicationNumber?: string;
      noveltyScore: number;
      keySimilarities: string[];
      similarityScore: number;
      distinctDifferences: string[];
      overlappingConcepts: string[];
      analysis?: string;
    }>;
  };
  recommendations?: string[];
}
