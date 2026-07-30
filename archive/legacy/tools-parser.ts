import type {
  ToolCall
} from "./tool-call-types";



export function extractToolCall(
  text: string
): ToolCall | null {


  const fenced =
    text.match(
      /```(?:json)?\s*([\s\S]*?)```/
    );



  const candidates:string[] = [];



  if(fenced){

    candidates.push(
      fenced[1].trim()
    );

  }



  const matches =
    text.match(
      /\{[\s\S]*\}/g
    );



  if(matches){

    candidates.push(
      ...matches
    );

  }



  for(
    const candidate of candidates
  ){

    try {

      const obj =
        JSON.parse(candidate);



      if(
        obj &&
        typeof obj.tool === "string"
      ){

        return obj as ToolCall;

      }


    }
    catch {

      continue;

    }

  }



  return null;

}