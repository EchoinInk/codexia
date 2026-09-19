import type { ChatResponse, EngineeringReport } from "@/lib/agent/engineering/chat-contract";
import type { EngineeringApproval } from "@/lib/agent/engineering/types";

export type EngineeringPhase = "idle" | "starting" | "running" | "awaiting_approval" | "resuming" |
  "completed" | "failed" | "paused" | "cancelled" | "rolled_back" | "invalidated" | "unknown";
export interface EngineeringSessionView {
  phase: EngineeringPhase;
  runtimeId?: string;
  report?: EngineeringReport;
  busy: boolean;
  routing: boolean;
  dismissed: boolean;
  error?: string;
  notice?: string;
}
export function reportPhase(report: EngineeringReport): EngineeringPhase {
  if (report.runtimeStatus === "cancelled") return "cancelled";
  if (report.proposalInvalidated) return "invalidated";
  if (report.pendingProposal) return "awaiting_approval";
  if (report.outcome === "verified") return "completed";
  if (report.lastChangeOutcome === "rollback_conflict") return "failed";
  if (report.lastChangeOutcome === "rolled_back") return "rolled_back";
  if (report.runtimeStatus === "running" || report.runtimeStatus === "created") return "running";
  if (report.runtimeStatus === "paused") return "paused";
  return "failed";
}
function approval(goalDigest: string, proposalIds: string[], now: number): EngineeringApproval {
  return { goalDigest, proposalIds: [...proposalIds], mode: "proposal", approvedBy: "local-user",
    approvedAt: now, expiresAt: now + 5 * 60 * 1000 };
}

/** Transport and view state only. The server owns planning, checkpoints and execution. */
export class EngineeringSessionClient {
  private state: EngineeringSessionView = { phase: "idle", busy: false, routing: false, dismissed: false };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private statusSequence = 0;
  constructor(private readonly request: typeof fetch = (...args) => fetch(...args), private readonly now = Date.now) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<EngineeringSessionView>) {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener();
  }
  private async post<T>(url: string, body: unknown): Promise<T> {
    const response = await this.request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? data.content ?? `Request failed (${response.status})`);
    return data as T;
  }
  private accept(report: EngineeringReport) {
    if (report.taskId !== this.state.runtimeId) throw new Error("Engineering runtime identity mismatch");
    this.publish({ report, phase: this.state.busy ? this.state.phase : reportPhase(report) });
  }
  async submit(messages: { role: "user" | "assistant"; content: string }[]): Promise<ChatResponse> {
    if (this.state.routing || this.state.busy) throw new Error("An engineering request is already in progress");
    this.publish({ routing: true });
    try {
      const response = await this.post<ChatResponse>("/api/chat", { messages });
      if (response.kind !== "engineering") return response;
      if (this.state.runtimeId && !["completed", "failed", "cancelled", "rolled_back", "invalidated"].includes(this.state.phase) &&
        !(this.state.dismissed && this.state.report?.runtimeStatus === "paused")) {
        return { kind: "unsupported", content: "Review or decline the current engineering proposal before starting another request." };
      }
      this.epoch++;
      this.publish({ runtimeId: response.taskId, report: undefined, phase: "starting", busy: true,
        dismissed: false, error: undefined, notice: undefined });
      await this.execute({ operation: "start", taskId: response.taskId, goal: response.goal,
        approval: approval(response.goalDigest, [], this.now()) });
      return response;
    } finally { this.publish({ routing: false }); }
  }
  private async execute(body: unknown) {
    try {
      const report = await this.post<EngineeringReport>("/api/engineering", body);
      this.epoch++; // Late status responses may not replace this command's result.
      this.publish({ busy: false });
      this.accept(report);
    } catch (error) {
      this.epoch++;
      this.publish({ busy: false, phase: "unknown", error: String(error) });
      // Stale resume failures persist invalidation server-side; read it rather
      // than retaining approval authority from the old displayed report.
      await this.refresh();
    }
  }
  async refresh() {
    if (!this.state.runtimeId) return;
    const epoch = this.epoch, sequence = ++this.statusSequence;
    try {
      const report = await this.post<EngineeringReport>("/api/engineering", { operation: "status", taskId: this.state.runtimeId });
      if (epoch !== this.epoch || sequence !== this.statusSequence) return;
      this.accept(report);
      if (this.state.busy && report.runtimeStatus === "running" && this.state.phase === "starting") this.publish({ phase: "running" });
    } catch (error) {
      if (epoch === this.epoch && sequence === this.statusSequence && !this.state.busy) {
        this.publish({ phase: "unknown", error: `Status unavailable; execution outcome is unknown. ${String(error)}` });
      }
    }
  }
  async approve(id: string) {
    const pending = this.state.report?.pendingProposal;
    if (this.state.busy || this.state.dismissed || this.state.phase !== "awaiting_approval" || !pending ||
      pending.runtimeId !== this.state.runtimeId || pending.proposal.id !== id || pending.digest !== id ||
      pending.approval.mode !== "proposal" || pending.approval.proposalIds.length !== 1 || pending.approval.proposalIds[0] !== id) return;
    this.epoch++;
    this.publish({ busy: true, phase: "resuming", error: undefined, notice: undefined });
    await this.execute({ operation: "resume", taskId: pending.runtimeId,
      approval: approval(pending.approval.goalDigest, pending.approval.proposalIds, this.now()) });
  }
  async decline() {
    if (!this.state.runtimeId) return;
    const epoch = this.epoch;
    try {
      const result = await this.post<{ accepted: boolean }>("/api/engineering", { operation: "cancel", taskId: this.state.runtimeId });
      if (epoch !== this.epoch) return;
      if (result.accepted) this.publish({ notice: "Cancellation requested; waiting for the server result." });
      else if (!this.state.busy && this.state.report?.runtimeStatus === "paused") {
        this.publish({ dismissed: true, notice: "Review closed without applying changes. The runtime remains paused on the server; it was not cancelled." });
      } else this.publish({ notice: "Cancellation was not accepted. Refresh to check the server state." });
    } catch (error) { if (epoch === this.epoch) this.publish({ error: String(error) }); }
  }
  async reopen() { await this.refresh(); this.publish({ dismissed: false, notice: undefined }); }
}
