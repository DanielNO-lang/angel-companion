import { GoogleGenAI } from "@google/genai";

export default async (request: Request): Promise<Response> => {
  const json = (statusCode: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status: statusCode,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return json(503, { error: "Angel's title service is not fully configured." });
  }
  if (!token) return json(401, { error: "Please sign in to continue." });

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization: `Bearer ${token}` },
    });
    if (!userResponse.ok) return json(401, { error: "Your session has expired." });

    const { message } = await request.json() as { message?: string };
    if (typeof message !== "string" || !message.trim() || message.length > 12000) {
      return json(400, { error: "A valid message is required." });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents: `Generate a concise 2 to 4 word title for this user message. Reply only with the title: ${message}`,
    });
    const generated = result.text?.trim().replace(/^["']|["']$/g, "");
    return json(200, { success: Boolean(generated), title: generated || "General Conversation" });
  } catch (error) {
    console.error("[companion-title] Gemini title generation failed:", error);
    return json(502, { error: "Could not generate a title." });
  }
};
