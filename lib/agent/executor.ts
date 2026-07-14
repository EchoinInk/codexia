import type {
  Plan,
  PlanStep,
} from "./planner";


import type {
  AgentContext,
} from "./types";


import {
  toolRegistry,
} from "@/lib/tools";


import {
  createObservation,
} from "./observation";


import {
  addObservation,
  addToolResult,
} from "./context";


import {
  validateExecution,
} from "./patch-validator";


import {
  runVerification,
} from "./verification";


import {
  analyseFailures,
} from "./failure-analyzer";


import {
  createProgress,
} from "./progress";


import {
  createChangeSummary,
  addAction,
  addVerification,
} from "./change-summary";



export interface ExecutionResult {

  success: boolean;

  output: string;

  filesModified: string[];

  context: AgentContext;

}



export async function executePlan(
  plan: Plan,
  context: AgentContext
): Promise<ExecutionResult> {


  let updatedContext =
    context;


  let summary =
    createChangeSummary();


  const results: string[] = [];



  updatedContext =
    addObservation(
      updatedContext,
      createObservation(
        createProgress(
          "applying_changes",
          "Executing plan"
        ).message
      )
    );



  for (const step of plan.steps) {


    summary =
      addAction(
        summary,
        step.description
      );


    const result =
      await executeStep(step);


    results.push(
      result.output
    );


    updatedContext =
      addObservation(
        updatedContext,
        createObservation(
          result.output,
          result.success
            ? "tool_result"
            : "error"
        )
      );


    if (result.tool) {

      updatedContext =
        addToolResult(
          updatedContext,
          {
            tool: result.tool,

            success:
              result.success,

            output:
              result.output,

          }
        );

    }

  }



  updatedContext =
    addObservation(
      updatedContext,
      createObservation(
        createProgress(
          "verifying",
          "Running verification"
        ).message
      )
    );



  const verification =
    await runVerification();


  for (const result of verification) {

    summary =
      addVerification(
        summary,
        result.success
          ? `${result.command}: passed`
          : `${result.command}: failed`
      );

  }



  const failure =
    analyseFailures(
      verification
    );


  if (failure.failed) {

    updatedContext =
      addObservation(
        updatedContext,
        createObservation(
          failure.failures.join("\n"),
          "error"
        )
      );

  }



  const validation =
    validateExecution(
      updatedContext
    );



  return {

    success:
      validation.valid &&
      !failure.failed,


    output: [

      `Task: ${plan.goal}`,

      ...results,

      "Verification:",

      ...summary.verification,

    ].join("\n"),


    filesModified:
      updatedContext.filesModified,


    context:
      updatedContext,

  };

}



async function executeStep(
  step: PlanStep
) {


  if (!step.tool) {

    return {

      success: true,

      output:
        `Completed: ${step.description}`,

    };

  }



  const tool =
    toolRegistry.get(
      step.tool
    );



  if (!tool) {

    return {

      success: false,

      output:
        `Tool "${step.tool}" not found`,

    };

  }



  try {

    const output =
      await tool.execute(
        step.args ?? {}
      );


    return {

      success: true,

      tool:
        step.tool,

      output:
        JSON.stringify(output),

    };


  } catch (error) {

    return {

      success: false,

      tool:
        step.tool,

      output:
        error instanceof Error
          ? error.message
          : String(error),

    };

  }

}