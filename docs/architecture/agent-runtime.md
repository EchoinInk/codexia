# Agent Runtime Architecture

## Purpose

The Agent Runtime coordinates Codexia's autonomous development workflow.

It transforms developer intent into validated changes.


## Responsibilities

The Agent Runtime manages:

- task lifecycle
- planning
- execution
- observation
- validation
- repair


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

Coordinate the lifecycle.

The workflow manages:

- state transitions
- execution stages
- error handling


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