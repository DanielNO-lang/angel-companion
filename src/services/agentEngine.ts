import { storageService, STORAGE_KEYS } from './storageService';
import { capabilityRegistry } from './capabilityRegistry';
import { permissionsEngine } from './permissionsEngine';
import { eventBus } from './AngelEventBus';
import { companionData } from './companionData';

export type AgentStatus = 'idle' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'blocked';

export interface AgentExecutionRecord {
  id: string;
  agentId: string;
  taskDescription: string;
  startedAt: string;
  completedAt?: string;
  status: 'completed' | 'failed' | 'blocked';
  result?: any;
  error?: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  objective: string;
  status: AgentStatus;
  toolRequirements: string[];
  requiredCapabilities?: string[];
  permissionBoundaries: ('read_files' | 'write_files' | 'execute_code' | 'network_fetch')[];
  executionCount: number;
  lastExecutionAt?: string;
  lastError?: string;
  lastTask?: string;
  lastResult?: any;
}

export interface WorkflowRule {
  id: string;
  agentId: string;
  name: string;
  triggerType: 'schedule' | 'event' | 'user_prompt';
  condition: string;
  action: string;
  isActive: boolean;
}

function createDefaultAgents(): AgentDefinition[] {
  return [
    {
      id: 'agent_research',
      name: 'Research Synthesis Agent',
      role: 'Literature Mining & Synthesis',
      objective: 'Analyze research topics, extract key methodologies, and formulate structured literature overviews.',
      status: 'idle',
      toolRequirements: ['Paper Synthesizer', 'Dataset Extraction'],
      requiredCapabilities: ['cap_research_synthesis'],
      permissionBoundaries: ['read_files', 'network_fetch'],
      executionCount: 0,
    },
    {
      id: 'agent_code',
      name: 'Code Generation Orchestrator',
      role: 'TypeScript & Architecture Specialist',
      objective: 'Generate TypeScript architectural scaffolds and verify source specifications.',
      status: 'idle',
      toolRequirements: ['AST Linter', 'Code Completion Engine'],
      requiredCapabilities: ['cap_code_generator'],
      permissionBoundaries: ['read_files', 'write_files', 'execute_code'],
      executionCount: 0,
    },
    {
      id: 'agent_data',
      name: 'Data & Analytics Agent',
      role: 'Telemetry & Visualization Specialist',
      objective: 'Analyze application metric datasets and compute telemetry distribution points.',
      status: 'idle',
      toolRequirements: ['Telemetry Parser', 'Chart Generator'],
      requiredCapabilities: ['cap_prof_intel_workflow'],
      permissionBoundaries: ['read_files'],
      executionCount: 0,
    },
    {
      id: 'agent_workflow',
      name: 'Workflow Automation Agent',
      role: 'Task Scheduler & Webhook Listener',
      objective: 'Coordinate multi-step event triggers and execution plan dispatches.',
      status: 'idle',
      toolRequirements: ['Webhook Listener', 'Cron Task Scheduler'],
      requiredCapabilities: ['cap_agent_workflow_trigger'],
      permissionBoundaries: ['network_fetch'],
      executionCount: 0,
    },
  ];
}

const HISTORY_KEY = 'angel_agent_execution_history_v1';

export class AgentEngine {
  private agents: AgentDefinition[] = createDefaultAgents();
  private executionHistory: AgentExecutionRecord[] = [];
  private cancelledRunTokens = new Set<string>();
  private accessToken: string | null = null;
  private activeUserId: string | null = null;
  private cloudHydrationToken: string | null = null;

