import React from 'react';
import { X, CheckCircle2, AlertCircle, Layers, Cpu, ArrowUpRight } from 'lucide-react';
import { FeatureMeta, FeatureStatusType } from '../../types/angel';

interface FeatureStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: FeatureMeta | null;
}

export const FeatureStatusModal: React.FC<FeatureStatusModalProps> = ({
  isOpen,
  onClose,
  feature,
}) => {
  if (!isOpen || !feature) return null;

  const statusBadgeStyle: Record<FeatureStatusType, { bg: string; text: string; border: string }> = {
    IMPLEMENTED: { bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-500/50' },
    PARTIALLY_IMPLEMENTED: { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-500/50' },
    UI_ONLY: { bg: 'bg-indigo-950/80', text: 'text-indigo-300', border: 'border-indigo-500/50' },
    AWAITING_CONFIGURATION: { bg: 'bg-purple-950/80', text: 'text-purple-300', border: 'border-purple-500/50' },
    NOT_IMPLEMENTED: { bg: 'bg-slate-900', text: 'text-slate-400', border: 'border-slate-700' },
    BLOCKED_BY_PLATFORM: { bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-500/50' },
  };

  const style = statusBadgeStyle[feature.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-3xl glass-panel-glow border border-indigo-500/40 bg-slate-950/95 text-slate-100 shadow-2xl p-6 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">{feature.category}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                {feature.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-xl font-bold font-heading text-white">{feature.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 text-xs">
          <div>
            <span className="text-slate-400 font-medium block mb-1">Module Overview:</span>
            <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
              {feature.description}
            </p>
          </div>

          {/* Requirements Checklist */}
          <div>
            <span className="text-slate-400 font-medium block mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              Requirements & Technical Specs:
            </span>
            <ul className="space-y-1.5">
              {feature.requirements.map((req: string, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-slate-300 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Dependencies & Phase */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-slate-400 font-medium block mb-1 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                Dependencies:
              </span>
              <div className="flex flex-wrap gap-1">
                {feature.dependencies.map((dep: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300">
                    {dep}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
              <span className="text-slate-400 font-medium block mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                Target Phase:
              </span>
              <span className="text-indigo-300 font-bold">{feature.targetPhase}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-500">Angel Modular Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-md flex items-center gap-1"
          >
            <span>Close Inspector</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
