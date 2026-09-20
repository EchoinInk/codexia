# Codexia Roadmap

Updated from the verified `v0.8.5` release baseline
(`5b6df9c568bcd781c11166c4b7285b592c196272`). Phase 8.5 is complete and was
released in `v0.8.5`; Phase 8.6 is implemented with user acceptance pending.

## Roadmap Status Philosophy

Phase completion represents achievement of the intended architectural milestone.

A completed phase may still contain:

- future enhancements
- deeper integrations
- performance improvements
- additional product polish

These do not reopen a completed phase unless the original milestone objectives were not achieved.

---

## ✅ Phase 0 — Foundation Refactor

Status: Complete

- Repository structure
- Agent architecture foundation
- Tool registry
- Filesystem sandbox
- Configuration layer
- Model abstraction
- Context system

---

## ✅ Phase 1 — Autonomous Agent

Status: Complete

### Planner

- Rule planner
- LLM planner
- Hybrid planner
- Planner validation
- Planner fallback

### Executor

- Tool execution
- Retry manager
- Repair planner
- Verification pipeline
- Patch validator

### Workflow

- Progress tracking
- Reports
- Audit
- Observations
- Change summaries

---

## ✅ Phase 2 — Workspace Intelligence

Status: Complete

### ✅ 2.1 File Intelligence

Status: Complete

- Workspace indexing
- File analysis
- Code parsing
- Symbol extraction
- Dependency graph
- Relationship graph

### ✅ 2.2 Planning Intelligence

Status: Complete

- File targeting
- Impact analysis
- Workspace intelligence context
- Symbol-aware planning
- Dependency-aware planning

---

## ✅ Phase 3 — Professional Developer Workflow

Status: Complete

- Git-aware workflow
- Validation
- Verification
- Reporting
- Failure analysis
- Retry strategy
- Repair planning
- Execution summaries
- Audit metrics

---

## ✅ Phase 4 — Runtime Intelligence

Status: Complete

Codexia evolves from a “planner that executes” into an intelligent coding runtime.

---

## ✅ 4.1 Deep Code Intelligence

Status: Complete

- AST parser abstraction
- Symbol database
- Relationship graph
- Cross-file intelligence
- Workspace semantic context

---

## ✅ 4.2 Advanced Planning Intelligence

Status: Complete

- Multi-file planning
- Intelligent file selection
- Dependency-aware edits
- Workspace reasoning

---

## ✅ 4.3 Professional Workflow

Status: Complete

- Verification pipeline
- Git workflow
- Execution reports
- Validation
- Retry system

---

## ✅ 4.4 Workspace Intelligence Runtime

Status: Complete

### ✅ 4.4.1 Workspace Cache

Status: Complete

- Workspace cache
- Cache manager
- Multi-workspace support
- Cache invalidation
- Cache lifetime
- Context integration

### ✅ 4.4.2 Incremental Workspace Indexing

Status: Complete

- File fingerprints
- Workspace fingerprints
- Index diffing
- Cache entries
- Incremental index updates
- Cached index reuse
- Change detection
- Workspace-aware indexing

### ✅ 4.4.3 Smart Incremental Refresh

Status: Complete

Goal:

Avoid rebuilding the complete workspace index when only a subset of files has changed.

Flow:

- scan
- detect changed files
- re-analyse changed files
- reuse everything else

Features:

- Fingerprint comparison
- Incremental rebuild
- Cached file reuse
- Changed-file analysis
- Added file analysis
- Removed file cleanup
- Index merging

### ✅ 4.4.4 File Watching

Status: Complete

- fs.watch
- Live workspace cache

### ✅ 4.4.5 Background Indexing

Status: Complete

Flow:

- User asks
- Agent replies immediately
- Background worker updates index

Features:

- Background index refresh queue
- Non-blocking cached index reuse
- Stored index hydration
- Watcher-triggered background refresh
- Background refresh status tracking

### ✅ 4.4.6 Memory-aware Workspace Intelligence

Status: Complete

- Frequently edited files
- Commonly opened files
- Recent modifications
- Project hotspots
- Developer habits

---

