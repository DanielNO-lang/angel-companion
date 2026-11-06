import React from 'react';
import { ArrowRight } from 'lucide-react';

interface SystemStatusPanelProps {
  onOpenDetails: () => void;
}

export const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({
  onOpenDetails,
}) => {
  return (
    <div className="rounded-3xl bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[190px] h-full shadow-[0_8px_30px_rgba(0,0,0,0.35)] select-none">
      {/* Header & Status Indicator */}
      <div>
        <h3 className="text-base font-bold font-heading text-white tracking-tight mb-2">System Status</h3>

        <div className="flex items-center gap-2">
          {/* Green hollow glowing ring indicator matching reference */}
          <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-bold text-emerald-400">All Systems Operational</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Last updated: 2 min ago</p>
      </div>

      {/* Glowing Neon Blue Sinus Wave Graph with Drop Stalks matching reference */}
      <div className="relative w-full h-16 my-1">
        <svg viewBox="0 0 320 65" className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sineWaveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            <filter id="sineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Vertical Drop Stalks */}
          <line x1="20" y1="50" x2="20" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="60" y1="38" x2="60" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="100" y1="20" x2="100" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="140" y1="42" x2="140" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="180" y1="32" x2="180" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="220" y1="48" x2="220" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="260" y1="25" x2="260" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="300" y1="35" x2="300" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Sine Wave Curve */}
          <path
            d="M 0 52 C 40 45, 40 20, 80 20 C 120 20, 120 50, 160 40 C 200 30, 200 52, 240 45 C 270 38, 280 15, 320 28"
            fill="none"
            stroke="url(#sineWaveGrad)"
            strokeWidth="2.5"
            filter="url(#sineGlow)"
          />

          {/* Glowing Nodes */}
          <circle cx="80" cy="20" r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #38bdf8)" />
          <circle cx="160" cy="40" r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #38bdf8)" />
          <circle cx="240" cy="45" r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #38bdf8)" />
          <circle cx="280" cy="18" r="3.5" fill="#ffffff" filter="drop-shadow(0 0 8px #60a5fa)" />
        </svg>
      </div>

      {/* Pill Button: "View Details ->" matching reference */}
      <div className="flex justify-end z-10">
        <button
          onClick={onOpenDetails}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0d1433]/70 hover:bg-[#121c45] text-xs font-medium text-slate-200 hover:text-white transition-all shadow-md group border-none"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
