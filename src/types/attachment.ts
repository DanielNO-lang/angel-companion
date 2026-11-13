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
