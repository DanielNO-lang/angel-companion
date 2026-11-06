import React, { useState } from 'react';
import { Wrench, Github, Slack, Database, Webhook, Plus, BookOpen, Settings } from 'lucide-react';
import { KnowledgeLibraryManager } from '../knowledge/KnowledgeLibraryManager';

export const ToolsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'knowledge'>('integrations');

  const [integrations, setIntegrations] = useState([
    { id: 'i1', name: 'GitHub Integration', type: 'Repository & PR Context', icon: Github, connected: true },
    { id: 'i2', name: 'Slack Messaging', type: 'Channel Notification Webhook', icon: Slack, connected: true },
    { id: 'i3', name: 'Google Workspace', type: 'Drive & Sheets API Scope', icon: Database, connected: false },
    { id: 'i4', name: 'Custom REST Webhook', type: 'HTTP Event Payload Handler', icon: Webhook, connected: false },
  ]);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header with Tab Toggle */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">Tool Extensions & Knowledge</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'integrations'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Integrations</span>
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'knowledge'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Library</span>
          </button>
        </div>
      </div>

      {activeTab === 'integrations' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-500/40 text-indigo-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{item.name}</h3>
                    <p className="text-xs text-slate-400">{item.type}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleConnection(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    item.connected
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {item.connected ? 'Connected' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <KnowledgeLibraryManager />
      )}
    </div>
  );
};
