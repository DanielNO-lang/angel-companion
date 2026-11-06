import React from 'react';
import { X, CheckCircle2, ActivitySquare, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface SystemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDetailsModal: React.FC<SystemDetailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const services = [
    { name: 'Angel Core Engine', status: 'Operational', latency: '12ms', uptime: '99.99%' },
    { name: 'Gemini AI API Proxy', status: 'Operational', latency: '45ms', uptime: '99.95%' },
    { name: 'Local State Memory Buffer', status: 'Operational', latency: '2ms', uptime: '100%' },
    { name: 'Supabase Integration Boundary', status: 'Standby / Local', latency: '< 1ms', uptime: '100%' },
    { name: 'Companion Orb Canvas Engine', status: 'Active (60 FPS)', latency: '16ms', uptime: '100%' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-3xl glass-panel-glow border border-indigo-500/40 bg-slate-950/95 text-slate-100 shadow-2xl p-6 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
              <ActivitySquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-xl font-bold font-heading text-white">System Status & Health</h2>
              </div>
              <p className="text-xs text-slate-400">All Systems Operational • Phase 1 Core Active</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Overview Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-slate-400 block mb-1">Uptime</span>
            <span className="text-lg font-bold text-emerald-400 font-heading">99.98%</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-slate-400 block mb-1">Avg Latency</span>
            <span className="text-lg font-bold text-indigo-300 font-heading">18ms</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-slate-400 block mb-1">Active Modules</span>
            <span className="text-lg font-bold text-cyan-300 font-heading">12 / 12</span>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-2 text-xs mb-4">
          <span className="font-semibold text-slate-300 block mb-2">Service Health Checklist:</span>
          {services.map((svc) => (
            <div 
              key={svc.name}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 border border-slate-800"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium text-slate-200">{svc.name}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                <span>{svc.latency}</span>
                <span className="text-emerald-400 font-semibold">{svc.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
