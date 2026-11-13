import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  LogOut,
  CheckCircle2,
  Link2,
  Unlink,
  ExternalLink,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import type { AuthIdentityInfo, AuthUser } from '../../services/authService';
import { authService } from '../../services/authService';
import {
  EXTERNAL_APP_INTEGRATIONS,
  getAuthProviderStatuses,
  type AuthProviderId,
} from '../../services/authProviderRegistry';
import { canUnlinkIdentity } from '../../services/authValidation';
import { ProviderLogo } from '../auth/ProviderLogo';

interface AccountPageProps {
  user?: AuthUser | null;
  identities?: AuthIdentityInfo[];
  onSignOut?: () => void;
  onNavigateToTools?: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  user = null,
  identities = [],
  onSignOut,
  onNavigateToTools,
}) => {
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const primaryProviders = getAuthProviderStatuses().filter(
    (p) => p.tier === 'primary' || p.isReady
  );

  const connectedProvidersMap = new Map<string, AuthIdentityInfo>();
  for (const id of identities) {
    connectedProvidersMap.set(id.provider, id);
  }

  const handleLinkProvider = async (providerId: AuthProviderId, displayName: string, isReady: boolean) => {
    setFeedback(null);
    if (!isReady) {
      setFeedback({
        type: 'error',
        text: `${displayName} cannot be linked until it is configured and enabled in your Supabase Auth provider settings.`,
      });
      return;
    }

    setActionBusy(providerId);
    const res = await authService.linkProviderIdentity(providerId);
    setActionBusy(null);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleUnlinkProvider = async (identity: AuthIdentityInfo, label: string) => {
    setFeedback(null);
    const guard = canUnlinkIdentity(identities.length);
    if (!guard.allowed) {
      setFeedback({ type: 'error', text: guard.reason || 'Cannot disconnect your sole sign-in method.' });
      return;
    }

    setActionBusy(identity.provider);
    const res = await authService.unlinkProviderIdentity(identity);
    setActionBusy(null);
    setFeedback({
      type: res.ok ? 'success' : 'error',
      text: res.ok ? `${label} disconnected.` : res.message,
    });
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    setFeedback(null);
    setActionBusy('password-reset');
    const res = await authService.requestPasswordReset(user.email);
    setActionBusy(null);
    setFeedback({ type: res.ok ? 'success' : 'error', text: res.message });
  };

  const emailConnected = connectedProvidersMap.has('email') || Boolean(user?.emailVerified);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Authenticated User Profile Header */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white shadow-xl shrink-0">
            {user?.initials || 'AN'}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold font-heading text-white truncate">
                {user?.fullName || 'Authenticated Angel User'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 text-[10px] font-bold border border-emerald-500/40 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>{user?.emailVerified ? 'Verified Account' : 'Authenticated'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate mt-0.5">{user?.email || 'No email provided'}</p>
          </div>
        </div>

        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. CONNECTED SIGN-IN IDENTITIES & ACCOUNT SECURITY */}
      <section className="rounded-3xl glass-panel border border-indigo-500/25 bg-slate-950/40 backdrop-blur-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-bold font-heading text-white">
                Connected Sign-In Identities
              </h3>
              <p className="text-xs text-slate-400">
                Authentication methods used strictly to verify your Angel login identity. You must retain at least one
                active sign-in method.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendPasswordReset}
            disabled={actionBusy === 'password-reset' || !user?.email}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50"
          >
            {actionBusy === 'password-reset' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>Change / Reset Password</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Email & Password Row */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <ProviderLogo provider="email" className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white">Email and password</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'Primary email credential'}
                </div>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                emailConnected
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/35'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {emailConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {/* OAuth Provider Identity Rows */}
          {primaryProviders.map((provider) => {
            const linked = connectedProvidersMap.get(provider.id);
            const busy = actionBusy === provider.id;
            const guard = canUnlinkIdentity(identities.length);

            return (
              <div
                key={provider.id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/95 flex items-center justify-center shrink-0 text-slate-900">
                    <ProviderLogo provider={provider.id} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white">{provider.displayName}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {linked
                        ? linked.email || 'Identity linked'
                        : provider.isReady
                          ? 'Not connected'
                          : 'Provider setup required in Supabase'}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {linked ? (
                    <button
                      type="button"
                      disabled={busy || !guard.allowed}
                      onClick={() => handleUnlinkProvider(linked, provider.displayName)}
                      title={guard.allowed ? `Disconnect ${provider.displayName}` : guard.reason}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-rose-950/80 text-emerald-300 hover:text-rose-200 border border-emerald-500/35 hover:border-rose-500/40 font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                      <span>{guard.allowed ? 'Connected' : 'Primary Lock'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleLinkProvider(provider.id, provider.displayName, provider.isReady)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                        provider.isReady
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                      <span>{provider.isReady ? 'Connect' : 'Setup Req.'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. SEPARATE: CONNECTED EXTERNAL APPLICATIONS & DATA PERMISSIONS */}
      <section className="rounded-3xl glass-panel border border-cyan-500/20 bg-slate-950/40 backdrop-blur-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold font-heading text-white">
                Connected External Applications (Separate From Login)
              </h3>
              <p className="text-xs text-slate-400">
                Signing into Angel with Google or Microsoft never grants Drive, Gmail, Calendar, or Outlook access.
                External data connectors require dedicated authorization in Tools.
              </p>
            </div>
          </div>

          {onNavigateToTools && (
            <button
              type="button"
              onClick={onNavigateToTools}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              <span>Open Tools & Connectors</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {EXTERNAL_APP_INTEGRATIONS.map((app) => (
            <div
              key={app.id}
              className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">{app.name}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {app.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{app.description}</p>
              <p className="text-[10px] text-cyan-300/85">
                {app.permissionNote}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Server Proxy Key Boundary */}
      <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl text-xs space-y-1.5">
        <span className="text-slate-400 font-medium block">Model Credentials Boundary</span>
        <div className="text-sm font-semibold text-indigo-300">Managed via Server-Side Proxy</div>
        <p className="text-slate-400">
          GEMINI_API_KEY and sensitive OAuth client secrets are never embedded or exposed inside frontend browser code.
        </p>
      </div>
    </div>
  );
};
