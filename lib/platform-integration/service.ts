import { randomUUID } from "node:crypto";
import { getWorkspaceRoot } from "@/lib/fs-safe";
import { IntegrationError, isolateAdapterFailure, redactSecrets } from "./errors";
import {
  PLATFORM_CAPABILITIES, PLATFORM_CONTRACT_VERSION, type CapabilityDiscovery, type DataSharingPolicy,
  type IntegrationClient, type IntegrationResourceLimits, type IntegrationSession, type PlatformCapability,
  type PlatformIntegrationOptions, type ShareableDataKind,
} from "./types";
import type { EngineeringGoal } from "@/lib/agent/engineering/types";

const DEFAULT_LIMITS: IntegrationResourceLimits = { maxConcurrentRequests: 4, maxRequestBytes: 256_000, maxResponseBytes: 1_000_000, timeoutMs: 30_000 };
const DEFAULT_SHARING: DataSharingPolicy = { mode: "local", allowed: [], maxBytes: 0 };
const KNOWN = new Set<string>(PLATFORM_CAPABILITIES);

export class PlatformIntegrationService {
  private readonly workspace: string;
  private readonly capabilities: readonly PlatformCapability[];
  private readonly limits: IntegrationResourceLimits;
  private readonly sharing: DataSharingPolicy;
  private readonly sessions = new Map<string, IntegrationSession>();
  private readonly active = new Map<string, number>();
  private readonly engineeringRequests = new Map<string, { goal: string; request: Promise<unknown> }>();
  private readonly now: () => number;

  constructor(private readonly options: PlatformIntegrationOptions) {
    this.workspace = getWorkspaceRoot(options.workspace);
    this.capabilities = canonicalCapabilities(options.authorizedCapabilities);
    this.limits = validateLimits({ ...DEFAULT_LIMITS, ...options.limits });
    this.sharing = validateSharing(options.sharing ?? DEFAULT_SHARING);
    this.now = options.now ?? Date.now;
  }

  connect(client: IntegrationClient): IntegrationSession {
    const clientWorkspace = getWorkspaceRoot(client.workspace);
    if (clientWorkspace !== this.workspace) throw new IntegrationError("WORKSPACE_MISMATCH", "Client workspace is not authorized");
    if (!client.contractVersions.includes(PLATFORM_CONTRACT_VERSION)) throw new IntegrationError("INCOMPATIBLE_VERSION", "No compatible platform contract version");
    for (const capability of client.requestedCapabilities) if (!KNOWN.has(capability)) {
      throw new IntegrationError("UNKNOWN_CAPABILITY", "Unknown platform capability");
    }
    const requested = canonicalCapabilities(client.requestedCapabilities as PlatformCapability[]);
    if (requested.some(capability => !this.capabilities.includes(capability))) throw new IntegrationError("CAPABILITY_DENIED", "Requested capability is not authorized");
    const requestedLimits = validateLimits({ ...this.limits, ...client.limits });
    const limits: IntegrationResourceLimits = {
      maxConcurrentRequests: Math.min(this.limits.maxConcurrentRequests, requestedLimits.maxConcurrentRequests),
      maxRequestBytes: Math.min(this.limits.maxRequestBytes, requestedLimits.maxRequestBytes),
      maxResponseBytes: Math.min(this.limits.maxResponseBytes, requestedLimits.maxResponseBytes),
      timeoutMs: Math.min(this.limits.timeoutMs, requestedLimits.timeoutMs),
    };
    const session: IntegrationSession = Object.freeze({ id: randomUUID(), clientId: client.id, workspace: this.workspace,
      version: PLATFORM_CONTRACT_VERSION, capabilities: requested, limits, sharing: structuredClone(this.sharing) });
    this.sessions.set(session.id, session);
    return session;
  }

  discover(sessionId: string): CapabilityDiscovery {
    const session = this.session(sessionId);
    return { version: PLATFORM_CONTRACT_VERSION, workspace: this.workspace, capabilities: [...session.capabilities],
      limits: { ...session.limits }, sharing: structuredClone(session.sharing) };
  }

