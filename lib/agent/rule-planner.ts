import type {
  AgentContext,
  TaskType,
} from "./types";

import {
  analyseTask,
} from "./task";

import type {
  Plan,
  PlanStep,
  Planner,
} from "./planner";

import {
  getRelevantFiles,
  getImpactAnalysis,
  addPlanMetadata,
} from "./planner";


function createSteps(
  type: TaskType,
  context: AgentContext
): PlanStep[] {

  switch (type) {

    case "analysis":

      return [

        {
          description:
            "Inspect workspace files",

          action:
            "read",

          tool:
            "list_files",

          args:
            {},
        },

        {
          description:
            "Analyse workspace structure",

          action:
            "analyze",
        },

      ];


    case "question":

      return [

        {
          description:
            context.contextualFile
              ? `Read selected file ${context.contextualFile.path}`
              : "Inspect relevant files",

          action:
            "read",

          tool:
            context.contextualFile
              ? "read_file"
              : "list_files",

          args:
            context.contextualFile
              ? { path: context.contextualFile.path }
              : {},
        },

        {
          description:
            "Analyse requested information",

          action:
            "analyze",
        },

      ];


    case "debug":

      return [

        {
          description:
            "Inspect workspace",

          action:
            "read",

          tool:
            "list_files",

          args:
            {},
        },

        {
          description:
            "Inspect git changes",

          action:
            "read",

          tool:
            "git_diff",

          args:
            {},
        },

        {
          description:
            "Identify issue",

          action:
            "analyze",
        },

      ];


    case "modify":
    case "create":
      // Mutation requests are admitted by A02 before this planner. Direct
      // legacy use remains explicitly non-executable.
      return [{ description: "Source change requires governed engineering", action: "analyze" }];


    default:

      return [

        {
          description:
            "Analyse request",

          action:
            "analyze",
        },

      ];

  }

}



export const rulePlanner: Planner = {

  async createPlan(
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



    const task =
      analyseTask(
        context
      );



    const fileSelection =
      getRelevantFiles(
        context,
        goal
      );



    const files =
      fileSelection?.files ??
      [];



    return addPlanMetadata({

      goal,

      steps:
        createSteps(
          task.type,
          context
        ),

      files,

      fileSelection,

      impact:
        getImpactAnalysis(
          context,
          files
        ),

    });


  },

};
