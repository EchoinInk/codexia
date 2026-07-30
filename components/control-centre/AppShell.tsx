"use client";

import { ControlCentre } from "./ControlCentre";
import { IDEWorkspace } from "./IDEWorkspace";
import { useWorkspace } from "./WorkspaceProvider";

export function AppShell() {
  const { session, setMode, setIdeTool } = useWorkspace();
  const snapshot = session.snapshot;

  if (session.mode === "control-centre") {
    return (
      <main className="app-shell control-mode">
        <ControlCentre />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setMode("control-centre")}
          aria-label="Open Control Centre"
        >
          <span className="brand-mark">C</span>
          <span className="brand-name">Codexia</span>
          <span className="mode-name">/ Workspace</span>
        </button>

        <div className="repo-context">
          <span className="status-dot" />
          <span>{snapshot.repository}</span>
          <span className="context-divider">/</span>
          <span className="branch-pill">⑂ {snapshot.branch}</span>
        </div>

        <div className="top-actions">
          <button className="icon-button" aria-label="Search workspace" onClick={() => setIdeTool("search")}>⌕</button>
          <button className="icon-button notification" aria-label="Show activity output" onClick={() => setIdeTool("source-control")}>
            ◌<span />
          </button>
          <button className="avatar" aria-label="Open settings" onClick={() => setIdeTool("settings")}>A</button>
        </div>
      </header>

      <div className="mode-switcher" aria-label="Application mode">
        <button
          onClick={() => setMode("control-centre")}
        >
          Control Centre
        </button>
        <button
          className={session.mode === "ide" ? "active" : ""}
          onClick={() => setMode("ide")}
        >
          IDE Workspace
        </button>
      </div>

      <IDEWorkspace />
    </main>
  );
}
