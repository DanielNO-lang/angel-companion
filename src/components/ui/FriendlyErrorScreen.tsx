import React from 'react';
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import type { ThemeMode } from '../../services/authValidation';

interface FriendlyErrorScreenProps {
  title?: string;
  message: string;
  theme?: ThemeMode;
  variant?: 'fullscreen' | 'panel';
  goBackLabel?: string;
  tryAgainLabel?: string;
  onGoBack: () => void;
  onTryAgain?: () => void;
  showTryAgain?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

/**
 * Calm, atmospheric Angel error & recovery interface.
 * Renders only human-friendly messaging with primary Go Back and optional Try Again actions.
 */
export const FriendlyErrorScreen: React.FC<FriendlyErrorScreenProps> = ({
  title = "Something didn't go as planned",
  message,
  theme = 'dark',
  variant = 'fullscreen',
  goBackLabel = 'Go Back',
  tryAgainLabel = 'Try Again',
  onGoBack,
  onTryAgain,
  showTryAgain = Boolean(onTryAgain),
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  const isLight = theme === 'light';

  const card = (
    <div
      role="alert"
      aria-live="polite"
      data-testid="friendly-error-screen"
      className={`w-full max-w-md mx-auto rounded-[28px] p-6 sm:p-8 text-center space-y-5 angel-blurred-surface backdrop-blur-2xl ${
        isLight
          ? 'bg-white/75 text-slate-900 shadow-[0_0_60px_rgba(59,130,246,0.16)]'
          : 'bg-[#080d24]/75 text-slate-100 shadow-[0_0_70px_rgba(56,189,248,0.14)]'
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className={`absolute w-16 h-16 rounded-full blur-2xl ${
              isLight ? 'bg-sky-300/45' : 'bg-cyan-500/25'
            }`}
          />
          <AngelEmblem3D size={44} seed="friendly-error" renderMode="svg" rotationSpeed={18} />
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
            isLight
              ? 'bg-amber-100/80 text-amber-800'
              : 'bg-indigo-500/15 text-cyan-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Angel Recovery</span>
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">
          {title}
        </h1>
        <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          {message}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onGoBack}
          className="w-full sm:w-auto min-w-[140px] min-h-[44px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs sm:text-sm font-semibold shadow-[0_8px_24px_rgba(79,70,229,0.38)] flex items-center justify-center gap-2 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{goBackLabel}</span>
        </button>

        {showTryAgain && onTryAgain && (
          <button
            type="button"
            onClick={onTryAgain}
            className={`w-full sm:w-auto min-w-[140px] min-h-[44px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              isLight
                ? 'bg-white/90 hover:bg-white text-slate-800 shadow-sm'
                : 'bg-white/10 hover:bg-white/15 text-slate-100'
            }`}
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>{tryAgainLabel}</span>
          </button>
        )}
      </div>

      {secondaryActionLabel && onSecondaryAction && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onSecondaryAction}
            className={`text-xs font-semibold hover:underline cursor-pointer ${
              isLight ? 'text-blue-700' : 'text-cyan-300'
            }`}
          >
            {secondaryActionLabel}
          </button>
        </div>
      )}
    </div>
  );

  if (variant === 'panel') {
    return <div className="w-full py-6 px-4 flex items-center justify-center">{card}</div>;
  }

  return (
    <div
      className={`relative z-20 min-h-screen w-full flex items-center justify-center px-4 py-10 ${
        isLight
          ? 'bg-gradient-to-b from-sky-100 via-blue-50 to-indigo-100 text-slate-900'
          : 'bg-[#070815] text-slate-100'
      }`}
    >
      {card}
    </div>
  );
};
