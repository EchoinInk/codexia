import { getWorkspaceRoot } from "@/lib/fs-safe";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RuntimeController } from "../runtime/controller";
import { FileRuntimeCheckpointStore } from "../runtime/checkpoint-store";
import { DefaultRuntimeContinuationPolicy } from "../runtime/continuation-policy";
import { WorkspaceRuntimeMemoryRecorder } from "../runtime/memory-recorder";
import { MultiAgentCoordinator } from "../multi-agent/coordinator";
import { ArchitectAgent, RefactorerAgent, TestWriterAgent, DocumentationWriterAgent, DefaultReviewerAgent } from "../multi-agent/agents";
import type { MultiAgentDependencies } from "../multi-agent/types";
import type { RuntimeCheckpointStore, RuntimeEventListener, RuntimeResult } from "../runtime/types";
import type { AgentContext } from "../types";
import { createWorkspaceIndex } from "@/lib/intelligence/workspace-index";
import { createIntelligenceContext } from "@/lib/intelligence/intelligence-context";
import { loadWorkspaceMemorySnapshot } from "@/lib/intelligence/workspace-memory";
import { snapshotId } from "@/lib/intelligence/change-proposal";
import type { WorkspaceIndex } from "@/lib/intelligence/types";
import { collectEngineeringEvidence } from "./evidence";
import { EngineeringPlanner, decomposeEngineeringGoal } from "./planner";
import { runEngineeringWorkflow } from "./workflow";
import { goalDigest, validateEngineeringGoal, validateEngineeringApproval, invalidatePendingProposals } from "./governance";
import { runEngineeringChecks } from "./verification";
import type { EngineeringApproval, EngineeringCheckRunner, EngineeringFindingProvider, EngineeringGoal, EngineeringReasoner } from "./types";

export interface EngineeringRuntimeOptions {
  checkpointStore?: RuntimeCheckpointStore;
  readIndex?: () => Promise<WorkspaceIndex>;
  checks?: EngineeringCheckRunner;
  findingProviders?: EngineeringFindingProvider[];
  reasoner?: EngineeringReasoner;
  specialists?: Partial<Pick<MultiAgentDependencies, "architect" | "refactorer" | "testWriter" | "documentationWriter" | "reviewer">>;
  recordMemory?: boolean;
}

