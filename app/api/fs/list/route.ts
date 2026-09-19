import { listTree } from "@/lib/fs-safe";
import { configuredRequestWorkspace, fileErrorResponse } from "@/lib/local-request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tree = await listTree("", configuredRequestWorkspace());
    return Response.json({ tree });
  } catch (error: unknown) {
    return fileErrorResponse(error);
  }
}
