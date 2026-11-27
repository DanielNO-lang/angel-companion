import { ComposerContext } from '../types/composer';
import { AttachmentRecord } from '../types/attachment';
import { fileStorageService } from './fileStorageService';
import { fileProcessingEngine, MAX_EXTRACTED_TEXT_CHARS } from './fileProcessingEngine';
import { storageService } from './storageService';
import { workspaceEngine } from './workspaceEngine';
import { companionData } from './companionData';
import type { ChatAttachmentPayload } from './geminiModelService';

const STORAGE_KEY_ATTACHMENTS_METADATA = 'angel_attachments_meta_v1';
const STORAGE_KEY_PENDING_DELETES = 'angel_att_pending_deletes_v1';

export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_SINGLE_INLINE_MEDIA_BYTES = 3 * 1024 * 1024; // 3 MB (keeps JSON base64 well below Netlify 6 MB limit)
export const MAX_TOTAL_INLINE_MEDIA_BYTES = 4200 * 1024; // 4.2 MB total raw bytes per /api/chat request

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function sanitizePersistedAttachment(record: AttachmentRecord): AttachmentRecord {
  const { ...safe } = record;
  // Guarantee raw binary / base64 is never persisted into metadata / localStorage / cloud JSON
  if (safe.metadata) {
    const cleanMeta = { ...safe.metadata };
    delete cleanMeta.base64;
    delete cleanMeta.inlineDataBase64;
    delete cleanMeta.rawBytes;
    safe.metadata = cleanMeta;
  }
  if (safe.extractedText && safe.extractedText.length > MAX_EXTRACTED_TEXT_CHARS) {
    safe.extractedText = safe.extractedText.slice(0, MAX_EXTRACTED_TEXT_CHARS);
  }
  return safe;
}

export class UniversalAttachmentService {
  private metadataMap = new Map<string, AttachmentRecord>();
  private stagedMap = new Map<string, AttachmentRecord[]>();
  private pendingCloudDeletes: string[] = [];
  private activeUserId: string | null = null;
  private accessToken: string | null = null;

