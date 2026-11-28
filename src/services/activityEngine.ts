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

const LEGACY_FABRICATED_ACTIVITY_IDS = new Set(['act_1', 'act_2', 'act_3', 'act_4', 'act_5']);

export class ActivityEngine {
  private tasks: TaskRecord[];
  private listeners = new Set<() => void>();

  constructor() {
    const loaded = storageService.load<TaskRecord[]>(STORAGE_KEYS.activities, []);
    this.tasks = Array.isArray(loaded)
      ? loaded.filter((t) => t && !LEGACY_FABRICATED_ACTIVITY_IDS.has(t.id))
      : [];
    if (Array.isArray(loaded) && this.tasks.length !== loaded.length) {
      this.persist();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // ignore listener failure
      }
    });
  }

  private persist() {
    storageService.save(STORAGE_KEYS.activities, this.tasks);
    this.notify();
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
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
    if (this.tasks.length > 100) {
      this.tasks = this.tasks.slice(0, 100);
    }
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
        task.durationMs = Math.max(0, Date.now() - start);
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
