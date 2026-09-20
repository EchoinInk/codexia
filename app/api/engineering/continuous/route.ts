import { configuredRequestWorkspace, localMutationBody, RequestError } from "@/lib/local-request";
import { createContinuousEngineeringService } from "@/lib/agent/maintenance/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const services = new Map<string, Awaited<ReturnType<typeof createContinuousEngineeringService>>>();

async function service(workspace: string) {
  let current = services.get(workspace);
  if (!current) { current = await createContinuousEngineeringService(workspace); services.set(workspace, current); }
  return current;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const requested = new URL(request.url).searchParams.get("workspace") ?? undefined;
    const workspace = configuredRequestWorkspace(requested);
    return Response.json(await (await service(workspace)).status());
  } catch (error) { return response(error); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await localMutationBody(request);
    if (typeof body.operation !== "string" || !["enable", "evaluate", "pause", "resume", "disable", "cancel"].includes(body.operation)) {
      throw new RequestError("Invalid continuous-engineering operation");
    }
    const workspace = configuredRequestWorkspace(body.workspace);
    const controller = await service(workspace);
    return Response.json(await controller[body.operation as "enable" | "evaluate" | "pause" | "resume" | "disable" | "cancel"]());
  } catch (error) { return response(error); }
}

function response(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status: /disabled|invalid/i.test(message) ? 409 : 500 });
}
