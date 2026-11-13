import React from 'react';
import { User, Shield, Key, LogOut, LogIn } from 'lucide-react';

interface AccountPageProps {
  user: { email: string; name: string } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ user, onSignIn, onSignOut }) => {
  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AC';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white shadow-xl">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold font-heading text-white">{user?.name || 'Guest session'}</h2>
          <p className="text-xs text-slate-400">{user?.email || 'Sign in to connect your Angel account.'}</p>
        </div>
        <button
          onClick={user ? onSignOut : onSignIn}
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-950/60 text-indigo-200 text-xs font-semibold hover:bg-indigo-900/70"
        >
          {user ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          {user ? 'Sign out' : 'Sign in'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2">
          <span className="text-slate-400 font-medium block">Subscription Status</span>
          <div className="text-lg font-bold text-white font-heading">Not configured</div>
          <p className="text-slate-400">Billing and subscription entitlements are not connected yet. Angel will not claim a paid plan until this is implemented.</p>
        </div>

        <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2">
          <span className="text-slate-400 font-medium block">AI Connection</span>
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
            <Key className="w-4 h-4" />
            Server-managed Gemini key
          </div>
          <p className="text-slate-400">The Gemini API key is configured in Netlify Functions and is not intended to be exposed in the browser.</p>
        </div>

        <div className="md:col-span-2 p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
            <Shield className="w-4 h-4" />
            Account security
          </div>
          <p className="text-slate-400">Account sign-in uses Supabase Authentication. Conversation access is restricted by user-scoped database policies.</p>
          {!user && <p className="text-amber-300">You are not signed in. Private chat and cloud synchronization require an authenticated account.</p>}
        </div>
      </div>
    </div>
  );
};
