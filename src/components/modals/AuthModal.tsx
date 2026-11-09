import React, { useState } from 'react';
import { companionAuth } from '../../services/companionAuth';
import { X, LogIn, UserPlus, Lock, Mail, User, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (userData: { email: string; name: string; accessToken: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setSuccessNotice(null);

    if (!email.trim() || !password.trim()) {
      setErrorNotice('Please fill in all required fields.');
      return;
    }
    if (password.length < 8) {
      setErrorNotice('Use a password with at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userName = name.trim() || email.split('@')[0];
      const session = mode === 'login'
        ? await companionAuth.signIn(email.trim(), password)
        : await companionAuth.signUp(email.trim(), password, userName);

      if (!session) {
        setSuccessNotice('Account created. Check your email to confirm your address, then sign in.');
        setMode('login');
        return;
      }

      setSuccessNotice(mode === 'login' ? 'Signed in successfully!' : 'Account created successfully!');
      onAuthSuccess({
        email: session.user.email || email.trim(),
        name: session.user.user_metadata?.full_name || userName,
        accessToken: session.access_token,
      });
      onClose();
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="w-full max-w-md rounded-3xl bg-[#090e28]/95 border border-indigo-500/30 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative text-slate-100 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold font-heading text-white tracking-wide">
            {mode === 'login' ? 'Sign In to Angel' : 'Create Angel Account'}
          </h2>
        </div>

        <p className="text-xs text-slate-300 mb-5">
          {mode === 'login'
            ? 'Enter your credentials to access your personalized AI session.'
            : 'Register your companion session to sync state across devices.'}
        </p>

        {errorNotice && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-medium">
            {errorNotice}
          </div>
        )}

        {successNotice && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-medium">
            {successNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 absolute left-3 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-[#06091b] border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full bg-[#06091b] border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#06091b] border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 mt-2"
          >
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            <span>{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-cyan-300 font-semibold hover:underline"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-cyan-300 font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
