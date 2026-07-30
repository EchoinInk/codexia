export type WorkspaceBackgroundIndexState =
  "queued" |
  "running" |
  "complete" |
  "failed";

export interface WorkspaceBackgroundIndexStatus {
  workspace: string;

  state: WorkspaceBackgroundIndexState;

  queuedAt: number;

  startedAt?: number;

  completedAt?: number;

  error?: string;
}

type WorkspaceBackgroundIndexTask =
  () => Promise<void>;

interface WorkspaceBackgroundIndexJob {
  status: WorkspaceBackgroundIndexStatus;

  task: WorkspaceBackgroundIndexTask;

  timer?: NodeJS.Timeout;
}

const jobs =
  new Map<string, WorkspaceBackgroundIndexJob>();

const DEFAULT_DELAY_MS = 100;

export function scheduleWorkspaceBackgroundIndex(
  workspace: string,
  task: WorkspaceBackgroundIndexTask,
  delayMs: number = DEFAULT_DELAY_MS
): WorkspaceBackgroundIndexStatus {
  const existing =
    jobs.get(
      workspace
    );

  if (
    existing &&
    (
      existing.status.state === "queued" ||
      existing.status.state === "running"
    )
  ) {
    return {
      ...existing.status,
    };
  }

  const job: WorkspaceBackgroundIndexJob = {
    status: {
      workspace,

      state: "queued",

      queuedAt:
        Date.now(),
    },

    task,
  };

  job.timer =
    setTimeout(
      () => {
        runWorkspaceBackgroundIndex(
          workspace
        );
      },
      delayMs
    );

  jobs.set(
    workspace,
    job
  );

  return {
    ...job.status,
  };
}

export function getWorkspaceBackgroundIndexStatus(
  workspace: string
): WorkspaceBackgroundIndexStatus | null {
  const job =
    jobs.get(
      workspace
    );

  return job
    ? {
        ...job.status,
      }
    : null;
}

export function clearWorkspaceBackgroundIndex(
  workspace: string
): void {
  const job =
    jobs.get(
      workspace
    );

  if (
    job?.timer
  ) {
    clearTimeout(
      job.timer
    );
  }

  jobs.delete(
    workspace
  );
}

export function clearAllWorkspaceBackgroundIndexes(): void {
  for (const workspace of jobs.keys()) {
    clearWorkspaceBackgroundIndex(
      workspace
    );
  }
}

async function runWorkspaceBackgroundIndex(
  workspace: string
): Promise<void> {
  const job =
    jobs.get(
      workspace
    );

  if (!job) {
    return;
  }

  job.timer =
    undefined;

  job.status = {
    ...job.status,

    state: "running",

    startedAt:
      Date.now(),
  };

  try {
    await job.task();

    job.status = {
      ...job.status,

      state: "complete",

      completedAt:
        Date.now(),

      error:
        undefined,
    };
  } catch (error) {
    job.status = {
      ...job.status,

      state: "failed",

      completedAt:
        Date.now(),

      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}
