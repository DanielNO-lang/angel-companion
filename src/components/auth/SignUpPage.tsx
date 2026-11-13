import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User, UserPlus, Loader2, AlertCircle, Check } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { ProviderAuthSection } from './ProviderAuthSection';
import { authService } from '../../services/authService';
import {
  evaluatePasswordStrength,
  validateSignUpInput,
  type AppRoute,
  type ThemeMode,
} from '../../services/authValidation';

interface SignUpPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute, options?: { email?: string }) => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
}) => {
  const isLight = theme === 'light';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateSignUpInput({
      fullName,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    });
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setIsSubmitting(true);
    try {
      const result = await authService.signUpWithEmailPassword(fullName, email, password);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      if (result.code === 'AUTHENTICATED') {
        onNavigate('app');
        return;
      }

      onNavigate('verify-email', { email: result.email || email.trim() });
    } catch (error) {
      setFormError(error instanceof Error
        ? error.message
        : 'Account creation could not reach Supabase. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass = isLight
    ? 'w-full min-h-[46px] bg-white/85 border border-slate-300 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500'
    : 'w-full min-h-[46px] bg-[#06091c]/80 border border-slate-700/80 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-400';

  const barColors = ['bg-slate-600', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'];

  return (
    <AuthLayout
      title="Create your Angel account"
      subtitle="Establish your private companion workspace across conversation, studios, and knowledge."
      visualHeading="Begin With Clarity and Continuity"
      visualDescription="Every Angel account keeps your conversations, workspace files, studio tools, and preferences organized under your verified identity."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={(r) => onNavigate(r)}
    >
      <ProviderAuthSection
        mode="signup"
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

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        <div>
          <label
            htmlFor="signup-fullname"
            className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            Full name
          </label>
          <div className="relative flex items-center">
            <User className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              id="signup-fullname"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className={inputBaseClass}
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
          </div>
          {fieldErrors.fullName && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.fullName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            Email address
          </label>
          <div className="relative flex items-center">
            <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              id="signup-email"
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

        <div>
          <label
            htmlFor="signup-password"
            className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            Password
          </label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
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

          {/* Password strength bar & requirements */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5" aria-live="polite">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      strength.score >= level
                        ? barColors[strength.score]
                        : isLight
                          ? 'bg-slate-200'
                          : 'bg-slate-800'
                    }`}
                  />
                ))}
                <span
                  className={`text-[11px] font-semibold ml-1.5 ${
                    strength.score >= 3
                      ? 'text-emerald-500'
                      : strength.score === 2
                        ? 'text-amber-500'
                        : 'text-rose-500'
                  }`}
                >
                  {strength.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <span className={`inline-flex items-center gap-1 ${strength.checks.minLength ? 'text-emerald-500' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> 8+ characters
                </span>
                <span className={`inline-flex items-center gap-1 ${strength.checks.hasUpper && strength.checks.hasLower ? 'text-emerald-500' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Upper & lowercase
                </span>
                <span className={`inline-flex items-center gap-1 ${strength.checks.hasNumber || strength.checks.hasSymbol ? 'text-emerald-500' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Number or symbol
                </span>
              </div>
            </div>
          )}

          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="signup-confirm-password"
            className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            Confirm password
          </label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className={`${inputBaseClass} pr-11`}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="absolute right-2.5 p-2 rounded-xl text-slate-400 hover:text-cyan-400 cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <div>
          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded accent-indigo-600 cursor-pointer shrink-0"
            />
            <span className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              I acknowledge the Angel Companion Terms of Use and Privacy Notice governing account data and AI
              session handling.
            </span>
          </label>
          {fieldErrors.acceptedTerms && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.acceptedTerms}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_8px_28px_rgba(79,70,229,0.45)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 mt-1"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          <span>{isSubmitting ? 'Creating Account...' : 'Create Angel Account'}</span>
        </button>
      </form>

      <div
        className={`mt-5 pt-4 border-t text-center text-xs ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800/80 text-slate-400'
        }`}
      >
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onNavigate('signin')}
          className={`font-semibold cursor-pointer hover:underline ${
            isLight ? 'text-blue-600' : 'text-cyan-300'
          }`}
        >
          Sign In
        </button>
      </div>
    </AuthLayout>
  );
};