## 🚧 Phase 5 — Agent Runtime

Status: Complete

### ✅ 5.1 Long-running Tasks

Status: Complete

- Runtime controller above the bounded workflow
- Task runtime lifecycle state
- Runtime context across iterations
- Durable checkpoints and resume
- Continuation and retry policy
- Pause and cancellation controls
- Timeout and iteration limits
- Runtime lifecycle events
- Runtime metrics and progress
- Runtime configuration and error handling
- observe → plan → execute → verify → checkpoint → continue

### ✅ 5.2 Task Queue

Status: Complete

- Durable task queue state
- Priority scheduling
- Configurable concurrency
- Bounded retries
- Safe cancellation
- Queue lifecycle events
- Queue metrics
- build
- tests
- lint
- documentation
- indexing

### ✅ 5.3 Event System

Status: Complete

- Typed workspace file-change events
- Agent/runtime notification boundary
- Dependency-aware impact reasoning
- Existing workspace activity memory updates
- Per-workspace serial event processing
- Event history and status
- Event metrics
- Observer isolation and safe error handling

### ✅ 5.4 Workspace Memory

Status: Complete

- Durable semantic project memory
- architecture
- coding style
- preferred patterns
- previous failures
- previous fixes
- Activity-memory schema migration
- Bounded semantic retention and deduplication
- Failure-to-fix relationships
- Runtime failure/fix learning adapter
- Intelligence-context integration

### ✅ 5.5 Multi-Agent Runtime

Status: Complete

- Planner
- Executor
- Reviewer
- Architect
- Refactorer
- Test Writer
- Documentation Writer

---

## ✅ Phase 6 — IDE Intelligence

Status: Complete

Extend the existing workspace index, symbol database, relationship graph, and
incremental indexing systems. Keep Intelligence responsible for workspace
understanding and preserve the Planner, Executor, Workflow, Validator, and
Reporter boundaries.

### ✅ 6.1 Semantic Navigation and Symbol Search

Status: Complete

- Workspace-wide symbol index
- Exact and fuzzy symbol search
- Definition lookup
- Reference lookup
- Implementation lookup
- Symbol hierarchy and relationships
- File and source-location navigation
- Incremental index compatibility

Current implementation covers the read-only Intelligence and HTTP API scope:

- Workspace symbol search: exact, prefix, fuzzy, and filters
- Document symbols, lexical containers, and source ranges
- Compiler-resolved definitions, references, and implementations
- Existing workspace index, incremental refresh, and persistence integration
- Versioned persisted snapshots with legacy rebuild

See `docs/architecture/ide-intelligence.md` and
`docs/contracts/semantic-navigation.md` for supported behavior and limits.
Symbol hierarchy and navigation are exposed through semantic data and source
locations within those documented limits. Editor UI integration is not part of
this implementation.

### ✅ 6.2 AI Diagnostics and Code Actions

Status: Complete

- Structured diagnostic model
- Diagnostic providers
- Workspace-aware explanations
- Suggested fixes
- Safe code-action generation
- Validation before application

### ✅ 6.3 Refactoring and Rename Engines

Status: Complete

- Refactoring contracts
- Rename planning across references
- Conflict and scope detection
- Patch generation
- Verification and rollback boundaries

### ✅ 6.4 Dead Code and Architecture Analysis

Status: Complete

- Unused symbols and exports
- Unreachable modules
- Dependency anomalies
- Layer-boundary violations
- Architecture findings and reports

---

## ✅ Phase 7 — Autonomous Engineering

Status: Complete

**Release baseline:** `v0.8.0`  
**Release commit:** `6793b0d`  
**Release name:** Phase 7 — Autonomous Engineering

Use Phase 6 navigation, diagnostics, code actions, refactoring contracts, and
architecture findings as inputs to autonomous engineering reasoning and
execution. Extend the existing Agent Runtime above the Workflow rather than
introducing another execution lifecycle or reimplementing analysis engines.

Planning determines what should happen; execution performs actions; Workflow
coordinates each bounded execution lifecycle; validation confirms correctness;
reporting explains outcomes. The Runtime owns continuation across cycles.
Intelligence supplies workspace understanding. Reasoning remains model-provider
independent, supporting OpenAI, local models, and future providers.

