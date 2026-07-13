import fs from "node:fs/promises";
import path from "node:path";

import {
  listTree,
  safeResolve
} from "./fs-safe";


export type ToolCall =
  | {
      tool: "read_file";
      args: {
        path: string;
      };
    }

  | {
      tool: "write_file";
      args: {
        path: string;
        content: string;
      };
    }

  | {
      tool: "list_files";
      args?: {
        path?: string;
      };
    }

  | {
      tool: "delete_file";
      args: {
        path: string;
      };
    };



export async function runTool(
  call: ToolCall
): Promise<unknown> {


  switch (call.tool) {


    case "read_file": {

      const abs =
        safeResolve(
          call.args.path
        );


      const content =
        await fs.readFile(
          abs,
          "utf8"
        );


      return {
        path: call.args.path,
        content
      };

    }



    case "write_file": {

      const abs =
        safeResolve(
          call.args.path
        );


      await fs.mkdir(
        path.dirname(abs),
        {
          recursive: true
        }
      );


      await fs.writeFile(
        abs,
        call.args.content,
        "utf8"
      );


      return {
        ok: true,
        path: call.args.path
      };

    }



    case "list_files": {

      const requestedPath =
        call.args?.path ?? "";


      console.log(
        "LIST_FILES DEBUG",
        {
          requestedPath,
          workspace:
            process.env.WORKSPACE_DIR
        }
      );


      const resolved =
        safeResolve(
          requestedPath
        );


      console.log(
        "LIST_FILES RESOLVED",
        resolved
      );


      const files =
        await listTree(
          requestedPath
        );


      return {
        path:
          requestedPath || ".",

        files
      };

    }



    case "delete_file": {

      const abs =
        safeResolve(
          call.args.path
        );


      await fs.rm(
        abs,
        {
          recursive:true,
          force:true
        }
      );


      return {
        ok:true,
        path:call.args.path
      };

    }

  }

}



/**
 * Extract tool JSON from model response
 */
export function extractToolCall(
  text:string
):ToolCall|null {


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

    try{

      const obj =
        JSON.parse(candidate);



      if(
        obj &&
        typeof obj.tool === "string" &&
        [
          "read_file",
          "write_file",
          "list_files",
          "delete_file"
        ].includes(obj.tool)
      ){

        return obj as ToolCall;

      }


    }catch{

      // ignore invalid JSON

    }

  }



  return null;

}