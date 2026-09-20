# Changelog

This file records released Codexia milestones. The full implementation history
and architectural constraints remain documented in `docs/roadmap/phases.md` and
the documents under `docs/architecture/`.

## v0.8.6 — Phase 8.6: Platform and Integration Layer

Released from validated commit
`efb93588111202f034dba879f93d59d154245c4e`.

### Added

- A versioned in-process platform contract, with `1.0` as the supported version,
  deterministic capability discovery, compatibility checks, typed errors, and
  typed request/provider events.
- Workspace-scoped adapters for existing Intelligence reads, governed engineering
  requests, lifecycle reads and controls, and Reporter-owned outcomes.
- A provider abstraction for local, OpenAI, and custom model implementations that
  adapts to the existing engineering text-generator seam without coupling Runtime
  to a provider.
- Explicit resource limits, request timeouts, stable-request deduplication, and
  local/private data sharing by default. External sharing requires an explicit,
  bounded allow-list and never includes credentials or secrets.

### Security and authority

- Preserved the existing Phase 7 governance, planning, execution, validation, and
  reporting path for delegated engineering work; integration capabilities do not
  grant approval, mutation, verification, retry-budget, or Reporter authority.
- Enforced canonical workspace identity and isolation across clients, requests,
  and adapter results.
- Independent review hardened failure isolation and fail-closed behaviour for
  request-ID reuse, adapter receipts, lifecycle actions, timeouts, concurrent
  requests, and upstream error or secret leakage.

### Reliability

- Replaced a fixed-delay macOS workspace-watcher test assumption with
  condition-based synchronization. This retains path, rename/removal, workspace,
  and ordering assertions while accepting valid cross-directory notifications
  that arrive in separate debounce batches. Production behaviour was unchanged.
- Final validation passed lint, TypeScript checking, all 160 tests, production
  build, post-build TypeScript checking, and `git diff --check`.

### Scope

Phase 8.6 provides the integration contract and adapter seams. Transport-specific
IDE protocols, deployment authentication, provider credential acquisition, remote
configuration, plugin marketplace/ecosystem support, workspace federation, and
broader UI work remain future possibilities rather than released capabilities.

## v0.8.5 — Phase 8.5: Workspace Operations and Control Centre

- Added workspace lifecycle projections for queued, active, paused, completed,
  failed, and cancelled work.
- Added governed lifecycle controls while preserving the distinction between a
  requested action and an authoritative Runtime/Queue acknowledgement.
- Released from commit `5b6df9c568bcd781c11166c4b7285b592c196272`.
