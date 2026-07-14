import type {
  AgentObservation,
} from "./types";


export interface AgentMemory {

  observations: AgentObservation[];

  successfulPatterns: string[];

}



export function createMemory(): AgentMemory {

  return {

    observations: [],

    successfulPatterns: [],

  };

}



export function rememberObservation(
  memory: AgentMemory,
  observation: AgentObservation
): AgentMemory {

  return {

    ...memory,

    observations: [
      ...memory.observations,
      observation,
    ],

  };

}



export function rememberPattern(
  memory: AgentMemory,
  pattern: string
): AgentMemory {

  return {

    ...memory,

    successfulPatterns: [
      ...memory.successfulPatterns,
      pattern,
    ],

  };

}