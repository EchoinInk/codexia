# Autonomous Engineering — Phase 7

## Ownership and lifecycle

`lib/agent/engineering/runtime.ts` wires domain policies into the existing `RuntimeController`. It introduces no second continuation loop, scheduler, watcher, or workspace index. Runtime remains responsible for iterations, active-time limits, checkpoints, pause, cancellation, and continuation. Each iteration invokes a bounded Workflow.

The existing Planner contract now permits typed engineering metadata. `EngineeringPlanner` authors executable plans from scope, evidence, task dependencies, and Phase 6 proposals. `runEngineeringWorkflow` adapts these plans to the reviewed-change Workflow, Validator, and existing Patch Executor. Model providers and specialist roles never receive an executable tool interface from this adapter. Reporter owns the final outcome representation.

Flow:

1. Validate the explicit goal and approval envelope.
2. Observe a fresh existing workspace index, Phase 6 diagnostics/architecture results, registered performance/security providers, and provenance-backed memory.
3. Capture named verification baselines. Decompose repair/remediation findings or validate explicit migration/refactor stages.
4. Select a dependency-ready task; use existing dependency order to break ties.
5. Generate a Phase 6 compiler fix, rename/refactor proposal, approved stage diff, or bounded model repair suggestion. Recheck scope, risk, proposal identity, and source validity.
6. Persist an existing Runtime checkpoint before entering execution.
7. Consult the existing Phase 5.5 coordinator's selected specialists, execute the bounded change Workflow, verify, and review.
8. Reobserve and continue within the original budgets, or pause for approval/recovery/escalation. Final verification evaluates every original acceptance check and documentation obligation.

## Planning and evidence

Goals specify exact workspace-relative files, allowed risk, batch-size limits, named checks, measurable acceptance criteria, compatibility checks, constraints, documentation files, and budgets. No scope expansion is inferred from a failing check. Explicit task dependencies form a validated DAG. Multi-file rename proposals remain atomic batches; they are not split into unsafe partial symbol edits merely to meet a file limit.

Repair/remediation decomposition groups findings by affected files and ranks severity, confidence, dependent impact, and effort. Staged migrations/refactors require explicit bounded stages because a title alone cannot establish compatibility transitions. Planner output retains evidence IDs, assumptions, constraints, affected files, and dependency impact. Evidence is refreshed each cycle; prior failed proposals are not repeatedly applied.

Performance and security providers are registered host adapters. Their findings must identify provider, indexed snapshot, observation time, evidence, severity, confidence, and effort. Provider failures remain visible, and missing required benchmark/security checkers block completion. The default system does not pretend to include a universal benchmark or vulnerability scanner.

## Models and specialists

The core accepts `EngineeringReasoner` and `EngineeringCheckRunner` interfaces. `createChatEngineeringReasoner` adapts a host text generator, including OpenAI, local, or future providers, to a strict diff-only response. The local HTTP composition root uses the existing Ollama adapter as a fallback after compiler fixes; runtime logic does not depend on Ollama. Provider requests and results respect cancellation. Source, memory, and logs are untrusted evidence. All generated changes cross the same validation and authorization boundary.

Phase 5.5's coordinator is reused. Architect and Refactorer consultations are selected from task risk/mode; Test Writer reviews write/verification obligations; Documentation Writer participates when documentation is required; Reviewer follows every bounded execution. Advice and provider/role provenance are checkpointed. Specialists provide recommendations, not independent writes. Documentation and test changes must be represented by executable scoped tasks. A review disagreement after otherwise verified execution pauses for user action; it never overrides a failed Validator result or changes acceptance criteria.

## Verification and recovery

Built-in named checks are typecheck, tests, lint, and build. Commands are fixed registrations executed in the explicit workspace. Benchmark/security checks require registered implementations. Results carry check identity, provider, measurement time, and optional metrics. Fresh results must meet the original criteria; quantitative checks compare against the captured baseline with an explicit regression allowance.

Before each write, the existing change validator and Workflow recheck fresh source and authorization. Abort signals now reach guarded patch execution and verification. Source changes during verification are checked against the authorized output; unrelated mutations force escalation rather than silently becoming the next trusted baseline. Generated TypeScript build-info files are excluded from workspace indexing so verification does not invalidate evidence with compiler cache churn.

Runtime checkpoints now retain engineering sessions: goal/approval, tasks, baselines, evidence, proposal identities, attempts, audit trail, role advice, and progress. A pre-execution in-flight marker prevents blind resume after a crash. Renewed approval may clear it only when fresh source matches the checkpoint. Changed source requires existing journal recovery or explicit replanning; verified partial stages are reported rather than called a completed migration. File checkpoints reject directory symlink escapes and use private, flushed temporary files before replacement.

The existing change journal owns before/after rollback. Failed verification restores only unchanged proposed output, preserving external edits. Journals and checkpoints are not an OS-wide transaction or distributed lock. Concurrent/partial writes can require manual recovery. Read-only baseline/final checkers are a host contract; unexpected source changes are detected, not silently reverted.

## Scheduling and boundaries

The existing Task Queue supports `engineering` jobs. They require `maxAttempts: 1`: a stopped task must be inspected/resumed explicitly rather than blindly replayed by queue retries. Queue cancellation is relayed through existing Runtime controls, including the start-up boundary. Existing lifecycle events are forwarded; observer failures remain isolated.

Markdown source is retained by the existing index for executable documentation obligations. Persisted index schema 3 invalidates older snapshots once; no parallel document index is introduced. Existing TS/JS/Markdown file replacement is supported. New-file/move refactors, arbitrary shell commands, externally visible publication, and irreversible external actions are not engineering operations and cannot be authorized by this API.

Phase 8 dashboards, continuous scheduling/learning, and ambient automation remain out of scope.
