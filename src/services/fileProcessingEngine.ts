import JSZip from 'jszip';
import { AttachmentCategory, AttachmentStatus, FileValidationResult } from '../types/attachment';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bin', 'msi', 'dll', 'scr', 'vbs',
  'app', 'com', 'pif', 'jar', 'cpl', 'msc', 'hta', 'reg'
]);

const EXTENSION_CATEGORIES: Record<string, AttachmentCategory> = {
  // Documents
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  txt: 'document',
  md: 'document',
  markdown: 'document',
  rtf: 'document',
  odt: 'document',
  // Spreadsheets
  csv: 'spreadsheet',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  tsv: 'spreadsheet',
  // Presentations
  ppt: 'presentation',
  pptx: 'presentation',
  // Images
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  svg: 'image',
  bmp: 'image',
  // Audio
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  flac: 'audio',
  aac: 'audio',
  // Video
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  // Archives
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  // Code
  ts: 'code',
  tsx: 'code',
  js: 'code',
  jsx: 'code',
  json: 'code',
  html: 'code',
  css: 'code',
  sql: 'code',
  py: 'code',
  yaml: 'code',
  yml: 'code',
};

export class FileProcessingEngine {
  public validateFile(name: string, sizeBytes: number): FileValidationResult {
    const ext = this.getExtension(name);

    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Executable or script file type (.${ext}) is rejected for security.`,
        category: 'other',
      };
    }

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
      const fileMb = (sizeBytes / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${fileMb}MB) exceeds maximum allowed limit (${maxMb}MB).`,
        category: 'other',
      };
    }

    const category = EXTENSION_CATEGORIES[ext] || 'other';
    return { valid: true, category };
  }

  public getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  public getMimeType(filename: string): string {
    const ext = this.getExtension(filename);
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      zip: 'application/zip',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  public async processFile(
    filename: string,
    content: string | ArrayBuffer
  ): Promise<{
    status: AttachmentStatus;
    category: AttachmentCategory;
    extractedText?: string;
    summary?: string;
    metadata?: Record<string, any>;
    error?: string;
  }> {
    const ext = this.getExtension(filename);
    const category = EXTENSION_CATEGORIES[ext] || 'other';

    try {
      switch (ext) {
        case 'txt':
        case 'md':
        case 'markdown':
        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
        case 'json':
        case 'html':
        case 'css':
        case 'sql':
        case 'py': {
          const text = typeof content === 'string'
            ? content
            : new TextDecoder('utf-8').decode(content);

          const lines = text.split('\n');
          return {
            status: 'processed',
            category,
            extractedText: text,
            summary: `Text document: ${lines.length} lines, ${text.length} characters.`,
            metadata: { lineCount: lines.length, charCount: text.length },
          };
        }

        case 'csv':
        case 'tsv': {
          const raw = typeof content === 'string'
            ? content
            : new TextDecoder('utf-8').decode(content);

          const delimiter = ext === 'tsv' ? '\t' : ',';
          const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
          const headers = lines[0] ? lines[0].split(delimiter).map((h) => h.trim()) : [];
          const rowCount = Math.max(0, lines.length - 1);

          return {
            status: 'processed',
            category: 'spreadsheet',
            extractedText: raw,
            summary: `Tabular spreadsheet: ${rowCount} rows, ${headers.length} columns (${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}).`,
            metadata: { rowCount, columnCount: headers.length, headers },
          };
        }

        case 'docx': {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(content);
          const documentXml = loadedZip.file('word/document.xml');

          if (!documentXml) {
            return {
              status: 'ready',
              category: 'document',
              summary: 'Word document (.docx) structure loaded, but word/document.xml was not found.',
              metadata: { format: 'docx' },
            };
          }

          const xmlText = await documentXml.async('string');
          // Extract <w:t> tags containing document text
          const textMatches: string[] = [];
          const regex = /<w:t[^>]*>(.*?)<\/w:t>/g;
          let match;
          while ((match = regex.exec(xmlText)) !== null) {
            textMatches.push(match[1]);
          }

          const extracted = textMatches.join(' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          const words = extracted.split(/\s+/).filter(Boolean);

          return {
            status: 'processed',
            category: 'document',
            extractedText: extracted,
            summary: `Word Document (.docx): ${words.length} words extracted locally.`,
            metadata: { wordCount: words.length },
          };
        }

        case 'doc': {
          return {
            status: 'ready',
            category: 'document',
            summary: 'Legacy Binary DOC format preserved safely. (Text extraction is optimized for modern .docx standards).',
            metadata: { format: 'doc_binary' },
          };
        }

        case 'pdf': {
          const rawString = typeof content === 'string'
            ? content
            : new TextDecoder('latin1').decode(content);

          // Count pages by counting occurrences of /Type /Page (standard PDF indicator)
          const pageMatches = rawString.match(/\/Type\s*\/Page\b/g);
          const pageCount = pageMatches ? pageMatches.length : 1;

          // Attempt to extract plain uncompressed text chunks between BT (begin text) and ET (end text)
          const textChunks: string[] = [];
          const btRegex = /BT[\s\S]*?ET/g;
          let btMatch;
          while ((btMatch = btRegex.exec(rawString)) !== null) {
            const block = btMatch[0];
            const tjRegex = /\((.*?)\)\s*T[jJ]/g;
            let tjMatch;
            while ((tjMatch = tjRegex.exec(block)) !== null) {
              textChunks.push(tjMatch[1]);
            }
          }

          const extracted = textChunks.join(' ').trim();
          if (extracted.length > 0) {
            return {
              status: 'processed',
              category: 'document',
              extractedText: extracted,
              summary: `PDF Document: ${pageCount} pages, extracted text stream (${extracted.length} chars).`,
              metadata: { pages: pageCount, textExtracted: true },
            };
          }

          return {
            status: 'ready',
            category: 'document',
            summary: `PDF Document: ${pageCount} pages detected. Text stream is compressed or rasterized; document preserved safely.`,
            metadata: { pages: pageCount, textExtracted: false },
          };
        }

        case 'zip': {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(content);
          const fileEntries: { name: string; size: number; isDir: boolean }[] = [];

          loadedZip.forEach((relativePath, file) => {
            fileEntries.push({
              name: relativePath,
              size: (file as any)._data ? (file as any)._data.uncompressedSize || 0 : 0,
              isDir: file.dir,
            });
          });

          return {
            status: 'processed',
            category: 'archive',
            summary: `ZIP Archive: ${fileEntries.length} items cataloged safely without auto-executing.`,
            metadata: {
              fileCount: fileEntries.length,
              entries: fileEntries.slice(0, 15).map((e) => e.name),
            },
          };
        }

        case 'pptx': {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(content);
          const slideFiles = Object.keys(loadedZip.files).filter((k) =>
            k.startsWith('ppt/slides/slide') && k.endsWith('.xml')
          );

          return {
            status: 'processed',
            category: 'presentation',
            summary: `PowerPoint Presentation (.pptx): ${slideFiles.length} slides cataloged.`,
            metadata: { slideCount: slideFiles.length },
          };
        }

        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
        case 'gif':
        case 'svg': {
          return {
            status: 'pending_integration',
            category: 'image',
            summary: `Image preserved (${ext.toUpperCase()}). Visual understanding model is awaiting cloud integration.`,
            metadata: { format: ext },
          };
        }

        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'm4a': {
          return {
            status: 'pending_integration',
            category: 'audio',
            summary: `Audio recording preserved (${ext.toUpperCase()}). Transcription engine is awaiting cloud integration.`,
            metadata: { format: ext },
          };
        }

        case 'mp4':
        case 'webm':
        case 'mov': {
          return {
            status: 'pending_integration',
            category: 'video',
            summary: `Video file preserved (${ext.toUpperCase()}). Multimodal video understanding is awaiting cloud integration.`,
            metadata: { format: ext },
          };
        }

        default: {
          return {
            status: 'ready',
            category,
            summary: `File preserved: ${filename}`,
            metadata: { extension: ext },
          };
        }
      }
    } catch (err: any) {
      return {
        status: 'error',
        category,
        error: `Local parsing failed: ${err?.message || 'Corrupt format'}`,
        summary: `File saved, but parsing could not complete: ${err?.message || 'Format error'}`,
      };
    }
  }
}

export const fileProcessingEngine = new FileProcessingEngine();
