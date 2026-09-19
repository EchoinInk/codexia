import { createHash, randomUUID } from "node:crypto";
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


export type WorkspaceEvolutionKind =
  | "structural"
  | "architecture"
  | "dependency"
  | "diagnostic"
  | "decision"
  | "verification";


export type WorkspaceEvidenceState =
  | "current"
  | "historical"
  | "stale"
  | "incomplete"
  | "contradicted"
  | "invalidated";


export interface WorkspaceEvidenceStrength {
  supportingObservations: number;

  distinctSnapshots: number;

  contradictionCount: number;

  invalidated: boolean;

  current: boolean;

  stale: boolean;

  label: "low" | "medium" | "high" | "contradicted";
}


export interface WorkspaceEvolutionEntry {
  id: string;

  kind: WorkspaceEvolutionKind;

  summary: string;

  details?: string;

  files: string[];

  directories: string[];

  snapshotId: string;

  fingerprint: string;

  state: WorkspaceEvidenceState;

  source: WorkspaceKnowledgeSource;

  observedAt: number;

  evidenceCount: number;

  strength: WorkspaceEvidenceStrength;
}


export interface WorkspaceLearningEntry {
  id: string;

  kind: "pattern" | "convention" | "dependency" | "failure" | "fix" | "constraint";

  summary: string;

  details?: string;

  files: string[];

  state: WorkspaceEvidenceState;

  supportingEvidenceIds: string[];

  observedAt: number;

  strength: WorkspaceEvidenceStrength;
}


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

  evolution: WorkspaceEvolutionEntry[];

  learning: WorkspaceLearningEntry[];
}


interface WorkspaceMemoryState {
  version: 3;

  files: Record<string, WorkspaceMemoryFile>;

  knowledge: WorkspaceKnowledgeEntry[];

  evolution: WorkspaceEvolutionEntry[];

