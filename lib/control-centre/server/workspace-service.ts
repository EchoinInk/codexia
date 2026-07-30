import path from "node:path";

import { createGitProvider } from "@/lib/agent/git-provider";
import {
  getWorkspaceEventHistory,
  subscribeWorkspaceEvents,
} from "@/lib/agent/event-system";
import { FileRuntimeCheckpointStore } from "@/lib/agent/runtime/checkpoint-store";
import { createRuntimeController } from "@/lib/agent/runtime/factory";
import type { RuntimeController } from "@/lib/agent/runtime/controller";
import { createTaskQueue } from "@/lib/agent/task-queue";
import { getWorkspaceRoot, safeReadFile, safeWriteFile } from "@/lib/fs-safe";
import { getWorkspaceIndex } from "@/lib/intelligence/workspace-index-manager";
import { loadWorkspaceMemorySnapshot } from "@/lib/intelligence/workspace-memory";
import {
  listFilesTool,
  readFileTool,
  writeFileTool,
} from "@/lib/tools/filesystem";

import type {
  AgentWorkspaceState,
  ArchitectureWorkspaceData,
  GitWorkspaceState,
  RuntimeWorkspaceState,
  TerminalExecutionResult,
  WorkspaceCapabilities,
  WorkspaceEvent,
  WorkspaceFileNode,
  WorkspaceHistory,
  WorkspaceSession,
} from "../types";

const SESSION_PATH = ".codexia/control-centre/session.json";

export class MissingCodexiaServiceError extends Error {
  constructor(public readonly capability: string, message: string) {
    super(message);
    this.name = "MissingCodexiaServiceError";
  }
}

interface ActiveRuntime {
  controller: RuntimeController;
  state: RuntimeWorkspaceState;
  operation?: Promise<void>;
}

const activeRuntimes = new Map<string, ActiveRuntime>();

function workspace() {
  return getWorkspaceRoot();
}

function asRuntimeState(
  checkpoint: Awaited<ReturnType<FileRuntimeCheckpointStore["loadLatest"]>>
): RuntimeWorkspaceState | null {
  if (!checkpoint) return null;
  return {
    taskId: checkpoint.taskId,
    status: checkpoint.state.status,
    phase: checkpoint.state.phase,
    iteration: checkpoint.state.iteration,
    checkpointId: checkpoint.id,
    updatedAt: checkpoint.state.updatedAt,
  };
}

function mapWorkspaceEvent(
  event: ReturnType<typeof getWorkspaceEventHistory>[number]
): WorkspaceEvent {
  const failed = event.type === "event_failed";
  return {
    id: event.id,
    kind:
      event.type === "memory_updated"
        ? "memory.updated"
        : failed
          ? "verification.failed"
          : "workspace.indexed",
    title: event.type.replaceAll("_", " "),
    detail: failed
      ? event.error
      : `${event.path} · ${event.type.replaceAll("_", " ")}`,
    actor: event.type === "memory_updated" ? "Workspace" : "Codier",
    occurredAt: new Date(event.timestamp).toISOString(),
    tone: failed ? "warning" : "neutral",
  };
}

export class CodexiaWorkspaceService {
  async loadActiveRepository() {
    return path.basename(workspace());
  }

  async detectCurrentBranch() {
    return createGitProvider().branch();
  }

