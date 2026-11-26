import React, { useState } from 'react';
import { Paperclip, Globe, ExternalLink, ChevronDown, ChevronUp, FileText, Download } from 'lucide-react';
import { AttachmentRecord, LinkPreview } from '../../types/attachment';
import { universalAttachmentService } from '../../services/universalAttachmentService';

interface MessageAttachmentsAndLinksProps {
  attachments?: string[];
  attachmentDetails?: AttachmentRecord[];
  linkPreviews?: LinkPreview[];
}

function getAttachmentBadge(att: AttachmentRecord): { label: string; classes: string } {
  if (att.status === 'error') {
    return { label: 'Error', classes: 'bg-rose-500/20 text-rose-300' };
  }
  if (att.analysisMode === 'multimodal_inline') {
    return { label: 'Visual / PDF Ready', classes: 'bg-cyan-500/20 text-cyan-200' };
  }
  if (att.analysisMode === 'unsupported' || att.status === 'pending_integration') {
    return { label: 'Unsupported for AI', classes: 'bg-amber-500/20 text-amber-300' };
  }
  if (att.status === 'processed') {
    return { label: 'Analyzed', classes: 'bg-emerald-500/20 text-emerald-300' };
  }
  return { label: 'Preserved', classes: 'bg-slate-500/20 text-slate-300' };
}

export const MessageAttachmentsAndLinks: React.FC<MessageAttachmentsAndLinksProps> = ({
  attachments,
  attachmentDetails,
  linkPreviews,
}) => {
  const [expandedAttachmentId, setExpandedAttachmentId] = useState<string | null>(null);
  const [downloadErrorId, setDownloadErrorId] = useState<string | null>(null);

  const hasAttachments = (attachmentDetails && attachmentDetails.length > 0) || (attachments && attachments.length > 0);
  const hasLinks = linkPreviews && linkPreviews.length > 0;

  if (!hasAttachments && !hasLinks) return null;

  const handleOpenAttachment = async (att: AttachmentRecord) => {
    setDownloadErrorId(null);
    const res = await universalAttachmentService.getAttachmentDownloadUrl(att);
    if (!res.url) {
      setDownloadErrorId(att.id);
      return;
    }
    const a = document.createElement('a');
    a.href = res.url;
    a.download = att.name;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (res.revoke) {
      setTimeout(() => res.revoke!(), 5000);
    }
  };

  return (
    <div className="mt-2.5 space-y-2">
      {/* Attachments Section */}
      {hasAttachments && (
        <div className="flex flex-wrap gap-1.5">
          {attachmentDetails && attachmentDetails.length > 0 ? (
            attachmentDetails.map((att) => {
              const badge = getAttachmentBadge(att);
              return (
                <div key={att.id} className="w-full sm:w-auto">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 text-xs shadow-sm hover:bg-cyan-900/60 transition-colors flex-wrap"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-medium truncate max-w-[160px]">{att.name}</span>
                    <span className="text-[10px] text-cyan-400/80 font-mono">
                      ({universalAttachmentService.formatFileSize(att.size)})
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${badge.classes}`}>
                      {badge.label}
                    </span>
                    {att.cloudStatus === 'synced' && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">
                        Cloud
                      </span>
                    )}
                    {(att.cloudStatus === 'sync_failed' || att.cloudStatus === 'local_only') && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono">
                        Local
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleOpenAttachment(att)}
                      className="ml-0.5 text-cyan-300 hover:text-white cursor-pointer"
                      aria-label={`Download ${att.name}`}
                      title={`Download ${att.name}`}
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {att.extractedText && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedAttachmentId(expandedAttachmentId === att.id ? null : att.id)
                        }
                        className="ml-0.5 text-cyan-400 hover:text-white cursor-pointer"
                        aria-label={`Toggle preview for ${att.name}`}
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

                  {downloadErrorId === att.id && (
                    <div className="mt-1 text-[10px] text-amber-300">
                      Original file bytes are not cached on this device.
                    </div>
                  )}

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
              );
            })
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
                  width={16}
                  height={16}
                  loading="lazy"
                  decoding="async"
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
