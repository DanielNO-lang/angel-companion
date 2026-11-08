import { StudioId } from './angel';

export type ComposerContextType =
  | 'general'
  | 'studio'
  | 'workspace'
  | 'adaptive'
  | 'agent_task'
  | 'learning';

export type ComposerMode =
  | 'Standard Intelligent'
  | 'Deep Research'
  | 'Code Analysis'
  | 'Creative Brainstorm';

export interface ComposerContext {
  type: ComposerContextType;
  conversationId?: string;
  studioId?: StudioId;
  projectId?: string;
  agentId?: string;
  learningSubject?: string;
  mode?: ComposerMode;
  capabilities?: string[];
  permissions?: string[];
  title?: string;
}

export interface ComposerSubmissionPayload {
  text: string;
  attachedFile?: { name: string; size: number; content?: string } | null;
  context: ComposerContext;
  timestamp: string;
  mode: ComposerMode;
}

export interface ComposerSubmissionResult {
  success: boolean;
  messageId?: string;
  taskId?: string;
  summaryText: string;
  error?: string;
  awaitingIntegrationReason?: string;
}
