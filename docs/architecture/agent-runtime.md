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
