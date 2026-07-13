import type {
  AgentContext
} from "./types";


export interface Plan {

  goal: string;

  steps: string[];

  files: string[];

}



export async function createPlan(
  context: AgentContext
): Promise<Plan> {


  const lastMessage =
    context.messages[
      context.messages.length - 1
    ];


  const goal =
    context.currentTask ??
    lastMessage?.content ??
    "No task provided";


  return {

    goal,


    steps: [

      "Analyze request",

      "Inspect relevant files",

      "Determine required changes",

      "Apply changes",

      "Verify result"

    ],


    files: []

  };

}