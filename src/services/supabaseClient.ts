import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRememberMePreference } from './authValidation';

/**
 * ANGEL PERSISTENCE & AUTHENTICATION BOUNDARY: SUPABASE
 *
 * Complies strictly with project security guidelines:
 * 1. Does NOT hardcode placeholder credentials or OAuth secrets.
 * 2. Checks VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY safely.
 * 3. Provides explicit unconfigured status without simulating signed-in users.
 * 4. Respects Remember-Me persistence choice across localStorage / sessionStorage.
 */

export interface SupabaseConfigState {
  isConfigured: boolean;
  supabaseUrl: string | null;
  statusMessage: string;
  missingVariables: string[];
}

function readEnvVar(name: string): string | null {
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    const raw = viteEnv?.[name];
    if (raw && raw.trim().length > 0 && !raw.startsWith('MY_')) {
      return raw.trim();
    }
  } catch {
    // Ignore outside Vite
  }
  if (typeof process !== 'undefined' && process.env?.[name]) {
    const raw = process.env[name]?.trim();
    if (raw && !raw.startsWith('MY_')) return raw;
  }
  return null;
}

export const getSupabaseConfigState = (): SupabaseConfigState => {
  const url = readEnvVar('VITE_SUPABASE_URL');
  const key = readEnvVar('VITE_SUPABASE_ANON_KEY');
  const missingVariables: string[] = [];

  if (!url) missingVariables.push('VITE_SUPABASE_URL');
  if (!key) missingVariables.push('VITE_SUPABASE_ANON_KEY');

  if (url && key) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return {
          isConfigured: true,
          supabaseUrl: url,
          statusMessage: 'Supabase client connected and configured.',
          missingVariables: [],
        };
      }
    } catch {
      return {
        isConfigured: false,
        supabaseUrl: null,
        statusMessage: 'VITE_SUPABASE_URL is not a valid URL.',
        missingVariables: ['VITE_SUPABASE_URL'],
      };
    }
  }

  return {
    isConfigured: false,
    supabaseUrl: null,
    statusMessage:
      'Supabase authentication is not configured in this environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live sign-in, registration, verification, and OAuth.',
    missingVariables,
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

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getSupabaseConfigState();
  const key = readEnvVar('VITE_SUPABASE_ANON_KEY');

  if (!config.isConfigured || !config.supabaseUrl || !key) {
    return null;
  }

  if (cachedClient && cachedUrl === config.supabaseUrl) {
    return cachedClient;
  }

  cachedUrl = config.supabaseUrl;
  cachedClient = createClient(config.supabaseUrl, key, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: adaptiveAuthStorage,
    },
  });

  return cachedClient;
};

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
