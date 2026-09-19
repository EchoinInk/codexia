import { getWorkspaceRoot } from "@/lib/fs-safe";
import { snapshotId } from "./change-proposal";
import {
  getWorkspaceCacheEntry,
} from "./workspace-cache";
import {
  getWorkspaceRefreshState,
  type WorkspaceRefreshState,
} from "./workspace-index-manager";
import {
  loadWorkspaceState,
} from "./workspace-storage";

import type {
  WorkspaceIndex,
} from "./types";

import type {
  WorkspaceFingerprint,
} from "./index-fingerprint";

export type WorkspaceIntelligenceStatus =
  | "current"
  | "stale"
  | "incomplete"
  | "unavailable"
  | "failed";

export interface WorkspaceIntelligenceProvenance {
  workspace: string;

  snapshotId: string;

  generatedAt: number;

  source: "cache" | "persisted";

  fingerprint: WorkspaceFingerprint;

  refreshVersion: number;
}

export interface WorkspaceIntelligenceEvidence {
  index: WorkspaceIndex;

  files: WorkspaceIndex["files"];

  directories: string[];

  relationships: WorkspaceIndex["relationships"];

  memory: WorkspaceIndex["memory"];

  intelligence: WorkspaceIndex["intelligence"];
}

export interface WorkspaceIntelligenceSnapshot {
  workspace: string;

  status: WorkspaceIntelligenceStatus;

  usable: boolean;

  dirty: boolean;

  pending: boolean;

  refresh: WorkspaceRefreshState;

  provenance?: WorkspaceIntelligenceProvenance;

  evidence?: WorkspaceIntelligenceEvidence;

  failure?: {
    message: string;

    occurredAt?: number;
  };
}

interface SnapshotSource {
  index: WorkspaceIndex;

  fingerprint: WorkspaceFingerprint;

  generatedAt: number;

  source: "cache" | "persisted";
}

export async function getWorkspaceIntelligenceSnapshot(
  workspace: string
): Promise<WorkspaceIntelligenceSnapshot> {
  const canonicalWorkspace =
    getWorkspaceRoot(
      workspace
    );

  const refresh =
    getWorkspaceRefreshState(
      workspace
    );

  const source =
    await getSnapshotSource(
      workspace,
      canonicalWorkspace
    );

  const background =
    refresh.background;

  if (
    background?.state === "failed"
  ) {
    if (!source) {
      return {
        workspace: canonicalWorkspace,

        status: "failed",

        usable: false,

        dirty: refresh.dirty,

        pending: refresh.dirty,

        refresh,

        failure: {
          message:
            background.error ??
            "Workspace refresh failed",

          occurredAt:
            background.completedAt,
        },
      };
    }

    return createSnapshot(
      canonicalWorkspace,
      refresh,
      source,
      "failed",
      {
        message:
          background.error ??
          "Workspace refresh failed",

        occurredAt:
          background.completedAt,
      }
    );
  }

  if (!source) {
    return {
      workspace: canonicalWorkspace,

      status: "unavailable",

      usable: false,

      dirty: refresh.dirty,

      pending:
        refresh.dirty ||
        background?.state === "queued" ||
        background?.state === "running",

      refresh,
    };
  }

  if (
    !isCompleteSource(
      source
    )
  ) {
    return createSnapshot(
      canonicalWorkspace,
      refresh,
      source,
      "incomplete"
    );
  }

  if (
    refresh.dirty ||
    source.source === "persisted" ||
    background?.state === "queued" ||
    background?.state === "running"
  ) {
    return createSnapshot(
      canonicalWorkspace,
      refresh,
      source,
      "stale"
    );
  }

  return createSnapshot(
    canonicalWorkspace,
    refresh,
    source,
    "current"
  );
}

async function getSnapshotSource(
  workspace: string,
  canonicalWorkspace: string
): Promise<SnapshotSource | null> {
  const cached =
    getWorkspaceCacheEntry(
      workspace
    );

  if (cached) {
    return {
      index: cached.index,

      fingerprint: cached.fingerprint,

      generatedAt: cached.createdAt,

      source: "cache",
    };
  }

  if (canonicalWorkspace !== workspace) {
    const canonicalCache =
      getWorkspaceCacheEntry(
        canonicalWorkspace
      );

    if (canonicalCache) {
      return {
        index: canonicalCache.index,

        fingerprint: canonicalCache.fingerprint,

        generatedAt: canonicalCache.createdAt,

        source: "cache",
      };
    }
  }

  const persisted =
    await loadWorkspaceState(
      workspace
    ) ??
    (
      canonicalWorkspace !== workspace
        ? await loadWorkspaceState(canonicalWorkspace)
        : null
    );

  if (!persisted) {
    return null;
  }

  return {
    index: persisted.index,

    fingerprint: persisted.fingerprint,

    generatedAt: persisted.createdAt,

    source: "persisted",
  };
}

function createSnapshot(
  workspace: string,
  refresh: WorkspaceRefreshState,
  source: SnapshotSource,
  status: WorkspaceIntelligenceStatus,
  failure?: WorkspaceIntelligenceSnapshot["failure"]
): WorkspaceIntelligenceSnapshot {
  const id =
    snapshotId(
      source.index
    );

  return {
    workspace,

    status,

    usable:
      status !== "unavailable" &&
      status !== "failed",

    dirty:
      refresh.dirty,

    pending:
      refresh.dirty ||
      refresh.background?.state === "queued" ||
      refresh.background?.state === "running",

    refresh,

    provenance: {
      workspace,

      snapshotId: id,

      generatedAt:
        source.generatedAt,

      source:
        source.source,

      fingerprint:
        source.fingerprint,

      refreshVersion:
        refresh.version,
    },

    evidence: {
      index: source.index,

      files: source.index.files,

      directories: source.index.directories,

      relationships: source.index.relationships,

      memory: source.index.memory,

      intelligence: source.index.intelligence,
    },

    failure,
  };
}

function isCompleteSource(
  source: SnapshotSource
): boolean {
  return (
    Array.isArray(source.index.files) &&
    Array.isArray(source.index.directories) &&
    Boolean(source.index.relationships) &&
    Boolean(source.fingerprint) &&
    typeof source.fingerprint.files === "object" &&
    Array.isArray(source.fingerprint.directories)
  );
}
