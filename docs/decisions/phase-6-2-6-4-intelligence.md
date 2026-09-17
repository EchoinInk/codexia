# Decision: shared compiler intelligence and reviewed change workflow

Status: Implemented, 2026-09-17. Tests passed between phases; final suite and typecheck passed.

The user authorized Phases 6.2, 6.3, and 6.4 together, with npm test between phases. Phase 7 remains unstarted. The delivery extends the existing programmatic Intelligence/HTTP boundary; no editor UI is introduced.

Extract the Phase 6.1 disposable compiler host into `compiler-project.ts` and reuse it for diagnostics, code fixes, rename, compiler refactor actions, and dependency resolution. Keep the existing workspace index as source authority. Extend the existing dependency graph rather than creating an architecture-only graph. Raw imports remain available; resolved edges drive transitive impact reasoning.

Structured diagnostics accept injectable providers. Optional AI advice goes through a Models adapter; it is never assumed correct or executable. Compiler fixes and model suggestions use the existing before/after `DiffResult` contract wrapped in a snapshot-bound proposal. The Validator rejects invalid/stale source and increased indexed compiler errors. Such validation is incomplete with external dependencies absent and does not prove behavior preservation.

Intelligence plans edits. Validator checks them. The existing Patch Executor performs guarded replacement. A bounded change Workflow coordinates fresh validation, a durable journal, verification, and rollback; Reporter formats architecture results. Runtime remains above Workflow. Default verification uses the existing verification runner with the chosen workspace as cwd. No model provider is added to Runtime or Planner.

Conservative collision rejection trades rename availability for avoiding capture and member conflicts. Full new-file/move refactors, external command fixes, unsaved buffers, and external references remain unsupported. Filesystem rollback is conflict-aware rather than falsely atomic: per-process serialization does not lock external editors, and concurrent/partial writes can require recovery from the durable journal.

Unused exports and unreachable modules are evidence-backed candidates, not deletion plans. Explicit entry points, public files, and layer rules avoid inferring a project's architecture from folder names. Nonliteral dynamic imports and external consumers remain visible limitations.
