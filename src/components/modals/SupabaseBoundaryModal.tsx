import React, { useState } from 'react';
import { X, Database, Check, Copy, Code2, ShieldCheck, Server } from 'lucide-react';
import { getSupabaseConfigState, SUPABASE_SQL_MIGRATION_SCHEMA } from '../../services/supabaseClient';

interface SupabaseBoundaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseBoundaryModal: React.FC<SupabaseBoundaryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const config = getSupabaseConfigState();

  if (!isOpen) return null;

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-3xl glass-panel-glow angel-blurred-surface bg-slate-950/92 text-slate-100 p-6 z-10 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-950/80 text-indigo-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading text-white">Cloud Persistence Boundary</h2>
              <p className="text-xs text-slate-400">Schema, Auth & Row-Level Security Blueprint</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
          {/* Status Badge Banner */}
          <div className={`p-4 rounded-2xl angel-blurred-surface flex items-start gap-3 ${
            config.isConfigured
              ? 'bg-emerald-950/40 text-emerald-200'
              : 'bg-indigo-950/40 text-slate-200'
          }`}>
            <Server className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm mb-1">
                {config.isConfigured ? 'Cloud Persistence Connected' : 'Boundary Active'}
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {config.isConfigured ? 'Verified cloud persistence is connected.' : 'Account storage stays protected until cloud persistence is activated.'}
              </p>
            </div>
          </div>

          {/* Integration Specs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-slate-900/50 angel-blurred-surface">
              <span className="font-semibold text-slate-400 block mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Security Policy
              </span>
              <p className="text-slate-300 text-[11px]">Strict User-Scoped Row-Level Security (RLS) on all auth-linked tables.</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/50 angel-blurred-surface">
              <span className="font-semibold text-slate-400 block mb-1 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                Environment Boundary
              </span>
              <p className="text-[11px] text-indigo-200">
                Public project URL & publishable key only; signing secrets stay strictly server-side.
              </p>
            </div>
          </div>

          {/* SQL Migration Script Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300">Database SQL Migration Script:</span>
              <button
                onClick={handleCopySchema}
                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-indigo-300 text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied SQL' : 'Copy Migration SQL'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-2xl bg-slate-950/90 angel-blurred-surface font-mono text-[11px] text-indigo-200 overflow-x-auto max-h-48 scrollbar-thin">
              {SUPABASE_SQL_MIGRATION_SCHEMA}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
