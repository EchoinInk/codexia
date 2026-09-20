"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { EngineeringSessionClient } from "@/lib/engineering/session";
import { FileBuffer } from "@/lib/editor/file-buffer";
import { ChatSessionClient } from "@/lib/chat/session";

import { Chat } from "@/components/Chat";
import { FileTree } from "@/components/FileTree";
import { FileViewer } from "@/components/FileViewer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Sidebar, View } from "@/components/Sidebar";
import { WorkspaceIntelligence } from "@/components/WorkspaceIntelligence";
import { WorkspaceOperations } from "@/components/WorkspaceOperations";

const viewTitles: Record<View, { title: string; description: string }> = {
  chat: {
    title: "Codier Workspace",
    description: "Plan, build, and refine your project with Codier.",
  },
  files: {
    title: "Workspace Files",
    description: "Browse and edit files in your active project.",
  },
  intelligence: {
    title: "Workspace Intelligence",
    description: "Inspect current, stale, incomplete, unavailable, and failed evidence.",
  },
  operations: {
    title: "Control Centre",
    description: "Coordinate lifecycle, recovery, evidence, and resources across authorized workspaces.",
  },
  settings: {
    title: "Settings",
    description: "Configure Codexia and your development environment.",
  },
};

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
  const [view, setView] = useState<View>("chat");
  const [openFile, setOpenFile] = useState<string | undefined>();
  const [fsKey, setFsKey] = useState(0);

  useEffect(() => {
    if (engineeringState.report && !engineeringState.busy) setFsKey(key => key + 1);
  }, [engineeringState.report, engineeringState.busy]);

  const refreshFs = () => {
    setFsKey((key) => key + 1);
  };

  const handleOpenFile = (path: string) => {
    setOpenFile(path);
    conversation.selectFile(path);
    setView("files");
  };

  const selectFile = (path: string) => {
    setOpenFile(path);
    conversation.selectFile(path);
  };

  const currentView = viewTitles[view];

  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-[#f5f6fc] text-ink-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-violet-300/20 blur-[110px]" />
        <div className="absolute -right-40 top-20 h-[30rem] w-[30rem] rounded-full bg-sky-300/20 blur-[110px]" />
        <div className="absolute bottom-[-18rem] left-1/3 h-[34rem] w-[34rem] rounded-full bg-pink-200/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
      </div>

      <div className="relative z-10 shrink-0">
        <Sidebar view={view} setView={setView} />
      </div>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/70 bg-white/45 px-5 backdrop-blur-xl sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />

              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                Codexia Control Centre
              </p>
            </div>

            <div className="mt-1 flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-lg font-semibold tracking-[-0.025em] text-ink-900">
                {currentView.title}
              </h1>

              <p className="hidden truncate text-sm text-ink-500 lg:block">
                {currentView.description}
              </p>
            </div>
          </div>

          <div className="ml-4 hidden items-center gap-2 sm:flex">
            <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              <span className="text-xs font-medium text-ink-600">
                Workspace active
              </span>
            </div>
          </div>
        </header>

        {view !== "chat" && engineeringState.runtimeId && (
          <button className="border-b border-ink-400/10 bg-white/70 px-5 py-2 text-left text-sm" onClick={() => setView("chat")}>
            Engineering: {engineeringState.dismissed ? "review closed" : engineeringState.phase.replaceAll("_", " ")} — Open review
          </button>
        )}
        <div className="min-h-0 flex-1 p-3 sm:p-4 lg:p-5">
          <div className="h-full overflow-hidden rounded-[24px] border border-white/80 bg-white/40 shadow-[0_24px_70px_-32px_rgba(50,56,100,0.35)] backdrop-blur-2xl">
            {view === "chat" && (
              <div className="flex h-full min-w-0">
                <section className="min-w-0 flex-1 p-2 sm:p-3">
                  <div className="h-full overflow-hidden rounded-[18px] border border-white/90 bg-white/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.28)]">
                    <Chat engineering={engineering} conversation={conversation} />
                  </div>
                </section>

                <aside className="hidden w-72 shrink-0 border-l border-white/80 bg-white/30 p-3 xl:flex 2xl:w-80">
                  <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border border-white/90 bg-white/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)]">
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
                        <span className="h-2 w-2 rounded-full bg-sky-300" />
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
                <aside className="hidden w-72 shrink-0 overflow-hidden rounded-[18px] border border-white/90 bg-white/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)] md:flex 2xl:w-80">
                  <FileTree
                    refreshKey={fsKey}
                    activePath={openFile}
                    onOpen={selectFile}
                  />
                </aside>

                <section className="min-w-0 flex-1 overflow-hidden rounded-[18px] border border-white/90 bg-white/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)]">
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
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-100 to-sky-50 shadow-sm">
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
                <section className="h-full overflow-hidden rounded-[18px] border border-white/90 bg-white/75 shadow-[0_12px_30px_-20px_rgba(49,46,129,0.25)]">
                  <SettingsPanel />
                </section>
              </div>
            )}

            <div className={view === "intelligence" ? "h-full" : "hidden"}>
              <WorkspaceIntelligence active={view === "intelligence"} />
            </div>
            <div className={view === "operations" ? "h-full" : "hidden"}>
              <WorkspaceOperations active={view === "operations"} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
