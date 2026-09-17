import path from "node:path";
import { getWorkspaceRoot, safeResolve } from "@/lib/fs-safe";
import { getWorkspaceIndex, getWorkspaceIndexBackgroundStatus } from "@/lib/intelligence/workspace-index-manager";
import { createSemanticNavigation } from "@/lib/intelligence/semantic-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const operation = params.get("operation") ?? "search";
  if (!["search", "symbols", "definitions", "references", "implementations"].includes(operation)) {
    return Response.json({ error: "Unknown navigation operation" }, { status: 400 });
  }
  const mode = params.get("mode") ?? "fuzzy";
  if (mode !== "exact" && mode !== "prefix" && mode !== "fuzzy") {
    return Response.json({ error: "Invalid search mode" }, { status: 400 });
  }
  const file = params.get("file");
  const line = Number(params.get("line"));
  const column = Number(params.get("column"));
  if (operation !== "search" && !file) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (["definitions", "references", "implementations"].includes(operation) &&
    (!Number.isInteger(line) || !Number.isInteger(column) || line < 1 || column < 1)) {
    return Response.json({ error: "Positive integer line and column required" }, { status: 400 });
  }
  try {
    const workspace = getWorkspaceRoot();
    let relative: string | undefined;
    if (file) {
      try {
        relative = path.relative(workspace, safeResolve(file, workspace));
      } catch {
        return Response.json({ error: "File is outside the workspace" }, { status: 400 });
      }
    }
    const index = await getWorkspaceIndex(workspace);
    const navigation = createSemanticNavigation(index);
    const results = operation === "search"
      ? navigation.searchSymbols(params.get("query") ?? "", { mode, file: relative })
      : operation === "symbols"
        ? navigation.documentSymbols(relative!)
        : operation === "definitions"
          ? navigation.definitions(relative!, { line, column })
          : operation === "references"
            ? navigation.references(relative!, { line, column })
            : navigation.implementations(relative!, { line, column });
    return Response.json({
      results,
      background: getWorkspaceIndexBackgroundStatus(workspace),
    });
  } catch (error: unknown) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
