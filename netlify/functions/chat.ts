import { handleChatRequest, handleChatStreamRequest } from "../../server/geminiBackend";

export default async (request: Request): Promise<Response> => {
  let body: unknown = null;
  if (request.method === "POST") {
    body = await request.json().catch(() => null);
  }

  let wantsStream = request.headers.get("accept")?.includes("text/event-stream") ?? false;
  if (!wantsStream) {
    try {
      wantsStream = new URL(request.url).searchParams.get("stream") === "1";
    } catch {
      wantsStream = false;
    }
  }

  if (wantsStream) {
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

    const clearKeepalive = () => {
      if (keepaliveTimer !== null) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        keepaliveTimer = setInterval(() => {
          if (!abortController.signal.aborted) {
            try {
              controller.enqueue(encoder.encode(": keepalive\n\n"));
            } catch {
              clearKeepalive();
            }
          }
        }, 3000);

        try {
          await handleChatStreamRequest(
            {
              method: request.method,
              authorizationHeader: request.headers.get("authorization"),
              body,
              signal: abortController.signal,
            },
            (event) => {
              if (!abortController.signal.aborted) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              }
            }
          );
        } catch (err) {
          if (!abortController.signal.aborted) {
            const msg = err instanceof Error ? err.message : "Conversation stream interrupted.";
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "error",
                    success: false,
                    statusCode: 502,
                    error: msg,
                    code: "STREAM_ERROR",
                  })}\n\n`
                )
              );
            } catch {
              // Ignore enqueue failure if stream is already closed
            }
          }
        } finally {
          clearKeepalive();
          if (!abortController.signal.aborted) {
            controller.close();
          }
        }
      },
      cancel() {
        clearKeepalive();
        abortController.abort();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
    });
  }

  const result = await handleChatRequest({
    method: request.method,
    authorizationHeader: request.headers.get("authorization"),
    body,
  });

  return new Response(JSON.stringify(result.body), {
    status: result.statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(result.headers || {}),
    },
  });
};
