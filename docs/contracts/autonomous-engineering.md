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

## Exact pending-proposal lifecycle (Phase 7)

Before the existing Runtime checkpoints a planned workflow, the task retains
`pendingProposal: { proposal: ChangeProposal, invalidatedReason?: string }`.
`ChangeProposal.id` is the SHA-256 digest of its full canonical proposal body:
its title, kind, origin, snapshot, exact before/after diff, and warnings. The
containing checkpoint retains the runtime ID, canonical workspace, task, goal,
scope/risk, approval, checks, acceptance criteria and budgets. No separate
proposal store is used.

Approval renewal keeps this proposal intact. Planning on resume selects the
persisted proposal without invoking a reasoner or rebuilding its diff. The
existing Validator and engineering authorization recheck its digest, snapshot,
before content, compiler validity, scope, risk, goal approval and expiry before
the existing reviewed change workflow executes it. That workflow still owns
verification, journaling and rollback. A rejected/stale proposal is invalidated;
renewing approval or restoring old bytes does not regenerate it. Explicit
replanning currently means starting a new, explicitly approved goal/runtime;
there is no in-place rejection/replan operation in this batch. Old awaiting
checkpoints without explicit pending state fail closed and require replanning.
A consumed attempt may still use the existing bounded repair policy; any new
proposal in proposal mode needs its own exact approval. Budgets are not reset.

`start`, `status` and `resume` reports add an optional typed `pendingProposal`
(`EngineeringPendingProposal`). It is present only for a paused runtime with a
valid, unconsumed task awaiting proposal approval, and has this JSON shape:

```ts
{
  runtimeId: string;
  taskId: string; // engineering task within the runtime
  proposal: {
    id: string; title: string; kind: "quickfix" | "rename" | "refactor";
    origin: string; snapshot: string;
    diff: { changes: { path: string; before: string; after: string }[] };
    warnings: string[];
  };
  digest: string; // identical to proposal.id; no second digest or authority
  workspace: string; // canonical configured workspace
  affectedPaths: string[];
  risk: { task: EngineeringRisk; required: EngineeringRisk; allowed: EngineeringRisk };
  scope: EngineeringGoal["scope"];
  taskFiles: string[];
  approval: { mode: "proposal" | "bounded"; goalDigest: string; proposalIds: string[] };
  checks: EngineeringCheck[];
  acceptance: EngineeringGoal["acceptance"];
  constraints: string[];
  obligations: string[];
  status: "awaiting_approval";
  reason: string;
}
```

The projection copies the checkpointed proposal directly. Status performs no
model call, diff generation, or authority creation. It describes the saved
snapshot, not a guarantee that the live workspace remains unchanged. Resume
performs fresh validation. To approve it, send the existing `resume` operation
with `taskId: pendingProposal.runtimeId` and an `EngineeringApproval` containing
that exact `approval.goalDigest` and `proposalIds`, plus the actual approver and
fresh issue/expiry timestamps. The response omits pending review authority when
completed, failed, cancelled, running, consumed, or invalidated. Existing report
fields and POST operations remain available. No Chat/FileViewer integration is
included.

## Visible Chat integration (A02)

The visible Chat sends text to the existing `/api/chat` adapter. Admission intent
is classified on the server, not in the UI. The typed `ChatResponse` discriminant
is `chat`, `unsupported`, or `engineering`. A governed handoff contains a
server-issued `taskId`, the bounded `EngineeringGoal` and its `goalDigest`; it
does not contain a generated patch. Chat's session transport uses these values
to call the existing `/api/engineering` `start` operation. The existing
EngineeringPlanner remains the only engineering proposal planner.

This admission path requires one to three explicitly named existing
workspace-relative TS/JS/Markdown files and at least one configured npm `test`,
`lint`, or `build` script. It selects those existing registered verification
operations; it never accepts arbitrary commands or infers a larger file scope.
New files, deletion, publication, dependency changes, unnamed/broader scope and
unavailable checks produce an unsupported response. Intent matching is
conservative and is not an authority boundary: the legacy Chat runner also
rejects mutating capabilities and verification plans before every workflow
attempt, including mutations labelled as reads. The existing B03 checks remain
unchanged. Model text is never interpreted by Chat as a writable patch.

`EngineeringSessionClient` is transport/view state owned by the page above the
Chat/File/Settings switch. It retains the authoritative runtime ID, latest
server report and transient request state; it creates no plans, persisted
runtime, checkpoint or approval store. Status polling occurs only during an
active request; manual refresh is available. Late status responses cannot
replace a newer command result. Duplicate approvals and approval of a different
or dismissed identity are refused locally, with server validation still
mandatory. Loss of transport is shown as unknown until status reconciles it;
no automatic start/resume or approval retry occurs.

Initial `start` uses proposal-mode approval with an empty proposalIds array.
Clicking **Approve this exact proposal** sends `resume` with exactly the A01
`goalDigest` and single proposal ID. Both approvals use `approvedBy: local-user`
and fresh five-minute timestamps, never bounded/global approval. The local
host/user remains the authentication boundary. The exact A01 before/after text
is passed directly into existing DiffView for presentation; IDs, warnings,
risk/scope and verification/acceptance requirements accompany the review.
Reports add `runtimeStatus`, `proposalInvalidated`, and `lastChangeOutcome` so
the UI does not guess success, invalidation or rollback from prose. Only a
verified report yields the completed-and-verified display.

**Decline / close review** uses existing `cancel`. Active cancellation requests
wait for the authoritative result. Paused checkpoints have no active control
handle, so the API returns `accepted: false`; the UI closes that review locally
and explicitly says the runtime remains paused, not cancelled. No resume,
source mutation or automatic replan occurs. Reopen refreshes the same runtime.
A new request may explicitly replace a dismissed paused review. Old checkpoints
remain available to the existing programmatic API; no parallel rejection store
or in-place replanning operation is introduced.

Pending engineering state survives view switching, with an Open review banner
outside Chat. General Chat history is still component-local (B08 remains out of
scope). Full page reload/navigation does not restore the session selector; the
server checkpoint remains durable and accessible by runtime ID. There is no
new history UI or client persistence layer.

Manual FileViewer editing continues to use the separate explicit filesystem
Save operation with B09 versions/conflicts and B01/B02 containment. Chat's
previous dormant direct-diff save branch is removed so it cannot become a
second autonomous mutation path. The engineering adapter now reuses the local
request guard, including normalized localhost/127.0.0.1 Host handling needed by
the visible application, and rejects configured-workspace overrides. Existing
POST operations and the A01 projection remain compatible.
