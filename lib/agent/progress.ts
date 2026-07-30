export type AgentStage =
  | "planning"
  | "analysing"
  | "selecting_files"
  | "generating_changes"
  | "applying_changes"
  | "verifying"
  | "completed"
  | "failed";


export interface AgentProgress {

  stage: AgentStage;

  message: string;

  timestamp: number;

}


export function createProgress(
  stage: AgentStage,
  message: string
): AgentProgress {

  return {

    stage,

    message,

    timestamp:
      Date.now(),

  };

}