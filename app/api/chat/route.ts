import { CONFIG, SYSTEM_PROMPT } from "@/lib/config";
import { extractToolCall, runTool } from "@/lib/tools";

export const runtime = "nodejs";

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function ollamaStream(messages: Msg[]): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${CONFIG.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CONFIG.model, messages, stream: true }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  return res.body;
}

/** Read Ollama's NDJSON stream, yielding each assistant token, and accumulate full text. */
async function* iterTokens(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        const piece: string | undefined = obj?.message?.content;
        if (piece) yield piece;
      } catch { /* skip partials */ }
    }
  }
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: Msg[] };

  // Always prepend the system prompt
  const history: Msg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (type: string, data: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + "\n"));

      try {
        // Tool-call loop, max 6 turns
        for (let turn = 0; turn < 6; turn++) {
          const stream = await ollamaStream(history);
          let full = "";
          for await (const piece of iterTokens(stream)) {
            full += piece;
            send("token", piece);
          }
          send("turn_end", { full });

          const call = extractToolCall(full);
          if (!call) break;

          send("tool_call", call);
          let result: unknown;
          try {
            result = await runTool(call);
          } catch (err: any) {
            result = { error: err.message };
          }
          send("tool_result", { tool: call.tool, result });

          history.push({ role: "assistant", content: full });
          history.push({
            role: "user",
            content: `tool_result(${call.tool}): ${JSON.stringify(result).slice(0, 20000)}`,
          });
        }
        send("done", {});
      } catch (e: any) {
        send("error", { message: e.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(out, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
