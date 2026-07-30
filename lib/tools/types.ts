export interface Tool {
  name: string;

  description: string;

  category: "filesystem" | "git" | "analysis";

  requiresConfirmation: boolean;

  execute(args: Record<string, unknown>): Promise<unknown>;
}
