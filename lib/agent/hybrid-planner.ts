import type {
  AgentContext,
} from "./types";

import {
  getRelevantFiles,
  getImpactAnalysis,
  addPlanMetadata,
} from "./planner";

import type {
  Plan,
  Planner,
} from "./planner";

import {
  llmPlanner,
} from "./llm-planner";

import {
  rulePlanner,
} from "./rule-planner";

import {
  validatePlan,
} from "./plan-validator";


function isUsefulPlan(
  plan: Plan
): boolean {

  return (
    Boolean(plan.goal) &&
    Array.isArray(plan.steps) &&
    plan.steps.length > 0
  );

}



export const hybridPlanner: Planner = {

  async createPlan(
    context: AgentContext
  ): Promise<Plan> {

    const start =
      Date.now();


    try {

      const plan =
        await llmPlanner.createPlan(
          context
        );


      const validated =
        validatePlan(
          plan
        );


      if (
        isUsefulPlan(
          validated
        )
      ) {

        console.log(
          `[Planner] LLM planner succeeded in ${
            Date.now() - start
          }ms`
        );


        const fileSelection =
          getRelevantFiles(
            context,
            validated.goal
          );


        const files =
          fileSelection?.files ??
          validated.files;


        return addPlanMetadata({

          ...validated,

          files,

          fileSelection,

          impact:
            getImpactAnalysis(
              context,
              files
            ),

        });

      }


    } catch (error) {

      if (
        error instanceof Error &&
        error.name === "PlanValidationError"
      ) {
        throw error;
      }

      console.error(
        "[Planner] LLM planner unavailable, using rule planner:",
        error
      );

    }


    /*
      Only use rule planner when the LLM planner
      is unavailable, not when validation fails.
    */

    const rulePlan =
      await rulePlanner.createPlan(
        context
      );


    const fileSelection =
      getRelevantFiles(
        context,
        rulePlan.goal
      );


    const files =
      fileSelection?.files ??
      rulePlan.files;


    return addPlanMetadata({

      ...rulePlan,

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