import { handleChatRequest } from "../../server/geminiBackend";

export default async (request: Request): Promise<Response> => {
  let body: unknown = null;
  if (request.method === "POST") {
    body = await request.json().catch(() => null);
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
