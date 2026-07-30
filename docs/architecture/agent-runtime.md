# Agent Runtime Architecture

## Purpose

The Agent Runtime coordinates Codexia's autonomous development workflow.

It transforms developer intent into validated changes while preserving strict boundaries between planning, execution, validation, reporting, and workspace intelligence.


## Runtime Layers

Codexia has two execution scopes:

- The Workflow coordinates one bounded execution cycle.
- The Long-running Task Runtime sits above the Workflow and may repeat bounded cycles until a stop condition is reached.

The long-running runtime does not replace or duplicate Workflow responsibilities.


## Long-running Task Runtime

The Phase 5.1 runtime coordinates:

- observation
- planning
- bounded workflow execution
- goal evaluation
- checkpointing
- continuation decisions
- pause and resume
- cancellation
- iteration and timeout limits
- runtime events and metrics

Runtime lifecycle state and durable checkpoints remain separate from the bounded Workflow state model.


## Task Queue

Phase 5.2 adds a durable Task Queue alongside the Long-running Task Runtime.

The queue schedules build, test, lint, documentation, and indexing work while delegating execution to the existing subsystem that owns each responsibility. It does not replace Workflow or Runtime orchestration.

Queue state is persisted locally, supports priority ordering, bounded retries, configurable concurrency, cancellation, lifecycle events, and aggregate metrics.


## Event System

Phase 5.3 adds a typed Event System between workspace change detection and agent/runtime reactions.

Workspace watcher notifications are promoted into observable file-change events, dispatched to agent/runtime subscribers, analysed through the existing workspace intelligence impact boundary, and recorded in existing workspace activity memory.

The Event System does not replace file watching, indexing, Workflow, the Long-running Task Runtime, the Task Queue, or Workspace Memory.


## Workspace Memory

Phase 5.4 expands Workspace Intelligence memory beyond file activity into durable semantic project knowledge.

The memory snapshot now carries architecture, coding style, preferred patterns, previous failures, and previous fixes alongside the existing activity signals. The Long-running Task Runtime may record failure/fix outcomes through an optional adapter, while the bounded Workflow remains independent from Workspace Intelligence persistence.

Semantic memory is exposed through the existing `IntelligenceContext`, allowing planning to consume remembered project knowledge without introducing a second context path.


## Core Components


## Planner

Responsibility:

Determine what should happen.

The planner creates structured plans containing:

- intent
- affected files
- required operations
- expected outcomes


Planner implementations:

- Rule Planner
- LLM Planner
- Hybrid Planner


## Executor

Responsibility:

Perform approved actions.

The executor manages:

- tool invocation
- filesystem changes
- patch application
- execution results


## Workflow

Responsibility:

Coordinate one bounded execution lifecycle.

The workflow manages:

- state transitions
- execution stages
- validation handoff
- bounded-cycle error handling

The Workflow does not own long-running continuation, checkpoints, pause/resume, cancellation policy, or iteration limits.


## Validator

Responsibility:

Confirm correctness.

Validation includes:

- patch validation
- type checking
- build verification
- test execution


## Repair System

When validation fails:

The system analyses:

- failure cause
- affected areas
- possible fixes

Then generates a repair strategy.

## Multi-Agent Runtime

Phase 5.5 adds a role-coordination layer above the existing Planner and bounded Workflow.

The coordinator may consult role-specific agents before and after execution:

- Architect
- Refactorer
- Test Writer
- Documentation Writer
- Reviewer

The existing Planner remains the only component that creates executable plans. The existing Workflow and Executor remain the only components that perform workspace actions. Specialist agents produce typed advice, and the Reviewer produces a typed approval result after the bounded Workflow completes.

This prevents multiple agents from independently mutating the workspace and preserves the approved Planner, Executor, Validator, Reporter, Workflow, Intelligence, and Runtime boundaries.
