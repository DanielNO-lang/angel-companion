import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Shield, ExternalLink } from 'lucide-react';
import { UserPreferences } from '../../types/angel';
import { geminiModelService, type ModelHealthStatus } from '../../services/geminiModelService';
import {
  PRODUCTION_APP_ORIGIN,
  isDevelopmentPreviewEnvironment,
  resolveDirectPreviewUrl,
} from '../../services/authValidation';

interface SettingsPageProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenAccountSecurity?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onToggleTheme,
  onOpenAccountSecurity,
}) => {
  const [prefs, setPrefs] = useState<UserPreferences>({
    theme,
    reduceMotion: false,
    voiceAutoPlay: true,
    orbSensitivity: 'medium',
    compactSidebar: false,
  });
  const [modelStatus, setModelStatus] = useState<ModelHealthStatus>(() => geminiModelService.getCachedStatus());

  useEffect(() => {
    return geminiModelService.subscribeStatus(setModelStatus);
  }, []);

  const isDevPreview =
    typeof window !== 'undefined' &&
    isDevelopmentPreviewEnvironment(window.location.hostname, import.meta.env.DEV);
  const directPreviewUrl =
    typeof window !== 'undefined' ? resolveDirectPreviewUrl(window.location.origin, '/app') : PRODUCTION_APP_ORIGIN;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow angel-blurred-surface bg-slate-950/38 backdrop-blur-2xl p-6 flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-indigo-600/25 text-indigo-300">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-white">System Settings & Preferences</h2>
        </div>
      </div>

      <div className="rounded-3xl glass-panel angel-blurred-surface bg-slate-950/38 backdrop-blur-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Interface Theme Mode</h3>
            <p className="text-xs text-slate-400">Toggle between Cosmic Dark Mode and Cloudy-Day Light Theme</p>
          </div>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-semibold shadow-md cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-200" />}
            <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Reduce Interface Motion</h3>
            <p className="text-xs text-slate-400">Simplify particle fields and background canvas movement</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.reduceMotion}
            onChange={(e) => setPrefs({ ...prefs, reduceMotion: e.target.checked })}
            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Voice Output Auto-Play</h3>
            <p className="text-xs text-slate-400">Synchronize audio response pulses with the Companion Orb</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.voiceAutoPlay}
            onChange={(e) => setPrefs({ ...prefs, voiceAutoPlay: e.target.checked })}
            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {onOpenAccountSecurity && (
          <div className="flex items-center justify-between pt-1 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Sign-In Identities & Security</h3>
              <p className="text-xs text-slate-400">Manage connected Google, Apple, Microsoft, GitHub, and email credentials</p>
            </div>
            <button
              type="button"
              onClick={onOpenAccountSecurity}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 text-xs font-semibold cursor-pointer"
            >
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Manage Account</span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div>
            <h3 className="text-sm font-bold text-white">AI Intelligence Console</h3>
            <p className="text-xs text-slate-400">
              Primary model: <span className="font-mono text-cyan-300">{modelStatus.model}</span>
              {modelStatus.fallbackModels && modelStatus.fallbackModels.length > 0
                ? ` • Fallbacks: ${modelStatus.fallbackModels.join(' → ')}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDevPreview && (
              <>
                <a
                  href={directPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-indigo-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open AI Studio Preview</span>
                </a>
                <a
                  href={PRODUCTION_APP_ORIGIN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Production App</span>
                </a>
              </>
            )}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-cyan-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Google AI Studio</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
