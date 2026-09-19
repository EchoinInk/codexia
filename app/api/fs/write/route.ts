import { safeWriteFile, fileVersion } from "@/lib/fs-safe";
import { localMutationBody, configuredRequestWorkspace, requestFilePath, fileErrorResponse, RequestError } from "@/lib/local-request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await localMutationBody(request);
    const path = requestFilePath(body.path);
    if (typeof body.content !== "string" || !(body.expectedVersion === null ||
      typeof body.expectedVersion === "string" && /^[a-f0-9]{64}$/.test(body.expectedVersion))) {
      throw new RequestError("content and expectedVersion required (null for a new file)");
    }
    await safeWriteFile(path, body.content, configuredRequestWorkspace(body.workspace), body.expectedVersion);
    return Response.json({ ok: true, path, version: fileVersion(body.content) });
  } catch (error) { return fileErrorResponse(error); }
}
