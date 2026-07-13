import type {
  AgentContext,
} from "./types";


import type {
  Plan,
  PlanStep,
} from "./planner";


import {
  toolRegistry
} from "@/lib/tools";


import {
  createObservation
} from "./observation";


import {
  addObservation,
  addToolResult,
} from "./context";



export interface ExecutionResult {

  success:boolean;

  output:string;

  filesModified:string[];

  context:AgentContext;

}



export async function executePlan(
  plan:Plan,
  context:AgentContext
):Promise<ExecutionResult>{


  let updatedContext =
    context;


  const results:string[] = [];



  for(
    const step of plan.steps
  ){


    const result =
      await executeStep(step);



    results.push(result.output);



    updatedContext =
      addObservation(
        updatedContext,
        createObservation(
          result.output
        )
      );



    if(result.tool){


      updatedContext =
        addToolResult(
          updatedContext,
          {

            tool:
              result.tool,

            success:
              result.success,

            output:
              result.output,

          }

        );

    }

  }



  return {

    success:true,

    output:[
      `Task: ${plan.goal}`,
      ...results,
    ].join("\n"),


    filesModified:
      updatedContext.filesModified,


    context:
      updatedContext,

  };

}




async function executeStep(
  step:PlanStep
){


  if(
    !step.tool
  ){

    return {

      success:true,

      output:
        `Completed: ${step.description}`,

    };

  }



  const tool =
    toolRegistry.get(
      step.tool
    );



  if(!tool){

    return {

      success:false,

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

      success:true,

      tool:
        step.tool,

      output:
        JSON.stringify(
          output
        ),

    };


  }
  catch(error:any){


    return {

      success:false,

      tool:
        step.tool,

      output:
        error.message,

    };

  }

}