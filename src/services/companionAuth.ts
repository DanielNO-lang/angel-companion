export interface CompanionSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string; user_metadata?: { full_name?: string } };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const SESSION_KEY = "angel_companion_auth_session";

function readStoredSession(): CompanionSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as CompanionSession : null;
  } catch {
    return null;
  }
}

function persistSession(session: any): CompanionSession {
  const normalized: CompanionSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
    user: session.user,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  return normalized;
}

async function authRequest(path: string, body: unknown): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Authentication is not configured yet.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.msg || payload.message || payload.error_description || payload.error;
    throw new Error(typeof message === "string" ? message : "Authentication failed. Please try again.");
  }
  return payload;
}

export const companionAuth = {
  getStoredSession: readStoredSession,

  async signIn(email: string, password: string): Promise<CompanionSession> {
    const payload = await authRequest("token?grant_type=password", { email, password });
    return persistSession(payload);
  },

  async signUp(email: string, password: string, fullName: string): Promise<CompanionSession | null> {
    const payload = await authRequest("signup", {
      email, password, data: { full_name: fullName },
    });
    return payload.access_token ? persistSession(payload) : null;
  },

  async getSession(): Promise<CompanionSession | null> {
    const current = readStoredSession();
    if (!current) return null;

    try {
      let session = current;
      if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
        const refreshed = await authRequest("token?grant_type=refresh_token", {
          refresh_token: session.refresh_token,
        });
        session = persistSession(refreshed);
      }

      if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Authentication is not configured yet.");
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error("Stored session is no longer valid.");
      const user = await response.json();
      const verified = { ...session, user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(verified));
      return verified;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  async signOut(): Promise<void> {
    const current = readStoredSession();
    try {
      if (current && SUPABASE_URL && SUPABASE_KEY) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${current.access_token}` },
        });
      }
    } finally {
      localStorage.removeItem(SESSION_KEY);
    }
  },
};
