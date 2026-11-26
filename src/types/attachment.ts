import { ComposerContext } from './composer';

export type AttachmentStatus =
  | 'ready'
  | 'processing'
  | 'processed'
  | 'error'
  | 'pending_integration';

export type AttachmentCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'other';

export interface AttachmentRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  storageRef: string;
  storagePath?: string;
  cloudStatus?: 'local_only' | 'uploading' | 'synced' | 'sync_failed' | 'pending_delete';
  analysisMode?: 'extracted_text' | 'multimodal_inline' | 'metadata_only' | 'unsupported';
  context: ComposerContext;
  status: AttachmentStatus;
  category: AttachmentCategory;
  extractedText?: string;
  summary?: string;
  metadata?: Record<string, any>;
  error?: string;
}

export interface LinkPreview {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  favicon?: string;
  status: 'loaded' | 'fallback' | 'error';
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category: AttachmentCategory;
}
