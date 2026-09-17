# Autonomous Engineering Contracts

## Public interfaces

`createEngineeringRuntime(workspace, options?)` returns:

- `preview(goal)`: validates scope, gathers fresh evidence, and returns `goalDigest`, evidence, and decomposed tasks without running verification commands or writing source.
- `start(goal, approval, taskId?)`: starts the existing Runtime with domain policies; returns a normal `RuntimeResult`.
- `resume(taskId, approval?)`: resumes a paused checkpoint. Renewed approval must match the original goal, and fresh source must match its last trusted snapshot. A running checkpoint left by interruption requires explicit renewed approval and revalidation.
- `pause(taskId, reason?)`, `cancel(taskId, reason?)`: existing Runtime controls.
- `checkpoint(taskId)`: latest durable state.
- `subscribe(listener)`: existing typed Runtime lifecycle events.

Options register a reasoning provider, verification runner, finding providers, specialist/reviewer implementations, checkpoint store, and index adapter. Default persistence/index/verification use existing Codexia subsystems. Test substitutes are trusted host adapters, not serialized model tools.

## Goal and approval

`EngineeringGoal` requires:

- Title and mode: repair, remediation, migration, or refactor.
- Exact scoped files, maximum files per batch, and maximum risk.
- Named checks and acceptance criteria referencing those check IDs.
- Compatibility checks that every stage must run even when a stage has narrower checks.
- Constraints and documentation file obligations.
- Positive iteration, repair-attempt, timeout, and no-progress budgets.
- Optional explicit task DAG and architecture options.

Tasks carry files, dependencies, evidence IDs, risk, obligations, and an operation: repair, rename, refactor, existing-file patch, or verify. Migration/refactor goals require explicit stages. Runtime never weakens acceptance or infers a broader scope from a failure. High-risk model/explicit-patch changes require matching risk authorization; cross-file or non-quick-fix compiler changes have at least medium risk.

`EngineeringApproval` binds the goal digest, approver, issue/expiry times, mode, and exact proposal IDs where applicable. `proposal` mode pauses until each generated patch is reviewed. `bounded` mode authorizes future validated proposals only within the exact goal scope, risk, and batch limits. Digests detect content identity; they are not authentication credentials. The embedding host must authenticate the user and obtain actual approval. A role or model cannot create authority by returning an approval-shaped object.

Constraints expressed only as prose remain planner/reviewer guidance. Encode enforceable compatibility requirements as named checks. A goal title is not itself a proof of semantic completion.

## Findings, verification, and outcomes

Finding providers must identify the current snapshot, files, provider, source evidence, severity, confidence, effort, and an observation no older than five minutes. Stale/invalid providers are reported as failures. Missing performance/security scanners are not represented as clean findings.

Check results must be fresh for their invocation, unique per required check, and identify a provider. Benchmark/security metrics require a reproducible before value and a finite after value; an explicit direction and allowed regression percentage govern acceptance. Failed or missing checks cannot be overridden by Reviewer approval.

The report links goals, approvals, task states, provider evidence, plans, proposal digests, journals, checkpoints, verification, and review. Outcomes distinguish verified work from paused, cancelled, failed, unsupported, deferred, and residual work. A finding is marked resolved only when absent from fresh same-provider evidence after final acceptance succeeds; this remains limited to provider coverage.

## HTTP adapter

POST `/api/engineering` accepts JSON:

- `{ "operation": "preview", "goal": ... }`
- `{ "operation": "start", "goal": ..., "approval": ..., "taskId": "optional-safe-id" }`
- `{ "operation": "status", "taskId": "..." }`
- `{ "operation": "pause" | "cancel", "taskId": "..." }`
- `{ "operation": "resume", "taskId": "...", "approval": ... }`

`start` and `resume` await the bounded runtime result. Other requests can query checkpoints or request controls while it runs. The local adapter retains one Runtime wrapper per workspace and rejects concurrent starts on that wrapper. Durable checkpoints survive process restart; observers and active control handles do not. Invalid input returns 400; missing status returns 404; mismatched browser origins return 403. This is a local integration surface, not an authenticated public service. The HTTP adapter marks the existing workspace index dirty after completion.

The local HTTP surface supplies the configured Ollama reasoner. Host integrations can instead supply `createChatEngineeringReasoner(providerId, generator)` for OpenAI or another provider. No live remote-model call is required by the regression tests. Benchmark/security checkers and external finding providers are configured in-process, not supplied as executable code in requests.

## Queue adapter

Enqueue the existing queue with type `engineering`, `maxAttempts: 1`, and payload `{ goal, approval }`. The job's runtime ID is `engineering-<queue-task-id>`. A noncompleted Runtime is reported as a failed queue job with its runtime ID for inspection; it is never silently restarted as a fresh migration. Use explicit checkpoint resume after reviewing its state.
