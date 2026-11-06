import React from 'react';
import { User, Shield, Key, LogOut } from 'lucide-react';

export const AccountPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white shadow-xl">
          JD
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-heading text-white">John Doe</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-[10px] font-bold border border-indigo-500/40">
              Plan • Pro
            </span>
          </div>
          <p className="text-xs text-slate-400">danielokohnwachukwu22@gmail.com</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2">
          <span className="text-slate-400 font-medium block">Subscription Status</span>
          <div className="text-lg font-bold text-white font-heading">Pro Active</div>
          <p className="text-slate-400">Unlimited AI Companion queries, Three.js 3D Emblem rendering, and 8 Studio Workspaces included.</p>
        </div>

        <div className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2">
          <span className="text-slate-400 font-medium block">API Key Vault</span>
          <div className="text-sm font-semibold text-indigo-300">Managed via AI Studio System Proxy</div>
          <p className="text-slate-400">Keys are injected securely on the server side (GEMINI_API_KEY).</p>
        </div>
      </div>
    </div>
  );
};
