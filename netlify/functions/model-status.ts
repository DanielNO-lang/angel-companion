import { handleModelStatusRequest } from "../../server/geminiBackend";

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1" || url.searchParams.get("refresh") === "true";
  const probeParam = url.searchParams.get("probe");
  const liveProbe =
    probeParam === "generate" ? true : probeParam === "none" ? false : undefined;

  const result = await handleModelStatusRequest({
    method: request.method,
    forceRefresh,
    liveProbe,
  });

  return new Response(JSON.stringify(result.body), {
    status: result.statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
