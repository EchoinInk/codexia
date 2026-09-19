import { safeReadFile, fileVersion } from "@/lib/fs-safe";
import { configuredRequestWorkspace, requestFilePath, fileErrorResponse } from "@/lib/local-request";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const path = requestFilePath(new URL(request.url).searchParams.get("path"));
    const content = await safeReadFile(path, configuredRequestWorkspace());
    return Response.json({ path, content, version: fileVersion(content) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fileErrorResponse(error); }
}