  constructor() {
    this.loadMetadata();
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private isOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  public setUserContext(userId: string | null): void {
    this.setAuthContext(this.accessToken, userId);
  }

  public setAuthContext(token: string | null, userId?: string | null): void {
    const nextUserId = token ? userId || null : null;
    const identityChanged = this.activeUserId !== nextUserId;
    this.accessToken = token;

    if (identityChanged) {
      this.activeUserId = nextUserId;
      this.metadataMap.clear();
      this.stagedMap.clear();
      this.pendingCloudDeletes = [];
      this.loadMetadata();
    }

    if (token && nextUserId && companionData.isCloudConfigured() && !this.isOffline()) {
      void this.reconcilePendingCloudOperations();
    }
  }

  private loadMetadata(): void {
    const loaded = storageService.load<Record<string, AttachmentRecord>>(
      this.scopedKey(STORAGE_KEY_ATTACHMENTS_METADATA),
      {}
    );
    Object.entries(loaded).forEach(([id, record]) => {
      if (record) {
        this.metadataMap.set(id, sanitizePersistedAttachment(record));
      }
    });

    const loadedDeletes = storageService.load<string[]>(
      this.scopedKey(STORAGE_KEY_PENDING_DELETES),
      []
    );
    this.pendingCloudDeletes = Array.isArray(loadedDeletes) ? loadedDeletes : [];
  }

  private persistMetadata(): void {
    const obj: Record<string, AttachmentRecord> = {};
    this.metadataMap.forEach((v, k) => {
      obj[k] = sanitizePersistedAttachment(v);
    });
    storageService.save(this.scopedKey(STORAGE_KEY_ATTACHMENTS_METADATA), obj);
    storageService.save(this.scopedKey(STORAGE_KEY_PENDING_DELETES), this.pendingCloudDeletes);
  }

  public getPendingCloudDeletes(): string[] {
    return [...this.pendingCloudDeletes];
  }

  public async reconcilePendingCloudOperations(): Promise<void> {
    if (!this.accessToken || !this.activeUserId || !companionData.isCloudConfigured() || this.isOffline()) {
      return;
    }

    // 1. Flush any deferred storage object deletions
    if (this.pendingCloudDeletes.length > 0) {
      const remaining: string[] = [];
      for (const storagePath of this.pendingCloudDeletes) {
        try {
          const ok = await companionData.deletePrivateFile(this.accessToken, storagePath, this.activeUserId);
          if (!ok) remaining.push(storagePath);
        } catch {
          remaining.push(storagePath);
        }
      }
      if (remaining.length !== this.pendingCloudDeletes.length) {
        this.pendingCloudDeletes = remaining;
        this.persistMetadata();
      }
    }

    // 2. Retry any locally saved attachments that still need private cloud upload
    const toUpload = Array.from(this.metadataMap.values()).filter(
      (att) =>
        att.cloudStatus === 'local_only' ||
        att.cloudStatus === 'sync_failed'
    );
    for (const att of toUpload) {
      const bytes = await fileStorageService.getFile(att.storageRef);
      if (bytes === null) continue;
      try {
        const storagePath = await companionData.uploadPrivateFile(
          this.accessToken,
          this.activeUserId,
          att.id,
          att.name,
          bytes,
          att.mimeType,
          att.context?.conversationId || att.context?.studioId || att.context?.type || 'general'
        );
        att.storagePath = storagePath;
        att.cloudStatus = 'synced';
        this.metadataMap.set(att.id, att);
        this.persistMetadata();
      } catch {
        // Keep local copy and retry next reconnect
      }
    }
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

    if (staged.length >= MAX_CHAT_ATTACHMENTS) {
      return {
        success: false,
        error: `Maximum ${MAX_CHAT_ATTACHMENTS} attachments allowed per message.`,
      };
    }

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

    const attachmentId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userPrefix = this.activeUserId ? `u_${this.activeUserId}_` : '';
    const storageRef = `${userPrefix}att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const saveResult = await fileStorageService.saveFile(storageRef, file.content);

    if (!saveResult.success) {
      return {
        success: false,
        error: saveResult.error || 'Failed to persist attachment to local storage.',
      };
    }

    let storagePath: string | undefined;
    let cloudStatus: AttachmentRecord['cloudStatus'] = 'local_only';

    if (this.accessToken && this.activeUserId && companionData.isCloudConfigured() && !this.isOffline()) {
      try {
        storagePath = await companionData.uploadPrivateFile(
          this.accessToken,
          this.activeUserId,
          attachmentId,
          file.name,
          file.content,
          mimeType,
          context.conversationId || context.studioId || context.projectId || context.type || 'general'
        );
        cloudStatus = 'synced';
      } catch (err) {
        cloudStatus = 'sync_failed';
        companionData.reportEngineSyncError('companion_private_storage', err, {
          errorCode: 'ATTACHMENT_UPLOAD_FAILED',
          endpoint: '/storage/v1/object/companion-private',
          method: 'POST',
        });
      }
    }

    const attachment: AttachmentRecord = sanitizePersistedAttachment({
      id: attachmentId,
      name: file.name,
      mimeType,
      size: file.size,
      createdAt: new Date().toISOString(),
      storageRef,
      storagePath,
      cloudStatus,
      analysisMode: processed.analysisMode,
      context: { ...context },
      status: processed.status,
      category: processed.category,
      extractedText: processed.extractedText,
      summary: processed.summary,
      metadata: processed.metadata,
      error: processed.error,
    });

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
    await this.deleteCloudObjectOrQueue(removed.storagePath);
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

  public async buildChatPayloads(attachments?: AttachmentRecord[]): Promise<ChatAttachmentPayload[]> {
    if (!attachments || attachments.length === 0) return [];

    const payloads: ChatAttachmentPayload[] = [];
    let remainingInlineBudget = MAX_TOTAL_INLINE_MEDIA_BYTES;

    for (const att of attachments.slice(0, MAX_CHAT_ATTACHMENTS)) {
      const payload: ChatAttachmentPayload = {
        id: att.id,
        name: att.name,
        mimeType: att.mimeType,
        sizeBytes: att.size,
        ...(att.storagePath ? { storagePath: att.storagePath } : {}),
        ...(att.extractedText ? { extractedText: att.extractedText.slice(0, MAX_EXTRACTED_TEXT_CHARS) } : {}),
      };

      const isMultimodal = fileProcessingEngine.isMultimodalInlineMime(att.mimeType);
      const requiresInlineVision =
        att.analysisMode === 'multimodal_inline' && !att.extractedText;

      if (requiresInlineVision && att.size > MAX_SINGLE_INLINE_MEDIA_BYTES) {
        throw new Error(
          `"${att.name}" is too large for inline visual analysis (maximum 3 MB). Resize it or attach a smaller version.`
        );
      }

      if (requiresInlineVision && att.size > remainingInlineBudget) {
        throw new Error(
          `"${att.name}" exceeds the remaining attachment analysis budget. Send fewer or smaller visual files.`
        );
      }

      if (isMultimodal && att.size <= MAX_SINGLE_INLINE_MEDIA_BYTES && att.size <= remainingInlineBudget) {
        let rawBytes = await fileStorageService.getFile(att.storageRef);

        // Cross-device fallback: retrieve private bytes using short-lived signed URL if local IndexedDB has none
        if (
          rawBytes === null &&
          att.storagePath &&
          this.accessToken &&
          this.activeUserId &&
          companionData.isCloudConfigured() &&
          !this.isOffline()
        ) {
          try {
            rawBytes = await companionData.downloadPrivateFileBytes(
              this.accessToken,
              att.storagePath,
              this.activeUserId
            );
          } catch {
            // The integrity check below prevents metadata-only "visual analysis" success.
          }
        }

        if (rawBytes !== null) {
          const buffer =
            typeof rawBytes === 'string'
              ? new TextEncoder().encode(rawBytes).buffer
              : rawBytes;
          if (buffer.byteLength <= MAX_SINGLE_INLINE_MEDIA_BYTES && buffer.byteLength <= remainingInlineBudget) {
            payload.inlineDataBase64 = arrayBufferToBase64(buffer);
            remainingInlineBudget -= buffer.byteLength;
          }
        }
      }

      if (requiresInlineVision && !payload.inlineDataBase64) {
        throw new Error(
          `Angel could not access the original data for "${att.name}". Reattach the file on this device or restore its private cloud copy before asking Angel to analyse it.`
        );
      }

      payloads.push(payload);
    }

    return payloads;
  }

  public async getAttachmentDownloadUrl(att: AttachmentRecord): Promise<{
    url?: string;
    error?: string;
    revoke?: () => void;
  }> {
    const localData = await fileStorageService.getFile(att.storageRef);
    if (localData !== null) {
      const blob = new Blob([localData], { type: att.mimeType || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      return {
        url: blobUrl,
        revoke: () => URL.revokeObjectURL(blobUrl),
      };
    }

    if (att.storagePath && this.accessToken && this.activeUserId && companionData.isCloudConfigured()) {
      try {
        const signedUrl = await companionData.getPrivateSignedUrl(
          this.accessToken,
          att.storagePath,
          120,
          this.activeUserId
        );
        return { url: signedUrl };
      } catch (err: any) {
        return { error: err?.message || 'Unable to generate temporary private download link.' };
      }
    }

    return { error: 'Original file bytes are only cached on the device where it was uploaded.' };
  }

  private async deleteCloudObjectOrQueue(storagePath?: string): Promise<void> {
    if (!storagePath) return;
    if (this.accessToken && this.activeUserId && companionData.isCloudConfigured() && !this.isOffline()) {
      try {
        const deleted = await companionData.deletePrivateFile(this.accessToken, storagePath, this.activeUserId);
        if (deleted) return;
      } catch {
        // Queue below for retry
      }
    }
    if (!this.pendingCloudDeletes.includes(storagePath)) {
      this.pendingCloudDeletes.push(storagePath);
    }
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
    await this.deleteCloudObjectOrQueue(att.storagePath);
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
