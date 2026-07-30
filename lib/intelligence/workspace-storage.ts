import fs from "node:fs/promises";
import path from "node:path";

import type {
  WorkspaceIndex,
} from "./types";

import type {
  WorkspaceFingerprint,
} from "./index-fingerprint";


interface PersistedWorkspaceState {

  index: WorkspaceIndex;

  fingerprint: WorkspaceFingerprint;

  createdAt: number;

}



function getStoragePath(
  workspace: string
): string {

  return path.join(
    workspace,
    ".codexia",
    "intelligence",
    "workspace-index.json"
  );

}



export async function loadWorkspaceState(
  workspace: string
): Promise<PersistedWorkspaceState | null> {

  try {

    const file =
      getStoragePath(
        workspace
      );


    const content =
      await fs.readFile(
        file,
        "utf8"
      );


    return JSON.parse(
      content
    ) as PersistedWorkspaceState;


  } catch {

    return null;

  }

}



export async function saveWorkspaceState(
  workspace: string,
  state: PersistedWorkspaceState
): Promise<void> {

  const file =
    getStoragePath(
      workspace
    );


  await fs.mkdir(
    path.dirname(file),
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



export function createWorkspaceState(
  index: WorkspaceIndex,
  fingerprint: WorkspaceFingerprint
): PersistedWorkspaceState {

  return {

    index,

    fingerprint,

    createdAt:
      Date.now(),

  };

}