import type {
  AgentContext,
  AgentMessage
} from "./types";


export function createContext(
  messages: AgentMessage[],
  workspace: string
): AgentContext {

  return {

    messages,

    workspace,

    filesRead: [],

    filesModified: []

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
      message
    ]

  };

}



export function trackFileRead(
  context: AgentContext,
  filePath: string
): AgentContext {

  if(
    context.filesRead.includes(filePath)
  ){
    return context;
  }


  return {

    ...context,

    filesRead: [
      ...context.filesRead,
      filePath
    ]

  };

}



export function trackFileModified(
  context: AgentContext,
  filePath: string
): AgentContext {

  if(
    context.filesModified.includes(filePath)
  ){
    return context;
  }


  return {

    ...context,

    filesModified: [
      ...context.filesModified,
      filePath
    ]

  };

}



export function setCurrentTask(
  context: AgentContext,
  task: string
): AgentContext {

  return {

    ...context,

    currentTask: task

  };

}