### ✅ 7.1 Autonomous Engineering Planner

Status: Complete

- Decompose authorised engineering goals into bounded tasks with dependencies and explicit scope
- Define acceptance criteria, verification requirements, and measurable completion conditions
- Select and prioritise tasks using Phase 6 findings, workspace context, and provenance-backed memory
- Assess affected symbols, files, dependants, architecture boundaries, and change risk through existing Intelligence
- Extend existing Planner contracts with evidence, assumptions, constraints, and escalation conditions
- Revise plans when evidence changes, while leaving execution and continuation to the existing Workflow and Runtime

### ✅ 7.2 Autonomous Repair and Recovery

Status: Complete

- Investigate build, test, lint, and type-check failures using structured verification results and Phase 6 diagnostics
- Correlate failure evidence with affected code and remembered failure/fix relationships
- Extend existing repair planning with bounded repair loops, retry budgets, time limits, and no-progress detection
- Replan from Validator evidence after each bounded Workflow cycle without weakening acceptance criteria
- Recover through existing Runtime checkpoints and approved rollback boundaries; revalidate workspace state before resuming
- Escalate ambiguous failures, exhausted budgets, repeated regressions, and changes outside authorised scope

### ✅ 7.3 Migration and Large-Scale Refactor Orchestration

Status: Complete

- Create staged migration and refactoring plans with compatibility constraints and explicit completion criteria
- Sequence cross-file and cross-module changes using existing dependency, reference, and impact analysis
- Consume Phase 6 refactoring and rename contracts for scope checks, conflicts, and patch generation
- Apply bounded change batches through the existing Workflow and Executor with verification between stages
- Use existing Runtime checkpoints and Git/patch capabilities for approved rollback, interruption, and safe resume
- Track partial migrations, remaining dependencies, and documentation updates without declaring incomplete transitions successful

### ✅ 7.4 Technical Debt, Performance, and Security Remediation

Status: Complete

- Consume existing diagnostic, architecture, dead-code, performance, and security provider findings with source provenance
- Prioritise remediation by severity, confidence, engineering impact, dependency risk, and estimated effort
- Produce scoped remediation plans through the existing Planner using Phase 6 code-action and refactoring capabilities
- Establish reproducible baselines and acceptance criteria, including targeted tests, benchmarks, or security checks as appropriate
- Apply approved changes through the existing execution pipeline and compare verification evidence against the baseline
- Record resolved, deferred, unsupported, and residual findings with rationale and evidence limits

### ✅ 7.5 Multi-Agent Engineering Orchestration

Status: Complete

- Extend the Phase 5.5 coordinator for Planner, Executor, Reviewer, Architect, Refactorer, Test Writer, and Documentation Writer roles
- Select and sequence specialist consultations according to task scope, risk, and required evidence
- Preserve typed advice and review handoffs through the existing context and coordination contracts
- Keep the existing Planner as the sole executable-plan author and Workflow/Executor as the workspace action path
- Coordinate implementation, testing, and documentation obligations through executable plans; specialists do not independently mutate the workspace
- Route review findings and disagreements into bounded Runtime replanning or user escalation without overriding Validator results
- Reuse existing task scheduling, cancellation, lifecycle events, and resource limits for coordinated engineering work

### ✅ 7.6 Autonomous Engineering Governance and Reporting

Status: Complete

- Enforce explicit approval boundaries for task scope, risk, tool actions, and externally visible or irreversible changes
- Apply existing runtime budgets, workspace isolation, pause/cancel controls, and escalation policies across engineering cycles
- Preserve audit trails linking goals, evidence, plans, approvals, patches, checkpoints, and verification outcomes
- Record provider and role provenance, workspace versions, assumptions, and evidence freshness for traceable decisions
- Produce Reporter-owned outcome reports covering acceptance criteria, changes, verification evidence, and recovery actions
- Distinguish verified outcomes from attempted, deferred, failed, or unverified work and identify unresolved risks
- Require explicit authorisation for scope expansion and retain user control over continuation and completion

