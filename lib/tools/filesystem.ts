import { safeReadFile, safeWriteFile, safeResolve, listTree } from "../fs-safe";

import fs from "node:fs/promises";

import type { Tool } from "./types";

export const readFileTool: Tool = {
  name: "read_file",

  description: "Reads a file from the workspace",

  category: "filesystem",

  requiresConfirmation: false,

  async execute(args: Record<string, unknown>) {
    const path = typeof args.path === "string" ? args.path : "";

    const abs = safeResolve(path);

    const stat = await fs.stat(abs);

    if (stat.isDirectory()) {
      throw new Error(
        `Cannot read directory "${path}". Use list_files instead.`
      );
    }

    const content = await safeReadFile(path);

    return {
      path,

      content,
    };
  },
};

export const writeFileTool: Tool = {
  name: "write_file",

  description: "Writes content to a workspace file",

  category: "filesystem",

  requiresConfirmation: true,

  async execute(args: Record<string, unknown>) {
    const path = typeof args.path === "string" ? args.path : "";

    const content = typeof args.content === "string" ? args.content : "";

    await safeWriteFile(path, content);

    return {
      ok: true,

      path,
    };
  },
};

export const listFilesTool: Tool = {
  name: "list_files",

  description: "Lists files and directories in the workspace",

  category: "filesystem",

  requiresConfirmation: false,

  async execute(args: Record<string, unknown>) {
    const path = typeof args.path === "string" ? args.path : "";

    return {
      path: path || ".",

      files: await listTree(path),
    };
  },
};

export const deleteFileTool: Tool = {
  name: "delete_file",

  description: "Deletes a workspace file or directory",

  category: "filesystem",

  requiresConfirmation: true,

  async execute(args: Record<string, unknown>) {
    const path = typeof args.path === "string" ? args.path : "";

    const abs = safeResolve(path);

    await fs.rm(abs, {
      recursive: true,

      force: true,
    });

    return {
      ok: true,

      path,
    };
  },
};
