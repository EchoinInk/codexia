# Workflow State Model

## Purpose

Defines Codexia workflow lifecycle.


## States


IDLE

↓

PLANNING

↓

PLAN_VALIDATED

↓

EXECUTING

↓

VERIFYING

↓

COMPLETED


Failure Path:

EXECUTING

↓

FAILED

↓

REPAIRING

↓

RETRYING


## Principle

State transitions should be explicit and observable.