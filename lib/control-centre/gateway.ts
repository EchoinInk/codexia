import { initialSession } from "./fixtures";
import type {
  AgentWorkspaceState,
  ArchitectureWorkspaceData,
  GitWorkspaceState,
  RuntimeWorkspaceState,
  TerminalExecutionResult,
  WorkspaceCapabilities,
  WorkspaceEvent,
  WorkspaceEventSubscription,
  WorkspaceFileNode,
  WorkspaceGateway,
  WorkspaceHistory,
  WorkspaceSession,
} from "./types";

const STORAGE_KEY = "codexia.workspace-session.v3";

function mergeSession(
  restored: Partial<WorkspaceSession> | null | undefined
): WorkspaceSession {
  if (!restored) return initialSession;

  return {
    ...initialSession,
    ...restored,
    selectedTask: {
      ...initialSession.selectedTask,
      ...restored.selectedTask,
    },
    openFiles: restored.openFiles ?? initialSession.openFiles,
    expandedFolders:
      restored.expandedFolders ?? initialSession.expandedFolders,
    terminalHistory:
      restored.terminalHistory ?? initialSession.terminalHistory,
    events: restored.events ?? initialSession.events,
    snapshot: { ...initialSession.snapshot, ...restored.snapshot },
    codierPresence: {
      ...initialSession.codierPresence,
      ...restored.codierPresence,
    },
  };
}

export class HostedWorkspaceGateway implements WorkspaceGateway {
  readonly kind = "hosted" as const;

  async loadActiveRepository() {
    return initialSession.snapshot.repository;
  }

  async detectCurrentBranch() {
    return initialSession.snapshot.branch;
  }

  async restoreWorkspaceSession() {
    if (typeof window === "undefined") return initialSession;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialSession;

    try {
      return mergeSession(JSON.parse(stored) as Partial<WorkspaceSession>);
    } catch {
      return initialSession;
    }
  }

  async persistWorkspaceSession(session: WorkspaceSession) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }

  async listWorkspaceFiles(): Promise<WorkspaceFileNode[]> {
    return [];
  }

  async readFileContents(path: string) {
    return `Hosted preview fixture for ${path}.`;
  }

  async writeFileContents() {
    throw new Error("Sites preview cannot write to a local workspace.");
  }

  async loadGitStatusAndDiff(): Promise<GitWorkspaceState> {
    return {
      branch: initialSession.snapshot.branch,
      status: "Hosted preview fixture: 3 simulated changes",
      diff: "Hosted preview fixture diff",
    };
  }

  async executeTerminalCommand(
    command: string
  ): Promise<TerminalExecutionResult> {
    return {
      command,
      stdout: "",
      stderr: "Sites preview cannot access a local terminal.",
      exitCode: null,
      supported: false,
    };
  }

  async loadRuntimeState(taskId: string): Promise<RuntimeWorkspaceState> {
    return {
      taskId,
      status: initialSession.runtimeStatus,
      phase: "hosted-preview",
      iteration: initialSession.checkpoint,
      checkpointId: `hosted-${initialSession.checkpoint}`,
    };
  }

  async pauseRuntime(taskId: string) {
    return {
      taskId,
      status: "paused",
      phase: "hosted-preview",
      iteration: initialSession.checkpoint,
    };
  }

  async resumeRuntime(taskId: string) {
    return {
      taskId,
      status: "running",
      phase: "hosted-preview",
      iteration: initialSession.checkpoint,
    };
  }

  async cancelRuntime(taskId: string) {
    return {
      taskId,
      status: "cancelled",
      phase: "hosted-preview",
      iteration: initialSession.checkpoint,
    };
  }

  async completeMission(taskId: string) {
    return {
      taskId,
      status: "completed",
      phase: "hosted-preview",
      iteration: initialSession.checkpoint,
    };
  }

  async restoreCheckpoint(taskId: string) {
    return this.loadRuntimeState(taskId);
  }

  async loadTaskAndMissionHistory(): Promise<WorkspaceHistory> {
    return { tasks: [], missions: [] };
  }

  async loadAgentStates(): Promise<AgentWorkspaceState[]> {
    return [];
  }

  async loadMemoryStatus() {
    return initialSession.snapshot.memoryStatus;
  }

  async loadKnowledgeGraphStatus() {
    return initialSession.snapshot.graphStatus;
  }

  async loadArchitectureAndSymbolIndex(): Promise<ArchitectureWorkspaceData> {
    return {
      files: initialSession.snapshot.indexedFiles,
      directories: 0,
      symbols: initialSession.snapshot.symbolCount,
      relationships: 0,
      indexedPaths: [],
    };
  }

  async loadCapabilities(): Promise<WorkspaceCapabilities> {
    const unavailable = {
      available: false,
      reason: "Available only in the local Codexia application.",
    };
    return {
      terminal: unavailable,
      runtimeControl: {
        available: true,
        reason: "Hosted state only; no local runtime process is controlled.",
      },
      missionCompletion: {
        available: true,
        reason: "Hosted state only; no local verification is executed.",
      },
      agentState: unavailable,
    };
  }

  streamWorkspaceEvents(): WorkspaceEventSubscription {
    return { close() {} };
  }
}

