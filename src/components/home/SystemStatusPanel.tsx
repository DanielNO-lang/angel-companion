import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { geminiModelService, type ModelHealthStatus } from '../../services/geminiModelService';
import { getSupabaseConfigState } from '../../services/supabaseClient';
import { cloudMigrationService, type CloudMigrationStatus } from '../../services/cloudMigrationService';
import { companionData, type CloudSyncHealthState } from '../../services/companionData';

interface SystemStatusPanelProps {
  onOpenDetails: () => void;
}

function getStatusDisplay(status: ModelHealthStatus): {
  label: string;
  colorClass: string;
  dotClass: string;
  borderClass: string;
} {
  switch (status.state) {
    case 'generation_successful':
      return {
        label: 'Verified Live Generation',
        colorClass: 'text-emerald-400',
        dotClass: 'bg-emerald-400',
        borderClass: 'border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
      };
    case 'provider_reachable':
      return {
        label: 'Model Provider Reachable',
        colorClass: 'text-cyan-400',
        dotClass: 'bg-cyan-400',
        borderClass: 'border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]',
      };
    case 'credentials_configured':
      return {
        label: 'Credentials Configured',
        colorClass: 'text-sky-300',
        dotClass: 'bg-sky-300',
        borderClass: 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.65)]',
      };
    case 'provider_unavailable':
      return {
        label: 'Provider Unavailable',
        colorClass: 'text-rose-400',
        dotClass: 'bg-rose-400',
        borderClass: 'border-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)]',
      };
    case 'credentials_missing':
    default:
      return {
        label: 'Model Credentials Missing',
        colorClass: 'text-amber-400',
        dotClass: 'bg-amber-400',
        borderClass: 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]',
      };
  }
}

export const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({
  onOpenDetails,
}) => {
  const [modelStatus, setModelStatus] = useState<ModelHealthStatus>(() => geminiModelService.getCachedStatus());
  const [migrationStatus, setMigrationStatus] = useState<CloudMigrationStatus>(() => cloudMigrationService.getStatus());
  const [cloudHealth, setCloudHealth] = useState<CloudSyncHealthState>(() => companionData.getCloudSyncHealth());
  const supabaseConfig = getSupabaseConfigState();

  useEffect(() => {
    const unsubModel = geminiModelService.subscribeStatus(setModelStatus);
    const unsubMigration = cloudMigrationService.subscribe(setMigrationStatus);
    const unsubHealth = companionData.subscribeCloudSyncHealth(setCloudHealth);
    return () => {
      unsubModel();
      unsubMigration();
      unsubHealth();
    };
  }, []);

  const display = getStatusDisplay(modelStatus);
  const checkedLabel = (() => {
    const dt = new Date(modelStatus.checkedAt);
    return Number.isNaN(dt.getTime())
      ? 'Not checked'
      : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  })();

  return (
    <div className="rounded-3xl angel-blurred-surface bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl relative overflow-hidden flex flex-col justify-between min-h-[190px] h-full select-none">
      {/* Header & Honest Status Indicator */}
      <div>
        <h3 className="text-base font-bold font-heading text-white tracking-tight mb-2">System Status</h3>

        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${display.borderClass}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${display.dotClass}`} />
          </div>
          <span className={`text-xs font-bold ${display.colorClass}`}>{display.label}</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 font-normal truncate">
          {modelStatus.model} • Latency: {modelStatus.latencyMs !== null ? `${modelStatus.latencyMs}ms` : '—'} • Checked: {checkedLabel}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
          Auth/Cloud:{' '}
          {!supabaseConfig.isConfigured
            ? 'Standby'
            : cloudHealth.status === 'missing_tables'
              ? 'Migration Pending'
              : cloudHealth.status === 'degraded'
                ? 'Sync Deferred'
                : 'Active'}
          {migrationStatus.state !== 'idle' ? ` • Sync: ${migrationStatus.state}` : ''}
        </p>
      </div>

      {/* Diagnostic Signal Curve */}
      <div className="relative w-full h-14 my-1">
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

          <line x1="20" y1="50" x2="20" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="100" y1="20" x2="100" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="180" y1="32" x2="180" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="260" y1="25" x2="260" y2="65" stroke="rgba(56,189,248,0.3)" strokeWidth="1" strokeDasharray="2 2" />

          <path
            d="M 0 52 C 40 45, 40 20, 80 20 C 120 20, 120 50, 160 40 C 200 30, 200 52, 240 45 C 270 38, 280 15, 320 28"
            fill="none"
            stroke="url(#sineWaveGrad)"
            strokeWidth="2.5"
            filter="url(#sineGlow)"
          />

          <circle cx="80" cy="20" r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #38bdf8)" />
          <circle cx="160" cy="40" r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #38bdf8)" />
          <circle cx="240" cy="45" r="3" fill="#ffffff" filter="drop-shadow(0 0 6px #38bdf8)" />
          <circle cx="280" cy="18" r="3.5" fill="#ffffff" filter="drop-shadow(0 0 8px #60a5fa)" />
        </svg>
      </div>

      {/* View Details Button */}
      <div className="flex justify-end z-10">
        <button
          onClick={onOpenDetails}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0d1433]/70 hover:bg-[#121c45] text-xs font-medium text-slate-200 hover:text-white transition-all shadow-md group border-none cursor-pointer"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-300 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
