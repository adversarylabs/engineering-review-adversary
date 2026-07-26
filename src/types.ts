export const reviewCategories = [
  "correctness",
  "completeness",
  "maintainability",
  "readability",
  "architecture",
  "risk",
  "validation",
] as const;

export type ReviewCategory = (typeof reviewCategories)[number];
export type ReviewSeverity = "low" | "medium" | "high" | "critical";
export type ReviewRisk = "none" | ReviewSeverity;

export interface ModelEvidence {
  citationId: string;
  line: number;
  detail: string;
}

export interface ModelObservation {
  id: string;
  title: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  confidence: "medium" | "high";
  principle: string;
  summary: string;
  impact: string;
  recommendation: string;
  tradeoffs: string;
  evidence: ModelEvidence[];
}

export interface ModelStrength {
  summary: string;
  evidence: ModelEvidence[];
}

export interface EngineeringReviewOutput {
  schemaVersion: 1;
  overall: {
    verdict:
      | "well-engineered"
      | "ready-with-minor-improvements"
      | "correct-but-over-engineered"
      | "significant-maintainability-concerns"
      | "incomplete-implementation"
      | "high-operational-risk";
    risk: ReviewRisk;
    ship: boolean;
    summary: string;
    primaryConcern: string;
  };
  observations: ModelObservation[];
  strengths: ModelStrength[];
}
