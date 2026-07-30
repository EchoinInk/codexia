import { randomUUID } from "node:crypto";
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


export type WorkspaceKnowledgeKind =
  | "architecture"
  | "coding_style"
  | "preferred_pattern"
  | "failure"
  | "fix";


export type WorkspaceKnowledgeSource =
  | "user"
  | "agent"
  | "runtime"
  | "workspace";


export interface WorkspaceKnowledgeEntry {
  id: string;

  kind: WorkspaceKnowledgeKind;

  summary: string;

  details?: string;

  files: string[];

  source: WorkspaceKnowledgeSource;

  confidence: number;

  firstObservedAt: number;

  lastObservedAt: number;

  observationCount: number;

  relatedFailureId?: string;

  resolvedAt?: number;

  resolvedByFixId?: string;

  metadata?: Record<string, string | number | boolean>;
}


export interface WorkspaceKnowledgeInput {
  summary: string;

  details?: string;

  files?: string[];

  source?: WorkspaceKnowledgeSource;

  confidence?: number;

  relatedFailureId?: string;

  metadata?: Record<string, string | number | boolean>;
}


export interface WorkspaceSemanticMemorySnapshot {
  architecture: WorkspaceKnowledgeEntry[];

  codingStyle: WorkspaceKnowledgeEntry[];

  preferredPatterns: WorkspaceKnowledgeEntry[];

  previousFailures: WorkspaceKnowledgeEntry[];

  previousFixes: WorkspaceKnowledgeEntry[];
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

  knowledge: WorkspaceSemanticMemorySnapshot;
}


interface WorkspaceMemoryState {
  version: 2;

  files: Record<string, WorkspaceMemoryFile>;

  knowledge: WorkspaceKnowledgeEntry[];

  updatedAt: number;
}


type LegacyWorkspaceMemoryState = {
  files?: Record<string, WorkspaceMemoryFile>;

  updatedAt?: number;
};


type WorkspaceMemoryEventType =
  | "read"
  | "edit"
  | "change";


const SNAPSHOT_LIMIT = 10;

const KNOWLEDGE_LIMIT_PER_KIND = 50;

const workspaceMemoryUpdates =
  new Map<string, Promise<void>>();


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


/** Stores a durable architectural fact or boundary for future planning. */
export async function rememberWorkspaceArchitecture(
  workspace: string,
  input: WorkspaceKnowledgeInput
): Promise<WorkspaceKnowledgeEntry> {
  return rememberWorkspaceKnowledge(
    workspace,
    "architecture",
    input
  );
}


/** Stores an observed coding convention for future planning and edits. */
export async function rememberWorkspaceCodingStyle(
  workspace: string,
  input: WorkspaceKnowledgeInput
): Promise<WorkspaceKnowledgeEntry> {
  return rememberWorkspaceKnowledge(
    workspace,
    "coding_style",
    input
  );
}


/** Stores a preferred implementation pattern or local project convention. */
export async function rememberWorkspacePreferredPattern(
  workspace: string,
  input: WorkspaceKnowledgeInput
): Promise<WorkspaceKnowledgeEntry> {
  return rememberWorkspaceKnowledge(
    workspace,
    "preferred_pattern",
    input
  );
}


/** Stores a durable failure so later tasks can avoid repeating it. */
export async function rememberWorkspaceFailure(
  workspace: string,
  input: WorkspaceKnowledgeInput
): Promise<WorkspaceKnowledgeEntry> {
  return rememberWorkspaceKnowledge(
    workspace,
    "failure",
    input
  );
}


/** Stores a successful fix and optionally resolves the related remembered failure. */
export async function rememberWorkspaceFix(
  workspace: string,
  input: WorkspaceKnowledgeInput
): Promise<WorkspaceKnowledgeEntry> {
  const entry =
    await rememberWorkspaceKnowledge(
      workspace,
      "fix",
      input
    );

  if (
    input.relatedFailureId
  ) {
    await resolveWorkspaceFailure(
      workspace,
      input.relatedFailureId,
      entry.id
    );
  }

  return entry;
}


/** Removes one semantic memory entry without disturbing activity history. */
export async function forgetWorkspaceKnowledge(
  workspace: string,
  id: string
): Promise<boolean> {
  return updateWorkspaceMemoryState(
    workspace,
    state => {
      const next =
        state.knowledge.filter(
          entry =>
            entry.id !== id
        );

      if (
        next.length === state.knowledge.length
      ) {
        return false;
      }

      state.knowledge = next;
      state.updatedAt = Date.now();

      return true;
    }
  );
}


