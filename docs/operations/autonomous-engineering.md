# Operating Phase 7

## Start with a reviewable goal

Use the programmatic API or POST `/api/engineering` with `operation: "preview"`. Select exact files and real verification checks. Do not list only a broad objective such as "make everything faster" without reproducible measurements.

Example staged rename goal for a workspace containing `src/value.ts` and `src/use.ts`:

```json
{
  "title": "Rename value to amount while preserving behavior",
  "mode": "migration",
  "scope": {
    "files": ["src/value.ts", "src/use.ts"],
    "maxFilesPerBatch": 2,
    "maxRisk": "medium"
  },
  "checks": [
    { "id": "types", "kind": "typecheck" },
    { "id": "tests", "kind": "tests" }
  ],
  "acceptance": [
    { "id": "types-pass", "description": "Typecheck passes", "checkId": "types" },
    { "id": "tests-pass", "description": "Regression tests pass", "checkId": "tests" }
  ],
  "compatibilityChecks": ["types", "tests"],
  "constraints": ["Preserve existing behavior"],
  "documentationFiles": [],
  "budgets": {
    "maxIterations": 6,
    "maxRepairAttempts": 2,
    "timeoutMs": 300000,
    "noProgressLimit": 2
  },
  "tasks": [{
    "id": "rename-value",
    "title": "Rename the exported symbol and indexed references",
    "dependsOn": [],
    "files": ["src/value.ts", "src/use.ts"],
    "operation": {
      "kind": "rename",
      "file": "src/value.ts",
      "position": { "line": 1, "column": 14 },
      "newName": "amount"
    },
    "evidenceIds": [],
    "risk": "medium",
    "obligations": ["Verify all indexed callers"]
  }]
}
```

Replace the example files and one-based UTF-16 position with actual source coordinates. Add explicit documentation patch stages and `documentationFiles` when needed. Every scoped file must already exist; unsupported new-file/move actions require a separate approved workflow.

## Approval and execution

After review, construct an approval containing the returned `goalDigest`, the real approver, current `approvedAt`, a future `expiresAt` (Unix milliseconds), `mode: "proposal"` or explicitly authorized `"bounded"`, and `proposalIds: []` initially. Start the goal with that exact approval.

Proposal mode pauses with the generated plan/proposal in the Runtime checkpoint. Review it, then resume with an approval containing its ID. Bounded mode allows the approved scope/risk policy to authorize generated patches; use it only when the user has actually granted that authority. A narrower risk ceiling can intentionally prevent model-authored/high-risk repairs.

## Failures and recovery

Inspect the report and checkpoint before continuing. Verification failures roll back the attempted batch through existing change journals. Successful earlier migration stages remain recorded as partial progress. Required checkers, ambiguous fixes, exhausted budgets, reviewer disagreement, unexpected edits, and scope expansion cause escalation rather than a success claim.

After a crash, inspect `.codexia/runtime/checkpoints/` and `.codexia/changes/`. Use the existing refactor recovery operation for a nonverified interrupted journal, then revalidate the source snapshot before resuming. Renewed approval can clear a pre-execution marker only when source matches its checkpoint. If a stage committed successfully before its Runtime checkpoint was saved, do not blindly replay it: inspect the verified journal and create a revised explicitly approved goal for remaining work.

Checkpoints/journals contain source and local verification output. Keep them within the workspace's access boundary. There is no distributed lock across separate application processes; do not run overlapping engineering jobs against one workspace from independent hosts.

## Performance/security integrations

Register an `EngineeringFindingProvider` with evidence provenance and a check runner that returns actual measurements/security-check results. Use the same named check and metric at baseline and after changes. The default built-in runner covers typecheck/tests/lint/build; it deliberately fails unsupported benchmark/security checks. Failure to load a scanner is not evidence that code is secure.

## Verification of this implementation

Regression tests cover phase-6 compatibility and end-to-end Phase 7 governance, staging, repair, model adapters, measurements, rollback, reporting, checkpoints, and controls. Tests use temporary workspaces and deterministic check/model substitutes. A successful fixture verifier does not claim a real workload benchmark or live-model repair passed.

Run `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build` after installing the baseline's locked dependencies with `npm ci`.
