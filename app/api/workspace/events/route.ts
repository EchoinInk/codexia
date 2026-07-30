import { codexiaWorkspaceService } from "@/lib/control-centre/server/workspace-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      for (const event of codexiaWorkspaceService.recentEvents()) send(event);
      unsubscribe = codexiaWorkspaceService.subscribeEvents(send);

      request.signal.addEventListener(
        "abort",
        () => {
          unsubscribe();
          controller.close();
        },
        { once: true }
      );
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
