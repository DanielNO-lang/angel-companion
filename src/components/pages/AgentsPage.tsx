import React, { useState, useEffect } from 'react';
import { Bot, Play, Pause, Square, Search, Cpu, Terminal, Database, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { agentEngine, AgentDefinition } from '../../services/agentEngine';

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  const refreshAgents = () => {
    setAgents(agentEngine.getAgents());
  };

  useEffect(() => {
    refreshAgents();
  }, []);

  const handlePause = (id: string) => {
    agentEngine.pauseAgent(id);
    refreshAgents();
  };

  const handleResume = (id: string) => {
    agentEngine.resumeAgent(id);
    refreshAgents();
  };

  const handleStop = (id: string) => {
    agentEngine.stopAgent(id);
    refreshAgents();
  };

  const getAgentIcon = (id: string) => {
    if (id.includes('research')) return Search;
    if (id.includes('code')) return Terminal;
    if (id.includes('data')) return Database;
    return Cpu;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">Agents & Multi-Agent Orchestration</h2>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((ag) => {
          const Icon = getAgentIcon(ag.id);
          const isRunning = ag.status === 'running';
          const isPaused = ag.status === 'paused';

          return (
            <div
              key={ag.id}
              className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-500/40 text-indigo-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{ag.name}</h3>
                    <p className="text-xs text-slate-400">{ag.role}</p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                    isRunning
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : isPaused
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-amber-400' : 'bg-slate-500'
                    }`}
                  />
                  <span className="capitalize">{ag.status}</span>
                </span>
              </div>

              {/* Objectives & Permission Boundaries */}
              <div className="space-y-2 text-xs">
                <p className="text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-indigo-300 font-bold block mb-0.5">Objective:</span>
                  {ag.objective}
                </p>

                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] text-slate-400 font-medium">Boundaries:</span>
                  {ag.permissionBoundaries.map((b) => (
                    <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono">
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Execution Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">{ag.executionCount} Executions</span>

                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <button
                      onClick={() => handlePause(ag.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResume(ag.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Dispatch</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleStop(ag.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 font-semibold transition-all"
                    title="Stop Agent Worker"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
