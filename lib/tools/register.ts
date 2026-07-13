import { toolRegistry } from "./registry";

import {
  readFileTool,
  writeFileTool,
  listFilesTool,
  deleteFileTool,
} from "./filesystem";

import { gitStatusTool, gitDiffTool, gitCommitTool } from "./git";

export function registerTools() {
  toolRegistry.register(readFileTool);

  toolRegistry.register(writeFileTool);

  toolRegistry.register(listFilesTool);

  toolRegistry.register(deleteFileTool);

  toolRegistry.register(gitStatusTool);

  toolRegistry.register(gitDiffTool);

  toolRegistry.register(gitCommitTool);
}
