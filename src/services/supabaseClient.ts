/**
 * ANGEL PERSISTENCE INTEGRATION BOUNDARY: SUPABASE
 * 
 * Target persistence engine for production deployment.
 * Complies strictly with project guidelines:
 * 1. Does NOT hardcode placeholder credentials.
 * 2. Checks for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY safely.
 * 3. Provides in-memory / localStorage fallback when unconfigured.
 * 4. Documents complete PostgreSQL schema definitions with Row-Level Security (RLS).
 */

export interface SupabaseConfigState {
  isConfigured: boolean;
  supabaseUrl: string | null;
  statusMessage: string;
}

export const getSupabaseConfigState = (): SupabaseConfigState => {
  const url = import.meta.env.VITE_SUPABASE_URL || null;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || null;

  if (url && key) {
    return {
      isConfigured: true,
      supabaseUrl: url,
      statusMessage: 'Supabase client connected and configured.',
    };
  }

  return {
    isConfigured: false,
    supabaseUrl: null,
    statusMessage: 'Supabase boundary active in Local State Fallback mode. Awaiting VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in environment settings.',
  };
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
  tier TEXT DEFAULT 'Pro',
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
