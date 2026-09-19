import type { EngineeringGoal } from "./types";
import type { createEngineeringReport } from "./report";

export type EngineeringReport = ReturnType<typeof createEngineeringReport>;
export interface ChatRequestContext {
  selectedFile?: string;
}
export interface ReadOnlyFileContext {
  path: string;
  content: string;
}
/** Server-owned admission data; no executable patch or client planning. */
export type ChatResponse =
  | { kind: "chat" | "unsupported"; content: string }
  | { kind: "engineering"; content: string; taskId: string; goal: EngineeringGoal; goalDigest: string };
