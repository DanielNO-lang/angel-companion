import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRememberMePreference } from './authValidation';

/**
 * ANGEL PERSISTENCE & AUTHENTICATION BOUNDARY: SUPABASE
 *
 * Complies strictly with project security guidelines:
 * 1. Does NOT hardcode placeholder credentials or OAuth secrets.
 * 2. Accepts VITE_SUPABASE_PUBLISHABLE_KEY and legacy VITE_SUPABASE_ANON_KEY.
 * 3. Uses static import.meta.env property access so Vite always bundles public VITE_* variables.
 * 4. Distinguishes exact configuration & connectivity failure modes without exposing secrets.
 */

export type SupabaseDiagnosticCode =
  | 'configured'
  | 'url_missing'
  | 'key_missing'
  | 'url_and_key_missing'
  | 'invalid_url'
  | 'client_init_failed';

export interface SupabaseConfigState {
  isConfigured: boolean;
  diagnosticCode: SupabaseDiagnosticCode;
  supabaseUrl: string | null;
  keySource: 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY' | null;
  statusMessage: string;
  diagnosticDetail: string;
  missingVariables: string[];
}

export interface SupabaseLiveHealthProbe {
  checkedAt: string;
  diagnosticCode: 'reachable' | 'auth_rejected' | 'unreachable' | 'unconfigured';
  reachable: boolean;
  statusCode: number | null;
  externalProviders: Record<string, boolean>;
  disableSignup?: boolean;
  mailerAutoconfirm?: boolean;
  message: string;
}

const PLACEHOLDER_MARKERS = [
  'MY_',
  'YOUR_PROJECT_REF',
  'your_public_key_here',
  'sb_publishable_your_public_key_here',
];

function sanitizeEnvValue(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  for (const marker of PLACEHOLDER_MARKERS) {
    if (trimmed === marker || trimmed.startsWith('MY_') || trimmed.includes('YOUR_PROJECT_REF') || trimmed.includes('your_public_key_here')) {
      return null;
    }
  }
  return trimmed;
}

function readPublicSupabaseUrl(): string | null {
  let viteVal: string | undefined;
  try {
    viteVal = import.meta.env?.VITE_SUPABASE_URL;
  } catch {
    // Outside Vite module evaluation
  }
  const normalizedVite = sanitizeEnvValue(viteVal);
  if (normalizedVite) return normalizedVite;

  if (typeof process !== 'undefined' && process.env) {
    return sanitizeEnvValue(process.env.VITE_SUPABASE_URL);
  }
  return null;
}

