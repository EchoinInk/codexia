import { runAgent } from "@/lib/agent/agent";

import type { AgentMessage } from "@/lib/agent/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json();

  const messages = body.messages as AgentMessage[];

  const result = await runAgent({
    messages,

    workspace: body.workspace ?? "",

    filesRead: [],

    filesModified: [],

    observations: [],

    toolResults: [],
  });

  return Response.json({
    content: result.content,
  });
}
