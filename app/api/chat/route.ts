import { configuredRequestWorkspace, RequestError } from "@/lib/local-request";
import { runAgent } from "@/lib/agent/agent";
import { chatRequestKind } from "@/lib/agent/task";
import { engineeringChatRequest } from "@/lib/agent/engineering/chat-request";
import type { ChatResponse } from "@/lib/agent/engineering/chat-contract";
import type { ChatRequestContext, ReadOnlyFileContext } from "@/lib/agent/engineering/chat-contract";
import { safeReadFile } from "@/lib/fs-safe";
import path from "node:path";

export const runtime = "nodejs";

function contextualReference(message: string): boolean {
  return /\b(?:this|selected|current)\s+(?:file|function|import|module|source)\b|\bhere\b/i.test(message);
}

async function selectedFileContext(input: unknown, workspace: string): Promise<ReadOnlyFileContext | undefined> {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RequestError("Invalid Chat context");
  const selectedFile = (input as ChatRequestContext).selectedFile;
  if (selectedFile === undefined) return undefined;
  if (typeof selectedFile !== "string" || !selectedFile.trim() || path.isAbsolute(selectedFile) || selectedFile.includes("\0")) {
    throw new RequestError("Selected file must be a workspace-relative path");
  }
  try {
    const content = await safeReadFile(selectedFile, workspace);
    if (content.length > 120000) throw new RequestError("Selected file is too large for Chat context", 413);
    return { path: selectedFile, content };
  } catch (error) {
    if (error instanceof RequestError) throw error;
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") throw new RequestError("Selected file was not found", 404);
    if (/escape|symlink|workspace root|not a file/i.test(error instanceof Error ? error.message : String(error))) {
      throw new RequestError("Selected file is outside the permitted workspace boundary", 403);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); }
    catch { throw new RequestError("Invalid JSON"); }
    const candidate = body as { messages?: unknown } | null;
    if (!candidate || !Array.isArray(candidate.messages) || !candidate.messages.length ||
      candidate.messages.some((message: { role?: unknown; content?: unknown } | null) => !message ||
        !["user", "assistant"].includes(String(message.role)) || typeof message.content !== "string")) {
      throw new RequestError("Chat messages are required");
    }
    const requestBody = body as { messages: { role: "user" | "assistant"; content: string }[]; workspace?: unknown; context?: unknown };
    const last = requestBody.messages[requestBody.messages.length - 1];
    if (last.role !== "user" || !last.content.trim() || last.content.length > 12000) throw new RequestError("A bounded user request is required");
    const workspace = configuredRequestWorkspace(requestBody.workspace);
    const fileContext = await selectedFileContext(requestBody.context, workspace);
    if (contextualReference(last.content) && !fileContext) {
      return Response.json({ kind: "unsupported", content: "Select an existing workspace file before asking about ‘this file’." } satisfies ChatResponse);
    }
    const result: ChatResponse = chatRequestKind(last.content) === "engineering"
      ? await engineeringChatRequest(last.content, workspace, fileContext?.path)
      : { kind: "chat", ...(await runAgent(last.content, workspace, fileContext, requestBody.messages)) };
    return Response.json(result);
  } catch (error) {
    const expected = error instanceof RequestError;
    return Response.json({ kind: "unsupported", content: expected ? error.message : "Unable to process Chat request" },
      { status: expected ? error.status : 500 });
  }
}
