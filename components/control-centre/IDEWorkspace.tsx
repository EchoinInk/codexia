"use client";

import { useEffect, useState } from "react";

import { Chat } from "@/components/Chat";
import { FileTree } from "@/components/FileTree";
import { FileViewer } from "@/components/FileViewer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { workspaceGateway } from "@/lib/control-centre/gateway";
import type {
  ArchitectureWorkspaceData,
  GitWorkspaceState,
} from "@/lib/control-centre/types";

import { useWorkspace } from "./WorkspaceProvider";

const tools = [
  ["explorer", "Files"],
  ["search", "Codier"],
  ["source-control", "Changes"],
  ["architecture", "Architecture"],
  ["tests", "Tests"],
  ["documentation", "Documentation"],
  ["settings", "Settings"],
] as const;

export function IDEWorkspace() {
  const {
    session,
    capabilities,
    setActiveFile,
    setIdeTool,
    setMode,
    submitTerminal,
  } = useWorkspace();
  const [fsKey, setFsKey] = useState(0);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [git, setGit] = useState<GitWorkspaceState | null>(null);
  const [architecture, setArchitecture] =
    useState<ArchitectureWorkspaceData | null>(null);

  useEffect(() => {
    if (session.ideTool === "source-control") {
      void workspaceGateway.loadGitStatusAndDiff().then(setGit);
    }
    if (session.ideTool === "architecture") {
      void workspaceGateway
        .loadArchitectureAndSymbolIndex()
        .then(setArchitecture);
    }
  }, [session.ideTool]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!terminalCommand.trim()) return;
    submitTerminal(terminalCommand);
    setTerminalCommand("");
  };

  return (
    <section className="real-ide">
      <nav className="real-ide-tools" aria-label="IDE tools">
        {tools.map(([tool, label]) => (
          <button
            key={tool}
            className={session.ideTool === tool ? "active" : ""}
            onClick={() => setIdeTool(tool)}
          >
            {label}
          </button>
        ))}
        <button onClick={() => setMode("control-centre")}>
          Minimise to Control Centre
        </button>
      </nav>

      <div className="real-ide-body">
        {session.ideTool === "explorer" && (
          <>
            <aside className="real-file-tree">
              <FileTree
                refreshKey={fsKey}
                activePath={session.activeFile}
                onOpen={setActiveFile}
              />
            </aside>
            <section className="real-editor">
              {session.activeFile ? (
                <FileViewer
                  path={session.activeFile}
                  onClose={() => setActiveFile("")}
                  onSaved={() => setFsKey((key) => key + 1)}
                />
              ) : (
                <div className="real-empty-state">
                  Select a real repository file to inspect or edit it.
                </div>
              )}
            </section>
          </>
        )}

        {session.ideTool === "search" && (
          <section className="real-tool-panel full">
            <Chat onWorkspaceChanged={() => setFsKey((key) => key + 1)} />
          </section>
        )}

        {session.ideTool === "source-control" && (
          <section className="real-tool-panel full">
            <h2>Git changes</h2>
            <p>Branch: {git?.branch ?? "Loading…"}</p>
            <h3>Status</h3>
            <pre>{git?.status || "Working tree clean"}</pre>
            <h3>Diff</h3>
            <pre>{git?.diff || "No unstaged diff"}</pre>
          </section>
        )}

        {session.ideTool === "architecture" && (
          <section className="real-tool-panel full">
            <h2>Workspace architecture</h2>
            <div className="real-metrics">
              <span>{architecture?.files ?? "—"} files</span>
              <span>{architecture?.directories ?? "—"} directories</span>
              <span>{architecture?.symbols ?? "—"} symbols</span>
              <span>{architecture?.relationships ?? "—"} relationships</span>
            </div>
          </section>
        )}

        {session.ideTool === "tests" && (
          <section className="real-tool-panel full">
            <h2>Tests</h2>
            <p>
              Use Codexia&apos;s existing verification workflow from Codier.
              General terminal execution is not exposed by this baseline.
            </p>
          </section>
        )}

        {session.ideTool === "documentation" && (
          <section className="real-tool-panel full">
            <h2>Documentation</h2>
            <p>
              Open documentation files through Files. They use the same real
              workspace reader and editor as source files.
            </p>
          </section>
        )}

        {session.ideTool === "settings" && (
          <section className="real-tool-panel full">
            <SettingsPanel />
          </section>
        )}
      </div>

      <div className="real-terminal">
        <div className="real-terminal-output" aria-live="polite">
          {session.terminalHistory.slice(-5).map((line, index) => (
            <div key={`${index}-${line}`}>{line}</div>
          ))}
        </div>
        <form onSubmit={submit}>
          <span>alex@codexia %</span>
          <input
            value={terminalCommand}
            onChange={(event) => setTerminalCommand(event.target.value)}
            placeholder={
              capabilities?.terminal.available
                ? "Enter command"
                : "Terminal unavailable in this Codexia baseline"
            }
            disabled={capabilities?.terminal.available === false}
          />
          <button
            type="submit"
            disabled={capabilities?.terminal.available === false}
          >
            Run
          </button>
        </form>
        {capabilities?.terminal.available === false && (
          <p>{capabilities.terminal.reason}</p>
        )}
      </div>
    </section>
  );
}
