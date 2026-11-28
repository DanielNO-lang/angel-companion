import React, { useEffect, useState } from 'react';
import {
  MailCheck,
  RefreshCw,
  Edit3,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  KeyRound,
} from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { authService } from '../../services/authService';
import { toFriendlyError } from '../../services/errorHandlingService';
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
  const [otpCode, setOtpCode] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(pendingEmail);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    initialError ? toFriendlyError(initialError, 'auth', { logDiagnostic: false }).userMessage : null
  );
  const [cooldownSec, setCooldownSec] = useState(0);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [codeVerified, setCodeVerified] = useState(verifiedSuccess);

  useEffect(() => {
    if (pendingEmail && !email) {
      setEmail(pendingEmail);
      setNewEmail(pendingEmail);
    }
  }, [pendingEmail, email]);

  useEffect(() => {
    if (verifiedSuccess) {
      setCodeVerified(true);
    }
  }, [verifiedSuccess]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSec]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!email.trim() || !validateEmail(email)) {
      setErrorMessage('Enter the valid email address used during registration.');
      return;
    }

    const cleaned = otpCode.replace(/[\s-]+/g, '').trim();
    if (!/^\d{6,8}$/.test(cleaned)) {
      setErrorMessage('Enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const result = await authService.verifyEmailOtpCode(email, cleaned, 'signup');
      if (!result.ok) {
        setErrorMessage(toFriendlyError(result.message, 'auth').userMessage);
        return;
      }

      if (result.user) {
        onNavigate('app');
        return;
      }

      setCodeVerified(true);
      setStatusMessage(result.message);
    } catch (err) {
      setErrorMessage(toFriendlyError(err, 'network').userMessage);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!email.trim() || !validateEmail(email)) {
      setErrorMessage('Enter the valid email address used during registration so we can resend your code.');
      return;
    }

    setIsResending(true);
    try {
      const result = await authService.resendVerificationEmail(email);
      if (!result.ok) {
        setErrorMessage(toFriendlyError(result.message, 'auth').userMessage);
        return;
      }

      setStatusMessage(result.message);
      setCooldownSec(45);
    } catch (err) {
      setErrorMessage(toFriendlyError(err, 'network').userMessage);
    } finally {
      setIsResending(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!newEmail.trim() || !validateEmail(newEmail)) {
      setErrorMessage('Please enter a valid replacement email address.');
      return;
    }

    setIsResending(true);
    try {
      const result = await authService.updateAccountEmail(newEmail);
      if (!result.ok) {
        setErrorMessage(toFriendlyError(result.message, 'auth').userMessage);
        return;
      }

      setEmail(newEmail.trim());
      setIsEditingEmail(false);
      setStatusMessage(result.message);
    } catch (err) {
      setErrorMessage(toFriendlyError(err, 'network').userMessage);
    } finally {
      setIsResending(false);
    }
  };

  const inputBaseClass = isLight
    ? 'w-full min-h-[44px] bg-white/80 hover:bg-white/95 rounded-2xl py-2 px-3.5 text-sm text-slate-900 placeholder-slate-400 angel-blurred-surface focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all'
    : 'w-full min-h-[44px] bg-white/[0.06] hover:bg-white/[0.09] rounded-2xl py-2 px-3.5 text-sm text-white placeholder-slate-500 angel-blurred-surface focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all';

  return (
    <AuthLayout
      title={codeVerified ? 'Email verified' : initialError ? 'Verification code issue' : 'Verify your email'}
      subtitle={
        codeVerified
          ? 'Your Angel email address has been confirmed.'
          : 'Enter the 6-digit verification code sent to your inbox to activate your private Angel workspace.'
      }
      visualHeading="Verify Once. Enter With Trust."
      visualDescription="Email code verification ensures only the rightful owner can access your Angel workspace, studio environments, and connected sessions."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={(r) => onNavigate(r)}
    >
      <div className="space-y-4">
        {codeVerified && (
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

        {!codeVerified && (
          <>
            <div
              className={`p-4 rounded-2xl text-xs space-y-2.5 backdrop-blur-md ${
                isLight ? 'bg-white/60 text-slate-700 ring-1 ring-slate-900/5' : 'bg-white/[0.05] text-slate-300 ring-1 ring-white/10'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <MailCheck className="w-4 h-4 text-cyan-400" />
                <span>Verification code destination</span>
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
                        disabled={isResending || isVerifyingCode}
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
                Enter the 6-digit verification code from your inbox below. If you do not see it, check spam or request a
                fresh code.
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-3" noValidate>
              <div>
                <label
                  htmlFor="verify-otp-code"
                  className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                >
                  Verification code
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    id="verify-otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                    placeholder="Enter 6-digit code"
                    className={`${inputBaseClass} pl-10 font-mono tracking-[0.22em] text-base`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifyingCode || isResending}
                className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isVerifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isVerifyingCode ? 'Verifying Code...' : 'Verify Email Code'}</span>
              </button>
            </form>

            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || isVerifyingCode || cooldownSec > 0}
              className={`w-full min-h-[44px] rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
                isLight
                  ? 'bg-white/75 hover:bg-white text-slate-800 shadow-xs ring-1 ring-slate-900/10'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 ring-1 ring-white/10'
              }`}
            >
              {isResending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>
                {cooldownSec > 0
                  ? `Resend code in ${cooldownSec}s`
                  : 'Resend Verification Code'}
              </span>
            </button>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className={`flex-1 min-h-[44px] rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
              isLight
                ? 'bg-white/75 hover:bg-white text-slate-800 shadow-xs ring-1 ring-slate-900/10'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 ring-1 ring-white/10'
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
