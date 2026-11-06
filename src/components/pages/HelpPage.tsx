import React from 'react';
import { HelpCircle, Search, Keyboard, BookOpen, ShieldCheck } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-heading text-white">Help Center & Keyboard Shortcuts</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shortcuts Card */}
        <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Keyboard Shortcuts</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-xl bg-slate-900/60">
              <span className="text-slate-300">Universal Search Command Palette</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">Cmd + K</kbd>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-slate-900/60">
              <span className="text-slate-300">Close Overlay / Cancel Modal</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">ESC</kbd>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-slate-900/60">
              <span className="text-slate-300">Send Composer Prompt</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">Enter</kbd>
            </div>
          </div>
        </div>

        {/* User Guides */}
        <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Documentation Guides</h3>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <p className="p-2 rounded-xl bg-slate-900/60">1. Angel Home Design Specification & Locking</p>
            <p className="p-2 rounded-xl bg-slate-900/60">2. 3D Companion Orb Event State Engine</p>
            <p className="p-2 rounded-xl bg-slate-900/60">3. Supabase Schema Migration & Persistence Boundary</p>
          </div>
        </div>
      </div>
    </div>
  );
};
