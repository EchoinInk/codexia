import { configuredRequestWorkspace, RequestError } from "@/lib/local-request";
import { runAgent } from "@/lib/agent/agent";
import { chatRequestKind } from "@/lib/agent/task";
import { engineeringChatRequest } from "@/lib/agent/engineering/chat-request";
import type { ChatResponse } from "@/lib/agent/engineering/chat-contract";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.messages) || !body.messages.length ||
      body.messages.some((message: { role?: unknown; content?: unknown } | null) => !message ||
        !["user", "assistant"].includes(String(message.role)) || typeof message.content !== "string")) {
      throw new RequestError("Chat messages are required");
    }
    const last = body.messages[body.messages.length - 1];
    if (last.role !== "user" || !last.content.trim() || last.content.length > 12000) throw new RequestError("A bounded user request is required");
    const workspace = configuredRequestWorkspace(body.workspace);
    const result: ChatResponse = chatRequestKind(last.content) === "engineering"
      ? await engineeringChatRequest(last.content, workspace)
      : { kind: "chat", ...(await runAgent(last.content, workspace)) };
    return Response.json(result);
  } catch (error) {
    return Response.json({ kind: "unsupported", content: error instanceof Error ? error.message : String(error) },
      { status: error instanceof RequestError ? error.status : 400 });
  }
}
