import {
  ComposerContext,
  ComposerMode,
  ComposerSubmissionResult,
} from '../types/composer';
import { conversationEngine } from './conversationEngine';
import { workspaceEngine } from './workspaceEngine';
import { agentEngine } from './agentEngine';
import { promptIntelligenceEngine } from './promptIntelligenceEngine';
import { storageService } from './storageService';

const STORAGE_KEYS = {
  drafts: 'angel_composer_drafts_v1',
  modes: 'angel_composer_modes_v1',
};

export class UniversalComposerService {
  private draftsMap: Map<string, string> = new Map();
  private modesMap: Map<string, ComposerMode> = new Map();
  private submittingMap: Map<string, boolean> = new Map();
  private errorsMap: Map<string, string | null> = new Map();

  constructor() {
    this.loadPersistence();
  }

  private loadPersistence(): void {
    const loadedDrafts = storageService.load<Record<string, string>>(STORAGE_KEYS.drafts, {});
    Object.entries(loadedDrafts).forEach(([k, v]) => {
      if (typeof v === 'string') this.draftsMap.set(k, v);
    });

    const loadedModes = storageService.load<Record<string, ComposerMode>>(STORAGE_KEYS.modes, {});
    Object.entries(loadedModes).forEach(([k, v]) => {
      if (v) this.modesMap.set(k, v);
    });
  }

  private savePersistence(): void {
    const draftsObj: Record<string, string> = {};
    this.draftsMap.forEach((v, k) => {
      if (v.trim()) draftsObj[k] = v;
    });
    storageService.save(STORAGE_KEYS.drafts, draftsObj);

    const modesObj: Record<string, ComposerMode> = {};
    this.modesMap.forEach((v, k) => {
      modesObj[k] = v;
    });
    storageService.save(STORAGE_KEYS.modes, modesObj);
  }

  public getContextKey(context: ComposerContext): string {
    const keyParts = [
      context.type,
      context.conversationId,
      context.studioId,
      context.projectId,
      context.agentId,
      context.learningSubject,
    ].filter(Boolean);

    return keyParts.length > 0 ? keyParts.join('_') : 'general_default';
  }

  public getDraft(context: ComposerContext): string {
    const key = this.getContextKey(context);
    return this.draftsMap.get(key) || '';
  }

  public setDraft(context: ComposerContext, text: string): void {
    const key = this.getContextKey(context);
    if (text) {
      this.draftsMap.set(key, text);
    } else {
      this.draftsMap.delete(key);
    }
    this.savePersistence();
  }

  public clearDraft(context: ComposerContext): void {
    const key = this.getContextKey(context);
    this.draftsMap.delete(key);
    this.savePersistence();
  }

  public getMode(context: ComposerContext): ComposerMode {
    const key = this.getContextKey(context);
    return context.mode || this.modesMap.get(key) || 'Standard Intelligent';
  }

  public setMode(context: ComposerContext, mode: ComposerMode): void {
    const key = this.getContextKey(context);
    this.modesMap.set(key, mode);
    this.savePersistence();
  }

  public isSubmitting(context: ComposerContext): boolean {
    const key = this.getContextKey(context);
    return Boolean(this.submittingMap.get(key));
  }

  public getError(context: ComposerContext): string | null {
    const key = this.getContextKey(context);
    return this.errorsMap.get(key) || null;
  }

  public clearError(context: ComposerContext): void {
    const key = this.getContextKey(context);
    this.errorsMap.delete(key);
  }

