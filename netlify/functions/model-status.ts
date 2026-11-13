export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const configured = Boolean(process.env.GEMINI_API_KEY);
  return new Response(JSON.stringify({
    connected: configured,
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    message: configured
      ? "Gemini server credentials are configured."
      : "Gemini server credentials are not configured.",
  }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
