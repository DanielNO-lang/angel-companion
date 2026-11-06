import { StudioId, ChatMessage, UserPreferences } from './angel';
export type { StudioId };

export type IntentType =
  | 'greeting'
  | 'conversational'
  | 'question_explanation'
  | 'research_investigation'
  | 'creative_media'
  | 'coding_development'
  | 'learning_education'
  | 'professional_intelligence'
  | 'personal_organization'
  | 'agent_automation'
  | 'device_environment'
  | 'general_task';

export type CapabilityCategory =
  | 'conversation'
  | 'research'
  | 'coding'
  | 'creative'
  | 'education'
  | 'professional'
  | 'personal'
  | 'automation'
  | 'device'
  | 'system';

export type CapabilityAvailability =
  | 'implemented_local'
  | 'implemented_awaiting_integration'
  | 'partially_implemented'
  | 'unavailable';

export type PermissionLevel =
  | 'none'
  | 'file_modification'
  | 'external_communication'
  | 'device_control'
  | 'destructive_action';

export interface PromptContext {
  scope: 'general' | 'studio';
  studioId?: StudioId;
  conversationHistory?: ChatMessage[];
  projectContext?: Record<string, any>;
  userPreferences?: UserPreferences;
}

export interface ParsedPromptIntent {
  rawInput: string;
  intent: IntentType;
  confidence: number;
  extractedEntities: Record<string, any>;
  detectedTask: string;
  isMultiStep: boolean;
  missingEssentialInfo: string[];
  clarificationQuestion?: string;
  recommendedStudioId?: StudioId;
  recommendedStudioReason?: string;
  selectedCapabilityIds: string[];
  permissionLevelRequired: PermissionLevel;
}

export interface PromptExecutionStepSpec {
  stepId: string;
  name: string;
  capabilityId: string;
  inputs: Record<string, any>;
  dependsOnStepIds: string[];
  requiresApproval: boolean;
}

export interface PromptExecutionSpec {
  id: string;
  scope: 'general' | 'studio';
  studioId?: StudioId;
  objective: string;
  systemInstruction: string;
  extractedConstraints: string[];
  requiredTools: string[];
  contextPayload: string;
  executionSteps: PromptExecutionStepSpec[];
  isValidated: boolean;
}

export interface CapabilityExecutionResult {
  success: boolean;
  capabilityId: string;
  outputData: any;
  summaryText: string;
  createdArtifacts?: Array<{ id: string; name: string; type: string }>;
  error?: string;
  awaitingIntegrationReason?: string;
}

export interface AngelCapability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  supportedInputTypes: string[];
  expectedOutputTypes: string[];
  dependencies: string[];
  status: CapabilityAvailability;
  permissionLevel: PermissionLevel;
  supportedStudios: (StudioId | 'all')[];
  handler: (input: any, context: PromptContext) => Promise<CapabilityExecutionResult>;
}

export type ExecutionPlanStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'waiting_approval';

export interface ExecutionPlanStep {
  id: string;
  name: string;
  capabilityId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  dependencies: string[];
  requiresApproval: boolean;
  result?: CapabilityExecutionResult;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  title: string;
  objective: string;
  scope: 'general' | 'studio';
  studioId?: StudioId;
  status: ExecutionPlanStatus;
  steps: ExecutionPlanStep[];
  createdAt: string;
  updatedAt: string;
  errorSummary?: string;
}

export interface StudioPromptConfig {
  studioId: StudioId;
  name: string;
  systemPromptPrefix: string;
  defaultConstraints: string[];
  supportedCapabilityCategories: CapabilityCategory[];
  disclaimers?: string[];
  humanSupervisionRequired?: boolean;
  samplePrompts: string[];
}

export interface PromptRecord {
  id: string;
  title: string;
  content: string;
  scope: 'general' | 'studio';
  studioId?: StudioId;
  intent: IntentType;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalityAdapterConfig {
  communicationStyle: 'concise' | 'detailed' | 'executive' | 'creative';
  reasoningDepth: 'standard' | 'deep_chain' | 'step_by_step';
  autonomyLevel: 'conservative' | 'balanced' | 'autonomous';
  humanSupervisionWarnings: boolean;
}