Implementation contracts and limits: see `docs/architecture/autonomous-engineering.md`,
`docs/contracts/autonomous-engineering.md`, and `docs/operations/autonomous-engineering.md`.
Existing-file TS/JS/Markdown changes are supported. Migration/refactor stages are explicit;
missing performance/security providers and unsupported operations escalate.

### Phase 7 Release Validation

Phase 7 was released as `v0.8.0` after final reliability, governance, dependency,
and clean-install validation.

Release validation:

- Clean dependency installation: PASS
- Lint: PASS
- TypeScript: PASS
- Tests: 97/97 PASS
- Production build: PASS
- Git diff validation: PASS
- Working tree: clean
- Main branch and remote release baseline verified

Dependency security remediation reduced the release dependency findings while
preserving the validated application baseline.

One upstream dependency exception remains:

- `next@15.5.25 → postcss@8.4.31`
- The nested PostCSS dependency is exact within the supported Next.js release.
- No unsupported dependency override is used.
- Codexia does not currently expose attacker-controlled CSS to this processing path.
- The dependency must be reassessed when a supported Next.js release resolves it,
  or before Codexia introduces untrusted CSS, theme, or build-pipeline processing.

### Deferred Engineering Constraints Carried into Phase 8

The following findings do not reopen Phase 7 but must be addressed before the
relevant Phase 8 capabilities depend on them:

**B11 — Workspace watcher debounce and change identity**

- Carried into Phase 8.1.
- Resolve before relying on event-driven live workspace intelligence.
- Coalescing repeated filesystem notifications must preserve the identities of
  changed, added, removed, and otherwise relevant files.
- Debouncing must not turn a known file-change event into an ambiguous generic refresh.

**B10 — Queue restart and attempt-budget handling — COMPLETE (Phase 8.4)**

- Resolved in Phase 8.4 with durable monotonic queue and engineering repair-attempt consumption.
- Resolve before autonomous/background continuous engineering is enabled.
- Queue restart and recovery must preserve consumed attempt/retry budgets.
- Restart or resume must not silently reset bounded execution authority.
- Continuous engineering must inherit existing Runtime and governance limits
  rather than creating an independent retry lifecycle.

---

## 🚧 Phase 8 — Continuously Intelligent AI Workspace

Status: Ready to begin

**Starting baseline:** `v0.8.0` (`6793b0d`)

Integrate the existing indexing, event, memory, and runtime foundations with
Phase 6 intelligence and Phase 7 autonomous engineering into a continuously
intelligent workspace and platform layer. Consume existing analysis and
execution capabilities rather than rebuilding them.

Phase 8 owns workspace presentation, integration, and policy-controlled entry
points into existing capabilities. Intelligence owns workspace understanding;
Planner determines what should happen; Executor performs approved actions;
Workflow coordinates each bounded execution lifecycle; Validator confirms
correctness; Reporter explains outcomes. Runtime remains above Workflow and
owns continuation, checkpoints, and interruption across cycles.

Platform views, schedulers, and integrations must preserve these boundaries and
must not introduce:

- a second engineering planner
- a parallel workspace mutation path
- a second verification system
- an integration-specific execution lifecycle
- presentation state with authority over Runtime or Validator state

### ⏳ 8.1 Live Workspace Intelligence

Status: Ready — not started

Goal:

Turn the existing workspace intelligence foundations into a continuously
updated, trustworthy, read-only view of the current workspace without creating
another analysis or engineering lifecycle.

#### Prerequisite — B11 Watcher Hardening

Before live event-driven workspace intelligence is considered reliable:

- Fix watcher debounce/change-identity handling.
- Preserve changed-file identities while coalescing repeated filesystem events.
- Preserve added, changed, removed, and relevant rename/replacement information.
- Ensure coalescing cannot silently convert known file changes into an ambiguous refresh.
- Keep refresh work bounded through existing queues and resource controls.
- Add regression coverage for burst changes, repeated events, multiple changed files,
  removals, and watcher-triggered incremental refresh.

#### Live Workspace Intelligence

