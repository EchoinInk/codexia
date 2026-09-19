import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getWorkspaceRoot } from "../fs-safe";
import type { Tool, ToolExecutionContext } from "./types";

const execFileAsync = promisify(execFile);
async function runGit(args: string[], context: ToolExecutionContext): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: getWorkspaceRoot(context.workspace), signal: context.signal });
  return stdout.trim();
}
function noArgs(args: Record<string, unknown>) {
  if (Object.keys(args).length) throw new Error("This Git operation accepts no arguments");
}
export const gitStatusTool: Tool = {
  name: "git_status", description: "Shows workspace Git status", category: "git",
  requiresConfirmation: false, capability: "read", actions: ["read"], validate: noArgs,
  async execute(args, context) { noArgs(args); return runGit(["status", "--short"], context); },
};
export const gitDiffTool: Tool = {
  name: "git_diff", description: "Shows workspace Git changes", category: "git",
  requiresConfirmation: false, capability: "read", actions: ["read"], validate: noArgs,
  async execute(args, context) { noArgs(args); return runGit(["diff"], context); },
};
export const gitCommitTool: Tool = {
  name: "git_commit", description: "Git publication is unavailable to agent plans", category: "git",
  requiresConfirmation: true, capability: "publication", actions: ["write"],
  validate(args) {
    if (typeof args.message !== "string" || !args.message.trim()) throw new Error("Commit message required");
  },
  // The existing proposal authority covers source replacement, not staging or
  // publication. Neither planner-provided files nor confirmation flags grant it.
  // No files are staged; a future host contract must authorize exact files.
  async execute() { throw new Error("Git staging/commit requires separate reviewed authority and is unavailable"); },
};
