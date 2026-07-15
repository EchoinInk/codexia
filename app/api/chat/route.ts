import { runAgent } from "@/lib/agent/agent";

import type { AgentMessage } from "@/lib/agent/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const messages = body.messages as AgentMessage[];

    console.log("Incoming chat:", messages);

    const result = await runAgent(
      messages[messages.length - 1]?.content ?? "",
      body.workspace ?? ""
    );

    console.log("Agent result:", result);

    return Response.json(result);
  } catch (err) {
    console.error("API Error:", err);

    return Response.json(
      {
        content: err instanceof Error ? err.stack ?? err.message : String(err),
      },
      {
        status: 500,
      }
    );
  }
}