- Present a unified workspace view of architecture, dependencies, diagnostics, findings, and engineering activity
- Consume existing Phase 6 analysis and navigation contracts with links to supporting symbols, files, and source locations
- Coordinate event-driven refresh through existing workspace events, cache invalidation, and incremental indexing
- Integrate continuous background indexing with non-blocking reads, refresh status, and explicit snapshot freshness
- Coalesce repeated change notifications and bound refresh work through existing queues and resource controls
- Surface stale, incomplete, unavailable, and failed analysis distinctly without presenting cached evidence as current
- Keep workspace understanding in Intelligence and expose read-only projections without triggering unapproved engineering work

#### 8.1 Architectural Constraints

- Intelligence remains the authority for workspace understanding.
- Existing Phase 6 analysis engines are consumed rather than reimplemented.
- Workspace events trigger refresh/invalidation, not autonomous mutation.
- Background indexing remains non-blocking.
- Every presented intelligence snapshot must expose freshness or availability state.
- Stale evidence must never be presented as current evidence.
- Live workspace views remain read-only.
- Any engineering action originating from the workspace view must enter the
  governed Phase 7 engineering request path.

### 8.2 Project Evolution and Learning

Status: Future — not started

- Track project history across workspace revisions, architecture changes, findings, decisions, and engineering outcomes
- Link decisions and findings to source evidence, affected workspace versions, plans, approvals, and verification results
- Extend existing durable workspace memory with provenance, retention, deduplication, correction, and invalidation controls
- Distinguish observations, proposed explanations, failed attempts, and verified outcomes in stored project knowledge
- Learn reusable failure/fix relationships and project patterns from Validator-confirmed outcomes through existing Runtime memory adapters
- Expose relevant history through existing Intelligence context while preserving workspace isolation and local-first persistence
- Keep remembered outcomes advisory; historical success must not bypass current planning, policy checks, or verification

### 8.3 Engineering Insights and Prioritisation

Status: Future — not started

- Aggregate architecture, dependency, diagnostic, activity, and verified outcome evidence into engineering insight views
- Track trends, change hotspots, dependency risk, recurring failures, technical debt, and unresolved diagnostics over time
- Attach source provenance, freshness, confidence, and coverage limits to insights and avoid unsupported risk claims
- Suggest priorities using severity, impact, recurrence, dependency exposure, and estimated effort with explainable rationale
- Measure outcomes against recorded baselines, including verified resolution, recurrence, regressions, and deferred work
- Feed evidence and suggested priorities into the Phase 7 Planner; keep executable planning and remediation in Phase 7
- Present Reporter-owned outcome summaries separately from analytical estimates and unverified suggestions

### 8.4 Autonomous Maintenance and Continuous Engineering

Status: Implemented — user acceptance pending

#### Prerequisite — B10 Queue Restart and Attempt-Budget Hardening

Before recurring or event-triggered autonomous engineering is enabled:

- Fix queue restart/attempt-budget handling.
- Preserve consumed retry and attempt budgets across restart, checkpoint recovery, and resume.
- Ensure restart cannot grant additional execution attempts.
- Preserve cancellation, timeout, iteration, and resource limits across recovery.
- Add regression coverage for restart after failure, retry exhaustion, interruption,
  cancellation, and resumed queued work.
- Keep Runtime as the authority for continuation and bounded execution.

#### Autonomous Maintenance and Continuous Engineering

- Configure policy-controlled recurring maintenance, documentation, testing, and review work with explicit workspace scope
- Translate authorised schedules and event triggers into bounded Phase 7 engineering requests through existing task queues
- Reuse Phase 7 planning, repair, migration, remediation, specialist coordination, governance, and reporting capabilities
- Bound automation with concurrency, time, iteration, retry, and resource budgets plus no-progress escalation
- Prevent duplicate or overlapping runs and revalidate workspace state, evidence freshness, and applicable approvals before execution
- Delegate continuation, checkpoints, pause, cancellation, and recovery to Runtime above the bounded Workflow
- Retain explicit approval and scope-expansion controls; recurring triggers do not grant broader engineering authority
- Record each scheduled run and its verified, failed, deferred, or interrupted outcome through existing audit and reporting contracts

