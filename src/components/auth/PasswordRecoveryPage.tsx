import React, { useMemo, useState } from 'react';
import { Mail, Lock, Eye, EyeOff, KeyRound, Loader2, AlertCircle, CheckCircle2, ArrowRight, Check } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { authService } from '../../services/authService';
import {
  evaluatePasswordStrength,
  validateEmail,
  validatePasswordResetInput,
  type AppRoute,
  type ThemeMode,
} from '../../services/authValidation';

interface PasswordRecoveryPageProps {
  mode: 'request' | 'complete';
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  initialError?: string | null;
}

export const PasswordRecoveryPage: React.FC<PasswordRecoveryPageProps> = ({
  mode,
  theme,
  onToggleTheme,
  onNavigate,
  initialError = null,
}) => {
  const isLight = theme === 'light';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!email.trim() || !validateEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    const result = await authService.requestPasswordReset(email);
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setSuccessMessage(result.message);
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validation = validatePasswordResetInput({ password, confirmPassword });
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setIsSubmitting(true);
    const result = await authService.completePasswordReset(password);
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setResetCompleted(true);
    setSuccessMessage(result.message);
  };

  const inputBaseClass = isLight
    ? 'w-full min-h-[46px] bg-white/85 border border-slate-300 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40'
    : 'w-full min-h-[46px] bg-[#06091c]/80 border border-slate-700/80 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35';

  return (
    <AuthLayout
      title={mode === 'request' ? 'Reset your password' : 'Set a new password'}
      subtitle={
        mode === 'request'
          ? 'Enter your Angel account email to receive a verified recovery link.'
          : 'Choose a strong new password to regain access to your Angel companion account.'
      }
      visualHeading="Account Recovery With Full Verification"
      visualDescription="Password resets are authenticated exclusively through Supabase recovery tokens so your account credentials stay protected."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={(r) => onNavigate(r)}
    >
      {formError && (
        <div
          role="alert"
          className={`mb-4 p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
            isLight
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="space-y-1">
            <span>{formError}</span>
            {mode === 'complete' && (
              <div>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="font-semibold underline cursor-pointer"
                >
                  Request a new recovery email
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className={`mb-4 p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
            isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {mode === 'request' ? (
        <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="recovery-email"
              className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
            >
              Account email address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={inputBaseClass}
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.email}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>{isSubmitting ? 'Sending Link...' : 'Send Password Recovery Email'}</span>
          </button>
        </form>
      ) : resetCompleted ? (
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => onNavigate('app')}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue to Angel Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleCompleteReset} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="new-password"
              className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
            >
              New password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={`${inputBaseClass} pr-11`}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 p-2 rounded-xl text-slate-400 hover:text-cyan-400 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                <span className={`inline-flex items-center gap-1 ${strength.checks.minLength ? 'text-emerald-500' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> 8+ chars
                </span>
                <span className={`inline-flex items-center gap-1 ${strength.isAcceptable ? 'text-emerald-500' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> {strength.label}
                </span>
              </div>
            )}
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-new-password"
              className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
            >
              Confirm new password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                id="confirm-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputBaseClass}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
              />
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>{isSubmitting ? 'Updating...' : 'Update Password'}</span>
          </button>
        </form>
      )}

      <div
        className={`mt-6 pt-4 border-t text-center text-xs ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800/80 text-slate-400'
        }`}
      >
        Remembered your password?{' '}
        <button
          type="button"
          onClick={() => onNavigate('signin')}
          className={`font-semibold cursor-pointer hover:underline ${
            isLight ? 'text-blue-600' : 'text-cyan-300'
          }`}
        >
          Back to Sign In
        </button>
      </div>
    </AuthLayout>
  );
};
