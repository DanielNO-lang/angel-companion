import React from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, Stars, Orbit, ArrowLeft } from 'lucide-react';
import { companionAuth } from '../../services/companionAuth';

type EntryMode = 'landing' | 'signin' | 'signup' | 'forgot';

interface PublicEntryPageProps {
  onAuthenticated: (user: { email: string; name: string; accessToken: string }) => void;
}

export const PublicEntryPage: React.FC<PublicEntryPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = React.useState<EntryMode>('landing');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const changeMode = (next: EntryMode) => {
    setError('');
    setNotice('');
    setMode(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await companionAuth.resetPassword(email.trim());
        setNotice('If an account exists for this email, a password recovery link has been sent. Check your inbox.');
        return;
      }
      if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const session = await companionAuth.signUp(email.trim(), password, name.trim() || email.split('@')[0]);
        if (!session) {
          setNotice('Your account has been created. Check your email to confirm your address, then sign in.');
          changeMode('signin');
          setNotice('Your account has been created. Check your email to confirm your address, then sign in.');
          return;
        }
        onAuthenticated({ email: session.user.email || email.trim(), name: session.user.user_metadata?.full_name || name.trim() || email.split('@')[0], accessToken: session.access_token });
        return;
      }
      const session = await companionAuth.signIn(email.trim(), password);
      onAuthenticated({ email: session.user.email || email.trim(), name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User', accessToken: session.access_token });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050713] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(31,57,130,.28),transparent_55%),radial-gradient(ellipse_at_85%_15%,rgba(13,148,136,.12),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(1px 1px at 12% 18%,#b8dfff 99%,transparent),radial-gradient(1px 1px at 78% 32%,#fff 99%,transparent),radial-gradient(1px 1px at 43% 72%,#7dd3fc 99%,transparent),radial-gradient(1px 1px at 88% 84%,#fff 99%,transparent)', backgroundSize: '230px 190px' }} />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <button onClick={() => changeMode('landing')} className="flex items-center gap-3" aria-label="Angel home">
          <img src="/assets/brand/angel_logo.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-sm font-semibold tracking-[.22em] text-white">ANGEL</span>
        </button>
        <div className="flex items-center gap-3">
          {mode === 'landing' ? (
            <>
              <button onClick={() => changeMode('signin')} className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:text-white">Sign in</button>
              <button onClick={() => changeMode('signup')} className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,.12)] transition hover:bg-cyan-300/20">Get started <ArrowRight className="ml-1 inline h-4 w-4" /></button>
            </>
          ) : (
            <button onClick={() => changeMode('landing')} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Angel</button>
          )}
        </div>
      </header>

      {mode === 'landing' ? (
        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 px-6 pb-16 pt-6 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
          <section className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-4 py-2 text-xs tracking-wide text-cyan-100"><Sparkles className="h-4 w-4" /> A more personal kind of intelligence</div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">Your world.<br/><span className="bg-gradient-to-r from-cyan-200 via-blue-300 to-violet-300 bg-clip-text text-transparent">One companion.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">A thoughtful space to explore ideas, work through complexity, create, and bring your digital world together.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button onClick={() => changeMode('signup')} className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_35px_rgba(14,165,233,.25)] transition hover:brightness-110">Create your account <ArrowRight className="ml-2 inline h-4 w-4" /></button>
              <button onClick={() => changeMode('signin')} className="rounded-full border border-white/15 bg-white/[.04] px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[.08]">I already have an account</button>
            </div>
            <div className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-6">
              <div><Sparkles className="mb-3 h-5 w-5 text-cyan-300"/><p className="text-sm font-medium text-white">Think</p><p className="mt-1 text-xs leading-5 text-slate-500">Explore and reason through ideas.</p></div>
              <div><Orbit className="mb-3 h-5 w-5 text-blue-300"/><p className="text-sm font-medium text-white">Create</p><p className="mt-1 text-xs leading-5 text-slate-500">Shape plans, projects and content.</p></div>
              <div><ShieldCheck className="mb-3 h-5 w-5 text-violet-300"/><p className="text-sm font-medium text-white">Keep context</p><p className="mt-1 text-xs leading-5 text-slate-500">Your private workspace, tied to your account.</p></div>
            </div>
          </section>
          <section className="relative mx-auto flex w-full max-w-xl items-center justify-center py-8">
            <div className="absolute h-[min(75vw,460px)] w-[min(75vw,460px)] rounded-full border border-cyan-200/10 shadow-[0_0_100px_rgba(59,130,246,.12),inset_0_0_80px_rgba(59,130,246,.08)]"/>
            <div className="absolute h-[min(62vw,360px)] w-[min(62vw,360px)] rotate-[-24deg] rounded-full border border-dashed border-blue-200/20"/>
            <div className="absolute h-[min(48vw,280px)] w-[min(48vw,280px)] rounded-full bg-cyan-400/10 blur-3xl"/>
            <img src="/assets/brand/angel_companion_clean.png" alt="Angel companion emblem" className="relative z-10 w-[min(65vw,390px)] drop-shadow-[0_0_55px_rgba(56,189,248,.3)]"/>
            <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#0a1024]/80 px-4 py-2 text-xs text-cyan-100 backdrop-blur-xl"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]"/> Your companion space begins here</div>
          </section>
        </main>
      ) : (
        <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-5 pb-14 pt-4">
          <div className="w-full max-w-md rounded-[28px] border border-indigo-300/15 bg-[#0a1024]/85 p-7 shadow-[0_25px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:p-9">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10"><LockKeyhole className="h-5 w-5 text-cyan-200"/></div>
              <div><p className="text-lg font-semibold text-white">{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your Angel account' : 'Reset your password'}</p><p className="mt-1 text-xs text-slate-400">{mode === 'signin' ? 'Sign in to continue to your private space.' : mode === 'signup' ? 'Your personal space, ready when you are.' : 'We’ll email you a secure recovery link.'}</p></div>
            </div>
            {error && <div role="alert" className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
            {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</div>}
            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && <label className="block text-xs font-medium text-slate-300">Your name<div className="relative mt-2"><UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Name" className="w-full rounded-xl border border-white/10 bg-[#050918] py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/60" /></div></label>}
              <label className="block text-xs font-medium text-slate-300">Email address<div className="relative mt-2"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-[#050918] py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/60"/></div></label>
              {mode !== 'forgot' && <label className="block text-xs font-medium text-slate-300">Password<div className="relative mt-2"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input type={showPassword?'text':'password'} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signin'?'current-password':'new-password'} placeholder="At least 8 characters" className="w-full rounded-xl border border-white/10 bg-[#050918] py-3 pl-10 pr-11 text-sm text-white outline-none transition focus:border-cyan-300/60"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></label>}
              <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(14,165,233,.2)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{busy?'Please wait…':mode==='signin'?'Sign in':mode==='signup'?'Create account':'Send recovery link'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
            </form>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-slate-400">
              {mode === 'signin' ? <><button onClick={()=>changeMode('forgot')} className="hover:text-cyan-200">Forgot password?</button><button onClick={()=>changeMode('signup')} className="font-semibold text-cyan-200 hover:text-white">Create account</button></> : mode === 'signup' ? <><span>Already registered?</span><button onClick={()=>changeMode('signin')} className="font-semibold text-cyan-200 hover:text-white">Sign in</button></> : <button onClick={()=>changeMode('signin')} className="font-semibold text-cyan-200 hover:text-white">Back to sign in</button>}
            </div>
            <p className="mt-5 text-center text-[11px] leading-5 text-slate-500">Your account is secured through Supabase Authentication. Never share your password or recovery link.</p>
          </div>
        </main>
      )}
      <footer className="relative z-10 px-6 pb-6 text-center text-[11px] text-slate-600">ANGEL COMPANION · A private space for your ideas and work</footer>
    </div>
  );
};
