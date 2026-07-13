import { execFile } from "node:child_process";

import { promisify } from "node:util";

import type { Tool } from "./types";

const execFileAsync = promisify(execFile);

async function runGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args);

  return stdout.trim();
}

export const gitStatusTool: Tool = {
  name: "git_status",

  description: "Shows current git repository status",

  category: "git",

  requiresConfirmation: false,

  async execute() {
    return runGit(["status", "--short"]);
  },
};

export const gitDiffTool: Tool = {
  name: "git_diff",

  description: "Shows current git changes",

  category: "git",

  requiresConfirmation: false,

  async execute() {
    return runGit(["diff"]);
  },
};

export const gitCommitTool: Tool = {
  name: "git_commit",

  description: "Creates a git commit",

  category: "git",

  requiresConfirmation: true,

  async execute(args: Record<string, unknown>) {
    const message =
      typeof args.message === "string" ? args.message : "Codexia change";

    await runGit(["add", "."]);

    return runGit(["commit", "-m", message]);
  },
};
