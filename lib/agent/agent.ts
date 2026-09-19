import { chatRequestKind } from "./task";
import { validateToolStep } from "@/lib/tools/validation";
import type {
  AgentResponse,
} from "./types";

import {
  createContext,
} from "./context";

import {
  analyseTask,
} from "./task";

import {
  getPlanner,
} from "./planner-index";

import {
  runWorkflow,
} from "./workflow";

import {
  createRepairPlan,
} from "./repair-planner";

import {
  createRetryState,
  canRetry,
  incrementRetry,
} from "./retry-manager";

import {
  auditAgentContext,
} from "./audit";

import {
  createAgentReport,
} from "./report-generator";

import {
  chatWithOllama,
} from "@/lib/models/ollama";


export async function runAgent(
  message: string,
  workspace: string
): Promise<AgentResponse> {
  // Direct legacy callers cannot turn Chat admission into an alternate writer.
  if (chatRequestKind(message) === "engineering") {
    return { content: "Source changes require the governed /api/engineering proposal review path." };
  }

  let context =
    await createContext(
      [
        {
          role: "user",
          content: message,
        },
      ],
      workspace
    );


  const task =
    analyseTask(
      context
    );


  /*
    Conversational requests should not enter
    the execution workflow.
  */

  if (
    !task.requiresTools
  ) {

    const response =
      await chatWithOllama([
        {
          role: "system",
          content:
            "You are Codier, the AI assistant inside Codexia. Answer naturally and concisely.",
        },

        {
          role: "user",
          content: message,
        },
      ]);


    return {
      content:
        response,
    };

  }


  const planner =
    getPlanner();


  let plan;

  try {

    plan =
      await planner.createPlan(
        context
      );

  } catch (error) {

    return {

      content:
        [
          "Planner validation failed.",

          error instanceof Error
            ? error.message
            : String(error),

          "Execution prevented: true",

        ].join("\n"),

    };

  }


  let retry =
    createRetryState();


  while (true) {
    // Also enforce read-only capability after planning and every repair attempt.
    // Verification commands belong to governed engineering, not read-only Chat.
    try {
      if (plan.engineering || plan.steps.some(step => !["read", "analyze"].includes(step.action))) {
        throw new Error("Source changes and verification require governed engineering review");
      }
      plan.steps.forEach(validateToolStep);
    } catch (error) {
      return { content: `Execution prevented: ${error instanceof Error ? error.message : String(error)}` };
    }

    const workflow =
      await runWorkflow(
        plan,
        context
      );


    const result =
      workflow.execution;


    context =
      result.context;


    const audit =
      auditAgentContext(
        context
      );


    if (
      result.success
    ) {

      return {

        content:
          createAgentReport(
            workflow,
            audit
          ),

      };

    }


    if (
      !canRetry(retry)
    ) {

      return {

        content:
          createAgentReport(
            workflow,
            audit
          ),

      };

    }


    retry =
      incrementRetry(
        retry
      );


    const repair =
      createRepairPlan(
        plan,
        context
      );


    plan = {

      goal:
        repair.originalGoal,

      steps:
        repair.steps,

      files:
        plan.files,

      fileSelection:
        plan.fileSelection,

      impact:
        plan.impact,

      metadata:
        plan.metadata,

    };

  }

}