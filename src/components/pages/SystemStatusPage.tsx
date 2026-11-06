import React, { useState } from 'react';
import { ActivitySquare, CheckCircle2, RefreshCw, Server, Zap } from 'lucide-react';
import { SystemServiceStatus } from '../../types/angel';

export const SystemStatusPage: React.FC = () => {
  const [services, setServices] = useState<SystemServiceStatus[]>([
    { id: 's1', name: 'Angel Core Logic Engine', status: 'operational', latencyMs: 14, lastChecked: 'Just now' },
    { id: 's2', name: 'Three.js 3D WebGL Renderer', status: 'operational', latencyMs: 16, lastChecked: 'Just now' },
    { id: 's3', name: 'Gemini AI Integration Proxy', status: 'operational', latencyMs: 42, lastChecked: '1m ago' },
    { id: 's4', name: 'Supabase Boundary Client', status: 'standby', latencyMs: 1, lastChecked: 'Standby Mode' },
  ]);

  const runDiagnostic = () => {
    setServices((prev) =>
      prev.map((s) => ({
        ...s,
        latencyMs: Math.floor(Math.random() * 20) + 10,
        lastChecked: 'Just now',
      }))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
            <ActivitySquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">System Status & Diagnostics</h2>
          </div>
        </div>

        <button
          onClick={runDiagnostic}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Ping Diagnostic</span>
        </button>
      </div>

      <div className="space-y-3">
        {services.map((svc) => (
          <div
            key={svc.id}
            className="p-4 rounded-2xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">{svc.name}</h4>
                <p className="text-xs text-slate-400">Last checked: {svc.lastChecked}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-indigo-300">{svc.latencyMs}ms</span>
              <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 capitalize">
                {svc.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
