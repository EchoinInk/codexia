# Control Centre gateway integration audit

## Scope

This audit compares the hosted `codexia-control-centre` implementation with the
Phase 6 Codexia repository baseline. The hosted gateway remains available for
Sites; the real application defaults to `CodexiaWorkspaceGateway`.

## Fixture imports

The hosted implementation imported `fixtures.ts` from:

| File | Imported values | Integration outcome |
| --- | --- | --- |
| `lib/control-centre/gateway.ts` | `initialSession` | Retained only for hosted fallback and safe client-side merge defaults. |
| `components/control-centre/WorkspaceProvider.tsx` | `initialSession` | Retained only as an initial render shape while the real session and snapshot load. |
| `components/control-centre/IDEWorkspace.tsx` | `editorContent`, `fileTree` | Removed from the real application. The real IDE uses the existing `FileTree` and `FileViewer` components and filesystem routes. |

No real filesystem, Git, index, memory, checkpoint, task-history, or event result
is read from `fixtures.ts`.

## Hosted hard-coded values

The hosted implementation contained the following repository-derived fixture
values:

- Repository: `EchoInInk/codexia`
- Branch: `main`
- Phase: `Phase 6 · IDE Intelligence`
- Workspace health: `98`
- Indexed files: `298`
- Modules: `74`
- Symbols: `1,842`
- Architecture score/context load: `94`
- Memory: `Loaded`, including the label `143 memories`
- Knowledge graph: `Updated` / `Current`
- Runtime: `paused`, checkpoint `3`
- Agent labels and work counts: Planner `4 tasks`, Builder `6 tasks`,
  Reviewer `6 checks`, Observer `Live`
- Verification: `42 verification checks passed`
- Recent change files and counts:
  `runtime-intelligence.ts +99`, `model-index.ts -11`,
  `tests/unit.spec.ts -21`, `workspace-cache.ts +8`
- Mission: `Semantic navigation`, fixed five-stage progress, estimated `18m`
- Activity timestamps: fixed `09:42` and generated `09:38`, `09:33`, etc.
- Architecture drawer: `298 files`, `1,842 symbols`, `Stable`
- AI activity percentages: Planning `83`, Reading `92`, Verification `74`,
  Monitoring `72`

The real application now replaces repository name, branch, Git state, indexed
file count, symbol count, memory status, relationship/graph status, file
contents, and architecture metrics with gateway results. Phase, product health,
AI progress percentages, mission copy, mission stages, and estimated completion
remain presentation/session fields because this baseline exposes no concrete
phase, health-scoring, mission lifecycle, or AI-progress service.

## Hosted terminal responses

The hosted provider previously returned:

- `npm run verify` →
  `✓ Hosted demo verification complete — planner, task queue and workspace index fixtures passed.`
- `git status` →
  `Hosted demo: main · 3 simulated changes. Open Changes to inspect the fixture diff.`
- Any other command →
  `Hosted preview: “<command>” was not executed because Sites cannot access your local shell. The command was captured safely.`

These responses remain confined to `HostedWorkspaceGateway`. The real gateway
returns HTTP `501` with an explicit missing-service result because this baseline
has no general terminal execution service.

## Hosted-only state mutations

The hosted `WorkspaceProvider` mutated the following state without calling a
Codexia service:

- Runtime resume and pause
- Mission completion and verification result
- Terminal history and simulated terminal output
- Git change count after mission completion
- Workspace health after mission completion
- Codier runtime and completion messages
- Activity events for runtime, terminal, and mission actions

The following remain local UI/session mutations by design and do not represent
repository operations:

- Control Centre ↔ IDE mode
- Active Control Centre panel
- Active IDE tool
- Editor tab selection and close
- Expanded file-tree folders
- Bottom-panel visibility

Runtime and mission actions now call the gateway first. UI state changes only
after a real result, or displays the concrete error returned by the service.

## Gateway boundary

`WorkspaceGateway` now defines:

