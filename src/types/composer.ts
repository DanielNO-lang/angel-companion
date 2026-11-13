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
  | 'Think'
  | 'Deep Research'
  | 'Code Analysis'
  | 'Creative Brainstorm';

export interface ComposerContext {
  type: ComposerContextType;
  conversationId?: string;
  studioId?: StudioId;
  projectId?: string;
  workspaceId?: string;
  agentId?: string;
  learningSubject?: string;
  mode?: ComposerMode;
  capabilities?: string[];
  permissions?: string[];
  title?: string;
}

import { AttachmentRecord, LinkPreview } from './attachment';

export interface ComposerSubmissionPayload {
  text: string;
  attachedFile?: { name: string; size: number; content?: string } | null;
  attachedFiles?: AttachmentRecord[];
  linkPreviews?: LinkPreview[];
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
  attachments?: AttachmentRecord[];
  linkPreviews?: LinkPreview[];
}
