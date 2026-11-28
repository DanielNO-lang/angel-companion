import JSZip from 'jszip';
import { AttachmentCategory, AttachmentStatus, FileValidationResult } from '../types/attachment';

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB (matches companion-private storage bucket limit)
export const MAX_EXTRACTED_TEXT_CHARS = 24000;

export const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bin', 'msi', 'dll', 'scr', 'vbs',
  'app', 'com', 'pif', 'jar', 'cpl', 'msc', 'hta', 'reg', 'ps1'
]);

export const MULTIMODAL_INLINE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function boundExtractedText(text: string): string {
  if (text.length <= MAX_EXTRACTED_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n... [Truncated at ${MAX_EXTRACTED_TEXT_CHARS} characters for safe context handling]`;
}

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

    if (sizeBytes < 0 || !Number.isFinite(sizeBytes)) {
      return {
        valid: false,
        error: 'Invalid file size.',
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
      markdown: 'text/markdown',
      csv: 'text/csv',
      tsv: 'text/plain',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      webm: 'video/webm',
      mp4: 'video/mp4',
      json: 'application/json',
      ts: 'text/plain',
      tsx: 'text/plain',
      js: 'text/plain',
      jsx: 'text/plain',
      py: 'text/plain',
      sql: 'text/plain',
      html: 'text/plain',
      css: 'text/plain',
      yaml: 'text/plain',
      yml: 'text/plain',
      zip: 'application/zip',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  public isMultimodalInlineMime(mimeType: string): boolean {
    return MULTIMODAL_INLINE_MIME_TYPES.has(mimeType.toLowerCase());
  }

  public async processFile(
    filename: string,
    content: string | ArrayBuffer
  ): Promise<{
    status: AttachmentStatus;
    category: AttachmentCategory;
    analysisMode: 'extracted_text' | 'multimodal_inline' | 'metadata_only' | 'unsupported';
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
        case 'rtf':
        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
        case 'json':
        case 'html':
        case 'css':
        case 'sql':
        case 'py':
        case 'yaml':
        case 'yml': {
          const text = typeof content === 'string'
            ? content
            : new TextDecoder('utf-8').decode(content);

          const lines = text.split('\n');
          return {
            status: 'processed',
            category,
            analysisMode: 'extracted_text',
            extractedText: boundExtractedText(text),
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
            analysisMode: 'extracted_text',
            extractedText: boundExtractedText(raw),
            summary: `Tabular spreadsheet: ${rowCount} rows, ${headers.length} columns (${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}).`,
            metadata: { rowCount, columnCount: headers.length, headers },
          };
        }

        case 'xlsx': {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(content);

          const sharedStrings: string[] = [];
          const sharedStringsFile = loadedZip.file('xl/sharedStrings.xml');
          if (sharedStringsFile) {
            const ssXml = await sharedStringsFile.async('string');
            const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
            let siMatch: RegExpExecArray | null;
            while ((siMatch = siRegex.exec(ssXml)) !== null) {
              const tParts: string[] = [];
              const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
              let tMatch: RegExpExecArray | null;
              while ((tMatch = tRegex.exec(siMatch[1])) !== null) {
                tParts.push(decodeXmlEntities(tMatch[1]));
              }
              sharedStrings.push(tParts.join(''));
            }
          }

          const sheetPaths = Object.keys(loadedZip.files)
            .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
            .sort((a, b) => {
              const numA = parseInt(a.match(/sheet(\d+)\.xml/i)?.[1] || '0', 10);
              const numB = parseInt(b.match(/sheet(\d+)\.xml/i)?.[1] || '0', 10);
              return numA - numB;
            });

          const sheetBlocks: string[] = [];
          let totalRows = 0;

          for (let sIdx = 0; sIdx < sheetPaths.length; sIdx++) {
            const sheetFile = loadedZip.file(sheetPaths[sIdx]);
            if (!sheetFile) continue;
            const sheetXml = await sheetFile.async('string');
            const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
            const sheetLines: string[] = [];
            let rowMatch: RegExpExecArray | null;

            while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
              const cells: string[] = [];
              const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
              let cellMatch: RegExpExecArray | null;
              while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
                const attrs = cellMatch[1];
                const body = cellMatch[2];
                const typeMatch = attrs.match(/\bt="([^"]+)"/);
                const cellType = typeMatch ? typeMatch[1] : '';
                if (cellType === 'inlineStr') {
                  const tMatch = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
                  cells.push(tMatch ? decodeXmlEntities(tMatch[1]) : '');
                } else {
                  const vMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
                  if (!vMatch) {
                    cells.push('');
                  } else if (cellType === 's') {
                    const idx = parseInt(vMatch[1], 10);
                    cells.push(Number.isFinite(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : vMatch[1]);
                  } else {
                    cells.push(decodeXmlEntities(vMatch[1]));
                  }
                }
              }
              const joinedRow = cells.join(' | ').trim();
              if (joinedRow) {
                sheetLines.push(joinedRow);
                totalRows++;
              }
            }

            if (sheetLines.length > 0) {
              sheetBlocks.push(`Sheet ${sIdx + 1}:\n${sheetLines.join('\n')}`);
            }
          }

          const extracted = sheetBlocks.join('\n\n').trim();
          return {
            status: 'processed',
            category: 'spreadsheet',
            analysisMode: 'extracted_text',
            ...(extracted ? { extractedText: boundExtractedText(extracted) } : {}),
            summary: `Excel Workbook (.xlsx): ${sheetPaths.length} sheet(s), ${totalRows} non-empty row(s) extracted locally.`,
            metadata: { format: 'xlsx', sheetCount: sheetPaths.length, rowCount: totalRows },
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
              analysisMode: 'metadata_only',
              summary: 'Word document (.docx) structure loaded, but word/document.xml was not found.',
              metadata: { format: 'docx' },
            };
          }

          const xmlText = await documentXml.async('string');
          const textMatches: string[] = [];
          const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(xmlText)) !== null) {
            textMatches.push(match[1]);
          }

          const extracted = decodeXmlEntities(textMatches.join(' '));
          const words = extracted.split(/\s+/).filter(Boolean);

          return {
            status: 'processed',
            category: 'document',
            analysisMode: 'extracted_text',
            extractedText: boundExtractedText(extracted),
            summary: `Word Document (.docx): ${words.length} words extracted locally.`,
            metadata: { wordCount: words.length },
          };
        }

        case 'doc': {
          return {
            status: 'ready',
            category: 'document',
            analysisMode: 'unsupported',
            summary: 'Legacy Binary DOC format preserved safely. (Text extraction is optimized for modern .docx standards).',
            metadata: { format: 'doc_binary' },
          };
        }

        case 'xls':
        case 'ppt':
        case 'odt': {
          return {
            status: 'ready',
            category,
            analysisMode: 'unsupported',
            summary: `Legacy format (.${ext.toUpperCase()}) preserved safely in private storage. Direct AI content analysis supports modern .docx, .xlsx, .pptx, .pdf, text, and images.`,
            metadata: { format: ext },
          };
        }

        case 'pdf': {
          const rawString = typeof content === 'string'
            ? content
            : new TextDecoder('latin1').decode(content);

          const pageMatches = rawString.match(/\/Type\s*\/Page\b/g);
          const pageCount = pageMatches ? pageMatches.length : 1;

          const textChunks: string[] = [];
          const btRegex = /BT[\s\S]*?ET/g;
          let btMatch: RegExpExecArray | null;
          while ((btMatch = btRegex.exec(rawString)) !== null) {
            const block = btMatch[0];
            const tjRegex = /\((.*?)\)\s*T[jJ]/g;
            let tjMatch: RegExpExecArray | null;
            while ((tjMatch = tjRegex.exec(block)) !== null) {
              textChunks.push(tjMatch[1]);
            }
          }

          const extracted = textChunks.join(' ').trim();
          if (extracted.length > 0) {
            return {
              status: 'processed',
              category: 'document',
              analysisMode: 'multimodal_inline',
              extractedText: boundExtractedText(extracted),
              summary: `PDF Document: ${pageCount} page(s), extracted text stream (${extracted.length} chars) + multimodal PDF ready.`,
              metadata: { pages: pageCount, textExtracted: true, multimodalSupported: true },
            };
          }

          return {
            status: 'ready',
            category: 'document',
            analysisMode: 'multimodal_inline',
            summary: `PDF Document: ${pageCount} page(s) ready for Gemini multimodal PDF analysis and preserved safely.`,
            metadata: { pages: pageCount, textExtracted: false, multimodalSupported: true },
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

          const entrySummary = fileEntries.slice(0, 40).map((e) => e.name).join('\n');
          return {
            status: 'processed',
            category: 'archive',
            analysisMode: 'metadata_only',
            ...(entrySummary ? { extractedText: `Archive entries:\n${entrySummary}` } : {}),
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
          const slideFiles = Object.keys(loadedZip.files)
            .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
            .sort((a, b) => {
              const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
              const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
              return numA - numB;
            });

          const slideBlocks: string[] = [];
          let wordCount = 0;

          for (let i = 0; i < slideFiles.length; i++) {
            const slideXmlFile = loadedZip.file(slideFiles[i]);
            if (!slideXmlFile) continue;
            const slideXml = await slideXmlFile.async('string');
            const slideTexts: string[] = [];
            const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
            let match: RegExpExecArray | null;
            while ((match = tRegex.exec(slideXml)) !== null) {
              const decoded = decodeXmlEntities(match[1]).trim();
              if (decoded) slideTexts.push(decoded);
            }
            if (slideTexts.length > 0) {
              const combinedSlide = slideTexts.join(' ');
              wordCount += combinedSlide.split(/\s+/).filter(Boolean).length;
              slideBlocks.push(`Slide ${i + 1}: ${combinedSlide}`);
            }
          }

          const extracted = slideBlocks.join('\n').trim();
          return {
            status: 'processed',
            category: 'presentation',
            analysisMode: 'extracted_text',
            ...(extracted ? { extractedText: boundExtractedText(extracted) } : {}),
            summary: `PowerPoint Presentation (.pptx): ${slideFiles.length} slide(s), ${wordCount} word(s) extracted locally.`,
            metadata: { slideCount: slideFiles.length, wordCount },
          };
        }

        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp': {
          return {
            status: 'ready',
            category: 'image',
            analysisMode: 'multimodal_inline',
            summary: `Image (${ext.toUpperCase()}) ready for visual Gemini analysis and preserved in private storage.`,
            metadata: { format: ext, multimodalSupported: true },
          };
        }

        case 'gif':
        case 'svg':
        case 'bmp': {
          return {
            status: 'ready',
            category: 'image',
            analysisMode: 'unsupported',
            summary: `Image (${ext.toUpperCase()}) preserved in private storage. Direct visual AI analysis currently supports PNG, JPG, JPEG, WEBP, and PDF.`,
            metadata: { format: ext, multimodalSupported: false },
          };
        }

        case 'mp3':
        case 'wav':
        case 'ogg': {
          return {
            status: 'ready',
            category: 'audio',
            analysisMode: 'multimodal_inline',
            summary: `Audio file (${ext.toUpperCase()}) ready for Gemini audio understanding and preserved in private storage.`,
            metadata: { format: ext, multimodalSupported: true },
          };
        }

        case 'm4a':
        case 'flac':
        case 'aac': {
          return {
            status: 'ready',
            category: 'audio',
            analysisMode: 'unsupported',
            summary: `Audio file (${ext.toUpperCase()}) preserved in private storage. Direct audio analysis currently supports MP3, WAV, and OGG.`,
            metadata: { format: ext, multimodalSupported: false },
          };
        }

        case 'mp4':
        case 'webm':
        case 'mov':
        case 'avi':
        case 'mkv': {
          return {
            status: 'ready',
            category: 'video',
            analysisMode: 'unsupported',
            summary: `Video file (${ext.toUpperCase()}) preserved in private storage. Direct video file analysis inside chat is not yet enabled.`,
            metadata: { format: ext, multimodalSupported: false },
          };
        }

        default: {
          return {
            status: 'ready',
            category,
            analysisMode: 'unsupported',
            summary: `File preserved safely: ${filename}. Direct AI text extraction is not available for .${ext || 'unknown'} files.`,
            metadata: { extension: ext },
          };
        }
      }
    } catch (err: any) {
      return {
        status: 'error',
        category,
        analysisMode: 'unsupported',
        error: `Local parsing failed: ${err?.message || 'Corrupt format'}`,
        summary: `File saved, but parsing could not complete: ${err?.message || 'Format error'}`,
      };
    }
  }
}

export const fileProcessingEngine = new FileProcessingEngine();