  queryIntelligence(sessionId: string, workspace: string) {
    return this.run(sessionId, workspace, "intelligence.read", randomUUID(), undefined, async signal => {
      const result = await this.options.adapters.intelligence.query(this.workspace, signal);
      this.assertWorkspace(result.workspace);
      if (!result.evidence || !result.usable || ["unavailable", "failed", "incomplete"].includes(result.status)) {
        throw new IntegrationError("EVIDENCE_UNAVAILABLE", "Workspace intelligence evidence is unavailable");
      }
      return result;
    });
  }

  requestEngineering(sessionId: string, workspace: string, requestId: string, goal: EngineeringGoal) {
    if (!requestId || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) {
      return Promise.reject(new IntegrationError("INVALID_REQUEST", "A stable requestId is required"));
    }
    let serializedGoal: string;
    try {
      this.authorize(sessionId, workspace, "engineering.request", goal);
      serializedGoal = safeSerialize(goal);
    } catch (error) { return Promise.reject(error); }
    const existing = this.engineeringRequests.get(requestId);
    if (existing) {
      if (existing.goal !== serializedGoal) return Promise.reject(new IntegrationError("INVALID_REQUEST", "Request ID was already used for a different engineering goal"));
      return existing.request;
    }
    const request = this.run(sessionId, workspace, "engineering.request", requestId, goal,
      async signal => {
        const receipt = await this.options.adapters.engineering.request({ workspace: this.workspace, requestId, goal, signal });
        this.assertWorkspace(receipt.workspace);
        if (receipt.requestId !== requestId || typeof receipt.accepted !== "boolean" ||
          (receipt.taskId !== undefined && typeof receipt.taskId !== "string") ||
          (receipt.detail !== undefined && typeof receipt.detail !== "string")) {
          throw new IntegrationError("ADAPTER_FAILURE", "Engineering adapter returned an invalid receipt", true);
        }
        return { workspace: this.workspace, requestId, accepted: receipt.accepted,
          ...(receipt.taskId === undefined ? {} : { taskId: receipt.taskId }),
          ...(receipt.detail === undefined ? {} : { detail: receipt.detail }) };
      });
    this.engineeringRequests.set(requestId, { goal: serializedGoal, request });
    return request;
  }

  readLifecycle(sessionId: string, workspace: string) {
    return this.run(sessionId, workspace, "lifecycle.read", randomUUID(), undefined, async signal => {
      const result = await this.options.adapters.lifecycle.read(this.workspace, signal); this.assertWorkspace(result.workspace); return result;
    });
  }

  requestLifecycle(sessionId: string, workspace: string, action: "pause" | "resume" | "cancel" | "retry", runtimeId?: string) {
    if (!["pause", "resume", "cancel", "retry"].includes(action)) throw new IntegrationError("INVALID_REQUEST", "Invalid lifecycle action");
    return this.run(sessionId, workspace, "lifecycle.control", randomUUID(), { action, runtimeId }, async () => {
      const result = await this.options.adapters.lifecycle.request(this.workspace, action, runtimeId);
      this.assertWorkspace(result.requested.workspace); this.assertWorkspace(result.projection.workspace); return result;
    });
  }

  readReporterOutcome(sessionId: string, workspace: string, taskId: string) {
    return this.run(sessionId, workspace, "reporter.read", randomUUID(), { taskId }, async signal => {
      const outcome = await this.options.adapters.reporter.read(this.workspace, taskId, signal);
      if (!outcome) throw new IntegrationError("EVIDENCE_UNAVAILABLE", "Reporter outcome is unavailable");
      this.assertWorkspace(outcome.workspace); return outcome;
    });
  }

  authorizeExternalSharing(sessionId: string, kinds: readonly ShareableDataKind[], bytes: number): DataSharingPolicy {
    this.session(sessionId);
    if (this.sharing.mode !== "external" || !Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.sharing.maxBytes ||
      kinds.some(kind => !this.sharing.allowed.includes(kind))) throw new IntegrationError("CAPABILITY_DENIED", "External data sharing is not authorized");
    return { mode: "external", allowed: [...new Set(kinds)], maxBytes: bytes };
  }

