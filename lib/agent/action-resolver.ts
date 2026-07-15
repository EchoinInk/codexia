export function resolveActionTool(
  action: string
): string | undefined {

  switch (action) {

    case "read":
      return "read_file";

    case "write":
      return "write_file";

    case "verify":
      return undefined;

    case "analyze":
      return undefined;

    default:
      return undefined;

  }

}