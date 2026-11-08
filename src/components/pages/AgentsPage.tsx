import React, { useState, useEffect } from 'react';
import { Bot, Play, Pause, Square, Search, Cpu, Terminal, Database, ShieldCheck, AlertCircle } from 'lucide-react';
import { agentEngine, AgentDefinition } from '../../services/agentEngine';
import { UniversalComposer } from '../composer/UniversalComposer';

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [executingAgentId, setExecutingAgentId] = useState<string | null>(null);

  const refreshAgents = () => {
    setAgents([...agentEngine.getAgents()]);
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

  const handleDispatchTask = async (id: string) => {
    const taskText = taskInputs[id] || '';
    if (!taskText.trim()) return;

    setExecutingAgentId(id);
    await agentEngine.executeTask(id, taskText.trim());
    setExecutingAgentId(null);
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
            <p className="text-xs text-slate-400 mt-0.5">Define, validate capabilities, and dispatch honest agent tasks.</p>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((ag) => {
          const Icon = getAgentIcon(ag.id);
          const isRunning = ag.status === 'running';
          const isPaused = ag.status === 'paused';
          const isBlocked = ag.status === 'blocked';
          const isFailed = ag.status === 'failed';
          const isCompleted = ag.status === 'completed';

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
                      : isBlocked
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                      : isFailed
                      ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                      : isCompleted
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning
                        ? 'bg-emerald-400 animate-pulse'
                        : isPaused
                        ? 'bg-amber-400'
                        : isBlocked || isFailed
                        ? 'bg-rose-400'
                        : isCompleted
                        ? 'bg-cyan-400'
                        : 'bg-slate-500'
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

                {ag.lastError && (
                  <div className="flex items-start gap-1.5 p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{ag.lastError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] text-slate-400 font-medium">Boundaries:</span>
                  {ag.permissionBoundaries.map((b) => (
                    <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono">
                      {b}
                    </span>
                  ))}
                </div>

                {/* Task Assignment Input powered by UniversalComposer */}
                <div className="pt-2">
                  <UniversalComposer
                    context={{
                      type: 'agent_task',
                      agentId: ag.id,
                    }}
                    variant="compact"
                    onSubmitted={() => refreshAgents()}
                  />
                </div>
              </div>

              {/* Execution Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">{ag.executionCount} Real Executions</span>

                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <button
                      onClick={() => handlePause(ag.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : isPaused ? (
                    <button
                      onClick={() => handleResume(ag.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => handleStop(ag.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 font-semibold transition-all cursor-pointer"
                    title="Reset to Idle"
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
