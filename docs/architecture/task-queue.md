# Task Queue Architecture

## Purpose

The Task Queue provides durable scheduling for background and maintenance work introduced in Phase 5.2.

It coordinates when work runs while preserving ownership of how each task is performed.

## Supported Task Categories

- build
- tests
- lint
- documentation
- indexing

## Boundary

The queue is a scheduling and lifecycle layer only.

It does not duplicate:

- Workflow execution
- Planner responsibilities
- Executor responsibilities
- Validation logic
- Workspace indexing logic
- Long-running runtime orchestration

Each queue task is delegated to the subsystem that already owns that responsibility.

## Task Lifecycle

queued

↓

running

↓

completed / failed / cancelled

Recoverable failures may be re-queued until the configured attempt limit is reached.

## Scheduling

Tasks are ordered by:

1. priority
2. enqueue time

Supported priorities are:

- low
- normal
- high
- critical

Queue concurrency is configurable and defaults to one task at a time.

## Durability

Queue state is persisted under:

`.codexia/runtime/task-queue.json`

Writes use atomic file replacement.

If Codexia restarts while a task is running, that task is recovered as queued work and may continue within its remaining attempt budget.

## Cancellation

Queued tasks can be cancelled before execution.

Running tasks receive an `AbortSignal` through the handler boundary.

Build, test, and lint subprocesses are abortable. Documentation tasks propagate cancellation into the Long-running Task Runtime. Workspace indexing observes cancellation at safe boundaries around the existing indexing operation.

## Default Adapters

### Build

Delegates to:

`npm run build`

### Tests

Delegates to:

`npm test -- --runInBand`

### Lint

Delegates to:

`npm run lint`

### Documentation

Creates a normal Codexia agent context and delegates the supplied documentation goal to the Phase 5.1 Long-running Task Runtime.

### Indexing

Delegates to the existing workspace index manager and performs an explicit workspace index rebuild.

## Observability

The queue exposes typed events for:

- enqueue
- start
- completion
- failure
- retry
- cancellation
- drain

It also tracks aggregate counts for queued, running, completed, failed, cancelled, and retried tasks.
