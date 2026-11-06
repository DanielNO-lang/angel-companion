import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Loader2, Clock, AlertTriangle, Play, Pause, RefreshCw, Check, X, ShieldAlert } from 'lucide-react';
import { activityEngine, TaskRecord, TaskLifecycleStatus } from '../../services/activityEngine';

export const ActivitiesPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskLifecycleStatus | 'all'>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Workspace');
  const [showCreate, setShowCreate] = useState(false);

  const refreshTasks = () => {
    setTasks(activityEngine.getTasks(activeFilter));
  };

  useEffect(() => {
    refreshTasks();
  }, [activeFilter]);

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    activityEngine.createTask(newTaskTitle, newTaskCategory, 'user', 'Manually created task execution record', 'running');
    setNewTaskTitle('');
    setShowCreate(false);
    refreshTasks();
  };

  const handleApprove = (id: string) => {
    activityEngine.approveTask(id);
    refreshTasks();
  };

  const handleRetry = (id: string) => {
    activityEngine.retryTask(id);
    refreshTasks();
  };

  const handleStatusChange = (id: string, newStatus: TaskLifecycleStatus) => {
    activityEngine.updateTaskStatus(id, newStatus);
    refreshTasks();
  };

  const handleDelete = (id: string) => {
    activityEngine.deleteTask(id);
    refreshTasks();
  };

  const metrics = activityEngine.getMetricsSummary();

  const statusBadgeStyle: Record<TaskLifecycleStatus, { bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }> = {
    running: { bg: 'bg-blue-950/80', text: 'text-blue-300', border: 'border-blue-500/40', icon: Loader2 },
    scheduled: { bg: 'bg-indigo-950/80', text: 'text-indigo-300', border: 'border-indigo-500/40', icon: Clock },
    waiting_approval: { bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-500/40', icon: ShieldAlert },
    completed: { bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-500/40', icon: CheckCircle2 },
    failed_interrupted: { bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-500/40', icon: AlertTriangle },
    monitoring: { bg: 'bg-purple-950/80', text: 'text-purple-300', border: 'border-purple-500/40', icon: Activity },
    self_initiated: { bg: 'bg-cyan-950/80', text: 'text-cyan-300', border: 'border-cyan-500/40', icon: CheckCircle2 },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">Activities & Task Lifecycles</h2>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <span>{showCreate ? 'Cancel' : 'Create Task Record'}</span>
        </button>
      </div>

      {/* Task Creation Form */}
      {showCreate && (
        <div className="p-4 rounded-2xl glass-panel border border-indigo-500/40 bg-slate-900/90 flex flex-col sm:flex-row gap-3 items-center">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title (e.g. Execute AST Code Optimization)..."
            className="flex-1 bg-slate-950 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
          />
          <select
            value={newTaskCategory}
            onChange={(e) => setNewTaskCategory(e.target.value)}
            className="bg-slate-950 text-xs text-slate-200 border border-slate-800 px-3 py-2 rounded-xl"
          >
            <option value="Research">Research</option>
            <option value="Development">Development</option>
            <option value="Workspace">Workspace</option>
            <option value="Agents">Agents</option>
            <option value="Integrations">Integrations</option>
          </select>
          <button
            onClick={handleCreateTask}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            Dispatch Task
          </button>
        </div>
      )}

      {/* Metric Counters Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
        {[
          { label: 'Running', count: metrics.running, color: 'text-blue-400' },
          { label: 'Scheduled', count: metrics.scheduled, color: 'text-indigo-400' },
          { label: 'Approval Req.', count: metrics.waitingApproval, color: 'text-amber-400' },
          { label: 'Completed', count: metrics.completed, color: 'text-emerald-400' },
          { label: 'Failed', count: metrics.failed, color: 'text-rose-400' },
          { label: 'Monitoring', count: metrics.total, color: 'text-purple-400' },
          { label: 'Self-Initiated', count: metrics.selfInitiated, color: 'text-cyan-400' },
        ].map((m) => (
          <div key={m.label} className="p-3 rounded-2xl glass-panel border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 block truncate">{m.label}</span>
            <span className={`text-base font-bold font-heading ${m.color}`}>{m.count}</span>
          </div>
        ))}
      </div>

      {/* Status Lifecycle Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pt-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeFilter === 'all' ? 'bg-indigo-600 text-white' : 'glass-panel text-slate-400 hover:text-white'
          }`}
        >
          All Lifecycles ({metrics.total})
        </button>
        {(
          [
            'running',
            'scheduled',
            'waiting_approval',
            'completed',
            'failed_interrupted',
            'monitoring',
            'self_initiated',
          ] as TaskLifecycleStatus[]
        ).map((st) => (
          <button
            key={st}
            onClick={() => setActiveFilter(st)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
              activeFilter === st ? 'bg-indigo-600 text-white' : 'glass-panel text-slate-400 hover:text-white'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task Records Stream */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const style = statusBadgeStyle[task.status];
          const IconComp = style.icon;

          return (
            <div
              key={task.id}
              className="p-4 rounded-2xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl border ${style.bg} ${style.text} ${style.border}`}>
                  <IconComp className={`w-5 h-5 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{task.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {task.category}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">{task.details}</p>
                  {task.errorLog && (
                    <p className="text-xs text-rose-300 font-mono bg-rose-950/50 p-1.5 rounded border border-rose-500/30 mt-1">
                      {task.errorLog}
                    </p>
                  )}
                  <div className="text-[10px] text-slate-500 mt-1">
                    Initiated by {task.initiatedBy} • {task.createdAt}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Lifecycle States */}
              <div className="flex items-center gap-2 self-end md:self-center">
                {task.status === 'waiting_approval' && (
                  <button
                    onClick={() => handleApprove(task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Task</span>
                  </button>
                )}

                {task.status === 'failed_interrupted' && (
                  <button
                    onClick={() => handleRetry(task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Execution</span>
                  </button>
                )}

                {task.status === 'running' && (
                  <button
                    onClick={() => handleStatusChange(task.id, 'completed')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-900"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Complete</span>
                  </button>
                )}

                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-300 hover:bg-slate-900"
                  title="Delete Record"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