/** Adapter wiring engineering policy into the existing Runtime, not another loop. */
export function createEngineeringRuntime(workspace: string, options: EngineeringRuntimeOptions = {}) {
  const root = getWorkspaceRoot(workspace);
  const store = options.checkpointStore ?? new FileRuntimeCheckpointStore(root);
  const readIndex = options.readIndex ?? (async () => {
    const index = await createWorkspaceIndex(root);
    return { ...index, memory: await loadWorkspaceMemorySnapshot(root) };
  });
  const runner = options.checks ?? runEngineeringChecks;
  const checks: EngineeringCheckRunner = async (required, workspace, signal) => {
    const startedAt = Date.now();
    const results = await runner(required, workspace, signal);
    signal?.throwIfAborted();
    return results.map(result => result.measuredAt < startedAt || result.measuredAt > Date.now() || typeof result.success !== "boolean"
      ? { ...result, success: false, output: `Stale/invalid verification evidence: ${result.id}` } : result);
  };
  let controller: RuntimeController | undefined;
  let active = false;
  const listeners = new Set<RuntimeEventListener>();

  function build(goal: EngineeringGoal): RuntimeController {
    let index: WorkspaceIndex;
    let signal: AbortSignal | undefined;
    const planner = new EngineeringPlanner(() => index, options.reasoner, () => signal);
    return new RuntimeController({
      checkpointStore: store,
      planner,
      observer: { async observe(input) {
        signal = input.signal;
        const context = input.context;
        const session = context.engineering!;
        validateEngineeringGoal(session.goal);
        try { validateEngineeringApproval(session.goal, session.approval); }
        catch (error) { session.escalation = String(error); }
        index = await readIndex();
        input.signal.throwIfAborted();
        context.intelligence = createIntelligenceContext(index);
        if (session.expectedSnapshot && snapshotId(index) !== session.expectedSnapshot) {
          session.escalation = "Workspace changed outside the last verified boundary; explicit replanning and review required";
          invalidatePendingProposals(session, session.escalation);
        }
        if (session.inFlight) session.escalation = "Interrupted change requires journal recovery and explicit revalidation";
        session.evidence = await collectEngineeringEvidence(index, session.goal, options.findingProviders, input.signal);
        session.expectedSnapshot ??= session.evidence.snapshot;
        if (!session.audit.some(event => event.type === "baseline") && !session.escalation) {
          session.initialFindings = structuredClone(session.evidence.findings);
          session.baseline = await checks(session.goal.checks, root, input.signal);
          session.tasks = decomposeEngineeringGoal(session.goal, session.evidence).map(task => ({
            task, status: "pending", attempts: 0, proposals: [], verification: [],
          }));
          if (!session.goal.tasks?.length && session.goal.mode === "repair" && session.baseline.every(check => check.success)) {
            session.tasks = [{ task: { id: "already-satisfied", title: "Verify healthy baseline", files: [], dependsOn: [],
              operation: { kind: "verify" }, evidenceIds: [], risk: "low", obligations: [] },
              status: "pending", attempts: 0, proposals: [], verification: [] }];
          }
          if (session.goal.checks.some(check => session.baseline.filter(result => result.id === check.id).length !== 1)) {
            session.escalation = "Baseline verification evidence is missing or duplicated";
          }
          if (session.baseline.some(result => result.provider === "unsupported")) session.escalation = "Required benchmark/security provider is not registered";
          if (session.goal.checks.some(check => check.metric && !session.baseline.find(result => result.id === check.id)?.measurements)) {
            session.escalation = "Required reproducible measurement baseline is unavailable";
          }
          session.audit.push({ at: Date.now(), type: "baseline", snapshot: session.expectedSnapshot,
            detail: JSON.stringify(session.baseline.map(result => ({ id: result.id, success: result.success, provider: result.provider }))) });
        }
        session.audit.push({ at: Date.now(), type: "observation", snapshot: session.evidence.snapshot,
          detail: `${session.evidence.findings.length} findings; ${session.evidence.memory.length} provenance-backed memories` });
        return { summary: session.escalation ?? "Fresh engineering evidence collected", context,
          metadata: { snapshot: session.evidence.snapshot, goalDigest: goalDigest(session.goal) } };
      } },
      prepareWorkflow: async (plan, context) => {
        const session = context.engineering!;
        const data = plan.engineering!;
        if (data.taskId && !data.escalation && !data.finalVerification) {
          const task = session.tasks.find(candidate => candidate.task.id === data.taskId);
          if (!task) throw new Error("Engineering task missing while consuming repair budget");
          if (task.attempts >= session.goal.budgets.maxRepairAttempts) {
            throw new Error("Repair budget exhausted before execution");
          }
          // B10: consume authority before the Runtime's durable pre-execution
          // checkpoint. A crash after this point can never recreate the attempt.
          task.attempts += 1;
          if (data.proposal) session.inFlight = { taskId: data.taskId, proposalId: data.proposal.id };
          session.audit.push({ at: Date.now(), type: "attempt_consumed", taskId: data.taskId,
            proposalId: data.proposal?.id, detail: `${task.attempts}/${session.goal.budgets.maxRepairAttempts}` });
        }
        session.audit.push({ at: Date.now(), type: "plan", taskId: data.taskId, proposalId: data.proposal?.id,
          snapshot: session.evidence?.snapshot, provider: data.proposal?.origin ?? "engineering-planner",
          detail: JSON.stringify({ constraints: data.constraints, evidence: data.evidenceIds, escalation: data.escalation }) });
        return context;
      },
      runWorkflow: async (plan, context, workflowOptions = {}) => {
        const session = context.engineering!;
        const data = plan.engineering!;
        if (data.escalation) return runEngineeringWorkflow(plan, context, workflowOptions, { index: readIndex, checks });
        const task = session.tasks.find(item => item.task.id === data.taskId)?.task;
        const coordinator = new MultiAgentCoordinator({
          planner: { createPlan: async () => plan },
          architect: options.specialists?.architect ?? new ArchitectAgent(),
          refactorer: options.specialists?.refactorer ?? new RefactorerAgent(),
          testWriter: options.specialists?.testWriter ?? new TestWriterAgent(),
          documentationWriter: options.specialists?.documentationWriter ?? new DocumentationWriterAgent(),
          reviewer: options.specialists?.reviewer ?? new DefaultReviewerAgent(),
          runWorkflow: (selected, ctx, opts) => runEngineeringWorkflow(selected, ctx, opts ?? {}, { index: readIndex, checks }),
        }, {
          enableArchitect: task?.risk !== "low" || !!session.goal.architecture?.layers?.length,
          enableRefactorer: task?.operation.kind === "rename" || task?.operation.kind === "refactor" || session.goal.mode === "migration",
          enableTestWriter: true, enableDocumentationWriter: session.goal.documentationFiles.length > 0,
          requireReviewerApproval: true,
        });
        const coordinated = await coordinator.run(`${session.goal.mode} refactor engineering: ${task?.title ?? session.goal.title}`, context, workflowOptions.signal);
        session.advice.push(...coordinated.advice);
        session.review = coordinated.review;
        session.audit.push({ at: Date.now(), type: "review", taskId: task?.id, detail: coordinated.review.summary,
          provider: options.specialists?.reviewer ? "registered-reviewer" : "default-reviewer" });
        if (!coordinated.review.approved) {
          session.complete = false;
          // Failed verification can feed a bounded repair attempt. A disagreement
          // after valid execution requires user review, not weaker acceptance.
          if (coordinated.workflow.validation.valid) session.escalation = coordinated.review.requiredActions.join("; ") || "Reviewer rejected verified change";
        }
        return coordinated.workflow;
      },
      goalEvaluator: { async evaluate({ workflow }) {
        const session = workflow.execution.context.engineering!;
        return { goalAchieved: session.complete && workflow.validation.valid && !!session.review?.approved,
          recoverable: !session.escalation, userInterruption: !!session.escalation,
          reason: session.escalation ?? (session.complete ? "Every acceptance criterion verified" : "Engineering tasks remain") };
      } },
      continuationPolicy: new DefaultRuntimeContinuationPolicy(),
      restoreContext: async snapshot => {
        if (path.resolve(snapshot.workspace) !== root || !snapshot.engineering) throw new Error("Checkpoint workspace mismatch");
        return { ...snapshot, intelligence: createIntelligenceContext(await readIndex()) };
      },
      memoryRecorder: options.recordMemory === false ? undefined : new WorkspaceRuntimeMemoryRecorder(),
    }, { maxIterations: goal.budgets.maxIterations, timeoutMs: goal.budgets.timeoutMs,
      maxConsecutiveFailures: goal.budgets.maxRepairAttempts, checkpointAfterEachIteration: true });
  }
  async function run(goal: EngineeringGoal, action: (controller: RuntimeController) => Promise<RuntimeResult>) {
    if (active) throw new Error("Engineering runtime already active");
    active = true;
    controller = build(goal);
    const unsubscribe = controller.subscribe(event => { for (const listener of listeners) { try { listener(event); } catch { /* observers cannot interrupt work */ } } });
    try { return await action(controller); } finally { active = false; unsubscribe(); }
  }
  return {
    async preview(goal: EngineeringGoal) {
      validateEngineeringGoal(goal);
      const index = await readIndex();
      for (const file of goal.scope.files) if (!index.files.some(source => source.path === file)) throw new Error(`Unknown scope file: ${file}`);
      const evidence = await collectEngineeringEvidence(index, goal, options.findingProviders);
      return { goalDigest: goalDigest(goal), evidence, tasks: decomposeEngineeringGoal(goal, evidence) };
    },
    async start(goal: EngineeringGoal, approval: EngineeringApproval, id: string = randomUUID()): Promise<RuntimeResult> {
      validateEngineeringGoal(goal); validateEngineeringApproval(goal, approval);
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid runtime task id");
      if (await store.loadLatest(id)) throw new Error("Runtime task id already exists");
      const initialIndex = await readIndex();
      for (const file of goal.scope.files) if (!initialIndex.files.some(source => source.path === file)) throw new Error(`Unknown scope file: ${file}`);
      const context: AgentContext = { workspace: root, messages: [{ role: "user", content: goal.title }],
        filesRead: [], filesModified: [], observations: [], toolResults: [], memory: [], currentTask: goal.title,
        engineering: { version: 1, goal: structuredClone(goal), approval: structuredClone(approval), expectedSnapshot: snapshotId(initialIndex),
          initialFindings: [], baseline: [], finalChecks: [], tasks: [], audit: [{ at: Date.now(), type: "approval", detail: JSON.stringify(approval) }],
          advice: [], noProgress: 0, complete: false } };
      return run(goal, controller => controller.start({ id, goal: goal.title, context, metadata: { engineering: true, goalDigest: goalDigest(goal) } }));
    },
    async resume(id: string, approval?: EngineeringApproval): Promise<RuntimeResult> {
      if (active) throw new Error("Engineering runtime already active");
      if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid runtime task id");
      const checkpoint = await store.loadLatest(id);
      if (!checkpoint?.context.engineering || path.resolve(checkpoint.context.workspace) !== root) throw new Error("Engineering checkpoint not found for workspace");
      const session = checkpoint.context.engineering;
      validateEngineeringGoal(session.goal);
      validatePersistedAttemptBudgets(session);
      if (session.tasks.some(task => task.status === "awaiting_approval" && !task.pendingProposal)) {
        throw new Error("Pending proposal missing; explicit replanning required");
      }
      if (approval) {
        validateEngineeringApproval(session.goal, approval);
        // Approval renewal never silently accepts external changes or unresolved writes.
        if (session.expectedSnapshot !== snapshotId(await readIndex())) {
          session.escalation = "Recovery/replanning required before resume: workspace changed since proposal generation";
          invalidatePendingProposals(session, session.escalation);
          await store.save(checkpoint);
          throw new Error(session.escalation);
        }
        if (session.inFlight) {
          session.audit.push({ at: Date.now(), type: "revalidated", taskId: session.inFlight.taskId,
            detail: "Fresh workspace matches pre-change checkpoint; interrupted marker cleared under renewed approval" });
          session.inFlight = undefined;
        }
        if (checkpoint.state.status === "running") {
          checkpoint.state.status = "paused";
          checkpoint.state.phase = "terminal";
          checkpoint.state.pauseReason = "Explicit recovery of interrupted runtime";
        }
        session.approval = structuredClone(approval);
        session.escalation = undefined;
        // Keep awaiting tasks and their exact proposals intact. The planner
        // revalidates these checkpointed inputs instead of regenerating them.
        session.audit.push({ at: Date.now(), type: "approval", detail: JSON.stringify(approval) });
        await store.save(checkpoint);
      }
      return run(session.goal, controller => controller.resume(id));
    },
    pause: (id: string, reason?: string) => controller?.pause(id, reason) ?? false,
    cancel: (id: string, reason?: string) => controller?.cancel(id, reason) ?? false,
    subscribe(listener: RuntimeEventListener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    checkpoint: (id: string) => store.loadLatest(id),
  };
}

function validatePersistedAttemptBudgets(session: AgentContext["engineering"]): void {
  if (!session || !Array.isArray(session.tasks)) throw new Error("Persisted engineering budget state is incomplete");
  for (const state of session.tasks) {
    if (!Number.isInteger(state.attempts) || state.attempts < 0 ||
      state.attempts > session.goal.budgets.maxRepairAttempts) {
      throw new Error("Persisted engineering repair budget is corrupt; recovery fails closed");
    }
  }
}
