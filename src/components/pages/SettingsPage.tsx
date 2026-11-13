import React, { useState } from 'react';
import { Settings, Moon, Sun, Volume2, Shield, Eye } from 'lucide-react';
import { UserPreferences } from '../../types/angel';

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-white">System Settings & Preferences</h2>
        </div>
      </div>

      <div className="rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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
          <div className="flex items-center justify-between pt-1">
            <div>
              <h3 className="text-sm font-bold text-white">Sign-In Identities & Security</h3>
              <p className="text-xs text-slate-400">Manage connected Google, Apple, Microsoft, GitHub, and email credentials</p>
            </div>
            <button
              type="button"
              onClick={onOpenAccountSecurity}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold cursor-pointer"
            >
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Manage Account</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
