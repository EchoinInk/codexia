# Workspace Memory Architecture

## Purpose

Phase 5.4 expands the existing activity-oriented Workspace Memory into durable project knowledge that can inform future Codexia planning and execution.

Workspace Memory remains owned by Workspace Intelligence. It does not replace Planner, Workflow, Runtime, Event System, or the Task Queue.

## Memory Model

Workspace Memory contains two complementary layers.

### Activity Memory

Introduced in Phase 4.4.6 and retained unchanged in purpose:

- frequently edited files
- commonly opened files
- recently modified files
- workspace hotspots
- developer activity totals

### Semantic Project Memory

Introduced in Phase 5.4:

- architecture
- coding style
- preferred patterns
- previous failures
- previous fixes

Semantic entries include provenance, confidence, related files, observation counts, timestamps, and optional metadata.

## Persistence

Workspace Memory is persisted per workspace at:

`.codexia/intelligence/workspace-memory.json`

The Phase 5.4 schema is versioned and migrates the existing Phase 4.4.6 activity-only state in place. Existing file activity history is preserved.

Writes use a temporary file followed by rename so partially written semantic memory does not replace the last valid state.

## Knowledge APIs

Workspace Intelligence exposes explicit operations for remembering:

- architectural facts and boundaries
- coding conventions
- preferred implementation patterns
- failures
- fixes

Knowledge is deduplicated by category and normalised summary, while repeated observations increase the observation count and refresh recency.

Individual semantic entries may be forgotten without clearing activity history.

## Failure and Fix Memory

The Long-running Task Runtime uses an optional memory-recorder adapter.

A failed runtime iteration may record a durable failure. A later successful iteration for the same task goal may record a fix and mark the related failure as resolved.

This integration lives above Workflow. Workflow remains responsible only for one bounded execution cycle and does not write semantic workspace memory directly.

Memory recording is non-critical runtime telemetry: a persistence failure is logged but does not fail an otherwise valid runtime iteration.

## Planner Integration

Workspace Memory is attached to the existing `WorkspaceIndex` and therefore becomes part of the existing `IntelligenceContext`.

The LLM Planner already receives `IntelligenceContext`, so Phase 5.4 semantic memory becomes available to planning without introducing another planner-specific data path.

Rule planning, dependency analysis, indexing, and file selection retain their existing responsibilities.

## Boundaries

Workspace Memory owns:

- durable project knowledge
- activity memory
- semantic memory persistence
- deduplication and bounded retention
- failure/fix relationships

Workspace Memory does not own:

- workspace file watching
- dependency graph construction
- task scheduling
- workflow execution
- continuation policy
- validation
- event dispatch
- multi-agent role coordination

## Retention

Activity snapshots remain bounded to the most relevant files.

Semantic storage is bounded per knowledge category, and planner-facing snapshots expose the most recent entries. This prevents long-running repositories from growing prompt context without limit while retaining durable history on disk.
