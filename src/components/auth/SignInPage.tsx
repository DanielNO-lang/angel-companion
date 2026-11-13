import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, LogIn, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { ProviderAuthSection } from './ProviderAuthSection';
import { authService } from '../../services/authService';
import {
  getRememberMePreference,
  validateEmail,
  validateSignInInput,
  type AppRoute,
  type ThemeMode,
} from '../../services/authValidation';

interface SignInPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute, options?: { email?: string }) => void;
  initialNotice?: string | null;
}

export const SignInPage: React.FC<SignInPageProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
  initialNotice = null,
}) => {
  const isLight = theme === 'light';
  const [authMethod, setAuthMethod] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(initialNotice);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validation = validateSignInInput({ email, password });
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setIsSubmitting(true);
    const result = await authService.signInWithEmailPassword(email, password, rememberMe);
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.code === 'CONFIRMATION_REQUIRED') {
        onNavigate('verify-email', { email });
        return;
      }
      setFormError(result.message);
      return;
    }

    onNavigate('app');
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!email.trim() || !validateEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    const result = await authService.signInWithMagicLink(email);
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSuccessMessage(result.message);
  };

  const inputBaseClass = isLight
    ? 'w-full min-h-[46px] bg-white/85 border border-slate-300 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
    : 'w-full min-h-[46px] bg-[#06091c]/80 border border-slate-700/80 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-400';

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to enter your private Angel companion workspace."
      visualHeading="Your Unified Companion Awaits"
      visualDescription="Return to your conversations, Adaptive Workspace, specialized Studios, Knowledge Library, and connected workflows inside Angel."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={(r) => onNavigate(r)}
    >
      <ProviderAuthSection
        mode="signin"
        theme={theme}
        disabled={isSubmitting}
        onError={(msg) => setFormError(msg)}
      />

      {formError && (
        <div
          role="alert"
          className={`mb-4 p-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${
            isLight
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{formError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className={`mb-4 p-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${
            isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Mode selector between Password and Passwordless Magic Link */}
      <div
        className={`grid grid-cols-2 p-1 rounded-2xl mb-4 text-xs font-semibold ${
          isLight ? 'bg-slate-200/75 text-slate-600' : 'bg-slate-900/75 border border-slate-800 text-slate-400'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setAuthMethod('password');
            setFieldErrors({});
            setFormError(null);
          }}
          className={`py-2 rounded-xl transition-all cursor-pointer ${
            authMethod === 'password'
              ? isLight
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-indigo-600 text-white shadow-md'
              : ''
          }`}
        >
          Email & Password
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod('magic-link');
            setFieldErrors({});
            setFormError(null);
          }}
          className={`py-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
            authMethod === 'magic-link'
              ? isLight
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-indigo-600 text-white shadow-md'
              : ''
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Email Magic Link</span>
        </button>
      </div>

      <form onSubmit={authMethod === 'password' ? handlePasswordSignIn : handleMagicLink} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="signin-email"
            className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            Email address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              id="signin-email"
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

        {authMethod === 'password' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="signin-password"
                  className={`block text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className={`text-xs font-semibold cursor-pointer ${
                    isLight ? 'text-blue-600 hover:text-blue-800' : 'text-cyan-300 hover:text-cyan-200'
                  }`}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Remember me on this device
                </span>
              </label>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_8px_28px_rgba(79,70,229,0.45)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          <span>
            {isSubmitting
              ? 'Verifying...'
              : authMethod === 'password'
                ? 'Sign In to Angel'
                : 'Send Sign-In Link'}
          </span>
        </button>
      </form>

      <div
        className={`mt-6 pt-4 border-t text-center text-xs ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800/80 text-slate-400'
        }`}
      >
        New to Angel Companion?{' '}
        <button
          type="button"
          onClick={() => onNavigate('signup')}
          className={`font-semibold cursor-pointer hover:underline ${
            isLight ? 'text-blue-600' : 'text-cyan-300'
          }`}
        >
          Create an account
        </button>
      </div>
    </AuthLayout>
  );
};
