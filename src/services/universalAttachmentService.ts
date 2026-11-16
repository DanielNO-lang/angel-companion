import { ComposerContext } from '../types/composer';
import { AttachmentRecord } from '../types/attachment';
import { fileStorageService } from './fileStorageService';
import { fileProcessingEngine } from './fileProcessingEngine';
import { storageService } from './storageService';
import { workspaceEngine } from './workspaceEngine';

const STORAGE_KEY_ATTACHMENTS_METADATA = 'angel_attachments_meta_v1';

export class UniversalAttachmentService {
  private metadataMap = new Map<string, AttachmentRecord>();
  private stagedMap = new Map<string, AttachmentRecord[]>();
  private activeUserId: string | null = null;

  constructor() {
    this.loadMetadata();
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  public setUserContext(userId: string | null): void {
    if (this.activeUserId !== userId) {
      this.activeUserId = userId;
      this.metadataMap.clear();
      this.stagedMap.clear();
      this.loadMetadata();
    }
  }

  private loadMetadata(): void {
    const loaded = storageService.load<Record<string, AttachmentRecord>>(
      this.scopedKey(STORAGE_KEY_ATTACHMENTS_METADATA),
      {}
    );
    Object.entries(loaded).forEach(([id, record]) => {
      this.metadataMap.set(id, record);
    });
  }

  private persistMetadata(): void {
    const obj: Record<string, AttachmentRecord> = {};
    this.metadataMap.forEach((v, k) => {
      obj[k] = v;
    });
    storageService.save(this.scopedKey(STORAGE_KEY_ATTACHMENTS_METADATA), obj);
  }

  public getContextKey(context: ComposerContext): string {
    const parts = [
      context.type,
      context.conversationId,
      context.studioId,
      context.projectId,
      context.workspaceId,
      context.agentId,
      context.learningSubject,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join('_') : 'general_default';
  }

  public getStagedAttachments(context: ComposerContext): AttachmentRecord[] {
    const key = this.getContextKey(context);
    return this.stagedMap.get(key) || [];
  }

  public clearStagedAttachments(context: ComposerContext): void {
    const key = this.getContextKey(context);
    this.stagedMap.delete(key);
  }

  public async stageAttachment(
    context: ComposerContext,
    file: { name: string; size: number; content: string | ArrayBuffer }
  ): Promise<{ success: boolean; attachment?: AttachmentRecord; error?: string }> {
    const key = this.getContextKey(context);
    const staged = this.stagedMap.get(key) || [];

    const validation = fileProcessingEngine.validateFile(file.name, file.size);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const existing = staged.find((a) => a.name === file.name && a.size === file.size);
    if (existing) {
      return {
        success: false,
        error: `Attachment "${file.name}" is already staged in this context.`,
      };
    }

    const mimeType = fileProcessingEngine.getMimeType(file.name);
    const processed = await fileProcessingEngine.processFile(file.name, file.content);

    const userPrefix = this.activeUserId ? `u_${this.activeUserId}_` : '';
    const storageRef = `${userPrefix}att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const saveResult = await fileStorageService.saveFile(storageRef, file.content);

    if (!saveResult.success) {
      return {
        success: false,
        error: saveResult.error || 'Failed to persist attachment to local storage.',
      };
    }

    const attachment: AttachmentRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      mimeType,
      size: file.size,
      createdAt: new Date().toISOString(),
      storageRef,
      context: { ...context },
      status: processed.status,
      category: processed.category,
      extractedText: processed.extractedText,
      summary: processed.summary,
      metadata: processed.metadata,
      error: processed.error,
    };

    staged.push(attachment);
    this.stagedMap.set(key, staged);
    this.metadataMap.set(attachment.id, attachment);
    this.persistMetadata();

    return { success: true, attachment };
  }

  public async removeStagedAttachment(
    context: ComposerContext,
    attachmentId: string
  ): Promise<boolean> {
    const key = this.getContextKey(context);
    const staged = this.stagedMap.get(key) || [];
    const index = staged.findIndex((a) => a.id === attachmentId);

    if (index === -1) return false;

    const [removed] = staged.splice(index, 1);
    this.stagedMap.set(key, staged);

    await fileStorageService.deleteFile(removed.storageRef);
    this.metadataMap.delete(removed.id);
    this.persistMetadata();

    return true;
  }

  public async commitAttachments(context: ComposerContext): Promise<AttachmentRecord[]> {
    const key = this.getContextKey(context);
    const staged = this.stagedMap.get(key) || [];
    if (staged.length === 0) return [];

    if (context.type === 'workspace') {
      const projId = context.projectId || 'proj_default';
      for (const att of staged) {
        const fileContent = await fileStorageService.getFile(att.storageRef);
        const textContent =
          typeof fileContent === 'string'
            ? fileContent
            : att.extractedText || `Binary file: ${att.name} (${att.size} bytes)`;

        workspaceEngine.addFileToProject(projId, att.name, textContent, 'document');
      }
    }

    const committed = [...staged];
    this.stagedMap.delete(key);
    return committed;
  }

  public getAttachmentsForContext(context: ComposerContext): AttachmentRecord[] {
    const targetKey = this.getContextKey(context);
    const results: AttachmentRecord[] = [];

    this.metadataMap.forEach((rec) => {
      if (this.getContextKey(rec.context) === targetKey) {
        results.push(rec);
      }
    });

    return results;
  }

  public getAttachment(id: string): AttachmentRecord | undefined {
    return this.metadataMap.get(id);
  }

  public async deleteAttachment(id: string): Promise<boolean> {
    const att = this.metadataMap.get(id);
    if (!att) return false;

    await fileStorageService.deleteFile(att.storageRef);
    this.metadataMap.delete(id);
    this.persistMetadata();
    return true;
  }

  public formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const universalAttachmentService = new UniversalAttachmentService();
