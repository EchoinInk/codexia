"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { EngineeringSessionClient } from "@/lib/engineering/session";
import { FileBuffer } from "@/lib/editor/file-buffer";
import { ChatSessionClient } from "@/lib/chat/session";

import { Chat } from "@/components/Chat";
import { FileTree } from "@/components/FileTree";
import { FileViewer } from "@/components/FileViewer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { WorkspaceIntelligence } from "@/components/WorkspaceIntelligence";
import { WorkspaceOperations } from "@/components/WorkspaceOperations";
import { ApplicationShell } from "@/components/application-shell/ApplicationShell";
import { ShellPanel } from "@/components/application-shell/ShellPanel";
import { shellViewFromSearch, type ShellView } from "@/lib/application-shell/navigation";

export default function Page() {
  const [engineering] = useState(() => new EngineeringSessionClient());
  const [conversation] = useState(() => new ChatSessionClient());
  const engineeringState = useSyncExternalStore(engineering.subscribe, engineering.getSnapshot, engineering.getSnapshot);
  useEffect(() => {
    if (!engineeringState.busy || !engineeringState.runtimeId) return;
    const timer = setInterval(() => void engineering.refresh(), 1500);
    return () => clearInterval(timer);
  }, [engineering, engineeringState.busy, engineeringState.runtimeId]);
  const [fileBuffer] = useState(() => new FileBuffer());
  const [view, setView] = useState<ShellView>("chat");
  const [workspace, setWorkspace] = useState<string>();
  const [openFile, setOpenFile] = useState<string | undefined>();
  const [fsKey, setFsKey] = useState(0);

  useEffect(() => {
    if (engineeringState.report && !engineeringState.busy) setFsKey(key => key + 1);
  }, [engineeringState.report, engineeringState.busy]);

  useEffect(() => {
    setView(shellViewFromSearch(window.location.search));
    const controller = new AbortController();
    void fetch("/api/workspaces", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : undefined)
      .then(body => setWorkspace(body?.workspaces?.[0]?.workspace))
      .catch(error => { if (error?.name !== "AbortError") setWorkspace(undefined); });
    return () => controller.abort();
  }, []);

  const refreshFs = () => {
    setFsKey((key) => key + 1);
  };

  const handleOpenFile = (path: string) => {
    setOpenFile(path);
    conversation.selectFile(path);
    setView("files");
    const url = new URL(window.location.href);
    url.searchParams.set("view", "files");
    window.history.pushState({ view: "files" }, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const selectFile = (path: string) => {
    setOpenFile(path);
    conversation.selectFile(path);
  };

  return (
    <ApplicationShell
      view={view}
      onNavigate={setView}
      workspace={workspace}
      runtimeStatus={engineeringState.busy ? engineeringState.phase.replaceAll("_", " ") : "Local runtime ready"}
      notice={view !== "chat" && engineeringState.runtimeId ? (
          <button className="border-b border-ink-400/10 bg-surface-elevated/70 px-5 py-2 text-left text-sm" onClick={() => {
            setView("chat");
            const url = new URL(window.location.href);
            url.searchParams.delete("view");
            window.history.pushState({ view: "chat" }, "", `${url.pathname}${url.search}${url.hash}`);
          }}>
            Engineering: {engineeringState.dismissed ? "review closed" : engineeringState.phase.replaceAll("_", " ")} — Open review
          </button>
      ) : undefined}
    >
          <ShellPanel className="h-full">
            {view === "chat" && (
              <div className="flex h-full min-w-0">
                <section className="min-w-0 flex-1 p-2 sm:p-3">
                  <div className="h-full overflow-hidden rounded-[18px] border border-subtle bg-surface-elevated/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.28)]">
                    <Chat engineering={engineering} conversation={conversation} />
                  </div>
                </section>

                <aside className="hidden w-72 shrink-0 border-l border-subtle bg-surface-elevated/30 p-3 xl:flex 2xl:w-80">
                  <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border border-subtle bg-surface-elevated/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)]">
                    <div className="flex shrink-0 items-center justify-between border-b border-ink-400/10 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink-800">
                          Project files
                        </p>
                        <p className="mt-0.5 text-xs text-ink-400">
                          Active workspace
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-pink-300" />
                        <span className="h-2 w-2 rounded-full bg-violet-300" />
                        <span className="h-2 w-2 rounded-full bg-intelligence" />
                      </div>
                    </div>

                    <div className="min-h-0 flex-1">
                      <FileTree
                        refreshKey={fsKey}
                        activePath={openFile}
                        onOpen={handleOpenFile}
                      />
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {view === "files" && (
              <div className="flex h-full min-w-0 gap-3 p-3">
                <aside className="hidden w-72 shrink-0 overflow-hidden rounded-[18px] border border-subtle bg-surface-elevated/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)] md:flex 2xl:w-80">
                  <FileTree
                    refreshKey={fsKey}
                    activePath={openFile}
                    onOpen={selectFile}
                  />
                </aside>

                <section className="min-w-0 flex-1 overflow-hidden rounded-[18px] border border-subtle bg-surface-elevated/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)]">
                  {openFile ? (
                    <FileViewer
                      buffer={fileBuffer}
                      path={openFile}
                      onClose={() => setOpenFile(undefined)}
                      onSaved={refreshFs}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-8">
                      <div className="max-w-sm text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-active bg-intelligence-gradient shadow-intelligence">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6 text-violet-500"
                          >
                            <path
                              d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h3.27c.6 0 1.17.24 1.59.66l.73.73c.42.42.99.66 1.59.66H18A2.25 2.25 0 0 1 20.25 8.8v8.45A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V6.75Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>

                        <h2 className="mt-4 text-base font-semibold text-ink-800">
                          No file selected
                        </h2>

                        <p className="mt-1.5 text-sm leading-6 text-ink-500">
                          Select a file from the workspace tree to inspect or
                          edit its contents.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {view === "settings" && (
              <div className="h-full p-3">
                <section className="h-full overflow-hidden rounded-[18px] border border-subtle bg-surface-elevated/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)]">
                  <SettingsPanel />
                </section>
              </div>
            )}

            <div className={view === "intelligence" ? "h-full" : "hidden"}>
              <WorkspaceIntelligence active={view === "intelligence"} />
            </div>
            <div className={view === "operations" ? "h-full" : "hidden"}>
              <WorkspaceOperations active={view === "operations"} workspace={workspace} engineering={engineering} engineeringState={engineeringState} onOpenMission={() => {
                setView("chat");
                const url = new URL(window.location.href);
                url.searchParams.delete("view");
                window.history.pushState({ view: "chat" }, "", `${url.pathname}${url.search}${url.hash}`);
              }} />
            </div>
          </ShellPanel>
    </ApplicationShell>
  );
}
