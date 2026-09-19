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

export interface WorkspaceWatchChange {
  path?: string;

  type: WorkspaceWatchEventType;

  ambiguous: boolean;

  occurredAt: number;
}

export interface WorkspaceWatchEvent {
  workspace: string;

  changes: WorkspaceWatchChange[];
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

  pendingChanges: Map<string, WorkspaceWatchChange>;
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

    pendingChanges: new Map(),
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

  watcher.pendingChanges.clear();

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
      : undefined;

  if (
    relativePath &&
    shouldIgnorePath(relativePath)
  ) {
    return;
  }

  const change: WorkspaceWatchChange = {
    path: relativePath,

    type:
      type === "rename"
        ? "rename"
        : "change",

    ambiguous:
      relativePath === undefined,

    occurredAt:
      watcher.lastEventAt ?? Date.now(),
  };

  const key =
    relativePath
      ? `path:${relativePath}`
      : `ambiguous:${change.type}`;

  const previous =
    watcher.pendingChanges.get(key);

  watcher.pendingChanges.set(
    key,
    previous
      ? mergeWatchChanges(previous, change)
      : change
  );

  if (watcher.invalidationTimer) {
    clearTimeout(
      watcher.invalidationTimer
    );
  }

  watcher.invalidationTimer =
    setTimeout(
      () => {
        const changes =
          coalesceWorkspaceWatchChanges(
            [...watcher.pendingChanges.values()]
          );

        watcher.pendingChanges.clear();

        if (!changes.length) {
          return;
        }

        watcher.onChange({
          workspace:
            watcher.workspace,

          changes,
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

export function coalesceWorkspaceWatchChanges(
  changes: WorkspaceWatchChange[]
): WorkspaceWatchChange[] {
  const retained = new Map<string, WorkspaceWatchChange>();

  for (const change of changes) {
    const key =
      change.path
        ? `path:${change.path}`
        : `ambiguous:${change.type}`;
    const previous = retained.get(key);

    retained.set(
      key,
      previous
        ? mergeWatchChanges(previous, change)
        : change
    );
  }

  return [...retained.values()].sort(compareWatchChanges);
}

function mergeWatchChanges(
  previous: WorkspaceWatchChange,
  next: WorkspaceWatchChange
): WorkspaceWatchChange {
  return {
    path:
      previous.path ?? next.path,

    type:
      watchTypeStrength(next.type) > watchTypeStrength(previous.type)
        ? next.type
        : previous.type,

    ambiguous:
      previous.ambiguous && next.ambiguous,

    occurredAt:
      Math.max(
        previous.occurredAt,
        next.occurredAt
      ),
  };
}

function watchTypeStrength(
  type: WorkspaceWatchEventType
): number {
  return type === "rename" ? 2 : 1;
}

function compareWatchChanges(
  left: WorkspaceWatchChange,
  right: WorkspaceWatchChange
): number {
  if (!left.path && !right.path) {
    return left.type.localeCompare(right.type);
  }

  if (!left.path) {
    return -1;
  }

  if (!right.path) {
    return 1;
  }

  return left.path.localeCompare(right.path);
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
