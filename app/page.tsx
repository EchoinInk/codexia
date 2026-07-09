"use client";
import { useState } from "react";
import { Sidebar, View } from "@/components/Sidebar";
import { Chat } from "@/components/Chat";
import { FileTree } from "@/components/FileTree";
import { FileViewer } from "@/components/FileViewer";
import { SettingsPanel } from "@/components/SettingsPanel";

export default function Page() {
  const [view, setView] = useState<View>("chat");
  const [openFile, setOpenFile] = useState<string | undefined>();
  const [fsKey, setFsKey] = useState(0);
  const refreshFs = () => setFsKey((k) => k + 1);

  return (
    <div className="h-screen flex bg-[#f4f7fe]">
      <Sidebar view={view} setView={setView} />

      <main className="flex-1 flex min-w-0">
        {view === "chat" && (
          <div className="flex-1 flex min-w-0">
            <div className="flex-1 p-6 min-w-0">
              <Chat onWorkspaceChanged={refreshFs} />
            </div>
            <div className="w-72 shrink-0 p-6 pl-0 hidden xl:block">
              <div className="bg-white rounded-2xl shadow-card border border-ink-400/10 h-full overflow-hidden">
                <FileTree
                  refreshKey={fsKey}
                  activePath={openFile}
                  onOpen={(p) => { setOpenFile(p); setView("files"); }}
                />
              </div>
            </div>
          </div>
        )}

        {view === "files" && (
          <div className="flex-1 flex min-w-0 p-6 gap-6">
            <div className="w-72 shrink-0 bg-white rounded-2xl shadow-card border border-ink-400/10 overflow-hidden">
              <FileTree refreshKey={fsKey} activePath={openFile} onOpen={setOpenFile} />
            </div>
            <div className="flex-1 min-w-0">
              {openFile ? (
                <FileViewer path={openFile} onClose={() => setOpenFile(undefined)} onSaved={refreshFs} />
              ) : (
                <div className="bg-white rounded-2xl shadow-card border border-ink-400/10 h-full flex items-center justify-center text-ink-500">
                  Select a file from the tree.
                </div>
              )}
            </div>
          </div>
        )}

        {view === "settings" && (
          <div className="flex-1 p-6">
            <SettingsPanel />
          </div>
        )}
      </main>
    </div>
  );
}
