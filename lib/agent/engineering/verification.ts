import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EngineeringCheck, EngineeringCheckResult, EngineeringCheckRunner } from "./types";

const execute = promisify(execFile);
const commands = {
  typecheck: ["npx", ["tsc", "--noEmit"]], tests: ["npm", ["test"]],
  lint: ["npm", ["run", "lint"]], build: ["npm", ["run", "build"]],
} as const;

/** Fixed registered commands only; model output cannot introduce shell commands. */
export const runEngineeringChecks: EngineeringCheckRunner = async (checks, workspace, signal) => {
  const results: EngineeringCheckResult[] = [];
  for (const check of checks) {
    signal?.throwIfAborted();
    if (check.kind === "benchmark" || check.kind === "security") {
      results.push({ id: check.id, success: false, provider: "unsupported", measuredAt: Date.now(),
        output: `A registered ${check.kind} checker is required; no evidence was produced.` });
      continue;
    }
    const [command, args] = commands[check.kind];
    try {
      const { stdout, stderr } = await execute(command, [...args], { cwd: workspace, signal, maxBuffer: 1024 * 1024 * 10 });
      results.push({ id: check.id, success: true, provider: command, measuredAt: Date.now(), output: (stdout + stderr).slice(0, 100000) });
    } catch (error) {
      if (signal?.aborted) throw error;
      results.push({ id: check.id, success: false, provider: command, measuredAt: Date.now(), output: String(error).slice(0, 100000) });
    }
  }
  return results;
};

export function evaluateEngineeringChecks(checks: EngineeringCheck[], results: EngineeringCheckResult[], baseline: EngineeringCheckResult[]): string[] {
  const errors: string[] = [];
  for (const check of checks) {
    const matching = results.filter(result => result.id === check.id);
    if (matching.length !== 1 || !matching[0].success || !matching[0].provider || !Number.isFinite(matching[0].measuredAt)) {
      errors.push(`Required verification did not pass: ${check.id}`); continue;
    }
    const result = matching[0];
    if (check.metric) {
      const before = baseline.find(result => result.id === check.id)?.measurements?.[check.metric.name];
      const after = result.measurements?.[check.metric.name];
      if (before === undefined || after === undefined || !Number.isFinite(before) || !Number.isFinite(after)) {
        errors.push(`Reproducible baseline and measurement required: ${check.id}/${check.metric.name}`); continue;
      }
      const change = check.metric.direction === "lower" ? after - before : before - after;
      const allowed = Math.abs(before) * check.metric.maxRegressionPercent / 100;
      if (change > allowed) errors.push(`Measurement regressed: ${check.id}/${check.metric.name}`);
    }
  }
  return errors;
}
