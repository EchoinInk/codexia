import type {
  AgentContext,
  TaskType,
} from "./types";

import {
  analyseTask
} from "./task";



export interface PlanStep {

  description:string;

  action:
    | "analyze"
    | "read"
    | "write"
    | "verify";


  tool?:string;


  args?:Record<string, unknown>;

}



export interface Plan {

  goal:string;

  steps:PlanStep[];

  files:string[];

}



function createSteps(
  type:TaskType
):PlanStep[] {


  switch(type){


    case "question":

      return [

        {
          description:
            "Inspect relevant files",

          action:"read",

          tool:"list_files",

          args:{},

        },

        {
          description:
            "Analyse requested information",

          action:"analyze",

        },

      ];



    case "debug":

      return [

        {
          description:
            "Inspect workspace",

          action:"read",

          tool:"list_files",

          args:{},

        },

        {
          description:
            "Inspect git changes",

          action:"read",

          tool:"git_diff",

          args:{},

        },

        {
          description:
            "Identify issue",

          action:"analyze",

        },

      ];



    case "modify":

    case "create":

      return [

        {
          description:
            "Inspect workspace",

          action:"read",

          tool:"list_files",

          args:{},

        },

        {
          description:
            "Prepare changes",

          action:"analyze",

        },

        {
          description:
            "Apply changes",

          action:"write",

        },

        {
          description:
            "Verify result",

          action:"verify",

        },

      ];



    default:

      return [

        {
          description:
            "Analyse request",

          action:"analyze",

        },

      ];

  }

}



export async function createPlan(
  context:AgentContext
):Promise<Plan>{


  const lastMessage =
    context.messages[
      context.messages.length - 1
    ];



  const goal =
    context.currentTask ??
    lastMessage?.content ??
    "No task provided";



  const task =
    analyseTask(context);



  return {

    goal,

    steps:
      createSteps(task.type),

    files:[],

  };

}