import type { AgentAction } from "@/lib/agent/contracts/action-types";

export interface ToolExecutionContext { workspace: string; signal?: AbortSignal }
export interface Tool {
  name: string;
  description: string;
  category: "filesystem" | "git" | "analysis";
  requiresConfirmation: boolean;
  capability: "read" | "source_write" | "delete" | "publication";
  actions: readonly AgentAction[];
  validate(args: Record<string, unknown>): void;
  execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown>;
}
