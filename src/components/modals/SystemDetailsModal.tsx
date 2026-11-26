import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, ActivitySquare, RefreshCw } from 'lucide-react';
import { geminiModelService, type ModelHealthStatus } from '../../services/geminiModelService';
import { getSupabaseConfigState } from '../../services/supabaseClient';
import { cloudMigrationService, type CloudMigrationStatus } from '../../services/cloudMigrationService';
import { companionData, type CloudSyncHealthState } from '../../services/companionData';
import { cloudSyncCoordinator } from '../../services/cloudSyncCoordinator';
import { conversationEngine } from '../../services/conversationEngine';
import { toFriendlyError } from '../../services/errorHandlingService';

interface SystemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDetailsModal: React.FC<SystemDetailsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [modelStatus, setModelStatus] = useState<ModelHealthStatus>(() => geminiModelService.getCachedStatus());
  const [migrationStatus, setMigrationStatus] = useState<CloudMigrationStatus>(() => cloudMigrationService.getStatus());
  const [cloudHealth, setCloudHealth] = useState<CloudSyncHealthState>(() => companionData.getCloudSyncHealth());
  const [isRetryingSync, setIsRetryingSync] = useState(false);

  useEffect(() => {
    const unsubModel = geminiModelService.subscribeStatus(setModelStatus);
    const unsubMigration = cloudMigrationService.subscribe(setMigrationStatus);
    const unsubCloud = companionData.subscribeCloudSyncHealth(setCloudHealth);
    return () => {
      unsubModel();
      unsubMigration();
      unsubCloud();
    };
  }, []);

  if (!isOpen) return null;

  const supabaseConfig = getSupabaseConfigState();
  const modelHealthy =
    modelStatus.state === 'generation_successful' ||
    modelStatus.state === 'provider_reachable' ||
    modelStatus.state === 'credentials_configured';

  const services = [
    {
      name: `Gemini AI Backend (${modelStatus.model})`,
      status: modelStatus.state.replace(/_/g, ' '),
      latency: modelStatus.latencyMs !== null ? `${modelStatus.latencyMs}ms` : '—',
      ok: modelHealthy,
    },
    {
      name: 'Supabase Auth & Persistence',
      status: !supabaseConfig.isConfigured
        ? 'Not Configured'
        : cloudHealth.status === 'missing_tables'
          ? 'Migration Pending'
          : cloudHealth.status === 'degraded'
            ? 'Sync Deferred'
            : 'Configured',
      latency: cloudHealth.missingTables.length > 0 ? `${cloudHealth.missingTables.length} table(s)` : 'PKCE + RLS',
      ok: supabaseConfig.isConfigured && cloudHealth.status === 'healthy',
    },
    {
      name: 'Local-to-Cloud Sync Engine',
      status: migrationStatus.state,
      latency: migrationStatus.lastMigratedAt
        ? new Date(migrationStatus.lastMigratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—',
      ok: migrationStatus.state !== 'error',
    },
    {
      name: 'Per-User Scoped State Engines',
      status: 'Active',
      latency: 'Local Cache',
      ok: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-3xl glass-panel-glow angel-blurred-surface bg-slate-950/92 text-slate-100 p-6 z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950/75 text-emerald-400">
              <ActivitySquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${modelHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <h2 className="text-xl font-bold font-heading text-white">System Status & Health</h2>
              </div>
              <p className="text-xs text-slate-400">
                {modelStatus.state === 'provider_unavailable'
                  ? toFriendlyError(modelStatus.message, 'ai', { logDiagnostic: false }).userMessage
                  : modelStatus.message}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close system status details"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Genuine Overview Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="p-3 rounded-2xl bg-slate-900/50 angel-blurred-surface text-center">
            <span className="text-slate-400 block mb-1">Active Model</span>
            <span className="text-sm font-bold text-cyan-300 font-heading truncate block">{modelStatus.model}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/50 angel-blurred-surface text-center">
            <span className="text-slate-400 block mb-1">Probe Latency</span>
            <span className="text-sm font-bold text-indigo-300 font-heading">
              {modelStatus.latencyMs !== null ? `${modelStatus.latencyMs}ms` : '—'}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/50 angel-blurred-surface text-center">
            <span className="text-slate-400 block mb-1">Live Generation</span>
            <span className={`text-sm font-bold font-heading ${modelStatus.generationVerified ? 'text-emerald-400' : 'text-amber-300'}`}>
              {modelStatus.generationVerified ? 'Verified' : 'Unverified'}
            </span>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-2 text-xs mb-4">
          <span className="font-semibold text-slate-300 block mb-2">Service Health Checklist:</span>
          {services.map((svc) => (
            <div
              key={svc.name}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/45 angel-blurred-surface"
            >
              <div className="flex items-center gap-2">
                {svc.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span className="font-medium text-slate-200">{svc.name}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                <span>{svc.latency}</span>
                <span className={`font-semibold capitalize ${svc.ok ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {svc.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Cloud sync error note & manual retry */}
        {(cloudHealth.status !== 'healthy' || conversationEngine.getOfflineCacheStatus().pendingCloudSync) && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-200">
            <span>{cloudHealth.lastError || 'Pending cloud changes are saved locally.'}</span>
            <button
              type="button"
              disabled={isRetryingSync}
              onClick={() => {
                setIsRetryingSync(true);
                void cloudSyncCoordinator.reconcilePendingSync().finally(() => setIsRetryingSync(false));
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-semibold shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetryingSync ? 'animate-spin' : ''}`} />
              <span>{isRetryingSync ? 'Syncing...' : 'Retry Sync'}</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 flex items-center justify-between">
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition-colors cursor-pointer"
          >
            Open Google AI Studio ↗
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
