import {
  toolRegistry,
} from "@/lib/tools";


export interface GitProvider {

  status(): Promise<string>;

  diff(): Promise<string>;

  commit(
    message: string
  ): Promise<string>;

}



function getGitTool(
  name: string
) {

  const tool =
    toolRegistry.get(
      name
    );


  if (!tool) {

    throw new Error(
      `Git tool "${name}" is not registered`
    );

  }


  return tool;

}



export function createGitProvider(): GitProvider {

  return {

    async status() {

      const tool =
        getGitTool(
          "git_status"
        );


      const result =
        await tool.execute(
          {}
        );


      return String(result);

    },


    async diff() {

      const tool =
        getGitTool(
          "git_diff"
        );


      const result =
        await tool.execute(
          {}
        );


      return String(result);

    },


    async commit(
      message: string
    ) {

      const tool =
        getGitTool(
          "git_commit"
        );


      const result =
        await tool.execute(
          {
            message,
          }
        );


      return String(result);

    },

  };

}