  private async run<T>(sessionId: string, workspace: string, capability: PlatformCapability, requestId: string, payload: unknown,
    operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const session = this.authorize(sessionId, workspace, capability, payload);
    const active = this.active.get(session.id) ?? 0;
    if (active >= session.limits.maxConcurrentRequests) throw new IntegrationError("RESOURCE_LIMIT", "Concurrent request limit reached", true);
    this.active.set(session.id, active + 1); this.options.emit?.({ type: "request.accepted", requestId, capability, at: this.now() });
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const timeoutFailure = new Promise<never>((_, reject) => { timeout = setTimeout(() => {
      controller.abort(); reject(new IntegrationError("RESOURCE_LIMIT", "Request timed out", true));
    }, session.limits.timeoutMs); });
    try {
      const result = redactSecrets(await Promise.race([operation(controller.signal), timeoutFailure]));
      if (Buffer.byteLength(safeSerialize(result)) > session.limits.maxResponseBytes) throw new IntegrationError("RESOURCE_LIMIT", "Response exceeds boundary limit");
      this.options.emit?.({ type: "request.completed", requestId, capability, at: this.now() }); return structuredClone(result);
    } catch (error) {
      const isolated = error instanceof IntegrationError ? error : isolateAdapterFailure(error);
      this.options.emit?.({ type: "request.failed", requestId, capability, error: { code: isolated.code, retryable: isolated.retryable }, at: this.now() }); throw isolated;
    } finally {
      clearTimeout(timeout!);
      const remaining = (this.active.get(session.id) ?? 1) - 1;
      if (remaining > 0) this.active.set(session.id, remaining); else this.active.delete(session.id);
    }
  }

  private authorize(sessionId: string, workspace: string, capability: PlatformCapability, payload: unknown): IntegrationSession {
    const session = this.session(sessionId); this.assertWorkspace(workspace);
    if (!session.capabilities.includes(capability)) throw new IntegrationError("CAPABILITY_DENIED", "Capability is not authorized");
    if (payload !== undefined && Buffer.byteLength(safeSerialize(payload)) > session.limits.maxRequestBytes) {
      throw new IntegrationError("RESOURCE_LIMIT", "Request exceeds boundary limit");
    }
    return session;
  }

  private session(id: string) { const session = this.sessions.get(id); if (!session) throw new IntegrationError("INVALID_REQUEST", "Unknown integration session"); return session; }
  private assertWorkspace(workspace: string) { if (getWorkspaceRoot(workspace) !== this.workspace) throw new IntegrationError("WORKSPACE_MISMATCH", "Workspace identity mismatch"); }
}

function canonicalCapabilities(capabilities: readonly PlatformCapability[]): readonly PlatformCapability[] {
  for (const capability of capabilities) if (!KNOWN.has(capability)) throw new IntegrationError("UNKNOWN_CAPABILITY", "Unknown platform capability");
  return Object.freeze([...new Set(capabilities)].sort()) as readonly PlatformCapability[];
}
function validateLimits(limits: IntegrationResourceLimits): IntegrationResourceLimits {
  if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value <= 0)) throw new IntegrationError("INVALID_REQUEST", "Resource limits must be positive integers");
  return limits;
}
function validateSharing(sharing: DataSharingPolicy): DataSharingPolicy {
  const known = new Set<ShareableDataKind>(["source", "prompts", "diagnostics", "reports", "evidence"]);
  if (!Number.isSafeInteger(sharing.maxBytes) || sharing.maxBytes < 0 || sharing.allowed.some(kind => !known.has(kind)) ||
    (sharing.mode === "local" && (sharing.allowed.length > 0 || sharing.maxBytes !== 0))) throw new IntegrationError("INVALID_REQUEST", "Invalid data-sharing policy");
  return { mode: sharing.mode, allowed: [...new Set(sharing.allowed)].sort(), maxBytes: sharing.maxBytes };
}

function safeSerialize(value: unknown): string {
  try { return JSON.stringify(value); }
  catch { throw new IntegrationError("INVALID_REQUEST", "Request or response is not serializable"); }
}
