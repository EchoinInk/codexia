# Planner Contract

## Purpose

Defines the interface between user intent and execution.


## Input

Planner receives:

- user request
- workspace context
- project state
- available tools


## Output

Planner produces:

- intent
- actions
- affected files
- expected outcome
- confidence


## Requirements

Plans must be:

- structured
- validated
- executable
- understandable