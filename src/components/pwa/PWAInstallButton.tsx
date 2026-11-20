import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  theme?: 'dark' | 'light';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  theme = 'dark',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const isLight = theme === 'light';

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Install Angel app for offline access"
        aria-label="Install Angel App"
        className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
          compact
            ? 'min-h-[28px] sm:min-h-[36px] px-2 sm:px-3 py-1 text-[10px] sm:text-xs'
            : 'px-3.5 py-2 text-xs'
        } ${
          isLight
            ? 'bg-sky-100/90 hover:bg-sky-200/90 text-blue-800 shadow-xs'
            : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 shadow-[0_0_16px_rgba(56,189,248,0.2)]'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Install Angel on iOS"
          aria-label="Install Angel on iOS"
          className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all cursor-pointer shrink-0 ${
            compact
              ? 'min-h-[28px] sm:min-h-[36px] px-2 sm:px-3 py-1 text-[10px] sm:text-xs'
              : 'px-3.5 py-2 text-xs'
          } ${
            isLight
              ? 'bg-white/80 hover:bg-white text-slate-800 shadow-xs'
              : 'bg-white/10 hover:bg-white/15 text-slate-200'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0b1026] text-slate-100 p-6 shadow-2xl border border-cyan-500/20">
              <h3 className="text-base font-bold font-heading text-white">Install Angel on iPhone / iPad</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                1. Tap the <strong className="text-white">Share</strong> button in Safari.
                <br />
                2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong> for quick launch and cached offline thread access.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-semibold text-white cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
