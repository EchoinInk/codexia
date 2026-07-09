import {
  AgentContext,
  AgentResponse,
  AgentMessage
} from "./types";

import {
  SYSTEM_PROMPT
} from "@/lib/config";

import {
  ollamaStream,
  iterOllamaTokens
} from "@/lib/models/ollama";

import {
  extractToolCall
} from "@/lib/tools";

import {
  toolRegistry
} from "@/lib/tools";

import {
createPlan
}
from "./planner";


import {
executePlan
}
from "./executor";

export async function runAgent(
  context: AgentContext
): Promise<AgentResponse> {


  const messages: AgentMessage[] = [

    {
      role: "system",
      content: SYSTEM_PROMPT
    },

    ...context.messages

  ];



  let finalContent = "";

  let usedTool:string | undefined;



  /**
   * Agent reasoning loop
   */
  for (
    let turn = 0;
    turn < 6;
    turn++
  ) {


    const stream =
      await ollamaStream(
        messages
      );



    let response = "";



    for await (
      const token
      of iterOllamaTokens(stream)
    ) {

      response += token;

    }



    finalContent = response;



    const toolCall =
      extractToolCall(
        response
      );



    if (!toolCall) {

      break;

    }



    usedTool =
      toolCall.tool;



    const tool =
      toolRegistry.get(
        toolCall.tool
      );



    if (!tool) {

      messages.push({

        role:"assistant",

        content:
          `Unknown tool: ${toolCall.tool}`

      });


      break;

    }



    const result =
      await tool.execute(
        toolCall.args ?? {}
      );



    messages.push({

      role:"assistant",

      content:
        response

    });



    messages.push({

      role:"tool",

      content:
        JSON.stringify({
          tool:
            toolCall.tool,

          result

        })

    });


  }



  return {

    content:
      finalContent,

    toolUsed:
      usedTool

  };

}