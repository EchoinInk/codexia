import type {
  AgentContext,
} from "./types";


import {
  getRelevantFiles,
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


    try {

      const start =
        Date.now();


      const plan =
        await llmPlanner.createPlan(
          context
        );


      const validated =
        validatePlan(plan);


      if (
        isUsefulPlan(validated)
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


        return {
          ...validated,

          files:
            fileSelection?.files ?? validated.files,

          fileSelection,
        };

      }


    } catch (error) {


      console.log(
        "[Planner] LLM planner failed, using rule planner",
        error
      );


    }


    const rulePlan =
      await rulePlanner.createPlan(
        context
      );


    const fileSelection =
      getRelevantFiles(
        context,
        rulePlan.goal
      );


    return {
      ...rulePlan,

      files:
        fileSelection?.files ?? rulePlan.files,

      fileSelection,
    };

  },

};