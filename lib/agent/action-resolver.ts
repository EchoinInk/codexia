import type { AgentAction } from "./contracts/action-types";

export function resolveActionTool(action: AgentAction): string | undefined {
  switch (action) {
    case "read":
      return "read_file";

    case "write":
      return "write_file";

    case "verify":
      return undefined;

    case "analyze":
      return undefined;

    default: {
      const exhaustiveCheck: never = action;

      return exhaustiveCheck;
    }
  }
}