interface ApiResult<T> {
  data?: T;
  error?: string;
  missingService?: boolean;
}

export class CodexiaWorkspaceGateway implements WorkspaceGateway {
  readonly kind = "codexia" as const;

  private async request<T>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<T> {
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = (await response.json()) as ApiResult<T>;
    if (!response.ok || result.error) {
      throw new Error(result.error ?? `Workspace action failed: ${action}`);
    }
    return result.data as T;
  }

  loadActiveRepository() {
    return this.request<string>("load-active-repository");
  }

  detectCurrentBranch() {
    return this.request<string>("detect-current-branch");
  }

  async restoreWorkspaceSession() {
    return mergeSession(
      await this.request<Partial<WorkspaceSession> | null>("restore-session")
    );
  }

  persistWorkspaceSession(session: WorkspaceSession) {
    return this.request<void>("persist-session", { session });
  }

  listWorkspaceFiles() {
    return this.request<WorkspaceFileNode[]>("list-files");
  }

  readFileContents(path: string) {
    return this.request<string>("read-file", { path });
  }

  writeFileContents(path: string, content: string) {
    return this.request<void>("write-file", { path, content });
  }

  loadGitStatusAndDiff() {
    return this.request<GitWorkspaceState>("load-git");
  }

  executeTerminalCommand(command: string) {
    return this.request<TerminalExecutionResult>("execute-terminal", {
      command,
    });
  }

  loadRuntimeState(taskId: string) {
    return this.request<RuntimeWorkspaceState | null>("load-runtime", {
      taskId,
    });
  }

  pauseRuntime(taskId: string) {
    return this.request<RuntimeWorkspaceState>("pause-runtime", { taskId });
  }

  resumeRuntime(taskId: string) {
    return this.request<RuntimeWorkspaceState>("resume-runtime", { taskId });
  }

  cancelRuntime(taskId: string) {
    return this.request<RuntimeWorkspaceState>("cancel-runtime", { taskId });
  }

  completeMission(missionId: string) {
    return this.request<RuntimeWorkspaceState>("complete-mission", {
      missionId,
    });
  }

  restoreCheckpoint(taskId: string) {
    return this.request<RuntimeWorkspaceState | null>("restore-checkpoint", {
      taskId,
    });
  }

  loadTaskAndMissionHistory() {
    return this.request<WorkspaceHistory>("load-history");
  }

  loadAgentStates() {
    return this.request<AgentWorkspaceState[]>("load-agents");
  }

  loadMemoryStatus() {
    return this.request<string>("load-memory");
  }

  loadKnowledgeGraphStatus() {
    return this.request<string>("load-knowledge-graph");
  }

  loadArchitectureAndSymbolIndex() {
    return this.request<ArchitectureWorkspaceData>("load-architecture");
  }

  loadCapabilities() {
    return this.request<WorkspaceCapabilities>("load-capabilities");
  }

  streamWorkspaceEvents(
    listener: (event: WorkspaceEvent) => void
  ): WorkspaceEventSubscription {
    const source = new EventSource("/api/workspace/events");
    source.onmessage = (message) => {
      listener(JSON.parse(message.data) as WorkspaceEvent);
    };
    return { close: () => source.close() };
  }
}

export function createWorkspaceGateway(): WorkspaceGateway {
  return process.env.NEXT_PUBLIC_CODEXIA_WORKSPACE_GATEWAY === "hosted"
    ? new HostedWorkspaceGateway()
    : new CodexiaWorkspaceGateway();
}

export const workspaceGateway = createWorkspaceGateway();
