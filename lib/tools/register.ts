import { toolRegistry } from "./registry";

import {
  readFileTool,
  writeFileTool,
  listFilesTool,
  deleteFileTool,
} from "./filesystem";

import {
  gitStatusTool,
  gitDiffTool,
  gitCommitTool,
} from "./git";


export function registerTools() {
  const existing =
    toolRegistry
      .list()
      .map(tool => tool.name);


  const tools = [
    readFileTool,
    writeFileTool,
    listFilesTool,
    deleteFileTool,
    gitStatusTool,
    gitDiffTool,
    gitCommitTool,
  ];


  for (const tool of tools) {
    if (!existing.includes(tool.name)) {
      toolRegistry.register(tool);
    }
  }
}