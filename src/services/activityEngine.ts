import { storageService, STORAGE_KEYS } from './storageService';

export type TaskLifecycleStatus =
  | 'running'
  | 'scheduled'
  | 'waiting_approval'
  | 'completed'
  | 'failed_interrupted'
  | 'monitoring'
  | 'self_initiated';

export interface TaskRecord {
  id: string;
  title: string;
  category: string;
  status: TaskLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  initiatedBy: 'user' | 'angel_self' | 'scheduled_cron' | 'workflow';
  details?: string;
  errorLog?: string;
  requiresApproval?: boolean;
}

const DEFAULT_ACTIVITIES: TaskRecord[] = [
  {
    id: 'act_1',
    title: 'Research Analysis & Synthesis Task',
    category: 'Research',
    status: 'completed',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3500000).toISOString(),
    durationMs: 1200,
    initiatedBy: 'user',
    details: 'Parsed 14 scholarly references and generated executive abstract.',
  },
  {
    id: 'act_2',
    title: 'Autonomous Code Refactoring Pipeline',
    category: 'Development',
    status: 'running',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    durationMs: 0,
    initiatedBy: 'angel_self',
    details: 'Optimizing TypeScript module import paths and AST tree.',
  },
  {
    id: 'act_3',
    title: 'Database Schema Migration Approval',
    category: 'Storage',
    status: 'waiting_approval',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
    updatedAt: new Date(Date.now() - 1200000).toISOString(),
    durationMs: 0,
    initiatedBy: 'workflow',
    details: 'Awaiting user confirmation to execute PostgreSQL RLS migrations.',
    requiresApproval: true,
  },
  {
    id: 'act_4',
    title: 'Daily Telemetry & Diagnostic Scan',
    category: 'Monitoring',
    status: 'scheduled',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    durationMs: 320,
    initiatedBy: 'scheduled_cron',
    details: 'Scheduled to run every 12 hours.',
  },
  {
    id: 'act_5',
    title: 'External Webhook Connection Test',
    category: 'Integrations',
    status: 'failed_interrupted',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    updatedAt: new Date(Date.now() - 14400000).toISOString(),
    durationMs: 450,
    initiatedBy: 'user',
    details: 'Connection timed out after 3 retries.',
    errorLog: 'ERR_TIMEOUT: External provider returned 504 Gateway Timeout',
  },
];

export class ActivityEngine {
  private tasks: TaskRecord[];

  constructor() {
    this.tasks = storageService.load<TaskRecord[]>(
      STORAGE_KEYS.activities,
      DEFAULT_ACTIVITIES
    );
  }

  private persist() {
    storageService.save(STORAGE_KEYS.activities, this.tasks);
  }

  getTasks(filterStatus?: TaskLifecycleStatus | 'all'): TaskRecord[] {
    if (!filterStatus || filterStatus === 'all') return [...this.tasks];
    return this.tasks.filter((t) => t.status === filterStatus);
  }

  createTask(
    title: string,
    category: string,
    initiatedBy: TaskRecord['initiatedBy'] = 'user',
    details?: string,
    initialStatus: TaskLifecycleStatus = 'running'
  ): TaskRecord {
    const newTask: TaskRecord = {
      id: `task_${Date.now()}`,
      title,
      category,
      status: initialStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      durationMs: 0,
      initiatedBy,
      details,
    };

    this.tasks.unshift(newTask);
    this.persist();
    return newTask;
  }

  updateTaskStatus(id: string, newStatus: TaskLifecycleStatus, errorMsg?: string): boolean {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.status = newStatus;
      task.updatedAt = new Date().toISOString();
      if (errorMsg) task.errorLog = errorMsg;
      if (newStatus === 'completed' || newStatus === 'failed_interrupted') {
        const start = new Date(task.createdAt).getTime();
        task.durationMs = Date.now() - start;
      }
      this.persist();
      return true;
    }
    return false;
  }

  approveTask(id: string): boolean {
    const task = this.tasks.find((t) => t.id === id);
    if (task && task.status === 'waiting_approval') {
      task.status = 'running';
      task.updatedAt = new Date().toISOString();
      task.requiresApproval = false;
      this.persist();
      return true;
    }
    return false;
  }

  retryTask(id: string): boolean {
    const task = this.tasks.find((t) => t.id === id);
    if (task && task.status === 'failed_interrupted') {
      task.status = 'running';
      task.errorLog = undefined;
      task.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  deleteTask(id: string): boolean {
    const initialLen = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length < initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  getMetricsSummary() {
    return {
      total: this.tasks.length,
      running: this.tasks.filter((t) => t.status === 'running').length,
      waitingApproval: this.tasks.filter((t) => t.status === 'waiting_approval').length,
      completed: this.tasks.filter((t) => t.status === 'completed').length,
      failed: this.tasks.filter((t) => t.status === 'failed_interrupted').length,
      scheduled: this.tasks.filter((t) => t.status === 'scheduled').length,
      selfInitiated: this.tasks.filter((t) => t.status === 'self_initiated').length,
    };
  }
}

export const activityEngine = new ActivityEngine();
