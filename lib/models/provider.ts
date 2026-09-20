import type { Msg } from "@/lib/agent/types";
import type { EngineeringTextGenerator } from "./engineering-reasoner";
import { isolateAdapterFailure } from "@/lib/platform-integration/errors";

export type ModelProviderKind = "local" | "openai" | "custom";

export interface ModelProvider {
  readonly id: string;
  readonly kind: ModelProviderKind;
  readonly location: "local" | "external";
  generate(messages: readonly Msg[], signal?: AbortSignal): Promise<string>;
}

/** Adapts providers to the existing reasoner seam; Runtime remains provider-blind. */
export function modelProviderGenerator(provider: ModelProvider): EngineeringTextGenerator {
  return async (messages, signal) => {
    try { return await provider.generate(messages, signal); }
    catch (error) { throw isolateAdapterFailure(error, true); }
  };
}