  learning: WorkspaceLearningEntry[];

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

const EVOLUTION_LIMIT = 200;

const LEARNING_LIMIT = 100;

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


export function createEvidenceStrength(
  supportingObservations: number,
  distinctSnapshots: number,
  contradictionCount: number,
  invalidated: boolean,
  current: boolean,
  stale: boolean
): WorkspaceEvidenceStrength {
  const strengthScore =
    supportingObservations +
    distinctSnapshots * 2 -
    contradictionCount * 3;

  if (invalidated || contradictionCount > 0) {
    return {
      supportingObservations,
      distinctSnapshots,
      contradictionCount,
      invalidated: true,
      current: false,
      stale: stale || current,
      label: "contradicted",
    };
  }

  if (strengthScore >= 6) {
    return {
      supportingObservations,
      distinctSnapshots,
      contradictionCount,
      invalidated: false,
      current,
      stale,
      label: "high",
    };
  }

  if (strengthScore >= 3) {
    return {
      supportingObservations,
      distinctSnapshots,
      contradictionCount,
      invalidated: false,
      current,
      stale,
      label: "medium",
    };
  }

  return {
    supportingObservations,
    distinctSnapshots,
    contradictionCount,
    invalidated: false,
    current,
    stale,
    label: "low",
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


export async function appendWorkspaceEvolution(
  workspace: string,
  input: Omit<WorkspaceEvolutionEntry, "id" | "strength"> & {
    evidenceCount?: number;
    observedAt?: number;
  }
): Promise<WorkspaceEvolutionEntry> {
  return updateWorkspaceMemoryState(
    workspace,
    state => {
      const {
        evidenceCount: requestedEvidenceCount,
        observedAt: requestedObservedAt,
        files: inputFiles,
        directories: inputDirectories,
        ...entryInput
      } = input;
      const evidenceCount = requestedEvidenceCount ?? 1;
      const observedAt = requestedObservedAt ?? Date.now();
      const files = [...new Set(inputFiles)].sort();
      const directories = [...new Set(inputDirectories)].sort();
      const identity = createStableId([
        entryInput.kind,
        normaliseSummary(entryInput.summary),
        entryInput.snapshotId,
        JSON.stringify(files),
        JSON.stringify(directories),
      ]);
      const existing = state.evolution.find(
        entry => entry.id === identity
      );
      if (existing) {
        existing.evidenceCount += evidenceCount;
        existing.observedAt = Math.max(existing.observedAt, observedAt);
        existing.files = [...new Set([...existing.files, ...files])].sort();
        existing.directories = [...new Set([...existing.directories, ...directories])].sort();
        existing.strength = createEvidenceStrength(
          existing.evidenceCount,
          1,
          existing.state === "contradicted" || existing.state === "invalidated" ? 1 : 0,
          existing.state === "invalidated",
          existing.state === "current",
          existing.state === "stale"
        );
        state.updatedAt = observedAt;
        return existing;
      }
      const entry: WorkspaceEvolutionEntry = {
        id: identity,
        strength: createEvidenceStrength(
          evidenceCount,
          1,
          0,
          false,
          input.state === "current",
          input.state === "stale"
        ),
        evidenceCount,
        ...entryInput,
        files,
        directories,
        observedAt,
      };

      state.evolution = [
        entry,
        ...state.evolution,
      ].slice(0, EVOLUTION_LIMIT);

      state.learning = deriveWorkspaceLearningEntries(
        state.evolution,
        state.learning
      );

      state.updatedAt = observedAt;
      return entry;
    }
  );
}


export async function appendWorkspaceLearning(
  workspace: string,
  input: Omit<WorkspaceLearningEntry, "id" | "strength"> & {
    state?: WorkspaceEvidenceState;
  }
): Promise<WorkspaceLearningEntry> {
  return updateWorkspaceMemoryState(
    workspace,
    state => {
      const { state: requestedState, ...entryInput } = input;
      const stateValue = requestedState ?? "historical";
      const entry: WorkspaceLearningEntry = {
        id: createStableId([
          entryInput.kind,
          normaliseSummary(entryInput.summary),
          JSON.stringify([...entryInput.supportingEvidenceIds].sort()),
        ]),
        state: stateValue,
        strength: createEvidenceStrength(
          input.supportingEvidenceIds.length,
          new Set(input.supportingEvidenceIds).size,
          0,
          false,
          stateValue === "current",
          stateValue === "stale"
        ),
        ...entryInput,
      };

      state.learning = [
        entry,
        ...state.learning,
      ].slice(0, LEARNING_LIMIT);

      state.updatedAt = Date.now();
      return entry;
    }
  );
}


export async function deriveWorkspaceLearning(
  workspace: string
): Promise<WorkspaceLearningEntry[]> {
  return updateWorkspaceMemoryState(
    workspace,
    state => {
      state.learning = deriveWorkspaceLearningEntries(
        state.evolution,
        state.learning
      );
      state.updatedAt = Date.now();
      return state.learning.slice(0, LEARNING_LIMIT);
    }
  );
}


function deriveWorkspaceLearningEntries(
  evolution: WorkspaceEvolutionEntry[],
  existing: WorkspaceLearningEntry[]
): WorkspaceLearningEntry[] {
  if (evolution.length === 0) {
    return existing.slice(0, LEARNING_LIMIT);
  }

  const grouped = new Map<string, {
    summary: string;
    details: string;
    files: Set<string>;
    supportingEvidenceIds: string[];
    state: WorkspaceEvidenceState;
    observedAt: number;
    kind: WorkspaceLearningEntry["kind"];
  }>();

  for (const entry of evolution) {
    const kind: WorkspaceLearningEntry["kind"] =
      entry.kind === "diagnostic" ? "failure" :
      entry.kind === "dependency" ? "dependency" :
      entry.kind === "architecture" || entry.kind === "structural" ? "pattern" :
      entry.kind === "verification" ? "fix" :
      "convention";

    const key = `${kind}:${normaliseSummary(entry.summary)}`;
    const current = grouped.get(key) ?? {
      summary: entry.summary,
      details: entry.details ?? "Observed over workspace evolution evidence.",
      files: new Set<string>(),
      supportingEvidenceIds: [],
      state: entry.state,
      observedAt: entry.observedAt,
      kind,
    };

    current.summary = current.summary || entry.summary;
    current.details = current.details || entry.details || "Observed over workspace evolution evidence.";
    for (const file of entry.files) current.files.add(file);
    current.supportingEvidenceIds.push(entry.id);
    current.observedAt = Math.max(current.observedAt, entry.observedAt);

    const stateOrder: WorkspaceEvidenceState[] = [
      "current",
      "historical",
      "stale",
      "incomplete",
      "contradicted",
      "invalidated",
    ];
    const currentPriority = stateOrder.indexOf(current.state);
    const entryPriority = stateOrder.indexOf(entry.state);
    if (entryPriority > currentPriority) {
      current.state = entry.state;
    }

    grouped.set(key, current);
  }

  const derived = [...grouped.values()].map(group => {
    const support = group.supportingEvidenceIds.length;
    const snapshotCount = new Set(
      evolution
        .filter(entry => group.supportingEvidenceIds.includes(entry.id))
        .map(entry => entry.snapshotId)
    ).size;

    const contradictionCount = group.supportingEvidenceIds.filter(id => {
      const entry = evolution.find(item => item.id === id);
      return entry ? entry.state === "contradicted" || entry.state === "invalidated" : false;
    }).length;

    const state =
      contradictionCount > 0 ? "contradicted" :
      group.state === "current" && support >= 2 ? "current" :
      group.state === "stale" ? "stale" :
      group.state === "incomplete" ? "incomplete" :
      "historical";

    return {
      id: createStableId([
        group.kind,
        normaliseSummary(group.summary),
        JSON.stringify([...new Set(group.supportingEvidenceIds)].sort()),
      ]),
      kind: group.kind,
      summary: group.summary,
      details: group.details,
      files: [...group.files].slice(0, 20),
      state,
      supportingEvidenceIds: [...new Set(group.supportingEvidenceIds)].slice(0, 20),
      observedAt: group.observedAt,
      strength: createEvidenceStrength(
        support,
        snapshotCount,
        contradictionCount,
        contradictionCount > 0,
        state === "current",
        state === "stale"
      ),
    } satisfies WorkspaceLearningEntry;
  }).sort((a, b) => b.observedAt - a.observedAt).slice(0, LEARNING_LIMIT);

  return derived.length > 0 ? derived : existing.slice(0, LEARNING_LIMIT);
}


function createStableId(parts: string[]): string {
  return createHash("sha256")
    .update(parts.join("\u0000"))
    .digest("hex");
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

    evolution:
      state.evolution
        .slice(0, EVOLUTION_LIMIT)
        .sort(
          (a, b) =>
            b.observedAt - a.observedAt
        ),

    learning:
      state.learning
        .slice(0, LEARNING_LIMIT)
        .sort(
          (a, b) =>
            b.observedAt - a.observedAt
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
    version: 3,

    files: {},

    knowledge: [],

    evolution: [],

    learning: [],

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
    version: 3,

    files:
      candidate.files ?? {},

    knowledge:
      Array.isArray(candidate.knowledge)
        ? candidate.knowledge.filter(isWorkspaceKnowledgeEntry)
        : [],

    evolution:
      Array.isArray(candidate.evolution)
        ? candidate.evolution.filter(isWorkspaceEvolutionEntry)
        : [],

    learning:
      Array.isArray(candidate.learning)
        ? candidate.learning.filter(isWorkspaceLearningEntry)
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


function isWorkspaceEvolutionEntry(
  value: unknown
): value is WorkspaceEvolutionEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<WorkspaceEvolutionEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.kind === "string" &&
    typeof entry.summary === "string" &&
    Array.isArray(entry.files) &&
    Array.isArray(entry.directories) &&
    typeof entry.snapshotId === "string" &&
    typeof entry.fingerprint === "string" &&
    typeof entry.state === "string" &&
    isWorkspaceKnowledgeSource(entry.source) &&
    typeof entry.observedAt === "number" &&
    typeof entry.evidenceCount === "number" &&
    !!entry.strength && typeof entry.strength.label === "string"
  );
}


function isWorkspaceLearningEntry(
  value: unknown
): value is WorkspaceLearningEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<WorkspaceLearningEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.kind === "string" &&
    typeof entry.summary === "string" &&
    Array.isArray(entry.files) &&
    typeof entry.state === "string" &&
    Array.isArray(entry.supportingEvidenceIds) &&
    typeof entry.observedAt === "number" &&
    !!entry.strength && typeof entry.strength.label === "string"
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
