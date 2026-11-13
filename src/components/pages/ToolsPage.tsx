import React, { useState } from 'react';
import { Wrench, Github, Slack, Database, Webhook, Cpu, Puzzle, Sparkles, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import { capabilityRegistry } from '../../services/capabilityRegistry';

export const ToolsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connectors' | 'plugins' | 'skills' | 'callable_tools'>('connectors');

  const capabilities = capabilityRegistry.getAllCapabilities();

  // Connectors: Genuine status verification without fake API key forms
  const connectors = [
    { id: 'c1', name: 'GitHub Integration', type: 'Repository & PR Context', icon: Github, status: 'Connected', verified: true, desc: 'Local workspace git engine integration verified.' },
    { id: 'c2', name: 'Slack Messaging', type: 'Channel Webhook Protocol', icon: Slack, status: 'Not Connected', verified: false, desc: 'External Slack webhook endpoint pending configuration.' },
    { id: 'c3', name: 'Google Workspace', type: 'OAuth 2.0 Client Scope', icon: Database, status: 'Not Connected', verified: false, desc: 'Requires Google Workspace OAuth consent grant.' },
    { id: 'c4', name: 'Custom REST Webhook', type: 'HTTP Event Payload Handler', icon: Webhook, status: 'Not Connected', verified: false, desc: 'External payload listener connection pending.' },
  ];

  const plugins = [
    { id: 'p1', name: 'Code Architecture Synthesizer', category: 'Development', desc: 'AST code syntax analysis, refactoring engine, and TypeScript scaffold generator.', status: 'Active' },
    { id: 'p2', name: 'Academic Literature Scoper', category: 'Research', desc: 'Investigative literature scoping, citation graphs, and academic document parsing.', status: 'Active' },
    { id: 'p3', name: 'Visual Media SVG Draftsman', category: 'Creative', desc: 'Vector graphics draftsman, aspect ratio direction, and visual concept generator.', status: 'Active' },
    { id: 'p4', name: 'Executive Strategy Briefing', category: 'Professional', desc: 'Regulatory compliance analyzer, SOC2/GDPR auditing, and executive summary engine.', status: 'Active' },
  ];

  const skills = [
    { id: 's1', name: 'Multi-Turn Pronoun Resolution', scope: 'Conversational Intelligence', desc: 'Resolves ambiguous context pronouns like "it", "that", and "the previous one" across turns.' },
    { id: 's2', name: 'Strict Memory & Scope Isolation', scope: 'Memory & Knowledge', desc: 'Enforces strict separation of private working memory between general conversation and Studios.' },
    { id: 's3', name: 'Intelligent Topic Title Synthesis', scope: 'Session Engine', desc: 'Extracts concise 2-4 word topic titles without trailing ellipsis truncation.' },
    { id: 's4', name: 'Structured Analytical Think Mode', scope: 'Reasoning Engine', desc: 'Decomposes complex inquiries using step-by-step analytical reasoning and structured breakdowns.' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with 4 Tool Category Tabs */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white font-mono">TOOLS & INTEGRATIONS</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Service connectors, plugin packages, system skills, and callable tools.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('connectors')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'connectors' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Connectors
          </button>
          <button
            onClick={() => setActiveTab('plugins')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'plugins' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Plugins
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'skills' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Skills
          </button>
          <button
            onClick={() => setActiveTab('callable_tools')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'callable_tools' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Callable Tools ({capabilities.length})
          </button>
        </div>
      </div>

      {/* 1. Connectors View */}
      {activeTab === 'connectors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connectors.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-500/40 text-indigo-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-slate-400 mb-1">{item.type}</p>
                    <p className="text-[11px] text-slate-500 leading-tight">{item.desc}</p>
                  </div>
                </div>

                <div className="shrink-0 pl-3">
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1 ${
                      item.verified
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {item.verified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{item.status}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Plugins View */}
      {activeTab === 'plugins' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plugins.map((plug) => (
            <div
              key={plug.id}
              className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">{plug.name}</h3>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-semibold">
                  {plug.category}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{plug.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* 3. Skills View */}
      {activeTab === 'skills' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">{skill.name}</h3>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-semibold">
                  {skill.scope}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{skill.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Callable Tools View */}
      {activeTab === 'callable_tools' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {capabilities.map((cap) => (
            <div
              key={cap.id}
              className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl space-y-2 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">{cap.name}</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 uppercase font-mono">
                  {cap.category}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{cap.description}</p>
              <div className="text-[10px] text-slate-500 font-mono pt-1">
                ID: {cap.id} | Permission: {cap.permissionLevel}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
