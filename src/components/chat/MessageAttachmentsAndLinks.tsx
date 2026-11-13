import React, { useState } from 'react';
import { Paperclip, Globe, ExternalLink, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { AttachmentRecord, LinkPreview } from '../../types/attachment';
import { universalAttachmentService } from '../../services/universalAttachmentService';

interface MessageAttachmentsAndLinksProps {
  attachments?: string[];
  attachmentDetails?: AttachmentRecord[];
  linkPreviews?: LinkPreview[];
}

export const MessageAttachmentsAndLinks: React.FC<MessageAttachmentsAndLinksProps> = ({
  attachments,
  attachmentDetails,
  linkPreviews,
}) => {
  const [expandedAttachmentId, setExpandedAttachmentId] = useState<string | null>(null);

  const hasAttachments = (attachmentDetails && attachmentDetails.length > 0) || (attachments && attachments.length > 0);
  const hasLinks = linkPreviews && linkPreviews.length > 0;

  if (!hasAttachments && !hasLinks) return null;

  return (
    <div className="mt-2.5 space-y-2">
      {/* Attachments Section */}
      {hasAttachments && (
        <div className="flex flex-wrap gap-1.5">
          {attachmentDetails && attachmentDetails.length > 0 ? (
            attachmentDetails.map((att) => (
              <div key={att.id} className="w-full sm:w-auto">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 text-xs shadow-sm hover:bg-cyan-900/60 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="font-medium truncate max-w-[160px]">{att.name}</span>
                  <span className="text-[10px] text-cyan-400/80 font-mono">
                    ({universalAttachmentService.formatFileSize(att.size)})
                  </span>
                  {att.status === 'pending_integration' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Preserved
                    </span>
                  )}
                  {att.status === 'processed' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Processed
                    </span>
                  )}
                  {att.extractedText && (
                    <button
                      onClick={() =>
                        setExpandedAttachmentId(expandedAttachmentId === att.id ? null : att.id)
                      }
                      className="ml-1 text-cyan-400 hover:text-white cursor-pointer"
                      title="Toggle preview"
                    >
                      {expandedAttachmentId === att.id ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded text preview */}
                {expandedAttachmentId === att.id && att.extractedText && (
                  <div className="mt-1 p-2 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-[11px] font-mono text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
                    <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold mb-1">
                      <FileText className="w-3 h-3" />
                      <span>Extracted Content Preview</span>
                    </div>
                    {att.extractedText.slice(0, 1000)}
                    {att.extractedText.length > 1000 ? '\n... [Remaining content preserved in storage]' : ''}
                  </div>
                )}
              </div>
            ))
          ) : (
            // Fallback for string-only attachments
            attachments?.map((name, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 text-xs"
              >
                <Paperclip className="w-3 h-3 text-cyan-400" />
                <span className="truncate max-w-[180px] font-medium">{name}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Link Previews Section */}
      {hasLinks && (
        <div className="grid grid-cols-1 gap-2 pt-1">
          {linkPreviews.map((lp, idx) => (
            <a
              key={idx}
              href={lp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-950/70 border border-slate-700/60 hover:border-cyan-400/50 transition-all group max-w-md shadow-md"
            >
              {lp.favicon ? (
                <img
                  src={lp.favicon}
                  alt=""
                  className="w-4 h-4 rounded mt-0.5 shrink-0 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-cyan-300 group-hover:text-cyan-200 truncate">
                    {lp.title || lp.domain}
                  </span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                </div>
                {lp.description && (
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                    {lp.description}
                  </p>
                )}
                <span className="text-[9px] text-slate-500 font-mono mt-0.5 block truncate">
                  {lp.domain}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
