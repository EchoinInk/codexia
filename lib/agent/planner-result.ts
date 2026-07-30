export type PlannerSource =
  | "rule"
  | "llm"
  | "hybrid";


export interface PlannerMetadata {

  source: PlannerSource;

  fallback:
    boolean;

  fallbackReason?: string;

  durationMs?: number;

}