import { storageService, STORAGE_KEYS } from './storageService';
import { capabilityRegistry } from './capabilityRegistry';
import { permissionsEngine } from './permissionsEngine';
import { eventBus } from './AngelEventBus';

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

// Predefined agent definitions with initial status idle and 0 fabricated executions
const DEFAULT_AGENTS: AgentDefinition[] = [
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

export class AgentEngine {
  private agents: AgentDefinition[];
  private executionHistory: AgentExecutionRecord[] = [];

  constructor() {
    const loaded = storageService.load<AgentDefinition[]>(
      STORAGE_KEYS.agentsState,
      DEFAULT_AGENTS
    );

    // Sanitize any stale fabricated running counts if loaded from previous mock sessions
    this.agents = loaded.map((a) => {
      // Find matching default for fresh metadata
      const def = DEFAULT_AGENTS.find((d) => d.id === a.id);
      return {
        ...a,
        status: (['idle', 'queued', 'running', 'paused', 'completed', 'failed', 'blocked'].includes(a.status) ? a.status : 'idle') as AgentStatus,
        requiredCapabilities: a.requiredCapabilities || def?.requiredCapabilities || [],
      };
    });

    this.executionHistory = storageService.load<AgentExecutionRecord[]>('angel_agent_execution_history_v1', []);
  }

  private persist() {
    storageService.save(STORAGE_KEYS.agentsState, this.agents);
    storageService.save('angel_agent_execution_history_v1', this.executionHistory);
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
    agent.status = 'idle';
    this.persist();
    eventBus.publish('agent:execution_stopped', { agentId: id });
    return true;
  }

  /**
   * Honest Execution:
   * 1. Requires an actual task description.
   * 2. Validates that required capabilities are registered and available.
   * 3. Checks permissions.
   * 4. Executes only through real registered capability handlers.
   * 5. Increments executionCount ONLY on genuine execution.
   * 6. Records actual execution results and failure logs.
   */
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

    // Lifecycle transition: queued
    agent.status = 'queued';
    agent.lastTask = taskDescription;
    this.persist();

    // Check required capabilities
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

      // Check permissions
      if (cap.permissionLevel !== 'none') {
        const isGranted = permissionsEngine.isPermissionGranted(cap.permissionLevel as any);
        if (!isGranted) {
          agent.status = 'blocked';
          agent.lastError = `Missing required permission: ${cap.permissionLevel}`;
          this.recordHistory(agent.id, taskDescription, 'blocked', undefined, agent.lastError);
          this.persist();
          return { success: false, error: agent.lastError };
        }
      }
    }

    // Lifecycle transition: running
    agent.status = 'running';
    agent.lastExecutionAt = new Date().toISOString();
    this.persist();
    eventBus.publish('agent:execution_started', { agentId: agent.id, task: taskDescription });

    try {
      let executionOutput: any = null;

      // Execute through registered capabilities
      if (reqCaps.length > 0) {
        for (const capId of reqCaps) {
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
        // Fallback to general conversational handler
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

      // Successful Genuine Execution
      agent.status = 'completed';
      agent.executionCount += 1;
      agent.lastResult = executionOutput;
      agent.lastError = undefined;
      this.recordHistory(agent.id, taskDescription, 'completed', executionOutput);
      this.persist();
      eventBus.publish('task:completed', { agentId: agent.id, result: executionOutput });

      return { success: true, result: executionOutput };
    } catch (err: any) {
      agent.status = 'failed';
      agent.lastError = err.message || 'Execution error';
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