  constructor() {
    this.loadCurrentScope();
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private loadCurrentScope(): void {
    const defaults = createDefaultAgents();
    const loaded = storageService.load<AgentDefinition[]>(
      this.scopedKey(STORAGE_KEYS.agentsState),
      defaults
    );

    this.agents = (Array.isArray(loaded) && loaded.length > 0 ? loaded : defaults).map((a) => {
      const def = defaults.find((d) => d.id === a.id);
      return {
        ...a,
        status: (['idle', 'queued', 'running', 'paused', 'completed', 'failed', 'blocked'].includes(a.status)
          ? a.status
          : 'idle') as AgentStatus,
        requiredCapabilities: a.requiredCapabilities || def?.requiredCapabilities || [],
        permissionBoundaries: a.permissionBoundaries || def?.permissionBoundaries || [],
      };
    });

    const hist = storageService.load<AgentExecutionRecord[]>(this.scopedKey(HISTORY_KEY), []);
    this.executionHistory = Array.isArray(hist) ? hist : [];
  }

  public setAuthContext(token: string | null, userId?: string | null): void {
    const nextUserId = token ? userId || null : null;
    const identityChanged = this.activeUserId !== nextUserId;
    this.accessToken = token;

    if (identityChanged) {
      this.activeUserId = nextUserId;
      this.cloudHydrationToken = null;
      this.cancelledRunTokens.clear();
      this.loadCurrentScope();
    }

    if (!token) {
      this.cloudHydrationToken = null;
      return;
    }

    if ((this.cloudHydrationToken !== token || identityChanged) && companionData.isCloudConfigured()) {
      this.cloudHydrationToken = token;
      void this.restoreCloud(token);
    }
  }

  private async restoreCloud(token: string): Promise<void> {
    const ownerId = this.activeUserId;
    if (!ownerId || !companionData.isCloudConfigured()) return;
    try {
      const cloudRecords = await companionData.loadAgentExecutions(token);
      if (this.accessToken !== token || this.activeUserId !== ownerId) return;

      const byId = new Map<string, AgentExecutionRecord>();
      cloudRecords.forEach((r) => byId.set(r.id, r));
      this.executionHistory.forEach((local) => {
        if (!byId.has(local.id)) byId.set(local.id, local);
      });

      this.executionHistory = Array.from(byId.values())
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 50);

      // Recompute honest executionCount from completed history records when cloud records exist
      if (cloudRecords.length > 0) {
        this.agents.forEach((agent) => {
          const completedCount = this.executionHistory.filter(
            (r) => r.agentId === agent.id && r.status === 'completed'
          ).length;
          if (completedCount > agent.executionCount) {
            agent.executionCount = completedCount;
          }
        });
      }
      this.persist(false);
    } catch (error) {
      companionData.reportEngineSyncError('companion_agent_executions', error);
    }
  }

  private persist(syncToCloud = true): void {
    storageService.save(this.scopedKey(STORAGE_KEYS.agentsState), this.agents);
    storageService.save(this.scopedKey(HISTORY_KEY), this.executionHistory);
    if (syncToCloud && this.accessToken && this.activeUserId && companionData.isCloudConfigured() && this.executionHistory.length > 0) {
      void companionData.syncAgentExecutions(this.accessToken, this.executionHistory, this.activeUserId).catch((error) => {
        companionData.reportEngineSyncError('companion_agent_executions', error);
      });
    }
  }

  getAgents(): AgentDefinition[] {
    return this.agents;
  }

  getAgent(id: string): AgentDefinition | undefined {
    return this.agents.find((a) => a.id === id);
  }

  getExecutionHistory(agentId?: string): AgentExecutionRecord[] {
    if (!agentId) return this.executionHistory;
    return this.executionHistory.filter((h) => h.agentId === agentId);
  }

  setAgentStatus(id: string, newStatus: AgentStatus): boolean {
    const agent = this.agents.find((a) => a.id === id);
    if (agent) {
      agent.status = newStatus;
      this.persist();
      return true;
    }
    return false;
  }