  public async submit(
    context: ComposerContext,
    text: string,
    attachedFile?: { name: string; size: number; content?: string } | null
  ): Promise<ComposerSubmissionResult> {
    const key = this.getContextKey(context);
    const trimmedText = text.trim();

    // 1. Validation: Agent tasks require an explicit agent & non-empty description
    if (context.type === 'agent_task') {
      if (!context.agentId) {
        const err = 'Agent task assignment requires a selected agent ID.';
        this.errorsMap.set(key, err);
        return { success: false, error: err, summaryText: err };
      }
      if (!trimmedText) {
        const err = 'Agent task assignment requires a meaningful task description.';
        this.errorsMap.set(key, err);
        return { success: false, error: err, summaryText: err };
      }
    } else {
      if (!trimmedText && !attachedFile) {
        const err = 'Message content or attached file is required.';
        this.errorsMap.set(key, err);
        return { success: false, error: err, summaryText: err };
      }
    }

    // 2. Prevent duplicate submission while in progress
    if (this.submittingMap.get(key)) {
      const err = 'Submission already in progress for this context.';
      this.errorsMap.set(key, err);
      return { success: false, error: err, summaryText: err };
    }

    this.submittingMap.set(key, true);
    this.errorsMap.delete(key);

    const mode = this.getMode(context);
    let fullContent = trimmedText;
    const attachments: string[] = [];

    if (attachedFile) {
      attachments.push(attachedFile.name);
      fullContent = trimmedText
        ? `${trimmedText}\n[Attached File: ${attachedFile.name}]`
        : `[Attached File: ${attachedFile.name}]`;
    }

    try {
      let result: ComposerSubmissionResult;

      switch (context.type) {
        case 'general': {
          let threadId = context.conversationId;
          if (!threadId) {
            const activeThread = conversationEngine.getActiveThread('general');
            threadId = activeThread.id;
          }

          const userMsg = await conversationEngine.addMessage(
            threadId,
            fullContent,
            'user',
            mode,
            attachments
          );

          const aiMsg = await conversationEngine.generateAssistantResponse(threadId);

          result = {
            success: true,
            messageId: aiMsg.id,
            summaryText: `Submitted message to General Conversation (${threadId}).`,
          };
          break;
        }

        case 'studio': {
          const studioId = context.studioId || 'research-studio';
          let threadId = context.conversationId;

          if (!threadId) {
            const activeStudioThread = conversationEngine.getActiveThread('studio', studioId);
            threadId = activeStudioThread.id;
          }

          const userMsg = await conversationEngine.addMessage(
            threadId,
            fullContent,
            'user',
            mode,
            attachments
          );

          const aiMsg = await conversationEngine.generateAssistantResponse(threadId);

          result = {
            success: true,
            messageId: aiMsg.id,
            summaryText: `Submitted message to Studio Conversation (${studioId}).`,
          };
          break;
        }

        case 'workspace': {
          const projId = context.projectId || 'proj_default';
          if (attachedFile) {
            workspaceEngine.addFileToProject(
              projId,
              attachedFile.name,
              attachedFile.content || `File content for ${attachedFile.name}`,
              'document'
            );
          }

          // Register instruction in project workspace
          workspaceEngine.addInstructionToProject(projId, fullContent);

          result = {
            success: true,
            summaryText: `Associated instruction with workspace project '${projId}'.`,
          };
          break;
        }

        case 'adaptive': {
          const presetId = context.projectId || 'research';
          const intent = promptIntelligenceEngine.analyzeInput(fullContent, {
            scope: 'studio',
            studioId: 'development-studio',
          });

          result = {
            success: true,
            summaryText: `Passed context for adaptive preset '${presetId}' into Prompt Intelligence Engine (Detected: ${intent.detectedTask}).`,
          };
          break;
        }

        case 'agent_task': {
          const agentId = context.agentId!;
          const agent = agentEngine.getAgent(agentId);

          if (!agent) {
            const err = `Agent with ID '${agentId}' not found.`;
            this.errorsMap.set(key, err);
            return { success: false, error: err, summaryText: err };
          }

          const execResult = await agentEngine.executeTask(agentId, trimmedText);

          if (!execResult.success) {
            const err = execResult.error || 'Agent task execution failed';
            this.errorsMap.set(key, err);
            return {
              success: false,
              error: err,
              summaryText: `Agent task failed: ${err}`,
            };
          }

          result = {
            success: true,
            taskId: `task_${Date.now()}`,
            summaryText: `Agent '${agent.name}' successfully executed task: "${trimmedText}".`,
          };
          break;
        }

        case 'learning': {
          const learningSubject = context.learningSubject || 'General Science';
          const thread = conversationEngine.createThread(
            'studio',
            'learning-education-studio',
            `Learning: ${learningSubject}`
          );

          const userMsg = await conversationEngine.addMessage(
            thread.id,
            fullContent,
            'user',
            mode,
            attachments
          );

          const aiMsg = await conversationEngine.generateAssistantResponse(thread.id);

          result = {
            success: true,
            messageId: aiMsg.id,
            summaryText: `Submitted learning query for subject '${learningSubject}'.`,
          };
          break;
        }

        default: {
          const activeThread = conversationEngine.getActiveThread('general');
          const aiMsg = await conversationEngine.generateAssistantResponse(activeThread.id);
          result = {
            success: true,
            messageId: aiMsg.id,
            summaryText: `Submitted fallback message to General Conversation.`,
          };
        }
      }

      this.clearDraft(context);
      return result;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to submit composer request.';
      this.errorsMap.set(key, errMsg);
      return {
        success: false,
        error: errMsg,
        summaryText: errMsg,
      };
    } finally {
      this.submittingMap.set(key, false);
    }
  }
}

export const universalComposerService = new UniversalComposerService();
