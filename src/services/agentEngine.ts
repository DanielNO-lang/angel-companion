import { storageService, STORAGE_KEYS } from './storageService';

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  objective: string;
  status: 'idle' | 'running' | 'paused' | 'stopped';
  toolRequirements: string[];
  permissionBoundaries: ('read_files' | 'write_files' | 'execute_code' | 'network_fetch')[];
  executionCount: number;
  lastExecutionAt?: string;
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

const DEFAULT_AGENTS: AgentDefinition[] = [
  {
    id: 'agent_research',
    name: 'Research Synthesis Agent',
    role: 'Literature Mining & Synthesis',
    objective: 'Automatically analyze uploaded documents, extract key citations, and generate summaries.',
    status: 'idle',
    toolRequirements: ['Paper Synthesizer', 'Dataset Extraction'],
    permissionBoundaries: ['read_files', 'network_fetch'],
    executionCount: 14,
    lastExecutionAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'agent_code',
    name: 'Code Generation Orchestrator',
    role: 'TypeScript & Architecture Specialist',
    objective: 'Refactor source modules, verify TypeScript types, and write automated unit tests.',
    status: 'running',
    toolRequirements: ['AST Linter', 'Code Completion Engine'],
    permissionBoundaries: ['read_files', 'write_files', 'execute_code'],
    executionCount: 28,
    lastExecutionAt: new Date().toISOString(),
  },
  {
    id: 'agent_data',
    name: 'Data & Analytics Agent',
    role: 'Telemetry & Visualization Specialist',
    objective: 'Monitor application operational metrics and compute performance latency averages.',
    status: 'idle',
    toolRequirements: ['Telemetry Parser', 'Chart Generator'],
    permissionBoundaries: ['read_files'],
    executionCount: 9,
    lastExecutionAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'agent_workflow',
    name: 'Workflow Automation Agent',
    role: 'Task Scheduler & Webhook Listener',
    objective: 'Dispatch scheduled cron tasks and listen for incoming HTTP event webhooks.',
    status: 'running',
    toolRequirements: ['Webhook Listener', 'Cron Task Scheduler'],
    permissionBoundaries: ['network_fetch'],
    executionCount: 19,
    lastExecutionAt: new Date().toISOString(),
  },
];

export class AgentEngine {
  private agents: AgentDefinition[];

  constructor() {
    this.agents = storageService.load<AgentDefinition[]>(
      STORAGE_KEYS.agentsState,
      DEFAULT_AGENTS
    );
  }

  private persist() {
    storageService.save(STORAGE_KEYS.agentsState, this.agents);
  }

  getAgents(): AgentDefinition[] {
    return this.agents;
  }

  setAgentStatus(id: string, newStatus: AgentDefinition['status']): boolean {
    const agent = this.agents.find((a) => a.id === id);
    if (agent) {
      agent.status = newStatus;
      if (newStatus === 'running') {
        agent.executionCount += 1;
        agent.lastExecutionAt = new Date().toISOString();
      }
      this.persist();
      return true;
    }
    return false;
  }

  pauseAgent(id: string): boolean {
    return this.setAgentStatus(id, 'paused');
  }

  resumeAgent(id: string): boolean {
    return this.setAgentStatus(id, 'running');
  }

  stopAgent(id: string): boolean {
    return this.setAgentStatus(id, 'stopped');
  }
}

export const agentEngine = new AgentEngine();
