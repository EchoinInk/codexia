import type { EngineeringGoal } from "@/lib/agent/engineering/types";
import type { WorkspaceAction, WorkspaceActionResult, WorkspaceLifecycleSnapshot } from "@/lib/workspace-operations/types";

export const PLATFORM_CONTRACT_VERSION = "1.0" as const;
export const PLATFORM_CAPABILITIES = [
  "intelligence.read",
  "engineering.request",
  "lifecycle.read",
  "lifecycle.control",
  "reporter.read",
] as const;

export type PlatformCapability = typeof PLATFORM_CAPABILITIES[number];
export type IntegrationClientKind = "ide" | "tool" | "workspace-api";
export type ShareableDataKind = "source" | "prompts" | "diagnostics" | "reports" | "evidence";

export interface IntegrationClient {
  id: string;
  kind: IntegrationClientKind;
  workspace: string;
  contractVersions: readonly string[];
  requestedCapabilities: readonly string[];
  limits?: Partial<IntegrationResourceLimits>;
}

export interface IntegrationResourceLimits {
  maxConcurrentRequests: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  timeoutMs: number;
}

export interface DataSharingPolicy {
  mode: "local" | "external";
  allowed: readonly ShareableDataKind[];
  maxBytes: number;
}

export interface IntegrationSession {
  id: string;
  clientId: string;
  workspace: string;
  version: typeof PLATFORM_CONTRACT_VERSION;
  capabilities: readonly PlatformCapability[];
  limits: IntegrationResourceLimits;
  sharing: DataSharingPolicy;
}

export interface CapabilityDiscovery {
  version: typeof PLATFORM_CONTRACT_VERSION;
  workspace: string;
  capabilities: readonly PlatformCapability[];
  limits: IntegrationResourceLimits;
  sharing: DataSharingPolicy;
}

export type IntegrationEvent =
  | { type: "request.accepted"; requestId: string; capability: PlatformCapability; at: number }
  | { type: "request.completed"; requestId: string; capability: PlatformCapability; at: number }
  | { type: "request.failed"; requestId: string; capability: PlatformCapability; error: { code: string; retryable: boolean }; at: number }
  | { type: "provider.failed"; providerId: string; error: { code: "PROVIDER_UNAVAILABLE"; retryable: boolean }; at: number };

export interface IntelligenceResult {
  workspace: string;
  status: "current" | "stale" | "incomplete" | "unavailable" | "failed";
  usable: boolean;
  evidence?: unknown;
  [key: string]: unknown;
}

export interface ReporterOutcome {
  workspace: string;
  status: string;
  evidence?: unknown;
  [key: string]: unknown;
}

export interface EngineeringRequestReceipt {
  workspace: string;
  requestId: string;
  accepted: boolean;
  taskId?: string;
  detail?: string;
}

export interface PlatformAdapters {
  intelligence: { query(workspace: string, signal?: AbortSignal): Promise<IntelligenceResult> };
  engineering: { request(input: { workspace: string; requestId: string; goal: EngineeringGoal; signal?: AbortSignal }): Promise<EngineeringRequestReceipt> };
  lifecycle: {
    read(workspace: string, signal?: AbortSignal): Promise<WorkspaceLifecycleSnapshot>;
    request(workspace: string, action: Exclude<WorkspaceAction, "approve">, runtimeId?: string): Promise<WorkspaceActionResult>;
  };
  reporter: { read(workspace: string, taskId: string, signal?: AbortSignal): Promise<ReporterOutcome | undefined> };
}

export interface PlatformIntegrationOptions {
  workspace: string;
  authorizedCapabilities: readonly PlatformCapability[];
  adapters: PlatformAdapters;
  limits?: Partial<IntegrationResourceLimits>;
  sharing?: DataSharingPolicy;
  emit?: (event: IntegrationEvent) => void;
  now?: () => number;
}
