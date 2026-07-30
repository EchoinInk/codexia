import fs from "node:fs";
import path from "node:path";

import {
  listTree,
  safeResolve,
  shouldIgnoreWorkspaceEntry,
} from "@/lib/fs-safe";

import type {
  FsNode,
} from "@/lib/fs-safe";

export type WorkspaceWatchEventType =
  "rename" |
  "change";

export interface WorkspaceWatchEvent {
  workspace: string;

  path: string;

  type: WorkspaceWatchEventType;

  occurredAt: number;
}

export interface WorkspaceWatcherStatus {
  workspace: string;

  active: boolean;

  watchedDirectories: number;

  startedAt: number;

  lastEventAt?: number;
}

type WorkspaceWatchHandler =
  (event: WorkspaceWatchEvent) => void;

interface WorkspaceWatcher {
  workspace: string;

  watchers: Map<string, fs.FSWatcher>;

  onChange: WorkspaceWatchHandler;

  startedAt: number;

  lastEventAt?: number;

  refreshTimer?: NodeJS.Timeout;

  invalidationTimer?: NodeJS.Timeout;
}

const watchers =
  new Map<string, WorkspaceWatcher>();

const WATCH_DEBOUNCE_MS = 100;

const WATCH_REFRESH_DEBOUNCE_MS = 250;

export async function startWorkspaceWatcher(
  workspace: string,
  onChange: WorkspaceWatchHandler
): Promise<WorkspaceWatcherStatus> {
  const existing =
    watchers.get(
      workspace
    );

  if (existing) {
    existing.onChange =
      onChange;

    return getWorkspaceWatcherStatus(
      workspace
    ) as WorkspaceWatcherStatus;
  }

  const watcher: WorkspaceWatcher = {
    workspace,

    watchers: new Map(),

    onChange,

    startedAt:
      Date.now(),
  };

  watchers.set(
    workspace,
    watcher
  );

  await refreshWatchedDirectories(
    watcher
  );

  return getWorkspaceWatcherStatus(
    workspace
  ) as WorkspaceWatcherStatus;
}

export function stopWorkspaceWatcher(
  workspace: string
): void {
  const watcher =
    watchers.get(
      workspace
    );

  if (!watcher) {
    return;
  }

  if (watcher.refreshTimer) {
    clearTimeout(
      watcher.refreshTimer
    );
  }

  if (watcher.invalidationTimer) {
    clearTimeout(
      watcher.invalidationTimer
    );
  }

  for (const fsWatcher of watcher.watchers.values()) {
    fsWatcher.close();
  }

  watchers.delete(
    workspace
  );
}

export function stopAllWorkspaceWatchers(): void {
  for (const workspace of watchers.keys()) {
    stopWorkspaceWatcher(
      workspace
    );
  }
}

export function hasWorkspaceWatcher(
  workspace: string
): boolean {
  return watchers.has(
    workspace
  );
}

export function getWorkspaceWatcherStatus(
  workspace: string
): WorkspaceWatcherStatus | null {
  const watcher =
    watchers.get(
      workspace
    );

  if (!watcher) {
    return null;
  }

  return {
    workspace,

    active: true,

    watchedDirectories:
      watcher.watchers.size,

    startedAt:
      watcher.startedAt,

    lastEventAt:
      watcher.lastEventAt,
  };
}

async function refreshWatchedDirectories(
  watcher: WorkspaceWatcher
): Promise<void> {
  const directories =
    await getWorkspaceDirectories(
      watcher.workspace
    );

  const nextDirectories =
    new Set(
      directories
    );

  for (const directory of watcher.watchers.keys()) {
    if (
      nextDirectories.has(
        directory
      )
    ) {
      continue;
    }

    watcher.watchers
      .get(
        directory
      )
      ?.close();

    watcher.watchers.delete(
      directory
    );
  }

  for (const directory of directories) {
    if (
      watcher.watchers.has(
        directory
      )
    ) {
      continue;
    }

    watchDirectory(
      watcher,
      directory
    );
  }
}

async function getWorkspaceDirectories(
  workspace: string
): Promise<string[]> {
  const tree =
    await listTree(
      "",
      workspace
    );

  const directories =
    [
      "",
      ...collectDirectories(
        tree
      ),
    ];

  return [
    ...new Set(
      directories
    ),
  ].sort();
}

function collectDirectories(
  nodes: FsNode[]
): string[] {
  const directories: string[] = [];

  for (const node of nodes) {
    if (
      node.type !== "dir"
    ) {
      continue;
    }

    directories.push(
      node.path
    );

    if (
      node.children
    ) {
      directories.push(
        ...collectDirectories(
          node.children
        )
      );
    }
  }

  return directories;
}

function watchDirectory(
  watcher: WorkspaceWatcher,
  directory: string
): void {
  const absolute =
    safeResolve(
      directory,
      watcher.workspace
    );

  try {
    const fsWatcher =
      fs.watch(
        absolute,
        (
          type,
          filename
        ) => {
          handleWatchEvent(
            watcher,
            directory,
            type,
            filename
          );
        }
      );

    fsWatcher.on(
      "error",
      () => {
        watcher.watchers.delete(
          directory
        );

        scheduleDirectoryRefresh(
          watcher
        );
      }
    );

    watcher.watchers.set(
      directory,
      fsWatcher
    );
  } catch {
    scheduleDirectoryRefresh(
      watcher
    );
  }
}

function handleWatchEvent(
  watcher: WorkspaceWatcher,
  directory: string,
  type: string,
  filename: string | Buffer | null
): void {
  watcher.lastEventAt =
    Date.now();

  const relativePath =
    filename
      ? path.join(
          directory,
          filename.toString()
        )
      : directory;

  if (
    shouldIgnorePath(
      relativePath
    )
  ) {
    return;
  }

  if (watcher.invalidationTimer) {
    clearTimeout(
      watcher.invalidationTimer
    );
  }

  watcher.invalidationTimer =
    setTimeout(
      () => {
        watcher.onChange({
          workspace:
            watcher.workspace,

          path:
            relativePath,

          type:
            type === "rename"
              ? "rename"
              : "change",

          occurredAt:
            watcher.lastEventAt ?? Date.now(),
        });
      },
      WATCH_DEBOUNCE_MS
    );

  if (
    type === "rename"
  ) {
    scheduleDirectoryRefresh(
      watcher
    );
  }
}

function shouldIgnorePath(
  relativePath: string
): boolean {
  const firstSegment =
    relativePath
      .split(
        path.sep
      )
      .filter(Boolean)[0];

  return firstSegment
    ? shouldIgnoreWorkspaceEntry(
        firstSegment
      )
    : false;
}

function scheduleDirectoryRefresh(
  watcher: WorkspaceWatcher
): void {
  if (watcher.refreshTimer) {
    clearTimeout(
      watcher.refreshTimer
    );
  }

  watcher.refreshTimer =
    setTimeout(
      () => {
        refreshWatchedDirectories(
          watcher
        ).catch(
          () => undefined
        );
      },
      WATCH_REFRESH_DEBOUNCE_MS
    );
}
