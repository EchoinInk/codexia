# Continuous Engineering — Phase 8.4

## Ownership

Phase 8.4 adds a conservative admission policy above the existing Phase 7 lifecycle. Workspace Intelligence observes; Engineering Insights orders attention; maintenance policy decides eligibility; the existing Task Queue schedules; the existing Runtime, Planner, Workflow, Executor, Validator, journal rollback, and Reporter retain their responsibilities. Insights remain advisory and never constitute approval or a writable proposal.

There is no second planner, executor, queue, Runtime, verifier, direct filesystem writer, or polling loop. Queue lifecycle events trigger another bounded observation only after a maintenance job reaches a terminal state.

## Lifecycle

1. Read the authoritative workspace snapshot and derive current insights.
2. Evaluate every insight using the typed, deterministic policy.
3. Admit at most one low-risk, one-file TypeScript diagnostic repair with direct current diagnostic evidence.
4. Create a bounded `EngineeringGoal` and server-owned approval representing the explicitly enabled maintenance policy.
5. Enqueue it as an existing `engineering` job with `maxAttempts: 1` and deterministic workspace/evidence identity.
6. Execute it through `createEngineeringRuntime`, reviewed-change Workflow, registered verification, and journal rollback.
7. Persist and expose the truthful terminal outcome; only the Phase 7 Reporter may describe verified completion.
8. Observe again only while enabled and not paused, and stop when no candidate remains eligible.

## Eligibility and authority

The default policy requires a current, clean, usable snapshot generated within five minutes; current, uncontradicted direct diagnostic evidence bound to that snapshot; error or warning severity; exactly one relative workspace file; low risk; an available bounded queue slot; and no existing task with the deterministic identity. The following are not eligible: stale, incomplete, unavailable, failed, historical, contradicted, or invalidated evidence; priority without direct diagnostic provenance; architecture/evolution/learning insights; directory or multi-file scope; higher risk; and duplicates.

Enabling the feature is an explicit local control action. Caller-supplied policy, workspace, approval, commands, checks, file scope, or proposal IDs are not accepted. Policy and approval construction remain server-owned. Higher-risk work is deferred for the existing explicit review path.

## B10 attempt-budget persistence

Queue schema 2 records `attemptBudget.limit`, `attemptBudget.consumed`, and the last consumption time beside compatibility counters. An attempt is consumed and atomically persisted before handler dispatch. Recovery validates equality between old and new counters. Complete schema-1 counters migrate conservatively; missing, corrupt, decreasing, over-limit, or contradictory evidence fails closed. An interrupted job whose final attempt was consumed becomes failed after restart rather than queued.

Engineering repair consumption now occurs in `prepareWorkflow`, before the Runtime's durable pre-execution checkpoint. The prior increment inside the Workflow created a crash window in which restart restored a lower count. Resume validates every persisted task counter before accepting renewed approval. Pause/resume, approval renewal, proposal reuse, and in-flight recovery retain the consumed count. A new attempt requires a new bounded operation, not a rehydrated copy.

Within one process, Runtime active-task guards and the queue's active-task map prevent concurrent consumption. The architecture still does not claim a distributed lock across independent hosts; separate processes must not operate the same workspace concurrently.

## Persistence, recovery, and idempotency

The existing queue store remains authoritative for scheduled work. Continuous-control state is the minimum additional durable state: enabled/paused/stopped status, snapshot identity, eligibility decisions, last outcome, and stop reason. It is workspace-scoped and atomically replaced under `.codexia/runtime/continuous-engineering.json`. Corruption fails closed.

Task IDs hash canonical workspace, snapshot/evidence identity, and policy version. Re-observing identical evidence cannot enqueue a duplicate, including after restart or completion. Historical evidence alone cannot reopen work. Source changes make the snapshot stale or trip the existing Phase 7 proposal/snapshot validation before execution.

## Stop and defer conditions

The controller stops or defers on no eligible work, non-current evidence, unsupported/risky scope, review requirement, a full queue, duplicate identity, disabled/paused state, budget exhaustion, cancellation, provider or persistence failure, stale proposal, verification failure, rollback conflict, or any terminal failure surfaced by the existing Runtime. Pause stops new admission; an already-running bounded task is allowed to reach its existing safe Runtime boundary. Cancel aborts the active queue task and disables further admission.

## Observability and API

`GET /api/engineering/continuous` returns persisted state, queue tasks, attempt budgets, current task, decisions, last outcome, snapshot identity, and stop reason. `POST` accepts only `enable`, `evaluate`, `pause`, `resume`, `disable`, and `cancel`. Existing local-origin and configured-workspace validation applies to mutations; callers cannot substitute workspace authority.

The Workspace Intelligence view adds a compact control/status panel. It does not redesign the Control Centre and never displays completion independently of the queue and existing engineering report outcome.
