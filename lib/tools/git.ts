import { execFile } from "node:child_process";
import { promisify } from "node:util";


const execFileAsync =
  promisify(execFile);



async function runGit(
  args: string[]
): Promise<string> {


  const {
    stdout
  } =
    await execFileAsync(
      "git",
      args
    );


  return stdout.trim();

}



export const gitStatusTool = {

  name: "git_status",

  description:
    "Shows the current git repository status",

  async execute() {

    return await runGit([
      "status",
      "--short"
    ]);

  }

};



export const gitDiffTool = {

  name: "git_diff",

  description:
    "Shows current git changes",

  async execute() {

    return await runGit([
      "diff"
    ]);

  }

};



export const gitCommitTool = {

  name: "git_commit",

  description:
    "Creates a git commit with a provided message",

  async execute(
    args: Record<string, unknown>
  ) {


    const message =
      typeof args.message === "string"
        ? args.message
        : "Codexia change";


    return await runGit([
      "add",
      "."
    ])
    .then(
      async () =>
        runGit([
          "commit",
          "-m",
          message
        ])
    );

  }

};