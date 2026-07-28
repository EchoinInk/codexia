# Event System Architecture

## Purpose

Phase 5.3 introduces a typed event layer between workspace change detection and agent/runtime reactions.

The Event System converts workspace file watcher notifications into observable agent events while preserving the existing responsibilities of Workspace Intelligence, Workflow, Runtime, and Workspace Memory.

## Event Flow

File changed

↓

Workspace watcher detects change

↓

Event System accepts typed `file_changed` event

↓

Agent/runtime observers are notified

↓

Workspace is marked dirty for background refresh

↓

Existing Intelligence performs dependency-aware impact analysis

↓

Existing Workspace Memory records the file change

## Responsibilities

The Event System owns:

- typed workspace events
- agent/runtime notification boundary
- per-workspace event serialisation
- dependency-aware impact reasoning handoff
- event history
- processing metrics and status
- observer isolation
- event-processing error handling

The Event System does not own:

- file watching
- workspace indexing
- dependency graph construction
- planning
- execution
- validation
- long-running task continuation
- task queue scheduling
- semantic workspace memory introduced in later milestones

## Event Types

### `file_changed`

A watcher change has entered the agent event runtime.

### `agent_notified`

The event has reached the agent/runtime notification boundary and is available to subscribers.

### `impact_analysed`

Existing workspace intelligence has reasoned about the changed file and its affected dependants.

### `memory_updated`

Existing workspace activity memory has recorded the file change.

### `event_failed`

Processing failed without allowing observer or event errors to break the workspace watcher.

## Impact Reasoning

Phase 5.3 reuses the existing `IntelligenceContext.analyseImpact()` boundary.

The Event System does not create another dependency or impact model. It asks Workspace Intelligence to reason about the changed file using the current workspace index.

## Workspace Refresh

When a file event is accepted, the Event System marks the workspace dirty through the existing Workspace Index Manager boundary.

The existing background indexing system remains responsible for incremental refresh and persisted index state.

## Workspace Memory

Phase 5.3 updates the existing activity-oriented Workspace Memory by recording changed files.

Phase 5.4 expands this same Workspace Intelligence memory boundary with long-lived semantic project knowledge such as architecture, coding style, preferred patterns, previous failures, and previous fixes. Event processing continues to record file activity only; it does not infer or author semantic project knowledge.

## Ordering and Concurrency

Event processing is serialised per workspace.

This prevents multiple watcher events for the same workspace from independently racing through impact reasoning and memory updates while still allowing separate workspaces to process events independently.

## Observability

Consumers may subscribe to typed events and inspect bounded in-memory event history and status.

Tracked metrics include:

- received events
- processed events
- failed events
- pending events

Observer failures are isolated and cannot interrupt event processing.
