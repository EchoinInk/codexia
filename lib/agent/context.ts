import type {
  AgentContext,
  AgentMessage,
  AgentObservation,
  ToolResult,
} from "./types";


export function createContext(
  messages: AgentMessage[],
  workspace: string
): AgentContext {

  return {

    messages,

    workspace,

    filesRead: [],

    filesModified: [],

    observations: [],

    toolResults: [],

  };

}



export function addMessage(
  context: AgentContext,
  message: AgentMessage
): AgentContext {

  return {

    ...context,

    messages: [
      ...context.messages,
      message,
    ],

  };

}



export function trackFileRead(
  context: AgentContext,
  filePath: string
): AgentContext {


  if (
    context.filesRead.includes(filePath)
  ) {

    return context;

  }



  return {

    ...context,

    filesRead: [
      ...context.filesRead,
      filePath,
    ],

  };

}



export function trackFileModified(
  context: AgentContext,
  filePath: string
): AgentContext {


  if (
    context.filesModified.includes(filePath)
  ) {

    return context;

  }



  return {

    ...context,

    filesModified: [
      ...context.filesModified,
      filePath,
    ],

  };

}



export function addObservation(
  context: AgentContext,
  observation: AgentObservation
): AgentContext {

  return {

    ...context,

    observations: [
      ...context.observations,
      observation,
    ],

  };

}



export function addToolResult(
  context: AgentContext,
  result: ToolResult
): AgentContext {

  return {

    ...context,

    toolResults: [
      ...context.toolResults,
      result,
    ],

  };

}



export function setCurrentTask(
  context: AgentContext,
  task: string
): AgentContext {

  return {

    ...context,

    currentTask: task,

  };
}
  export function addMemory(
  context: AgentContext,
  observation: AgentObservation
): AgentContext {

  return {

    ...context,

    memory:[
      ...(context.memory ?? []),
      observation,
    ],

  };
}