function readPublicSupabaseKey(): {
  value: string | null;
  source: 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY' | null;
} {
  let vitePub: string | undefined;
  let viteAnon: string | undefined;
  try {
    vitePub = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    viteAnon = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  } catch {
    // Outside Vite module evaluation
  }

  const normalizedPub = sanitizeEnvValue(vitePub);
  if (normalizedPub) {
    return { value: normalizedPub, source: 'VITE_SUPABASE_PUBLISHABLE_KEY' };
  }

  const normalizedAnon = sanitizeEnvValue(viteAnon);
  if (normalizedAnon) {
    return { value: normalizedAnon, source: 'VITE_SUPABASE_ANON_KEY' };
  }

  if (typeof process !== 'undefined' && process.env) {
    const procPub = sanitizeEnvValue(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    if (procPub) {
      return { value: procPub, source: 'VITE_SUPABASE_PUBLISHABLE_KEY' };
    }
    const procAnon = sanitizeEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
    if (procAnon) {
      return { value: procAnon, source: 'VITE_SUPABASE_ANON_KEY' };
    }
  }

  return { value: null, source: null };
}

let lastClientInitError: string | null = null;

export const getSupabaseConfigState = (): SupabaseConfigState => {
  const url = readPublicSupabaseUrl();
  const keyInfo = readPublicSupabaseKey();
  const missingVariables: string[] = [];

  if (!url) missingVariables.push('VITE_SUPABASE_URL');
  if (!keyInfo.value) missingVariables.push('VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY)');

  if (!url && !keyInfo.value) {
    return {
      isConfigured: false,
      diagnosticCode: 'url_and_key_missing',
      supabaseUrl: null,
      keySource: null,
      statusMessage: 'Supabase URL and publishable key are missing.',
      diagnosticDetail:
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) in .env.local for preview or your deployment environment.',
      missingVariables,
    };
  }

  if (!url) {
    return {
      isConfigured: false,
      diagnosticCode: 'url_missing',
      supabaseUrl: null,
      keySource: keyInfo.source,
      statusMessage: 'Supabase project URL (VITE_SUPABASE_URL) is missing.',
      diagnosticDetail: 'Add VITE_SUPABASE_URL pointing to your Supabase project origin (https://<ref>.supabase.co).',
      missingVariables,
    };
  }

  if (!keyInfo.value) {
    return {
      isConfigured: false,
      diagnosticCode: 'key_missing',
      supabaseUrl: url,
      keySource: null,
      statusMessage: 'Supabase publishable key is missing.',
      diagnosticDetail: 'Add VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) to enable Supabase client authentication.',
      missingVariables,
    };
  }

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }

  if (!parsedUrl || (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:')) {
    return {
      isConfigured: false,
      diagnosticCode: 'invalid_url',
      supabaseUrl: null,
      keySource: keyInfo.source,
      statusMessage: 'VITE_SUPABASE_URL is not a valid HTTP/HTTPS URL.',
      diagnosticDetail: 'Expected a valid project URL such as https://your-project-ref.supabase.co.',
      missingVariables: ['VITE_SUPABASE_URL'],
    };
  }

  if (lastClientInitError) {
    return {
      isConfigured: false,
      diagnosticCode: 'client_init_failed',
      supabaseUrl: url,
      keySource: keyInfo.source,
      statusMessage: 'Supabase client initialization failed.',
      diagnosticDetail: lastClientInitError,
      missingVariables: [],
    };
  }

  return {
    isConfigured: true,
    diagnosticCode: 'configured',
    supabaseUrl: parsedUrl.origin,
    keySource: keyInfo.source,
    statusMessage: 'Supabase client configuration present.',
    diagnosticDetail: `Using public project ${parsedUrl.host} with ${keyInfo.source}.`,
    missingVariables: [],
  };
};

/**
 * Dynamic storage adapter honoring user Remember-Me choice.
 * Reads from either localStorage or sessionStorage, and writes to the active tier.
 */
const adaptiveAuthStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const remember = getRememberMePreference();
      if (remember) {
        return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
      }
      return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      const remember = getRememberMePreference();
      if (remember) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
      } else {
        window.sessionStorage.setItem(key, value);
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore quota errors
    }
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
};

let cachedClient: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;
let cachedAuthProbe: { cacheKey: string; expiresAt: number; result: SupabaseLiveHealthProbe } | null = null;
let inFlightAuthProbe: { cacheKey: string; promise: Promise<SupabaseLiveHealthProbe> } | null = null;
const AUTH_PROBE_CACHE_TTL_MS = 30000;

export const resetSupabaseClientCacheForTests = (): void => {
  cachedClient = null;
  cachedUrl = null;
  cachedKey = null;
  cachedAuthProbe = null;
  inFlightAuthProbe = null;
  lastClientInitError = null;
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const url = readPublicSupabaseUrl();
  const keyInfo = readPublicSupabaseKey();

  if (!url || !keyInfo.value) {
    return null;
  }

  let parsedOrigin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    parsedOrigin = parsed.origin;
  } catch {
    return null;
  }

  if (cachedClient && cachedUrl === parsedOrigin && cachedKey === keyInfo.value) {
    return cachedClient;
  }

  try {
    lastClientInitError = null;
    const client = createClient(parsedOrigin, keyInfo.value, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: adaptiveAuthStorage,
      },
    });
    cachedUrl = parsedOrigin;
    cachedKey = keyInfo.value;
    cachedClient = client;
    return cachedClient;
  } catch (err) {
    lastClientInitError = err instanceof Error ? err.message : 'Could not initialize Supabase client.';
    cachedClient = null;
    cachedUrl = null;
    cachedKey = null;
    return null;
  }
};

