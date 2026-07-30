"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { initialSession } from "@/lib/control-centre/fixtures";
import { workspaceGateway } from "@/lib/control-centre/gateway";
import type {
  AppMode,
  ControlView,
  IdeTool,
  RuntimeStatus,
  WorkspaceCapabilities,
  WorkspaceEvent,
  WorkspaceSession,
} from "@/lib/control-centre/types";

interface WorkspaceContextValue {
  session: WorkspaceSession;
  capabilities: WorkspaceCapabilities | null;
  gatewayKind: "hosted" | "codexia";
  setMode(mode: AppMode): void;
  openIde(tool?: IdeTool): void;
  setControlView(view: ControlView): void;
  setIdeTool(tool: IdeTool): void;
  setActiveFile(path: string): void;
  closeFile(path: string): void;
  toggleFolder(path: string): void;
  setPanel(panel: WorkspaceSession["panel"]): void;
  setBottomPanelOpen(open: boolean): void;
  submitTerminal(command: string): void;
  setRuntime(status: RuntimeStatus): void;
  completeTask(): void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function eventForRuntime(status: RuntimeStatus): WorkspaceEvent {
  const paused = status === "paused";
  return {
    id: `event-${Date.now()}`,
    kind: paused ? "runtime.paused" : "runtime.started",
    title: paused ? "Runtime paused" : "Runtime resumed",
    detail: paused
      ? "The active Codexia runtime accepted a pause request."
      : "The active Codexia runtime resumed from its durable checkpoint.",
    actor: "Runtime",
    occurredAt: "now",
    tone: paused ? "warning" : "success",
  };
}

function errorEvent(title: string, error: unknown): WorkspaceEvent {
  return {
    id: `event-${Date.now()}`,
    kind: "verification.failed",
    title,
    detail: error instanceof Error ? error.message : String(error),
    actor: "Workspace",
    occurredAt: "now",
    tone: "warning",
  };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState(initialSession);
  const [capabilities, setCapabilities] =
    useState<WorkspaceCapabilities | null>(null);

  const patch = useCallback((changes: Partial<WorkspaceSession>) => {
    setSession((current) => ({ ...current, ...changes }));
  }, []);

  useEffect(() => {
    let active = true;
    const subscription = workspaceGateway.streamWorkspaceEvents((event) => {
      if (!active) return;
      setSession((current) => ({
        ...current,
        events: [
          event,
          ...current.events.filter((item) => item.id !== event.id),
        ],
      }));
    });

    void Promise.all([
      workspaceGateway.restoreWorkspaceSession(),
      workspaceGateway.loadActiveRepository(),
      workspaceGateway.detectCurrentBranch(),
      workspaceGateway.loadMemoryStatus(),
      workspaceGateway.loadKnowledgeGraphStatus(),
      workspaceGateway.loadArchitectureAndSymbolIndex(),
      workspaceGateway.loadGitStatusAndDiff(),
      workspaceGateway.loadCapabilities(),
    ])
      .then(
        ([
          restored,
          repository,
          branch,
          memoryStatus,
          graphStatus,
          architecture,
          git,
          nextCapabilities,
        ]) => {
          if (!active) return;
          setCapabilities(nextCapabilities);
          setSession({
            ...restored,
            status: "ready",
            snapshot: {
              ...restored.snapshot,
              repository,
              branch,
              memoryStatus,
              graphStatus,
              indexedFiles: architecture.files,
              symbolCount: architecture.symbols,
              architectureScore:
                architecture.files === 0
                  ? 0
                  : Math.min(
                      100,
                      Math.round(
                        (architecture.relationships / architecture.files) * 25
                      )
                    ),
              gitStatus: git.status || "Clean",
              recentChanges: git.status
                ? git.status.split("\n").filter(Boolean).length
                : 0,
            },
          });
        }
      )
      .catch((error) => {
        if (!active) return;
        setSession((current) => ({
          ...current,
          status: "ready",
          codierPresence: {
            ...current.codierPresence,
            state: "error",
            priority: "attention",
            message:
              error instanceof Error ? error.message : String(error),
            lastUpdatedAt: "Just now",
          },
          events: [errorEvent("Workspace restore failed", error), ...current.events],
        }));
      });

    return () => {
      active = false;
      subscription.close();
    };
  }, []);

  useEffect(() => {
    if (session.status === "restoring") return;
    void workspaceGateway.persistWorkspaceSession(session).catch((error) => {
      console.error("Unable to persist Codexia workspace session", error);
    });
  }, [session]);

  const runRuntimeAction = useCallback(
    async (status: RuntimeStatus) => {
      const taskId = session.selectedTask.id;
      try {
        const runtime =
          status === "running"
            ? await workspaceGateway.resumeRuntime(taskId)
            : await workspaceGateway.pauseRuntime(taskId);
        const runtimeStatus =
          runtime.status === "pause-requested"
            ? "paused"
            : runtime.status === "running"
              ? "running"
              : status;
        setSession((current) => ({
          ...current,
          runtimeStatus,
          checkpoint: runtime.iteration,
          codierPresence: {
            ...current.codierPresence,
            state: runtimeStatus === "running" ? "monitoring" : "waiting",
            message:
              runtimeStatus === "running"
                ? "The real Codexia runtime resumed from its durable checkpoint."
                : "The real Codexia runtime accepted a safe pause request.",
            priority: runtimeStatus === "running" ? "normal" : "quiet",
            runtimeStatus,
            lastUpdatedAt: "Just now",
          },
          events: [eventForRuntime(runtimeStatus), ...current.events],
        }));
      } catch (error) {
        setSession((current) => ({
          ...current,
          codierPresence: {
            ...current.codierPresence,
            state: "warning",
            priority: "attention",
            message: error instanceof Error ? error.message : String(error),
            lastUpdatedAt: "Just now",
          },
          events: [errorEvent("Runtime action unavailable", error), ...current.events],
        }));
      }
    },
    [session.selectedTask.id]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      session,
      capabilities,
      gatewayKind: workspaceGateway.kind,
      setMode: (mode) =>
        patch({
          mode,
          status: mode === "ide" ? "working" : "ready",
          controlView: mode === "control-centre" ? "home" : session.controlView,
        }),
      openIde: (tool = "explorer") =>
        patch({ mode: "ide", status: "working", ideTool: tool }),
      setControlView: (controlView) => patch({ controlView }),
      setIdeTool: (ideTool) => patch({ ideTool }),
      setActiveFile: (path) =>
        setSession((current) => ({
          ...current,
          activeFile: path,
          openFiles: current.openFiles.includes(path)
            ? current.openFiles
            : [...current.openFiles, path],
        })),
      closeFile: (path) =>
        setSession((current) => {
          const openFiles = current.openFiles.filter((file) => file !== path);
          return {
            ...current,
            openFiles,
            activeFile:
              current.activeFile === path
                ? openFiles.at(-1) ?? ""
                : current.activeFile,
          };
        }),
      toggleFolder: (path) =>
        setSession((current) => ({
          ...current,
          expandedFolders: current.expandedFolders.includes(path)
            ? current.expandedFolders.filter((folder) => folder !== path)
            : [...current.expandedFolders, path],
        })),
      setPanel: (panel) => patch({ panel }),
      setBottomPanelOpen: (bottomPanelOpen) => patch({ bottomPanelOpen }),
      submitTerminal: (rawCommand) => {
        const command = rawCommand.trim();
        if (!command) return;
        void workspaceGateway
          .executeTerminalCommand(command)
          .then((result) => {
            const output =
              [result.stdout, result.stderr].filter(Boolean).join("\n") ||
              `Command exited with code ${result.exitCode ?? "unknown"}.`;
            setSession((current) => ({
              ...current,
              terminalHistory: [
                ...current.terminalHistory,
                `alex@codexia % ${command}`,
                output,
              ],
            }));
          })
          .catch((error) => {
            setSession((current) => ({
              ...current,
              terminalHistory: [
                ...current.terminalHistory,
                `alex@codexia % ${command}`,
                error instanceof Error ? error.message : String(error),
              ],
              events: [
                errorEvent("Terminal service unavailable", error),
                ...current.events,
              ],
            }));
          });
      },
      setRuntime: (runtimeStatus) => {
        void runRuntimeAction(runtimeStatus);
      },
      completeTask: () => {
        void workspaceGateway
          .completeMission(session.selectedTask.id)
          .then(() => {
            setSession((current) => ({
              ...current,
              mode: "control-centre",
              status: "ready",
              runtimeStatus: "completed",
              selectedTask: {
                ...current.selectedTask,
                status: "completed",
                progress: 100,
              },
              codierPresence: {
                ...current.codierPresence,
                state: "completed",
                priority: "attention",
                expression: "celebrating",
                runtimeStatus: "completed",
                message:
                  "Mission completed by the Codexia service and verification result restored.",
                lastUpdatedAt: "Just now",
              },
            }));
          })
          .catch((error) => {
            setSession((current) => ({
              ...current,
              codierPresence: {
                ...current.codierPresence,
                state: "warning",
                priority: "attention",
                message: error instanceof Error ? error.message : String(error),
                lastUpdatedAt: "Just now",
              },
              events: [
                errorEvent("Mission completion unavailable", error),
                ...current.events,
              ],
            }));
          });
      },
    }),
    [capabilities, patch, runRuntimeAction, session]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return context;
}
