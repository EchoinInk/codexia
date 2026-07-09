import {
  safeReadFile,
  safeWriteFile,
  safeResolve,
  listTree
} from "../fs-safe";

import fs from "node:fs/promises";



export const readFileTool = {

  name: "read_file",

  description:
    "Reads a file from the workspace",

  async execute(args:any) {

    const content =
      await safeReadFile(
        args.path
      );


    return {
      path: args.path,
      content
    };

  }

};




export const writeFileTool = {

  name:"write_file",

  description:
    "Writes content to a workspace file",

  async execute(args:any) {

    await safeWriteFile(
      args.path,
      args.content
    );


    return {
      ok:true,
      path:args.path
    };

  }

};




export const listFilesTool = {

  name:"list_files",

  description:
    "Lists files and directories in the workspace",

  async execute(args:any) {

    const path =
      args?.path ?? "";


    const files =
      await listTree(
        path
      );


    return {
      path:path || ".",
      files
    };

  }

};




export const deleteFileTool = {

  name:"delete_file",

  description:
    "Deletes a file or directory",

  async execute(args:any) {

    const abs =
      safeResolve(
        args.path
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
      path:args.path
    };

  }

};