  async restoreWorkspaceSession(): Promise<Partial<WorkspaceSession> | null> {
    try {
      return JSON.parse(
        await safeReadFile(SESSION_PATH, workspace())
      ) as Partial<WorkspaceSession>;
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  async persistWorkspaceSession(session: WorkspaceSession) {
    await safeWriteFile(
      SESSION_PATH,
      JSON.stringify(session, null, 2),
      workspace()
    );
  }

  async listWorkspaceFiles(): Promise<WorkspaceFileNode[]> {
    const result = (await listFilesTool.execute({ path: "" })) as {
      files: WorkspaceFileNode[];
    };
    return result.files;
  }

  async readFileContents(filePath: string) {
    const result = (await readFileTool.execute({ path: filePath })) as {
      content: string;
    };
    return result.content;
  }

  async writeFileContents(filePath: string, content: string) {
    await writeFileTool.execute({ path: filePath, content });
  }

  async loadGitStatusAndDiff(): Promise<GitWorkspaceState> {
    const git = createGitProvider();
    const [branch, status, diff] = await Promise.all([
      git.branch(),
      git.status(),
      git.diff(),
    ]);
    return { branch, status, diff };
  }

  async executeTerminalCommand(
    command: string
  ): Promise<TerminalExecutionResult> {
    throw new MissingCodexiaServiceError(
      "terminal",
      `No general terminal execution service exists in this Codexia baseline; “${command}” was not executed.`
    );
  }

  async loadRuntimeState(
    taskId: string
  ): Promise<RuntimeWorkspaceState | null> {
    const active = activeRuntimes.get(taskId);
    if (active) return { ...active.state };
    return asRuntimeState(
      await new FileRuntimeCheckpointStore(workspace()).loadLatest(taskId)
    );
  }

  async pauseRuntime(taskId: string): Promise<RuntimeWorkspaceState> {
    const active = activeRuntimes.get(taskId);
    if (!active || !active.controller.pause(taskId, "Paused from Control Centre")) {
      throw new MissingCodexiaServiceError(
        "runtime-control",
        `Runtime task ${taskId} is not active in this Codexia process.`
      );
    }
    active.state = { ...active.state, status: "pause-requested" };
    return { ...active.state };
  }

  async resumeRuntime(taskId: string): Promise<RuntimeWorkspaceState> {
    const checkpoint = await new FileRuntimeCheckpointStore(
      workspace()
    ).loadLatest(taskId);
    if (!checkpoint) {
      throw new MissingCodexiaServiceError(
        "runtime-control",
        `No durable checkpoint exists for runtime task ${taskId}.`
      );
    }

    const controller = createRuntimeController(workspace());
    const state: RuntimeWorkspaceState = {
      taskId,
      status: "running",
      phase: "idle",
      iteration: checkpoint.state.iteration,
      checkpointId: checkpoint.id,
      updatedAt: Date.now(),
    };
    const active: ActiveRuntime = { controller, state };
    activeRuntimes.set(taskId, active);
    active.operation = controller
      .resume(taskId)
      .then((result) => {
        active.state = {
          taskId,
          status: result.state.status,
          phase: result.state.phase,
          iteration: result.state.iteration,
          checkpointId: result.checkpoint?.id,
          updatedAt: result.state.updatedAt,
        };
      })
      .catch((error) => {
        active.state = {
          ...active.state,
          status: "failed",
          phase: error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        };
      });
    return { ...state };
  }

  async cancelRuntime(taskId: string): Promise<RuntimeWorkspaceState> {
    const active = activeRuntimes.get(taskId);
    if (!active || !active.controller.cancel(taskId, "Cancelled from Control Centre")) {
      throw new MissingCodexiaServiceError(
        "runtime-control",
        `Runtime task ${taskId} is not active in this Codexia process.`
      );
    }
    active.state = { ...active.state, status: "cancellation-requested" };
    return { ...active.state };
  }

  async completeMission(): Promise<RuntimeWorkspaceState> {
    throw new MissingCodexiaServiceError(
      "mission-completion",
      "This Codexia baseline has no mission lifecycle service that can complete and verify a mission."
    );
  }

  async restoreCheckpoint(
    taskId: string
  ): Promise<RuntimeWorkspaceState | null> {
    return asRuntimeState(
      await new FileRuntimeCheckpointStore(workspace()).loadLatest(taskId)
    );
  }

  async loadTaskAndMissionHistory(): Promise<WorkspaceHistory> {
    const queue = await createTaskQueue(workspace(), {
      configuration: { autoStart: false },
    });
    return {
      tasks: queue.list() as unknown as Array<Record<string, unknown>>,
      missions: [],
    };
  }

  async loadAgentStates(): Promise<AgentWorkspaceState[]> {
    throw new MissingCodexiaServiceError(
      "agent-state",
      "Multi-agent execution emits transient events but exposes no shared agent-state registry."
    );
  }

  async loadMemoryStatus() {
    const memory = await loadWorkspaceMemorySnapshot(workspace());
    return `Loaded · ${memory.recentlyModifiedFiles.length} recent files · ${memory.knowledge.architecture.length} architecture memories`;
  }

  async loadKnowledgeGraphStatus() {
    const index = await getWorkspaceIndex(workspace());
    const relationships = index.relationships?.relationships.length ?? 0;
    return `Indexed · ${relationships} relationships`;
  }

  async loadArchitectureAndSymbolIndex(): Promise<ArchitectureWorkspaceData> {
    const index = await getWorkspaceIndex(workspace());
    return {
      files: index.files.length,
      directories: index.directories.length,
      symbols: index.files.reduce(
        (count, file) => count + (file.code?.symbols.length ?? 0),
        0
      ),
      relationships: index.relationships?.relationships.length ?? 0,
      indexedPaths: index.files.map((file) => file.path),
    };
  }

  async loadCapabilities(): Promise<WorkspaceCapabilities> {
    return {
      terminal: {
        available: false,
        reason: "No general terminal execution service exists in this baseline.",
      },
      runtimeControl: {
        available: true,
        reason:
          "Available when a durable checkpoint exists and the runtime remains in this server process.",
      },
      missionCompletion: {
        available: false,
        reason: "No mission lifecycle and verification service exists.",
      },
      agentState: {
        available: false,
        reason: "No shared agent-state registry exists.",
      },
    };
  }

  recentEvents() {
    return getWorkspaceEventHistory(workspace()).map(mapWorkspaceEvent);
  }

  subscribeEvents(listener: (event: WorkspaceEvent) => void) {
    return subscribeWorkspaceEvents((event) => {
      if (event.workspace === workspace()) listener(mapWorkspaceEvent(event));
    });
  }
}

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export const codexiaWorkspaceService = new CodexiaWorkspaceService();
