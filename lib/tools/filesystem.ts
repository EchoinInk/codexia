import { safeReadFile, listTree } from "../fs-safe";
import type { Tool } from "./types";

function fileArgs(args: Record<string, unknown>) {
  if (typeof args.path !== "string" || !args.path.trim() || args.path.includes("\0")) throw new Error("Nonempty file path required");
}

export const readFileTool: Tool = {
  name: "read_file", description: "Reads a file from the workspace", category: "filesystem",
  requiresConfirmation: false, capability: "read", actions: ["read"], validate: fileArgs,
  async execute(args, context) {
    fileArgs(args);
    return { path: args.path, content: await safeReadFile(args.path as string, context.workspace) };
  },
};

export const writeFileTool: Tool = {
  name: "write_file", description: "Source edits require the reviewed change workflow", category: "filesystem",
  requiresConfirmation: true, capability: "source_write", actions: ["write"],
  validate(args) {
    fileArgs(args);
    if (typeof args.content !== "string" || !args.content.trim()) throw new Error("Nonempty file content required");
    if (/^(?:todo|tbd|placeholder|write this later|<content>|\[content\])$/i.test(args.content.trim())) {
      throw new Error("Placeholder file content is not executable");
    }
  },
  async execute() { throw new Error("Use proposal → Validator → reviewed change Workflow for source edits"); },
};

export const listFilesTool: Tool = {
  name: "list_files", description: "Lists files and directories in the workspace", category: "filesystem",
  requiresConfirmation: false, capability: "read", actions: ["read"],
  validate(args) { if (args.path !== undefined && typeof args.path !== "string") throw new Error("path must be a string"); },
  async execute(args, context) {
    this.validate(args);
    const path = (args.path as string | undefined) ?? "";
    return { path: path || ".", files: await listTree(path, context.workspace) };
  },
};

export const deleteFileTool: Tool = {
  name: "delete_file", description: "Deletion is unavailable to agent plans", category: "filesystem",
  requiresConfirmation: true, capability: "delete", actions: ["write"], validate: fileArgs,
  async execute() { throw new Error("Agent deletion has no reviewed authority contract and is unavailable"); },
};
