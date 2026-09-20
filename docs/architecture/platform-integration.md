# Platform and Integration Layer — Phase 8.6

Phase 8.6 adds a thin, versioned boundary over existing Codexia capabilities. It is an adapter surface, not a new execution system. Phase 7 governance, Planner, Workflow, Executor, Runtime, Validator, and Reporter keep their existing authority. Phase 8.4 keeps queue scheduling and monotonic B10 attempt budgets. Phase 8.5 keeps lifecycle projections and the distinction between a requested control action and an authoritative acknowledgement.

## Contract and capabilities

Contract `1.0` is the only supported version. Negotiation selects it only when the client explicitly offers it; incompatible versions fail closed. Discovery returns a deterministic sorted subset of server-authorized capabilities, the canonical workspace, resource limits, and data-sharing policy.

The capability vocabulary is intentionally small:

- `intelligence.read` requests existing Workspace Intelligence evidence.
- `engineering.request` submits a request to a host adapter backed by the existing Phase 7 governed engineering entry point.
- `lifecycle.read` reads existing Phase 8.5 lifecycle state.
- `lifecycle.control` requests pause, resume, cancel, or retry through the existing lifecycle adapter.
- `reporter.read` reads an existing Reporter-owned outcome.

Capabilities permit requesting existing operations only. They do not grant approval, mutation, verification, Reporter, lifecycle, queue, or budget authority. There is no approval capability and no direct filesystem or Executor adapter. Unknown capabilities, unauthorized capabilities, and invalid requests fail closed.

## Workspace identity and isolation

The service canonicalizes its authorized workspace once. Client connection, every operation, and every adapter result must match that identity. Alias paths resolve to the same canonical identity; substitution with another workspace is rejected. Boundary request/response size, concurrency, and timeout limits are positive, bounded, and can only be narrowed by a client.

Stable engineering request IDs are deduplicated before dispatch, including concurrent duplicates. This prevents an integration retry from creating a second engineering execution. The boundary neither reads nor writes queue retry counters. Exhausted and restarted Phase 8.4 tasks therefore remain governed by the existing persisted B10 attempt budget.

## Existing authority paths

Host wiring supplies narrow adapters for Intelligence, governed engineering admission, lifecycle operations, and Reporter reads. The engineering adapter must enter through the existing governance/Planner/Workflow/Runtime/Executor/Validator/Reporter path as applicable. A receipt means only that a request was accepted; it is not approval, mutation, verification, or a successful outcome.

Lifecycle control returns the existing Phase 8.5 result unchanged. `requested` records intent, while `acknowledged` and the refreshed projection come from the authoritative Runtime/Queue source. Reporter reads return only existing outcomes. Missing Intelligence evidence and missing Reporter outcomes produce typed `EVIDENCE_UNAVAILABLE` errors; the integration layer never synthesizes evidence.

## Providers and failure isolation

`ModelProvider` supports `local`, `openai`, and future `custom` implementations behind the existing `EngineeringTextGenerator` seam. The adapter converts a provider into that existing generator, so Runtime is provider-blind. A provider failure becomes a typed retryable `PROVIDER_UNAVAILABLE` error and cannot add capabilities or mutation authority.

Integration errors have stable codes and retryability. Events describe request acceptance, completion, or failure using codes only. Provider response bodies, stacks, credentials, authorization headers, tokens, secrets, and cookies are not copied into discovery, errors, or events.

## Local-first data sharing

The default policy is `{ mode: "local", allowed: [], maxBytes: 0 }`. Source, prompts, diagnostics, reports, and evidence are never silently shared. External sharing must be configured explicitly with an allow-list and maximum bytes; each request can only narrow that configured envelope. Secrets and credentials are never shareable data kinds.

## Limitations

Phase 8.6 defines the in-process contract and provider adapter seam. Deployment authentication, transport-specific IDE protocols, OpenAI credential acquisition, remote service configuration, and UI redesign remain host responsibilities. The layer does not add a plugin marketplace, remote workspace federation, new engineering operations, or a second lifecycle.
