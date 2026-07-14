import type { AgentObservation } from "./types";

export interface AgentMemory {
  observations: AgentObservation[];
}

export function createMemory(): AgentMemory {
  return {
    observations: [],
  };
}

export function remember(
  memory: AgentMemory,
  observation: AgentObservation
): AgentMemory {
  return {
    observations: [...memory.observations, observation],
  };
}

export function getRecentMemory(
  memory: AgentMemory,
  limit = 10
): AgentObservation[] {
  return memory.observations.slice(-limit);
}
