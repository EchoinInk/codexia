# ADR-004: Patch First Change Strategy

Status: Accepted

Date: July 2026


## Context

Direct file mutation creates risk in autonomous coding systems.

Changes need reviewability and validation.


## Decision

Codexia uses a patch-first workflow.

The preferred process:

Plan

↓

Generate Change

↓

Review Patch

↓

Apply Patch

↓

Verify Result


## Consequences

Benefits:

- safer modifications
- easier debugging
- clearer audit history
- reversible workflows


Tradeoff:

Additional processing is required before applying changes.