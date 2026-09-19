import { safeDeleteFile } from "@/lib/fs-safe";
import { localMutationBody, configuredRequestWorkspace, requestFilePath, fileErrorResponse } from "@/lib/local-request";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await localMutationBody(request);
    await safeDeleteFile(requestFilePath(body.path), configuredRequestWorkspace(body.workspace));
    return Response.json({ ok: true });
  } catch (error) { return fileErrorResponse(error); }
}
