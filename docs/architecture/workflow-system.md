# Workflow System Architecture

## Purpose

The Workflow System coordinates one bounded Codexia development lifecycle.

Long-running task orchestration is owned by the Runtime above the Workflow. The Runtime may invoke multiple Workflow cycles, but the Workflow itself remains bounded and independent.


## Lifecycle

Intent

↓

Planning

↓

Execution

↓

Observation

↓

Validation

↓

Reporting


## Responsibilities


## Planning Stage

Determines:

- required changes
- affected files
- execution strategy


## Execution Stage

Performs:

- tool operations
- file modifications
- patch application


## Observation Stage

Records:

- actions taken
- results
- failures


## Validation Stage

Checks:

- correctness
- build state
- regression risk


## Reporting Stage

Provides:

- summaries
- changed files
- validation results


## Runtime Boundary

The Workflow owns a single bounded execution cycle.

The Long-running Task Runtime owns:

- repeating Workflow cycles
- task lifecycle state
- checkpoints
- continuation and retry decisions
- pause and resume
- cancellation
- timeout and iteration limits
- runtime events and metrics

Planner, Executor, Validator, Reporter, Workflow, and Intelligence remain independent components.

The Phase 5.2 Task Queue may schedule work that eventually invokes Workflow or the Long-running Task Runtime, but queue scheduling remains outside the bounded Workflow lifecycle.

The Phase 5.3 Event System may notify runtime consumers about workspace changes and their impact, but event processing remains outside the bounded Workflow lifecycle.

Phase 5.4 Workspace Memory remains owned by Workspace Intelligence. Runtime-level adapters may record durable failures and fixes after a bounded Workflow returns, but Workflow itself does not persist semantic memory.


## Design Goal

The workflow system should make autonomous actions predictable and trustworthy.

## Multi-Agent Coordination Boundary

Phase 5.5 may wrap a bounded Workflow with role-specific consultation and review. Specialist roles do not execute tools or modify files. The Planner still determines the plan, the Workflow still coordinates one bounded lifecycle, and the Executor still owns tool execution.

A Reviewer may reject a completed coordinated task without changing the underlying Workflow result. Follow-up repair or continuation remains the responsibility of the orchestration layer above Workflow.
