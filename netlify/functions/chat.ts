import { GoogleGenAI } from "@google/genai";

const json = (statusCode: number, payload: unknown) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  },
  body: JSON.stringify(payload),
});

type ChatMessage = { role: "user" | "assistant"; content: string };

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return new Response(JSON.stringify({ error: "Angel's conversation service is not fully configured yet." }), {
      status: 503, headers: { "content-type": "application/json" },
    });
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Please sign in to continue." }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization: `Bearer ${token}` },
    });
    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: "Your session has expired. Please sign in again." }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }

    const body = await request.json() as { messages?: ChatMessage[]; systemInstruction?: string };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length || messages.length > 40) {
      return new Response(JSON.stringify({ error: "Send between 1 and 40 conversation messages." }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const safeMessages = messages.filter((m) =>
      m && (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" && m.content.trim().length > 0
    );
    if (safeMessages.length !== messages.length || safeMessages.some(m => m.content.length > 12000)) {
      return new Response(JSON.stringify({ error: "One or more messages are invalid or too long." }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents: safeMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: typeof body.systemInstruction === "string"
          ? body.systemInstruction.slice(0, 8000)
          : "You are Angel, a thoughtful, natural, capable personal AI companion. Respond directly, conversationally, and honestly. Do not invent actions, sources, or capabilities.",
      },
    });

    const reply = result.text?.trim();
    if (!reply) {
      return new Response(JSON.stringify({ error: "Angel couldn't produce a response. Please try again." }), {
        status: 502, headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[companion-chat] Gemini request failed:", error);
    return new Response(JSON.stringify({ error: "Angel couldn't reach her conversation model just now. Please try again." }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
};