async function recordWorkspaceMemoryEvent(
  workspace: string,
  file: string,
  type: WorkspaceMemoryEventType
): Promise<void> {
  if (!file) {
    return;
  }

  await updateWorkspaceMemoryState(
    workspace,
    state => {
      const now =
        Date.now();

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
    }
  );
}


async function rememberWorkspaceKnowledge(
  workspace: string,
  kind: WorkspaceKnowledgeKind,
  input: WorkspaceKnowledgeInput
): Promise<WorkspaceKnowledgeEntry> {
  const summary =
    input.summary.trim();

  if (!summary) {
    throw new Error(
      "Workspace memory summary must not be empty"
    );
  }

  return updateWorkspaceMemoryState(
    workspace,
    state => {
      const now =
        Date.now();

      const existingIndex =
        state.knowledge.findIndex(
          entry =>
            entry.kind === kind &&
            normaliseSummary(entry.summary) === normaliseSummary(summary) &&
            sameMetadataGoal(entry.metadata, input.metadata)
        );

      const files =
        sanitiseFiles(
          input.files ?? []
        );

      let entry:
        WorkspaceKnowledgeEntry;

      if (existingIndex >= 0) {
        const current =
          state.knowledge[existingIndex];

        entry = {
          ...current,

          summary,

          details:
            input.details?.trim() || current.details,

          files:
            [
              ...new Set([
                ...current.files,
                ...files,
              ]),
            ],

          source:
            input.source ?? current.source,

          confidence:
            clampConfidence(
              input.confidence ?? current.confidence
            ),

          lastObservedAt:
            now,

          observationCount:
            current.observationCount + 1,

          relatedFailureId:
            input.relatedFailureId ?? current.relatedFailureId,

          metadata:
            input.metadata ?? current.metadata,
        };

        state.knowledge[existingIndex] =
          entry;
      } else {
        entry = {
          id:
            randomUUID(),

          kind,

          summary,

          details:
            input.details?.trim() || undefined,

          files,

          source:
            input.source ?? "agent",

          confidence:
            clampConfidence(
              input.confidence ?? 1
            ),

          firstObservedAt:
            now,

          lastObservedAt:
            now,

          observationCount:
            1,

          relatedFailureId:
            input.relatedFailureId,

          metadata:
            input.metadata,
        };

        state.knowledge.push(
          entry
        );
      }

      state.knowledge =
        trimKnowledge(
          state.knowledge
        );

      state.updatedAt =
        now;

      return {
        ...entry,

        files: [
          ...entry.files,
        ],
      };
    }
  );
}


async function resolveWorkspaceFailure(
  workspace: string,
  failureId: string,
  fixId: string
): Promise<void> {
  await updateWorkspaceMemoryState(
    workspace,
    state => {
      const failure =
        state.knowledge.find(
          entry =>
            entry.id === failureId &&
            entry.kind === "failure"
        );

      if (!failure) {
        return;
      }

      const now =
        Date.now();

      failure.resolvedAt =
        now;

      failure.resolvedByFixId =
        fixId;

      failure.lastObservedAt =
        now;

      state.updatedAt =
        now;
    }
  );
}


async function updateWorkspaceMemoryState<T>(
  workspace: string,
  update: (state: WorkspaceMemoryState) => T | Promise<T>
): Promise<T> {
  const previous =
    workspaceMemoryUpdates.get(
      workspace
    ) ?? Promise.resolve();

  const operation =
    previous
      .catch(
        () => undefined
      )
      .then(
        async () => {
          const state =
            await loadWorkspaceMemoryState(
              workspace
            );

          const result =
            await update(
              state
            );

          await saveWorkspaceMemoryState(
            workspace,
            state
          );

          return result;
        }
      );

  const tail =
    operation.then(
      () => undefined,
      () => undefined
    );

  workspaceMemoryUpdates.set(
    workspace,
    tail
  );

  tail.finally(
    () => {
      if (
        workspaceMemoryUpdates.get(workspace) === tail
      ) {
        workspaceMemoryUpdates.delete(
          workspace
        );
      }
    }
  );

  return operation;
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

    const parsed =
      JSON.parse(
        content
      ) as WorkspaceMemoryState | LegacyWorkspaceMemoryState;

    return migrateWorkspaceMemoryState(
      parsed
    );
  } catch {
    return createEmptyWorkspaceMemoryState();
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

  const temporaryFile =
    `${file}.tmp`;

  await fs.writeFile(
    temporaryFile,
    JSON.stringify(
      state,
      null,
      2
    ),
    "utf8"
  );

  await fs.rename(
    temporaryFile,
    file
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

    knowledge:
      createSemanticMemorySnapshot(
        state.knowledge
      ),
  };
}