- `loadActiveRepository`
- `detectCurrentBranch`
- `restoreWorkspaceSession`
- `persistWorkspaceSession`
- `listWorkspaceFiles`
- `readFileContents`
- `writeFileContents`
- `loadGitStatusAndDiff`
- `executeTerminalCommand`
- `loadRuntimeState`
- `pauseRuntime`
- `resumeRuntime`
- `cancelRuntime`
- `completeMission`
- `restoreCheckpoint`
- `loadTaskAndMissionHistory`
- `loadAgentStates`
- `loadMemoryStatus`
- `loadKnowledgeGraphStatus`
- `loadArchitectureAndSymbolIndex`
- `loadCapabilities`
- `streamWorkspaceEvents`

The production selection point is `createWorkspaceGateway()` in
`lib/control-centre/gateway.ts`:

- `NEXT_PUBLIC_CODEXIA_WORKSPACE_GATEWAY=hosted` →
  `HostedWorkspaceGateway`
- unset or any other value → `CodexiaWorkspaceGateway`

## Fixture-to-service map

| Gateway operation | Concrete Codexia service | Status |
| --- | --- | --- |
| Load active repository | `getWorkspaceRoot()` | Integrated |
| Detect branch | `GitProvider.branch()` → `gitBranchTool` | Integrated; branch support added to the existing Git tool family |
| Restore/persist session | `safeReadFile` / `safeWriteFile` under `.codexia/control-centre` | Integrated |
| List files | `listFilesTool` → `listTree` | Integrated |
| Read file | `readFileTool` → `safeReadFile` | Integrated |
| Write/save file | `writeFileTool` → `safeWriteFile` | Integrated |
| Git status/diff | `createGitProvider()` → existing Git tools | Integrated; Git tools now execute in `WORKSPACE_DIR` |
| Execute terminal command | None | Missing; no general terminal service exists |
| Load runtime state | `FileRuntimeCheckpointStore.loadLatest` plus active adapter state | Integrated |
| Pause runtime | `RuntimeController.pause` | Integrated for an active in-process task |
| Resume runtime | `createRuntimeController().resume` | Integrated for a durable paused checkpoint |
| Cancel runtime | `RuntimeController.cancel` | Integrated for an active in-process task |
| Complete mission | None | Missing; no mission lifecycle/verification service exists |
| Restore checkpoint | `FileRuntimeCheckpointStore.loadLatest` | Integrated |
| Task history | `createTaskQueue().list()` using `FileTaskQueueStore` | Integrated |
| Mission history | None | Missing |
| Agent states | None | Missing; multi-agent events are transient and there is no shared registry |
| Memory status | `loadWorkspaceMemorySnapshot` | Integrated |
| Knowledge graph status | `getWorkspaceIndex().relationships` | Integrated |
| Architecture/symbol data | `getWorkspaceIndex()` | Integrated |
| Workspace events | `getWorkspaceEventHistory` / `subscribeWorkspaceEvents` | Integrated through SSE |

## Verified behavior

Verified against a real temporary Git repository through the running Next.js
application:

- Repository identity returned the actual workspace directory.
- Branch detection returned `main`.
- `src/example.ts` opened through the real filesystem service.
- Saving changed `integrationMarker` from `before` to `after`.
- The changed bytes were confirmed directly on disk.
- Git status changed to `M src/example.ts`.
- Git diff returned the exact before/after line.
- A workspace session with IDE mode and the selected real file was persisted
  and restored.
- Architecture indexing returned two files, one directory, and one symbol.
- Memory and relationship status came from the real workspace services.
- A durable runtime checkpoint was restored.
- The real runtime resumed from that checkpoint and completed one bounded
  iteration with `goal_achieved`.

Not verified as complete:

- A pause request did not land because the verification runtime completed before
  the request reached an active boundary.
- General terminal execution is unavailable.
- Mission completion is unavailable.
- Persistent agent-state and mission-history services are unavailable.
- Cloud-browser access to the local non-Sites server was blocked by the browser
  environment, so the mode transition is verified through persisted session
  state and component behavior rather than a cloud-browser click trace.
