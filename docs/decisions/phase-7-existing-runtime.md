# Decision: Phase 7 adapts the existing Runtime

Status: Implemented; user acceptance pending.

The authoritative `codexia-sept.phase7.baseline.zip` contains an expanded six-milestone Phase 7 roadmap and the Phase 6.4 implementation. Its status labels were contradictory. The user's confirmation that lint/build passed and explicit request to implement Phase 7 supersede the stale focus/status labels. This change reconciles those labels; it does not treat attached documentation as new authorization for Phase 8.

Use the existing RuntimeController for continuation and the existing Task Queue for scheduling. Extend the Planner/AgentContext with serializable engineering contracts, inject engineering observer/planner/evaluator policies, and add a generic pre-Workflow checkpoint hook. This avoids a second task execution lifecycle.

Keep Intelligence responsible for diagnostics/architecture/symbol understanding, Models for optional reasoning, Planner for executable plans, Validator for correctness checks, Executor for writes, Workflow for bounded change/verification/rollback, Runtime for continuation, and Reporter for outcomes. The Phase 5.5 specialist coordinator remains advisory, with review evidence feeding escalation rather than bypassing validation.

Use exact file scope and explicit approval envelopes. Bounded authorization permits autonomous repair only inside reviewed limits; proposal mode requires exact patch review. New files, move refactors, arbitrary commands, publication, and irreversible external operations remain unsupported by this adapter. Unsupported work is escalated and reported, not implicitly authorized.

Reuse Phase 6 proposal/diff validation and journals. Add cancellation propagation, pre-execution checkpoint markers, fresh-state resume checks, source-mutation detection around verification, and workspace-local checkpoint path hardening. Markdown snapshots enable existing-file documentation obligations; schema 3 rebuilds older indexes. Compiler build-info files are excluded as generated cache data.

Performance/security integrations consume registered evidence and check providers. Missing providers are explicit limits, not successful checks. Preserving named baseline/acceptance checks is more important than making every autonomous task appear successful. Structured staged migrations are supported; an arbitrary migration title does not generate an invented compatibility plan.

Tests use injected deterministic models/checkers and temporary workspaces. Live-provider quality, external vulnerability coverage, and real workload benchmark results remain host verification responsibilities. No Phase 8 continuous automation or dashboard is introduced.
