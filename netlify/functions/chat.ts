import { GoogleGenAI } from "@google/genai";

type ChatMessage = { role: "user" | "assistant"; content: string };

const json = (statusCode: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return json(503, { error: "Angel's conversation service is not fully configured." });
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return json(401, { error: "Please sign in to continue." });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization: `Bearer ${token}` },
    });
    if (!userResponse.ok) {
      return json(401, { error: "Your session has expired. Please sign in again." });
    }

    const body = await request.json() as {
      messages?: ChatMessage[];
      systemInstruction?: string;
      mode?: string;
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length || messages.length > 40) {
      return json(400, { error: "Send between 1 and 40 conversation messages." });
    }

    const safeMessages = messages.filter((message) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0 &&
      message.content.length <= 12000
    );

    if (safeMessages.length !== messages.length) {
      return json(400, { error: "One or more messages are invalid or too long." });
    }

    const defaultInstruction =
      "You are Angel, a thoughtful, natural, capable Universal Personal AI Companion. " +
      "Respond directly, accurately and conversationally. Respect the complete conversation history. " +
      "Do not claim to have performed actions or accessed services unless a connected tool confirms it.";

    const systemInstruction = typeof body.systemInstruction === "string"
      ? body.systemInstruction.slice(0, 8000)
      : defaultInstruction;

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents: safeMessages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      config: { systemInstruction },
    });

    const reply = result.text?.trim();
    if (!reply) {
      return json(502, { error: "Angel couldn't produce a response. Please try again." });
    }

    return json(200, {
      reply,
      modelUsed: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      mode: body.mode || "Default",
    });
  } catch (error) {
    console.error("[companion-chat] Gemini request failed:", error);
    return json(502, {
      error: "Angel couldn't reach her conversation model just now. Please try again.",
    });
  }
};