### 8.5 Workspace Operations and Control Centre

Status: Complete — released in `v0.8.5`

- Provide a unified view of queued, active, paused, completed, failed, and cancelled work across authorised workspaces
- Show task dependencies, progress, budgets, checkpoints, pending approvals, and verification evidence from existing lifecycle state
- Route approval, pause, resume, cancellation, and interruption controls through existing governance, queue, and Runtime contracts
- Distinguish requested control actions from acknowledged state transitions and explain recovery or resume requirements
- Support notification preferences for meaningful progress, completion, failures, and required developer action
- Coordinate multi-workspace lifecycle visibility, isolation, concurrency, and resource allocation through existing runtime controls
- Expose audit history and Reporter-owned outcomes without letting presentation state override execution or Validator results

### 8.6 Platform and Integration Layer

Status: Implemented — user acceptance pending

- Define provider-independent interfaces for IDE clients, tools, model providers, and workspace platform APIs
- Extend existing model abstractions to support OpenAI, local models, and future providers without coupling Runtime to a provider
- Establish versioned extension and integration contracts with capability discovery, compatibility rules, and typed errors and events
- Expose existing Intelligence queries, engineering requests, lifecycle controls, and reports through stable workspace-scoped APIs
- Enforce workspace identity, isolation, scoped permissions, and resource limits at every integration boundary
- Route external engineering requests through Phase 7 governance, Planner, Workflow, and Executor rather than allowing integration-specific mutation paths
- Preserve local-first operation and explicit data-sharing controls for integrations that communicate with external services
- Verify contract compatibility and adapter failure isolation without introducing a parallel execution or verification lifecycle

---

## ⏳ Current Development Focus

Current focus:

**Phase 8.6 — Platform and Integration Layer**

Status: Implemented — user acceptance pending

Starting baseline:

`v0.8.5` (`5b6df9c568bcd781c11166c4b7285b592c196272`)

Authority boundary:

Provider-independent requests reuse Phase 7 governance and reporting, Phase 8.4
B10 attempt budgets, and Phase 8.5 lifecycle projections. Integration
capabilities never grant those authorities.

---

## ⏳ Current Progress

Phase 0  [████████████████████] 100%  
Phase 1  [████████████████████] 100%  
Phase 2  [████████████████████] 100%  
Phase 3  [████████████████████] 100%  
Phase 4  [████████████████████] 100%  
Phase 5  [████████████████████] 100%  
Phase 6  [████████████████████] 100%  
Phase 7  [████████████████████] 100%

Phase 8  [████████████████████] 100% — 8.6 implemented; acceptance pending

- 8.1 Complete
- 8.2 Complete
- 8.3 Complete
- 8.4 Complete
- 8.5 Complete — released in `v0.8.5`
- 8.6 Implemented — user acceptance pending

---

## Phase 8 Implementation Order

1. **8.1 — Live Workspace Intelligence**
   - Resolve B11
   - Establish trustworthy event-driven refresh
   - Add snapshot freshness and availability state
   - Expose unified read-only workspace intelligence

2. **8.2 — Project Evolution and Learning**
   - Add durable project-history relationships
   - Strengthen provenance, correction, retention, and invalidation
   - Learn only from Validator-confirmed outcomes

3. **8.3 — Engineering Insights and Prioritisation**
   - Aggregate verified workspace evidence
   - Track trends, hotspots, recurring failures, and technical debt
   - Feed explainable priorities into the existing Phase 7 Planner

4. **8.4 — Autonomous Maintenance and Continuous Engineering**
   - Resolve B10 before autonomous background engineering
   - Introduce policy-controlled recurring/event-triggered requests
   - Reuse Phase 7 engineering governance and Runtime continuation

5. **8.5 — Workspace Operations and Control Centre**
   - Present lifecycle state across workspaces
   - Expose governed approval and runtime controls
   - Surface checkpoints, verification, failures, and recovery state

6. **8.6 — Platform and Integration Layer**
   - Stabilise workspace-scoped APIs
   - Add provider-independent integration contracts
   - Preserve local-first isolation and Phase 7 execution boundaries
