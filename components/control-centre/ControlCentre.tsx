"use client";

import { useState } from "react";

import type { ControlView, IdeTool } from "@/lib/control-centre/types";
import { useWorkspace } from "./WorkspaceProvider";

const navigation = [
  ["⌂", "Control Centre", "home", "control"],
  ["▣", "IDE", "explorer", "ide"],
  ["▱", "Files", "explorer", "ide"],
  ["⌕", "Search", "search", "ide"],
  ["◇", "Architecture", "architecture", "control"],
  ["△", "Agents", "agents", "control"],
  ["↻", "Runtime", "runtime", "control"],
  ["✓", "Tests", "tests", "control"],
  ["▤", "Documentation", "documentation", "control"],
  ["✦", "Codier", "codier", "section"],
  ["⌘", "Knowledge Graph", "knowledge-graph", "control"],
  ["◉", "Memory", "memory", "control"],
  ["⚙", "Settings", "settings", "section"],
  ["⬡", "Extensions", "extensions", "control"],
] as const;

const aiActivity = [
  ["Planning", 83, "violet"],
  ["Reading", 92, "cyan"],
  ["Verification", 74, "amber"],
  ["Monitoring", 72, "green"],
] as const;

function StatusItem({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <article className={`summary-item ${accent}`}>
      <span className="summary-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

function PanelHeading({
  children,
  action,
  onAction,
}: {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="cc-panel-heading">
      <h3>{children}</h3>
      {action && <button onClick={onAction}>{action}</button>}
    </div>
  );
}

const viewCopy: Record<Exclude<ControlView, "home">, { title: string; description: string }> = {
  search: { title: "Workspace Search", description: "Search is available in the IDE with the active repository context already loaded." },
  changes: { title: "Changes View", description: "Git status and diff are loaded through Codexia’s existing Git provider." },
  architecture: { title: "Architecture View", description: "Architecture and symbol data are loaded through the existing workspace index manager." },
  activity: { title: "Activity & Event History", description: "All workspace, runtime and mission events are shown below in newest-first order." },
  agents: { title: "Agent Status", description: "This baseline has no shared agent-state registry. Transient multi-agent events are not presented as durable state." },
  runtime: { title: "Runtime", description: "Runtime controls call the existing RuntimeController and durable checkpoint store." },
  tests: { title: "Tests", description: "Verification remains owned by Codexia’s existing workflow and verification services." },
  documentation: { title: "Documentation", description: "Documentation files open through the real workspace filesystem service." },
  codier: { title: "Codier", description: "Codier is connected to the active mission, runtime status and shared event stream." },
  "knowledge-graph": { title: "Knowledge Graph", description: "Relationship status is derived from the real workspace index." },
  memory: { title: "Workspace Memory", description: "Memory status is loaded from Codexia’s persisted workspace memory." },
  settings: { title: "Settings", description: "Repository and model-provider configuration remain in the existing Codexia settings surface." },
  extensions: { title: "Extensions", description: "No extension-management service exists in this baseline." },
};

export function ControlCentre() {
  const {
    session,
    capabilities,
    gatewayKind,
    setMode,
    openIde,
    setControlView,
    setRuntime,
    completeTask,
  } = useWorkspace();
  const { snapshot, selectedTask, codierPresence } = session;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`cc-app ${menuOpen ? "menu-open" : ""}`}>
      <div className="aurora aurora-violet" />
      <div className="aurora aurora-cyan" />
      <div className="cc-grid" />

      <button
        className="cc-menu-scrim"
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
      />
      <aside className="cc-sidebar">
        <button className="cc-brand" onClick={() => setMode("control-centre")}>
          <span className="cc-brand-mark">C</span>
          <span><strong>Codexia</strong><small>Control Centre</small></span>
        </button>

        <nav className="cc-navigation" aria-label="Codexia navigation">
          {navigation.map(([icon, label, target, kind]) => (
            <div key={label}>
              {kind === "section" && (
                <span className="cc-nav-label">
                  {label === "Codier" ? "INTELLIGENCE" : "SYSTEM"}
                </span>
              )}
              <button
                className={
                  (label === "Control Centre" && session.controlView === "home") ||
                  (kind !== "ide" && session.controlView === target)
                    ? "active"
                    : ""
                }
                onClick={() => {
                  if (kind === "ide") openIde(target as IdeTool);
                  else setControlView(target as ControlView);
                  setMenuOpen(false);
                }}
              >
                <span>{icon}</span>{label}
                {label === "Runtime" && <i className={session.runtimeStatus} />}
              </button>
            </div>
          ))}
        </nav>

        <div className="cc-plan">
          <span>◉</span>
          <div><strong>Pro workspace</strong><small>All systems available</small></div>
          <b>⌃</b>
        </div>
      </aside>

      <section className="cc-workspace">
        <header className="cc-header">
          <div>
            <p>WORKSPACE RESTORED · JUST NOW</p>
            <h1>Good morning, Alex.</h1>
            <span>Workspace loaded and ready.</span>
          </div>
          <div className="cc-header-actions">
            <button
              className="cc-mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >☰</button>
            <button aria-label="Search workspace" onClick={() => openIde("search")}>⌕</button>
            <button className="cc-notification" aria-label="Open activity" onClick={() => setControlView("activity")}>◌<i /></button>
            <button className="cc-profile" aria-label="Open settings" onClick={() => setControlView("settings")}>A</button>
          </div>
        </header>

        <section className="workspace-summary">
          <StatusItem icon="▣" label="Repository" value={snapshot.repository} detail="Active workspace" accent="violet" />
          <StatusItem icon="⑂" label="Branch" value={snapshot.branch} detail={snapshot.phase} accent="green" />
          <StatusItem icon="♡" label="Workspace" value={`${snapshot.health}%`} detail="Excellent" accent="cyan" />
          <StatusItem icon="◉" label="Memory" value={snapshot.memoryStatus} detail="Workspace memory" accent="blue" />
          <StatusItem icon="⌘" label="Knowledge Graph" value="Updated" detail={snapshot.graphStatus} accent="cyan" />
          <button className="next-task" onClick={() => openIde("explorer")}>
            <span>✦<small>Next Task</small></span>
            <strong>Continue</strong>
            <em>{selectedTask.title}</em>
            <b>→</b>
          </button>
        </section>

        <div className="cc-dashboard">
          <section className="cc-actions cc-panel">
            <PanelHeading>What would you like to do?</PanelHeading>
            <div className="action-stack">
              <button onClick={() => openIde("explorer")}><i className="cyan">▷</i><span><strong>Continue Workspace</strong><small>Pick up where you left off</small></span><b>→</b></button>
              <button onClick={() => openIde("explorer")}><i className="violet">▣</i><span><strong>Open IDE</strong><small>Launch the focused workspace</small></span><b>→</b></button>
              <button onClick={() => setRuntime("running")}><i className="green">↻</i><span><strong>Resume runtime</strong><small>Continue from checkpoint {session.checkpoint}</small></span><b>→</b></button>
              <button onClick={() => setControlView("changes")}><i className="amber">▤</i><span><strong>Review changes</strong><small>Inspect recent diffs</small></span><b>→</b></button>
              <button onClick={() => setControlView("architecture")}><i className="blue">◇</i><span><strong>Explore architecture</strong><small>Open the architecture map</small></span><b>→</b></button>
            </div>
          </section>

          <section className={`codier-briefing cc-panel priority-${codierPresence.priority}`}>
            <div className="codier-copy">
              <div className="codier-kicker">
                <span>CODIER · {codierPresence.state.toUpperCase()}</span>
                <small>{codierPresence.lastUpdatedAt}</small>
              </div>
              <h2>Workspace briefing ready.</h2>
              <p>{session.briefing}</p>
              <ul>
                <li className="green"><i>✓</i> {snapshot.indexedFiles} repository files indexed</li>
                <li className="blue"><i>✓</i> {snapshot.symbolCount.toLocaleString()} symbols available</li>
                <li className="green"><i>✓</i> {snapshot.graphStatus}</li>
                <li className="amber"><i>!</i> {snapshot.gitStatus || "Working tree clean"}</li>
              </ul>
              <button onClick={() => openIde("explorer")}>Continue Mission <span>→</span></button>
            </div>
            <div className="codier-stage" aria-label={`Codier is ${codierPresence.state}`}>
              <div className="codier-halo" />
              {/* The official JPG is retained intact and blended into the glass panel without cropping. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/codier-control-centre.jpeg"
                alt="Codier, Codexia’s AI engineering companion"
              />
              <div className="codier-state-badge">
                <i className={codierPresence.priority} />
                <span><strong>{codierPresence.state}</strong><small>{codierPresence.message}</small></span>
              </div>
            </div>
            <div className="codier-state-strip">
              {["Thinking", "Planning", "Building", "Monitoring", "Waiting"].map((state) => (
                <span key={state} className={codierPresence.state === state.toLowerCase() ? "active" : ""}>
                  <i />{state}
                </span>
              ))}
            </div>
          </section>

          <section className="cc-right-column">
            <div className="cc-panel activity-panel">
              <PanelHeading action="View all" onAction={() => setControlView("activity")}>Live Activity</PanelHeading>
              <div className="cc-timeline">
                {session.events.slice(0, 5).map((event, index) => (
                  <article key={event.id}>
                    <time>{index === 0 ? "09:42" : `09:${38 - index * 5}`}</time>
                    <i className={event.tone} />
                    <div><strong>{event.title}</strong><span>{event.detail}</span></div>
                  </article>
                ))}
              </div>
            </div>
            <div className="cc-panel ai-panel">
              <PanelHeading>AI Activity</PanelHeading>
              {aiActivity.map(([label, value, tone]) => (
                <div className="ai-row" key={label}>
                  <span><i className={tone} />{label}</span>
                  <div><b className={tone} style={{ width: `${value}%` }} /></div>
                  <strong>{value}%</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="cc-panel intelligence-panel">
            <PanelHeading>Workspace Intelligence</PanelHeading>
            <div className="cc-stat-grid">
              <article><strong>{snapshot.indexedFiles}</strong><span>Files</span></article>
              <article><strong>{snapshot.indexedFiles}</strong><span>Modules</span></article>
              <article><strong>{snapshot.symbolCount.toLocaleString()}</strong><span>Symbols</span></article>
            </div>
            <div className="memory-load">
              <span>Context loaded <b>94%</b></span>
              <div><i /></div>
            </div>
            <div className="intelligence-tags">
              <span>Index Current</span><span>Graph Stable</span>
            </div>
          </section>

          <section className="cc-panel agents-panel">
            <PanelHeading action="Manage" onAction={() => setControlView("agents")}>Agents</PanelHeading>
            <article><i /><strong>Agent state</strong><span>Unavailable</span><b>{capabilities?.agentState.reason ?? "Checking service…"}</b></article>
          </section>

          <section className="cc-panel changes-panel">
            <PanelHeading action="Open diff" onAction={() => setControlView("changes")}>Recent Changes</PanelHeading>
            <article><i>GIT</i><strong>{snapshot.gitStatus || "Working tree clean"}</strong><span className={snapshot.recentChanges ? "amber" : "green"}>{snapshot.recentChanges}</span></article>
          </section>

          <section className="cc-panel history-panel">
            <PanelHeading action="History" onAction={() => setControlView("activity")}>Mission History</PanelHeading>
            <article><i className="green">✓</i><div><strong>Runtime foundation</strong><span>Completed · Phase 5.1</span></div></article>
            <article><i className="green">✓</i><div><strong>Task queue</strong><span>Completed · Phase 5.5</span></div></article>
            <article><i className="violet">◆</i><div><strong>Semantic navigation</strong><span>Current · Phase 6</span></div></article>
          </section>
        </div>
      </section>

      {session.controlView !== "home" && (
        <section className="cc-demo-drawer" role="dialog" aria-modal="true" aria-label={viewCopy[session.controlView].title}>
          <div className="cc-demo-drawer-head">
            <div>
              <p>{gatewayKind === "hosted" ? "HOSTED PREVIEW" : "REAL WORKSPACE"}</p>
              <h2>{viewCopy[session.controlView].title}</h2>
            </div>
            <button onClick={() => setControlView("home")} aria-label="Close panel">×</button>
          </div>
          <p>{viewCopy[session.controlView].description}</p>
          {session.controlView === "changes" && (
            <div className="demo-list">
              <article><i>GIT</i><strong>{snapshot.gitStatus || "Working tree clean"}</strong><span>{snapshot.recentChanges} changes</span></article>
            </div>
          )}
          {session.controlView === "architecture" && (
            <div className="architecture-demo">
              <article><strong>Workspace Index</strong><span>{snapshot.indexedFiles} files</span></article>
              <b>→</b><article><strong>Symbol Graph</strong><span>{snapshot.symbolCount.toLocaleString()} symbols</span></article>
              <b>→</b><article><strong>IDE Intelligence</strong><span>Stable</span></article>
            </div>
          )}
          {session.controlView === "activity" && (
            <div className="demo-event-list">
              {session.events.map((event) => <article key={event.id}><i className={event.tone} /><div><strong>{event.title}</strong><span>{event.detail}</span></div><time>{event.occurredAt}</time></article>)}
            </div>
          )}
          {session.controlView === "runtime" && (
            <div className="demo-runtime">
              <strong>Runtime status: {session.runtimeStatus}</strong>
              <button onClick={() => setRuntime(session.runtimeStatus === "running" ? "paused" : "running")}>
                {session.runtimeStatus === "running" ? "Pause Runtime" : "Resume Runtime"}
              </button>
              <button
                onClick={completeTask}
                disabled={capabilities?.missionCompletion.available === false}
                title={capabilities?.missionCompletion.reason}
              >
                Complete Mission
              </button>
              {capabilities?.missionCompletion.available === false && (
                <p>{capabilities.missionCompletion.reason}</p>
              )}
            </div>
          )}
          {session.controlView === "documentation" && (
            <button className="drawer-primary" onClick={() => openIde("documentation")}>Open Phase 6 documentation in IDE</button>
          )}
          {session.controlView === "tests" && (
            <button className="drawer-primary" onClick={() => openIde("tests")}>Open test results in IDE</button>
          )}
          {session.controlView === "search" && (
            <button className="drawer-primary" onClick={() => openIde("search")}>Open Search in IDE</button>
          )}
        </section>
      )}

      <footer className="mission-progress">
        <div className="mission-identity">
          <span>✓</span>
          <div><small>CURRENT MISSION</small><strong>{selectedTask.title}</strong><em>{selectedTask.phase} · {session.runtimeStatus}</em></div>
        </div>
        {[
          ["1", "Planning", "Completed"],
          ["2", "Building", "In progress"],
          ["3", "Testing", "In progress"],
          ["4", "Documentation", "Waiting"],
          ["5", "Verification", "Queued"],
        ].map(([number, label, status]) => (
          <article key={number} className={status === "Completed" ? "done" : status === "In progress" ? "active" : ""}>
            <span>{number}</span><div><strong>{label}</strong><small>{status}</small></div>
          </article>
        ))}
        <div className="mission-estimate"><small>EST. COMPLETION</small><strong>◷ 18m</strong></div>
        <button onClick={() => openIde("explorer")}><strong>Open IDE</strong><small>Continue building</small><span>→</span></button>
      </footer>
    </div>
  );
}
