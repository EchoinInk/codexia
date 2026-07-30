import { NextResponse } from "next/server";

import {
  codexiaWorkspaceService,
  MissingCodexiaServiceError,
} from "@/lib/control-centre/server/workspace-service";

export const runtime = "nodejs";

interface WorkspaceRequest {
  action?: string;
  path?: string;
  content?: string;
  command?: string;
  taskId?: string;
  missionId?: string;
  session?: unknown;
}

function required(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as WorkspaceRequest;
    let data: unknown;

    switch (input.action) {
      case "load-active-repository":
        data = await codexiaWorkspaceService.loadActiveRepository();
        break;
      case "detect-current-branch":
        data = await codexiaWorkspaceService.detectCurrentBranch();
        break;
      case "restore-session":
        data = await codexiaWorkspaceService.restoreWorkspaceSession();
        break;
      case "persist-session":
        data = await codexiaWorkspaceService.persistWorkspaceSession(
          input.session as Parameters<
            typeof codexiaWorkspaceService.persistWorkspaceSession
          >[0]
        );
        break;
      case "list-files":
        data = await codexiaWorkspaceService.listWorkspaceFiles();
        break;
      case "read-file":
        data = await codexiaWorkspaceService.readFileContents(
          required(input.path, "path")
        );
        break;
      case "write-file":
        data = await codexiaWorkspaceService.writeFileContents(
          required(input.path, "path"),
          required(input.content, "content")
        );
        break;
      case "load-git":
        data = await codexiaWorkspaceService.loadGitStatusAndDiff();
        break;
      case "execute-terminal":
        data = await codexiaWorkspaceService.executeTerminalCommand(
          required(input.command, "command")
        );
        break;
      case "load-runtime":
        data = await codexiaWorkspaceService.loadRuntimeState(
          required(input.taskId, "taskId")
        );
        break;
      case "pause-runtime":
        data = await codexiaWorkspaceService.pauseRuntime(
          required(input.taskId, "taskId")
        );
        break;
      case "resume-runtime":
        data = await codexiaWorkspaceService.resumeRuntime(
          required(input.taskId, "taskId")
        );
        break;
      case "cancel-runtime":
        data = await codexiaWorkspaceService.cancelRuntime(
          required(input.taskId, "taskId")
        );
        break;
      case "complete-mission":
        data = await codexiaWorkspaceService.completeMission();
        break;
      case "restore-checkpoint":
        data = await codexiaWorkspaceService.restoreCheckpoint(
          required(input.taskId, "taskId")
        );
        break;
      case "load-history":
        data = await codexiaWorkspaceService.loadTaskAndMissionHistory();
        break;
      case "load-agents":
        data = await codexiaWorkspaceService.loadAgentStates();
        break;
      case "load-memory":
        data = await codexiaWorkspaceService.loadMemoryStatus();
        break;
      case "load-knowledge-graph":
        data = await codexiaWorkspaceService.loadKnowledgeGraphStatus();
        break;
      case "load-architecture":
        data =
          await codexiaWorkspaceService.loadArchitectureAndSymbolIndex();
        break;
      case "load-capabilities":
        data = await codexiaWorkspaceService.loadCapabilities();
        break;
      default:
        return NextResponse.json(
          { error: `Unknown workspace action: ${input.action ?? "(missing)"}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ data });
  } catch (error) {
    const missing = error instanceof MissingCodexiaServiceError;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        missingService: missing,
      },
      { status: missing ? 501 : 500 }
    );
  }
}