async function executeSingleAuthProbe(
  endpoint: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<SupabaseLiveHealthProbe> {
  const checkedAt = new Date().toISOString();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetchImpl(endpoint, {
      method: 'GET',
      headers: {
        apikey: apiKey,
      },
      signal: controller?.signal,
    });

    if (!res.ok) {
      return {
        checkedAt,
        diagnosticCode: 'auth_rejected',
        reachable: false,
        statusCode: res.status,
        externalProviders: {},
        message: `Supabase Auth endpoint responded with HTTP ${res.status}. Verify VITE_SUPABASE_URL and publishable key belong to the same project.`,
      };
    }

    const payload = (await res.json()) as {
      external?: Record<string, boolean>;
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
    };

    const externalProviders: Record<string, boolean> = {};
    if (payload?.external && typeof payload.external === 'object') {
      for (const [k, v] of Object.entries(payload.external)) {
        if (typeof v === 'boolean') {
          externalProviders[k.toLowerCase()] = v;
        }
      }
    }

    return {
      checkedAt,
      diagnosticCode: 'reachable',
      reachable: true,
      statusCode: res.status,
      externalProviders,
      disableSignup: payload?.disable_signup,
      mailerAutoconfirm: payload?.mailer_autoconfirm,
      message: 'Supabase Auth endpoint is reachable.',
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      checkedAt,
      diagnosticCode: 'unreachable',
      reachable: false,
      statusCode: null,
      externalProviders: {},
      message: isAbort
        ? 'Timed out while reaching Supabase Auth settings.'
        : 'Could not reach Supabase Auth endpoint from the browser.',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Probes Supabase's public GoTrue /auth/v1/settings endpoint to verify live reachability
 * and read real enabled OAuth providers without exposing any sensitive keys.
 * Deduplicates concurrent probes and caches reachable results briefly so multiple mounted
 * auth components do not flood Supabase during page load.
 */
export async function probeSupabaseAuthSettings(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = 10000,
  options?: { forceRefresh?: boolean }
): Promise<SupabaseLiveHealthProbe> {
  const checkedAt = new Date().toISOString();
  const config = getSupabaseConfigState();
  const keyInfo = readPublicSupabaseKey();

  if (!config.isConfigured || !config.supabaseUrl || !keyInfo.value) {
    return {
      checkedAt,
      diagnosticCode: 'unconfigured',
      reachable: false,
      statusCode: null,
      externalProviders: {},
      message: config.statusMessage,
    };
  }

  const endpoint = `${config.supabaseUrl}/auth/v1/settings`;
  const apiKey = keyInfo.value;
  const cacheKey = `${config.supabaseUrl}|${apiKey}`;
  const useSharedCache = fetchImpl === fetch && !options?.forceRefresh;

  if (useSharedCache && cachedAuthProbe && cachedAuthProbe.cacheKey === cacheKey && Date.now() < cachedAuthProbe.expiresAt) {
    return cachedAuthProbe.result;
  }

  if (useSharedCache && inFlightAuthProbe && inFlightAuthProbe.cacheKey === cacheKey) {
    return inFlightAuthProbe.promise;
  }

  const runProbe = async (): Promise<SupabaseLiveHealthProbe> => {
    let result = await executeSingleAuthProbe(endpoint, apiKey, fetchImpl, timeoutMs);
    // Cold-start Supabase Free Tier projects can occasionally stall the first handshake; retry once on timeout
    if (!result.reachable && result.diagnosticCode === 'unreachable' && result.message.includes('Timed out') && fetchImpl === fetch) {
      result = await executeSingleAuthProbe(endpoint, apiKey, fetchImpl, timeoutMs);
    }
    if (useSharedCache && result.reachable) {
      cachedAuthProbe = {
        cacheKey,
        expiresAt: Date.now() + AUTH_PROBE_CACHE_TTL_MS,
        result,
      };
    }
    return result;
  };

  if (useSharedCache) {
    const promise = runProbe().finally(() => {
      if (inFlightAuthProbe?.promise === promise) {
        inFlightAuthProbe = null;
      }
    });
    inFlightAuthProbe = { cacheKey, promise };
    return promise;
  }

  return runProbe();
}

/**
 * SQL Schema Migration Blueprint for Supabase Execution
 */
export const SUPABASE_SQL_MIGRATION_SCHEMA = `-- ANGEL PERSISTENCE SCHEMA - MIGRATION V1

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  workspace_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_role TEXT CHECK (sender_role IN ('user', 'angel', 'system', 'agent')) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own messages" ON public.messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
  )
);

-- 5. Activities & Execution History Table
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own activities" ON public.activities FOR ALL USING (auth.uid() = user_id);
`;
