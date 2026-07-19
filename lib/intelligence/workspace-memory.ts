import fs from "node:fs/promises";
import path from "node:path";

import type {
  WorkspaceIndex,
} from "./types";

import type {
  FingerprintDiff,
} from "./index-fingerprint";

export interface WorkspaceMemoryFile {
  path: string;

  readCount: number;

  editCount: number;

  changeCount: number;

  lastReadAt?: number;

  lastEditedAt?: number;

  lastChangedAt?: number;

  lastTouchedAt?: number;
}

export interface WorkspaceMemorySnapshot {
  frequentlyEditedFiles: WorkspaceMemoryFile[];

  commonlyOpenedFiles: WorkspaceMemoryFile[];

  recentlyModifiedFiles: WorkspaceMemoryFile[];

  hotspots: WorkspaceMemoryFile[];

  developerHabits: {
    totalReads: number;

    totalEdits: number;

    totalChanges: number;

    lastActivityAt?: number;
  };
}

interface WorkspaceMemoryState {
  files: Record<string, WorkspaceMemoryFile>;

  updatedAt: number;
}

type WorkspaceMemoryEventType =
  "read" |
  "edit" |
  "change";

const SNAPSHOT_LIMIT = 10;

function getMemoryPath(
  workspace: string
): string {
  return path.join(
    workspace,
    ".codexia",
    "intelligence",
    "workspace-memory.json"
  );
}

export async function attachWorkspaceMemory(
  workspace: string,
  index: WorkspaceIndex
): Promise<WorkspaceIndex> {
  const memory =
    await loadWorkspaceMemorySnapshot(
      workspace
    );

  return {
    ...index,

    memory,
  };
}

export async function loadWorkspaceMemorySnapshot(
  workspace: string
): Promise<WorkspaceMemorySnapshot> {
  const state =
    await loadWorkspaceMemoryState(
      workspace
    );

  return createWorkspaceMemorySnapshot(
    state
  );
}

export async function recordWorkspaceFileRead(
  workspace: string,
  file: string
): Promise<void> {
  await recordWorkspaceMemoryEvent(
    workspace,
    file,
    "read"
  );
}

export async function recordWorkspaceFileEdit(
  workspace: string,
  file: string
): Promise<void> {
  await recordWorkspaceMemoryEvent(
    workspace,
    file,
    "edit"
  );
}

export async function recordWorkspaceFileChange(
  workspace: string,
  file: string
): Promise<void> {
  await recordWorkspaceMemoryEvent(
    workspace,
    file,
    "change"
  );
}

export async function recordWorkspaceIndexDiff(
  workspace: string,
  diff: FingerprintDiff
): Promise<void> {
  const changedFiles =
    [
      ...diff.changed,
      ...diff.added,
    ];

  for (const file of changedFiles) {
    await recordWorkspaceFileChange(
      workspace,
      file
    );
  }
}

async function recordWorkspaceMemoryEvent(
  workspace: string,
  file: string,
  type: WorkspaceMemoryEventType
): Promise<void> {
  if (!file) {
    return;
  }

  const now =
    Date.now();

  const state =
    await loadWorkspaceMemoryState(
      workspace
    );

  const current =
    state.files[file] ?? {
      path: file,

      readCount: 0,

      editCount: 0,

      changeCount: 0,
    };

  const updated:
    WorkspaceMemoryFile = {
      ...current,

      lastTouchedAt:
        now,
    };

  if (type === "read") {
    updated.readCount += 1;

    updated.lastReadAt =
      now;
  }

  if (type === "edit") {
    updated.editCount += 1;

    updated.lastEditedAt =
      now;
  }

  if (type === "change") {
    updated.changeCount += 1;

    updated.lastChangedAt =
      now;
  }

  state.files[file] =
    updated;

  state.updatedAt =
    now;

  await saveWorkspaceMemoryState(
    workspace,
    state
  );
}

async function loadWorkspaceMemoryState(
  workspace: string
): Promise<WorkspaceMemoryState> {
  try {
    const content =
      await fs.readFile(
        getMemoryPath(
          workspace
        ),
        "utf8"
      );

    return JSON.parse(
      content
    ) as WorkspaceMemoryState;
  } catch {
    return {
      files: {},

      updatedAt:
        Date.now(),
    };
  }
}

async function saveWorkspaceMemoryState(
  workspace: string,
  state: WorkspaceMemoryState
): Promise<void> {
  const file =
    getMemoryPath(
      workspace
    );

  await fs.mkdir(
    path.dirname(
      file
    ),
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    file,
    JSON.stringify(
      state,
      null,
      2
    ),
    "utf8"
  );
}

function createWorkspaceMemorySnapshot(
  state: WorkspaceMemoryState
): WorkspaceMemorySnapshot {
  const files =
    Object.values(
      state.files
    );

  const totalReads =
    files.reduce(
      (total, file) =>
        total + file.readCount,
      0
    );

  const totalEdits =
    files.reduce(
      (total, file) =>
        total + file.editCount,
      0
    );

  const totalChanges =
    files.reduce(
      (total, file) =>
        total + file.changeCount,
      0
    );

  const lastActivityAt =
    files
      .map(
        file =>
          file.lastTouchedAt ?? 0
      )
      .sort(
        (a, b) =>
          b - a
      )[0];

  return {
    frequentlyEditedFiles:
      sortByScore(
        files,
        file =>
          file.editCount
      ),

    commonlyOpenedFiles:
      sortByScore(
        files,
        file =>
          file.readCount
      ),

    recentlyModifiedFiles:
      sortByScore(
        files,
        file =>
          file.lastChangedAt ?? file.lastEditedAt ?? 0
      ),

    hotspots:
      sortByScore(
        files,
        file =>
          file.readCount +
          file.editCount * 3 +
          file.changeCount * 2
      ),

    developerHabits: {
      totalReads,

      totalEdits,

      totalChanges,

      lastActivityAt:
        lastActivityAt || undefined,
    },
  };
}

function sortByScore(
  files: WorkspaceMemoryFile[],
  getScore: (file: WorkspaceMemoryFile) => number
): WorkspaceMemoryFile[] {
  return [
    ...files,
  ]
    .filter(
      file =>
        getScore(
          file
        ) > 0
    )
    .sort(
      (a, b) =>
        getScore(
          b
        ) -
        getScore(
          a
        )
    )
    .slice(
      0,
      SNAPSHOT_LIMIT
    );
}
