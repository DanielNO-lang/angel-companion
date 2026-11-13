import React, { useEffect, useState } from 'react';
import { MailCheck, RefreshCw, Edit3, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { authService } from '../../services/authService';
import { validateEmail, type AppRoute, type ThemeMode } from '../../services/authValidation';

interface EmailVerificationPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  pendingEmail?: string;
  initialError?: string | null;
  verifiedSuccess?: boolean;
}

export const EmailVerificationPage: React.FC<EmailVerificationPageProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
  pendingEmail = '',
  initialError = null,
  verifiedSuccess = false,
}) => {
  const isLight = theme === 'light';
  const [email, setEmail] = useState(pendingEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(pendingEmail);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (pendingEmail && !email) {
      setEmail(pendingEmail);
      setNewEmail(pendingEmail);
    }
  }, [pendingEmail, email]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const handleResend = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!email.trim() || !validateEmail(email)) {
      setErrorMessage('Enter the valid email address used during registration so we can resend your link.');
      return;
    }

    setIsLoading(true);
    const result = await authService.resendVerificationEmail(email);
    setIsLoading(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStatusMessage(result.message);
    setCooldownSec(45);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!newEmail.trim() || !validateEmail(newEmail)) {
      setErrorMessage('Please enter a valid replacement email address.');
      return;
    }

    setIsLoading(true);
    const result = await authService.updateAccountEmail(newEmail);
    setIsLoading(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setEmail(newEmail.trim());
    setIsEditingEmail(false);
    setStatusMessage(result.message);
  };

  const inputBaseClass = isLight
    ? 'w-full min-h-[44px] bg-white/85 border border-slate-300 rounded-2xl py-2 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40'
    : 'w-full min-h-[44px] bg-[#06091c]/80 border border-slate-700/80 rounded-2xl py-2 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35';

  return (
    <AuthLayout
      title={verifiedSuccess ? 'Email verified' : initialError ? 'Verification link issue' : 'Verify your email'}
      subtitle={
        verifiedSuccess
          ? 'Your Angel email address has been confirmed.'
          : 'Confirm your email address to activate access to your private Angel companion workspace.'
      }
      visualHeading="Verify Once. Enter With Trust."
      visualDescription="Email verification ensures only the rightful owner can access your Angel workspace, studio environments, and connected sessions."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={(r) => onNavigate(r)}
    >
      <div className="space-y-4">
        {verifiedSuccess && (
          <div
            role="status"
            className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
              isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Email address confirmed</p>
              <p className="mt-1 opacity-90">Your account is verified. You can now sign in and enter Angel.</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              isLight
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              isLight
                ? 'bg-sky-50 border-sky-200 text-sky-900'
                : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-100'
            }`}
          >
            <MailCheck className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {!verifiedSuccess && (
          <>
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                isLight ? 'bg-slate-50/80 border-slate-200 text-slate-700' : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <MailCheck className="w-4 h-4 text-cyan-400" />
                <span>Confirmation destination</span>
              </div>
              {email && !isEditingEmail ? (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`font-mono font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {email}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Change email</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdateEmail} className="space-y-2">
                  <label htmlFor="verify-email-input" className="block text-[11px] font-semibold">
                    {isEditingEmail ? 'New email address (requires active session)' : 'Registered email address'}
                  </label>
                  <input
                    id="verify-email-input"
                    type="email"
                    value={isEditingEmail ? newEmail : email}
                    onChange={(e) => (isEditingEmail ? setNewEmail(e.target.value) : setEmail(e.target.value))}
                    placeholder="name@example.com"
                    className={inputBaseClass}
                  />
                  {isEditingEmail && (
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Update Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </form>
              )}
              <p className="text-[11px] opacity-85">
                Open the verification email from Supabase and click the confirmation link. If your link expired, request a
                new verification email below.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResend}
              disabled={isLoading || cooldownSec > 0}
              className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>
                {cooldownSec > 0
                  ? `Resend available in ${cooldownSec}s`
                  : 'Resend Verification Email'}
              </span>
            </button>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className={`flex-1 min-h-[44px] rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              isLight
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                : 'bg-slate-900/70 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <span>Return to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className={`flex-1 min-h-[44px] rounded-2xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
              isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-300 hover:bg-white/5'
            }`}
          >
            Register Different Email
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
