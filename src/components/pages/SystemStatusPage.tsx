import React, { useEffect, useState } from 'react';
import { ActivitySquare, CheckCircle2, AlertTriangle, RefreshCw, Cloud, Cpu, ExternalLink } from 'lucide-react';
import { SystemServiceStatus } from '../../types/angel';
import { geminiModelService, type ModelHealthStatus } from '../../services/geminiModelService';
import { getSupabaseConfigState } from '../../services/supabaseClient';
import { cloudMigrationService, type CloudMigrationStatus } from '../../services/cloudMigrationService';
import { toFriendlyError } from '../../services/errorHandlingService';
import {
  PRODUCTION_APP_ORIGIN,
  isDevelopmentPreviewEnvironment,
  resolveDirectPreviewUrl,
} from '../../services/authValidation';

function mapModelStatusToServiceStatus(model: ModelHealthStatus): SystemServiceStatus['status'] {
  if (model.state === 'generation_successful' || model.state === 'provider_reachable') return 'operational';
  if (model.state === 'credentials_configured') return 'configured';
  if (model.state === 'credentials_missing') return 'standby';
  return 'unavailable';
}

export const SystemStatusPage: React.FC = () => {
  const [modelStatus, setModelStatus] = useState<ModelHealthStatus>(() => geminiModelService.getCachedStatus());
  const [migrationStatus, setMigrationStatus] = useState<CloudMigrationStatus>(() => cloudMigrationService.getStatus());
  const [isProbing, setIsProbing] = useState(false);
  const [lastDiagnosticAt, setLastDiagnosticAt] = useState<string>('Initial check');
  const supabaseConfig = getSupabaseConfigState();
  const isDevPreview =
    typeof window !== 'undefined' &&
    isDevelopmentPreviewEnvironment(window.location.hostname, import.meta.env.DEV);
  const directPreviewUrl =
    typeof window !== 'undefined' ? resolveDirectPreviewUrl(window.location.origin, '/app') : PRODUCTION_APP_ORIGIN;

  useEffect(() => {
    const unsubModel = geminiModelService.subscribeStatus(setModelStatus);
    const unsubMigration = cloudMigrationService.subscribe(setMigrationStatus);
    void geminiModelService.checkStatus(false, false);
    return () => {
      unsubModel();
      unsubMigration();
    };
  }, []);

  const runDiagnostic = async () => {
    setIsProbing(true);
    try {
      await geminiModelService.checkStatus(true, true, true);
      setLastDiagnosticAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      setIsProbing(false);
    }
  };

  const friendlyModelMessage =
    modelStatus.state === 'provider_unavailable'
      ? toFriendlyError(modelStatus.message, 'ai').userMessage
      : modelStatus.message;

  const services: SystemServiceStatus[] = [
    {
      id: 's1',
      name: `Gemini Conversation Backend (${modelStatus.activeModel || modelStatus.model})`,
      status: mapModelStatusToServiceStatus(modelStatus),
      latencyMs: modelStatus.latencyMs,
      lastChecked: modelStatus.state === 'generation_successful'
        ? `Live generation verified (${lastDiagnosticAt})`
        : friendlyModelMessage,
      detail: `Primary: ${modelStatus.model} • Fallbacks: ${(modelStatus.fallbackModels || ['gemini-3.8-flash', 'gemini-3.1-flash-lite']).join(' → ')}`,
    },
    {
      id: 's2',
      name: 'Cloud Auth & Persistence',
      status: supabaseConfig.isConfigured ? 'operational' : 'standby',
      latencyMs: null,
      lastChecked: supabaseConfig.isConfigured ? 'Active session protection' : 'Standby mode',
      detail: `Sync status: ${migrationStatus.state}${
        migrationStatus.lastMigratedAt ? ` • Last synced ${new Date(migrationStatus.lastMigratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
      }`,
    },
    {
      id: 's3',
      name: 'Angel Core & Scoped Storage Engines',
      status: 'operational',
      latencyMs: null,
      lastChecked: 'Per-user runtime isolation active',
      detail: 'Conversation, Memory, Library, Workspace, Studios, Agents & Permissions',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow angel-blurred-surface bg-slate-950/38 backdrop-blur-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-950/75 text-emerald-400">
            <ActivitySquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">System Status & Diagnostics</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live server model health check, authentication readiness, and cloud sync status.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isDevPreview && (
            <>
              <a
                href={directPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 text-indigo-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open AI Studio Preview</span>
              </a>
              <a
                href={PRODUCTION_APP_ORIGIN}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 text-emerald-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Production App</span>
              </a>
            </>
          )}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/70 hover:bg-slate-800/80 text-cyan-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Google AI Studio</span>
          </a>
          <button
            onClick={runDiagnostic}
            disabled={isProbing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isProbing ? 'animate-spin' : ''}`} />
            <span>{isProbing ? 'Checking Health...' : 'Run Health Check'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-2xl glass-panel angel-blurred-surface bg-slate-950/38 flex items-center gap-3">
          <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <span className="text-slate-400 block">Configured Primary Model</span>
            <span className="font-bold text-white">{modelStatus.model}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl glass-panel angel-blurred-surface bg-slate-950/38 flex items-center gap-3">
          <ActivitySquare className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <span className="text-slate-400 block">Measured Latency</span>
            <span className="font-bold text-white">
              {modelStatus.latencyMs !== null ? `${modelStatus.latencyMs}ms` : 'Not measured'}
            </span>
          </div>
        </div>
        <div className="p-4 rounded-2xl glass-panel angel-blurred-surface bg-slate-950/38 flex items-center gap-3">
          <Cloud className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-slate-400 block">Cloud Sync State</span>
            <span className="font-bold text-white capitalize">{migrationStatus.state}</span>
          </div>
        </div>
      </div>

      {Array.isArray(modelStatus.tierResults) && modelStatus.tierResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {modelStatus.tierResults.map((tier) => (
            <div
              key={tier.model}
              className="p-3.5 rounded-2xl glass-panel angel-blurred-surface bg-slate-950/38 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">{tier.tier} tier</span>
                <span className="font-mono font-semibold text-white truncate block">{tier.model}</span>
              </div>
              <span
                className={`font-semibold text-[11px] shrink-0 ${
                  tier.generationVerified
                    ? 'text-emerald-400'
                    : tier.modelsGetReachable
                      ? 'text-amber-300'
                      : 'text-rose-300'
                }`}
              >
                {tier.generationVerified ? 'Verified' : tier.modelsGetReachable ? 'Reachable' : 'Unavailable'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {services.map((svc) => (
          <div
            key={svc.id}
            className="p-4 rounded-2xl glass-panel angel-blurred-surface bg-slate-950/38 backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              {svc.status === 'operational' || svc.status === 'configured' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-sm font-bold text-white">{svc.name}</h4>
                <p className="text-xs text-slate-300 mt-0.5">{svc.lastChecked}</p>
                {svc.detail && <p className="text-[11px] text-slate-400 mt-0.5">{svc.detail}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
              <span className="text-indigo-300">
                {svc.latencyMs !== null ? `${svc.latencyMs}ms` : '—'}
              </span>
              <span className="capitalize text-slate-300">{svc.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