function createSemanticMemorySnapshot(
  entries: WorkspaceKnowledgeEntry[]
): WorkspaceSemanticMemorySnapshot {
  return {
    architecture:
      selectKnowledge(
        entries,
        "architecture"
      ),

    codingStyle:
      selectKnowledge(
        entries,
        "coding_style"
      ),

    preferredPatterns:
      selectKnowledge(
        entries,
        "preferred_pattern"
      ),

    previousFailures:
      selectKnowledge(
        entries,
        "failure"
      ),

    previousFixes:
      selectKnowledge(
        entries,
        "fix"
      ),
  };
}


function selectKnowledge(
  entries: WorkspaceKnowledgeEntry[],
  kind: WorkspaceKnowledgeKind
): WorkspaceKnowledgeEntry[] {
  return entries
    .filter(
      entry =>
        entry.kind === kind
    )
    .sort(
      (a, b) =>
        b.lastObservedAt - a.lastObservedAt
    )
    .slice(
      0,
      SNAPSHOT_LIMIT
    )
    .map(
      entry => ({
        ...entry,

        files: [
          ...entry.files,
        ],
      })
    );
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


function createEmptyWorkspaceMemoryState(): WorkspaceMemoryState {
  return {
    version: 2,

    files: {},

    knowledge: [],

    updatedAt:
      Date.now(),
  };
}


function migrateWorkspaceMemoryState(
  state: WorkspaceMemoryState | LegacyWorkspaceMemoryState
): WorkspaceMemoryState {
  const candidate =
    state as Partial<WorkspaceMemoryState>;

  return {
    version: 2,

    files:
      candidate.files ?? {},

    knowledge:
      Array.isArray(candidate.knowledge)
        ? candidate.knowledge.filter(isWorkspaceKnowledgeEntry)
        : [],

    updatedAt:
      typeof candidate.updatedAt === "number"
        ? candidate.updatedAt
        : Date.now(),
  };
}


function isWorkspaceKnowledgeEntry(
  value: unknown
): value is WorkspaceKnowledgeEntry {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const entry =
    value as Partial<WorkspaceKnowledgeEntry>;

  return (
    typeof entry.id === "string" &&
    isWorkspaceKnowledgeKind(entry.kind) &&
    typeof entry.summary === "string" &&
    Array.isArray(entry.files) &&
    entry.files.every(file => typeof file === "string") &&
    isWorkspaceKnowledgeSource(entry.source) &&
    typeof entry.confidence === "number" &&
    typeof entry.firstObservedAt === "number" &&
    typeof entry.lastObservedAt === "number" &&
    typeof entry.observationCount === "number"
  );
}


function isWorkspaceKnowledgeKind(
  value: unknown
): value is WorkspaceKnowledgeKind {
  return (
    value === "architecture" ||
    value === "coding_style" ||
    value === "preferred_pattern" ||
    value === "failure" ||
    value === "fix"
  );
}


function isWorkspaceKnowledgeSource(
  value: unknown
): value is WorkspaceKnowledgeSource {
  return (
    value === "user" ||
    value === "agent" ||
    value === "runtime" ||
    value === "workspace"
  );
}


function trimKnowledge(
  entries: WorkspaceKnowledgeEntry[]
): WorkspaceKnowledgeEntry[] {
  const result:
    WorkspaceKnowledgeEntry[] = [];

  for (const kind of [
    "architecture",
    "coding_style",
    "preferred_pattern",
    "failure",
    "fix",
  ] as const) {
    result.push(
      ...entries
        .filter(
          entry =>
            entry.kind === kind
        )
        .sort(
          (a, b) =>
            b.lastObservedAt - a.lastObservedAt
        )
        .slice(
          0,
          KNOWLEDGE_LIMIT_PER_KIND
        )
    );
  }

  return result;
}


function normaliseSummary(
  summary: string
): string {
  return summary
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}


function sameMetadataGoal(
  current: WorkspaceKnowledgeEntry["metadata"],
  next: WorkspaceKnowledgeInput["metadata"]
): boolean {
  const currentGoal =
    current?.goal;

  const nextGoal =
    next?.goal;

  if (
    currentGoal === undefined &&
    nextGoal === undefined
  ) {
    return true;
  }

  return currentGoal === nextGoal;
}


function sanitiseFiles(
  files: string[]
): string[] {
  return [
    ...new Set(
      files
        .map(
          file =>
            file.trim()
        )
        .filter(Boolean)
    ),
  ];
}


function clampConfidence(
  confidence: number
): number {
  if (!Number.isFinite(confidence)) {
    return 1;
  }

  return Math.max(
    0,
    Math.min(
      1,
      confidence
    )
  );
}
