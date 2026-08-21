export type ColumnKey = "yueli" | "yueshi";

export type Topic = {
  id: string;
  title: string;
  column: ColumnKey;
  whyNow: string;
  voxAngle: string;
  source: string;
  freshness: number;
  voxFit: number;
  audible: number;
  format: string;
  risk?: string;
};

export type LearningProposal = {
  id: string;
  rule: string;
  evidence: string[];
  confidence: number;
  oldRule: string;
  newRule: string;
};