  pauseAgent(id: string): boolean {
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) return false;
    if (agent.status === 'running' || agent.status === 'queued') {
      agent.status = 'paused';
      this.persist();
      eventBus.publish('agent:execution_paused', { agentId: id });
      return true;
    }
    return false;
  }

  resumeAgent(id: string): boolean {
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) return false;
    if (agent.status === 'paused') {
      agent.status = 'queued';
      this.persist();
      eventBus.publish('agent:execution_started', { agentId: id });
      return true;
    }
    return false;
  }

  stopAgent(id: string): boolean {
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) return false;
    this.cancelledRunTokens.add(id);
    agent.status = 'idle';
    this.persist();
    eventBus.publish('agent:execution_stopped', { agentId: id });
    return true;
  }

  cancelAgent(id: string): boolean {
    return this.stopAgent(id);
  }

  async executeTask(
    agentId: string,
    taskDescription: string,
    inputs: Record<string, any> = {}
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) {
      return { success: false, error: `Agent with ID '${agentId}' not found.` };
    }

    if (!taskDescription || !taskDescription.trim()) {
      agent.status = 'failed';
      agent.lastError = 'Task description cannot be empty.';
      this.persist();
      return { success: false, error: 'Task description cannot be empty.' };
    }

    this.cancelledRunTokens.delete(agentId);
    agent.status = 'queued';
    agent.lastTask = taskDescription;
    this.persist();

    // Check explicit agent permission boundaries
    for (const boundary of agent.permissionBoundaries || []) {
      if (!permissionsEngine.isPermissionGranted(boundary)) {
        agent.status = 'blocked';
        agent.lastError = `Missing required permission boundary: ${boundary}`;
        this.recordHistory(agent.id, taskDescription, 'blocked', undefined, agent.lastError);
        this.persist();
        return { success: false, error: agent.lastError };
      }
    }

    // Check required capabilities and capability permission levels
    const reqCaps = agent.requiredCapabilities || [];
    for (const capId of reqCaps) {
      const cap = capabilityRegistry.getCapability(capId);
      if (!cap) {
        agent.status = 'blocked';
        agent.lastError = `Required capability '${capId}' is not registered.`;
        this.recordHistory(agent.id, taskDescription, 'blocked', undefined, agent.lastError);
        this.persist();
        return { success: false, error: agent.lastError };
      }

      if (cap.status === 'unavailable' || cap.status === 'integration_pending' || cap.status === 'implemented_awaiting_integration') {
        agent.status = 'blocked';
        agent.lastError = `Required capability '${cap.name}' is ${cap.status}.`;
        this.recordHistory(agent.id, taskDescription, 'blocked', undefined, agent.lastError);
        this.persist();
        return { success: false, error: agent.lastError };
      }

      if (cap.permissionLevel !== 'none') {
        const isGranted = permissionsEngine.isPermissionGranted(cap.permissionLevel as string);
        if (!isGranted) {
          agent.status = 'blocked';
          agent.lastError = `Missing required permission: ${cap.permissionLevel}`;
          this.recordHistory(agent.id, taskDescription, 'blocked', undefined, agent.lastError);
          this.persist();
          return { success: false, error: agent.lastError };
        }
      }
    }

    agent.status = 'running';
    agent.lastExecutionAt = new Date().toISOString();
    this.persist();
    eventBus.publish('agent:execution_started', { agentId: agent.id, task: taskDescription });

    try {
      let executionOutput: any = null;

      if (reqCaps.length > 0) {
        for (const capId of reqCaps) {
          if (this.cancelledRunTokens.has(agentId)) {
            throw new Error('Agent execution was cancelled.');
          }
          const capResult = await capabilityRegistry.executeCapability(
            capId,
            { text: taskDescription, ...inputs },
            { scope: 'general' }
          );

          if (!capResult.success) {
            throw new Error(capResult.error || capResult.summaryText);
          }
          executionOutput = capResult.outputData || capResult.summaryText;
        }
      } else {
        const fallbackRes = await capabilityRegistry.executeCapability(
          'cap_general_chat',
          { text: taskDescription },
          { scope: 'general' }
        );
        if (!fallbackRes.success) {
          throw new Error(fallbackRes.error || fallbackRes.summaryText);
        }
        executionOutput = fallbackRes.outputData;
      }

      if (this.cancelledRunTokens.has(agentId)) {
        agent.status = 'idle';
        agent.lastError = 'Agent execution was cancelled.';
        this.recordHistory(agent.id, taskDescription, 'failed', undefined, agent.lastError);
        this.persist();
        return { success: false, error: agent.lastError };
      }

      agent.status = 'completed';
      agent.executionCount += 1;
      agent.lastResult = executionOutput;
      agent.lastError = undefined;
      this.recordHistory(agent.id, taskDescription, 'completed', executionOutput);
      this.persist();
      eventBus.publish('task:completed', { agentId: agent.id, result: executionOutput });

      return { success: true, result: executionOutput };
    } catch (err: any) {
      agent.status = this.cancelledRunTokens.has(agentId) ? 'idle' : 'failed';
      agent.lastError = err?.message || 'Execution error';
      this.recordHistory(agent.id, taskDescription, 'failed', undefined, agent.lastError);
      this.persist();
      eventBus.publish('task:failed', { agentId: agent.id, errorMsg: agent.lastError });

      return { success: false, error: agent.lastError };
    }
  }

  private recordHistory(
    agentId: string,
    taskDescription: string,
    status: 'completed' | 'failed' | 'blocked',
    result?: any,
    error?: string
  ) {
    const record: AgentExecutionRecord = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      agentId,
      taskDescription,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status,
      result,
      error,
    };
    this.executionHistory.unshift(record);
    if (this.executionHistory.length > 50) {
      this.executionHistory.pop();
    }
  }
}

export const agentEngine = new AgentEngine();
