export type AppMode = "control-centre" | "ide";
export type RuntimeStatus = "idle" | "running" | "paused" | "completed";
export type SessionStatus = "restoring" | "ready" | "working";
export type ControlView =
  | "home"
  | "search"
  | "changes"
  | "architecture"
  | "activity"
  | "agents"
  | "runtime"
  | "tests"
  | "documentation"
  | "codier"
  | "knowledge-graph"
  | "memory"
  | "settings"
  | "extensions";
export type IdeTool =
  | "explorer"
  | "search"
  | "source-control"
  | "architecture"
  | "tests"
  | "documentation"
  | "settings";
export type CodierState =
  | "thinking"
  | "analysing"
  | "planning"
  | "building"
  | "reviewing"
  | "monitoring"
  | "waiting"
  | "completed"
  | "warning"
  | "error";
export type CodierPriority = "quiet" | "normal" | "attention" | "critical";
export type EventKind =
  | "workspace.indexed"
  | "architecture.updated"
  | "plan.created"
  | "runtime.started"
  | "runtime.paused"
  | "verification.passed"
  | "verification.failed"
  | "documentation.updated"
  | "task.completed"
  | "memory.updated";

export interface WorkspaceEvent {
  id: string;
  kind: EventKind;
  title: string;
  detail: string;
  actor: "Codier" | "Runtime" | "Workspace" | "Git";
  occurredAt: string;
  tone: "neutral" | "success" | "warning";
}

export interface WorkspaceTask {
  id: string;
  title: string;
  description: string;
  phase: string;
  progress: number;
  status: "recommended" | "active" | "paused" | "completed";
  relevantFiles: string[];
}

export interface WorkspaceSnapshot {
  repository: string;
  branch: string;
  phase: string;
  health: number;
  memoryStatus: string;
  graphStatus: string;
  architectureScore: number;
  indexedFiles: number;
  symbolCount: number;
  activeWorkflows: number;
  agentStatus: string;
  gitStatus: string;
  verificationStatus: string;
  recentChanges: number;
}

export interface CodierPresence {
  state: CodierState;
  message: string;
  priority: CodierPriority;
  expression: "waving" | "focused" | "celebrating" | "concerned";
  relatedTaskId: string | null;
  runtimeStatus: RuntimeStatus;
  lastUpdatedAt: string;
}

export interface WorkspaceSession {
  id: string;
  mode: AppMode;
  status: SessionStatus;
  selectedTask: WorkspaceTask;
  runtimeStatus: RuntimeStatus;
  checkpoint: number;
  briefing: string;
  activeFile: string;
  openFiles: string[];
  panel: "terminal" | "problems" | "output";
  controlView: ControlView;
  ideTool: IdeTool;
  expandedFolders: string[];
  terminalHistory: string[];
  bottomPanelOpen: boolean;
  codierPresence: CodierPresence;
  snapshot: WorkspaceSnapshot;
  events: WorkspaceEvent[];
}

export interface WorkspaceFileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: WorkspaceFileNode[];
}

export interface GitWorkspaceState {
  branch: string;
  status: string;
  diff: string;
}

export interface TerminalExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  supported: boolean;
}

export interface RuntimeWorkspaceState {
  taskId: string;
  status: string;
  phase: string;
  iteration: number;
  checkpointId?: string;
  updatedAt?: number;
}

export interface WorkspaceCapability {
  available: boolean;
  reason?: string;
}

export interface WorkspaceCapabilities {
  terminal: WorkspaceCapability;
  runtimeControl: WorkspaceCapability;
  missionCompletion: WorkspaceCapability;
  agentState: WorkspaceCapability;
}

export interface ArchitectureWorkspaceData {
  files: number;
  directories: number;
  symbols: number;
  relationships: number;
  indexedPaths: string[];
}

export interface WorkspaceHistory {
  tasks: Array<Record<string, unknown>>;
  missions: Array<Record<string, unknown>>;
}

export interface AgentWorkspaceState {
  id: string;
  role: string;
  status: string;
}

export interface WorkspaceEventSubscription {
  close(): void;
}

export interface WorkspaceGateway {
  readonly kind: "hosted" | "codexia";
  loadActiveRepository(): Promise<string>;
  detectCurrentBranch(): Promise<string>;
  restoreWorkspaceSession(): Promise<WorkspaceSession>;
  persistWorkspaceSession(session: WorkspaceSession): Promise<void>;
  listWorkspaceFiles(): Promise<WorkspaceFileNode[]>;
  readFileContents(path: string): Promise<string>;
  writeFileContents(path: string, content: string): Promise<void>;
  loadGitStatusAndDiff(): Promise<GitWorkspaceState>;
  executeTerminalCommand(command: string): Promise<TerminalExecutionResult>;
  loadRuntimeState(taskId: string): Promise<RuntimeWorkspaceState | null>;
  pauseRuntime(taskId: string): Promise<RuntimeWorkspaceState>;
  resumeRuntime(taskId: string): Promise<RuntimeWorkspaceState>;
  cancelRuntime(taskId: string): Promise<RuntimeWorkspaceState>;
  completeMission(missionId: string): Promise<RuntimeWorkspaceState>;
  restoreCheckpoint(taskId: string): Promise<RuntimeWorkspaceState | null>;
  loadTaskAndMissionHistory(): Promise<WorkspaceHistory>;
  loadAgentStates(): Promise<AgentWorkspaceState[]>;
  loadMemoryStatus(): Promise<string>;
  loadKnowledgeGraphStatus(): Promise<string>;
  loadArchitectureAndSymbolIndex(): Promise<ArchitectureWorkspaceData>;
  loadCapabilities(): Promise<WorkspaceCapabilities>;
  streamWorkspaceEvents(
    listener: (event: WorkspaceEvent) => void
  ): WorkspaceEventSubscription;
}
