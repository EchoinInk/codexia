import type {
  AgentContext,
} from "./types";

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


        return validated;

      }


    } catch (error) {


      console.log(
        "[Planner] LLM planner failed, using rule planner",
        error
      );


    }


    return rulePlanner.createPlan(
      context
    );

  },

};