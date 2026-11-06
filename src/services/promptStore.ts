import { PromptRecord } from '../types/promptEngine';
import { StudioId } from '../types/angel';
import { storageService } from './storageService';

const PROMPT_STORE_KEY = 'angel_prompt_records_v1';

class PromptStore {
  private prompts: Map<string, PromptRecord> = new Map();

  constructor() {
    this.loadPrompts();
    if (this.prompts.size === 0) {
      this.initDefaultPrompts();
    }
  }

  public getPrompt(id: string): PromptRecord | undefined {
    return this.prompts.get(id);
  }

  public getPrompts(scope?: 'general' | 'studio', studioId?: StudioId): PromptRecord[] {
    let list = Array.from(this.prompts.values());
    if (scope) {
      list = list.filter((p) => p.scope === scope);
    }
    if (studioId) {
      list = list.filter((p) => p.studioId === studioId);
    }
    return list.sort((a, b) => b.usageCount - a.usageCount);
  }

  public savePrompt(promptData: Omit<PromptRecord, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): PromptRecord {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: PromptRecord = {
      ...promptData,
      id,
      usageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.prompts.set(id, record);
    this.persistPrompts();
    return record;
  }

  public recordUsage(id: string): void {
    const prompt = this.prompts.get(id);
    if (prompt) {
      prompt.usageCount++;
      prompt.updatedAt = new Date().toISOString();
      this.persistPrompts();
    }
  }

  public deletePrompt(id: string): boolean {
    const deleted = this.prompts.delete(id);
    if (deleted) {
      this.persistPrompts();
    }
    return deleted;
  }

  public exportPromptsJSON(): string {
    return JSON.stringify(Array.from(this.prompts.values()), null, 2);
  }

  private persistPrompts(): void {
    storageService.save(PROMPT_STORE_KEY, Array.from(this.prompts.values()));
  }

  private loadPrompts(): void {
    const loaded = storageService.load<PromptRecord[]>(PROMPT_STORE_KEY, []);
    if (Array.isArray(loaded)) {
      loaded.forEach((p) => this.prompts.set(p.id, p));
    }
  }

  private initDefaultPrompts(): void {
    this.savePrompt({
      title: 'Universal Problem Breakdown',
      content: 'Break down the following request into actionable sub-tasks, identifying constraints and key deliverables.',
      scope: 'general',
      intent: 'question_explanation',
      tags: ['analysis', 'general', 'planning'],
    });

    this.savePrompt({
      title: 'Literature Synthesis Framework',
      content: 'Synthesize primary findings on this topic with methodology comparison and research limitations.',
      scope: 'studio',
      studioId: 'research-studio',
      intent: 'research_investigation',
      tags: ['research', 'academic', 'literature'],
    });

    this.savePrompt({
      title: 'AST Refactoring Specification',
      content: 'Analyze the given code module for type safety, modular decoupling, error boundaries, and performance.',
      scope: 'studio',
      studioId: 'development-studio',
      intent: 'coding_development',
      tags: ['coding', 'typescript', 'refactoring'],
    });
  }
}

export const promptStore = new PromptStore();
