import React, { useState, useEffect, useRef } from 'react';
import { Plus, Sliders, Eye, Mic, Send, Camera, Monitor, Paperclip, Loader2, AlertCircle, Globe, FileText } from 'lucide-react';
import { CompanionOrbState } from '../../types/angel';
import { ComposerContext, ComposerMode, ComposerSubmissionResult } from '../../types/composer';
import { AttachmentRecord } from '../../types/attachment';
import { universalComposerService } from '../../services/universalComposerService';
import { universalAttachmentService } from '../../services/universalAttachmentService';
import { linkPreviewService } from '../../services/linkPreviewService';
import { voiceEngine } from '../../services/voiceEngine';
import { mediaStreamService } from '../../services/mediaStreamService';

export interface UniversalComposerProps {
  context: ComposerContext;
  variant?: 'full' | 'simple' | 'compact';
  onSubmitted?: (result: ComposerSubmissionResult) => void;
  onOrbStateChange?: (state: CompanionOrbState) => void;
  onStartVoiceSession?: () => void;
  placeholder?: string;
  className?: string;
}

const MODES: ComposerMode[] = [
  'Standard Intelligent',
  'Think',
  'Deep Research',
  'Code Analysis',
  'Creative Brainstorm',
];

export const UniversalComposer: React.FC<UniversalComposerProps> = ({
  context,
  variant = 'full',
  onSubmitted,
  onOrbStateChange,
  onStartVoiceSession,
  placeholder,
  className = '',
}) => {
  const [text, setText] = useState(() => universalComposerService.getDraft(context));
  const [activeMode, setActiveMode] = useState<ComposerMode>(() => universalComposerService.getMode(context));
  const [showVisualMenu, setShowVisualMenu] = useState(false);
  const [showModesMenu, setShowModesMenu] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stagedAttachments, setStagedAttachments] = useState<AttachmentRecord[]>(() =>
    universalAttachmentService.getStagedAttachments(context)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft and staged attachments when context changes
  useEffect(() => {
    setText(universalComposerService.getDraft(context));
    setActiveMode(universalComposerService.getMode(context));
    setStagedAttachments(universalAttachmentService.getStagedAttachments(context));
    setFeedback(null);
  }, [context.type, context.conversationId, context.studioId, context.projectId, context.agentId]);

  // Click outside listener for menus
  useEffect(() => {
    if (!showVisualMenu && !showModesMenu) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowVisualMenu(false);
        setShowModesMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showVisualMenu, showModesMenu]);

  const handleTextChange = (val: string) => {
    setText(val);
    universalComposerService.setDraft(context, val);
  };

  const handleModeSelect = (mode: ComposerMode) => {
    setActiveMode(mode);
    universalComposerService.setMode(context, mode);
    setShowModesMenu(false);
  };

  const handleFileSelection = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      const isText =
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.tsv') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.ts') ||
        file.name.endsWith('.tsx') ||
        file.name.endsWith('.js') ||
        file.name.endsWith('.jsx') ||
        file.name.endsWith('.sql');

      reader.onload = async () => {
        const content = reader.result;
        if (!content) return;

        const res = await universalAttachmentService.stageAttachment(context, {
          name: file.name,
          size: file.size,
          content: content as string | ArrayBuffer,
        });

        if (res.success) {
          setStagedAttachments(universalAttachmentService.getStagedAttachments(context));
          setFeedback({ message: `Attached: ${file.name}`, type: 'info' });
        } else {
          setFeedback({ message: res.error || 'Failed to attach file', type: 'error' });
        }
        setTimeout(() => setFeedback(null), 3500);
      };

      if (isText) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    await universalAttachmentService.removeStagedAttachment(context, id);
    setStagedAttachments(universalAttachmentService.getStagedAttachments(context));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelection(e.dataTransfer.files);
    }
  };

  const handleSubmit = async () => {
    if ((!text.trim() && stagedAttachments.length === 0) || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);
    if (onOrbStateChange) onOrbStateChange('thinking');

    try {
      const result = await universalComposerService.submit(context, text);

      if (result.success) {
        setText('');
        setStagedAttachments([]);
        if (isDictating) {
          voiceEngine.stopListening();
          setIsDictating(false);
        }
        if (onOrbStateChange) onOrbStateChange('speaking');
        if (onSubmitted) onSubmitted(result);
      } else {
        setFeedback({ message: result.error || 'Submission failed.', type: 'error' });
        if (onOrbStateChange) onOrbStateChange('idle');
      }
    } catch (err: any) {
      setFeedback({ message: err?.message || 'Unexpected error submitting message.', type: 'error' });
      if (onOrbStateChange) onOrbStateChange('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleDictation = () => {
    if (isDictating) {
      voiceEngine.stopListening();
      setIsDictating(false);
      if (onOrbStateChange) onOrbStateChange('idle');
    } else {
      const started = voiceEngine.startListening({
        onTranscript: (transcript) => {
          handleTextChange(transcript);
          if (onOrbStateChange) onOrbStateChange('listening');
        },
        onError: (err) => {
          setFeedback({ message: `Mic: ${err}`, type: 'error' });
          setIsDictating(false);
          if (onOrbStateChange) onOrbStateChange('idle');
          setTimeout(() => setFeedback(null), 3000);
        },
        onEnd: () => {
          setIsDictating(false);
          if (onOrbStateChange) onOrbStateChange('idle');
        },
      }, text);

      if (started) {
        setIsDictating(true);
        if (onOrbStateChange) onOrbStateChange('listening');
        setFeedback({ message: 'Continuous dictation active... Speak naturally', type: 'info' });
        setTimeout(() => setFeedback(null), 2500);
      }
    }
  };

  const handleCameraRequest = async () => {
    setShowVisualMenu(false);
    const res = await mediaStreamService.startCamera();
    if (res.success) {
      setFeedback({ message: 'Live camera feed active.', type: 'info' });
    } else {
      setFeedback({ message: res.error || 'Camera permission required.', type: 'error' });
    }
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleScreenShareRequest = async () => {
    setShowVisualMenu(false);
    const res = await mediaStreamService.startScreenShare();
    if (res.success) {
      setFeedback({ message: 'Live screen sharing active.', type: 'info' });
    } else {
      setFeedback({ message: res.error || 'Screen share permission required.', type: 'error' });
    }
    setTimeout(() => setFeedback(null), 3500);
  };

  const defaultPlaceholder =
    context.type === 'agent_task'
      ? 'Specify task instructions for agent...'
      : context.type === 'workspace'
      ? 'Add workspace instruction or file guidance...'
      : context.type === 'studio'
      ? `Ask ${context.studioId || 'Studio'} assistant...`
      : 'Message Angel...';

  const inputPlaceholder = placeholder || defaultPlaceholder;
  const detectedUrls = linkPreviewService.detectUrls(text).validUrls;

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full relative select-none transition-all rounded-3xl ${
        isDragging ? 'ring-2 ring-cyan-400/80 bg-cyan-950/30' : ''
      } ${className}`}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) handleFileSelection(e.target.files);
        }}
        multiple
        className="hidden"
      />

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`absolute left-1/2 -top-12 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 flex items-center gap-1.5 ${
            feedback.type === 'error'
              ? 'bg-rose-950/90 border border-rose-500/50 text-rose-200'
              : 'bg-slate-950/90 border border-cyan-400/50 text-cyan-200'
          }`}
        >
          {feedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Visual Menu Popup */}
      {showVisualMenu && (
        <div className="absolute right-12 -top-24 z-30 w-44 p-1.5 rounded-2xl border border-cyan-500/30 bg-[#090d24]/95 text-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(56,189,248,0.3)] animate-in zoom-in-95 duration-150 backdrop-blur-2xl space-y-1">
          <button
            onClick={handleCameraRequest}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-cyan-500/20 transition-all text-left cursor-pointer"
          >
            <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Camera</span>
          </button>
          <button
            onClick={handleScreenShareRequest}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-cyan-500/20 transition-all text-left cursor-pointer"
          >
            <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Share Screen</span>
          </button>
        </div>
      )}

      {/* Modes Menu Popup */}
      {showModesMenu && (
        <div className="absolute right-24 -top-44 z-30 w-52 p-1.5 rounded-2xl border border-cyan-500/30 bg-[#090d24]/95 text-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(56,189,248,0.3)] animate-in zoom-in-95 duration-150 backdrop-blur-2xl space-y-0.5">
          <div className="px-3 py-1.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider border-b border-slate-800/80">
            Select Intelligence Mode
          </div>
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => handleModeSelect(m)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                activeMode === m
                  ? 'bg-cyan-500/30 text-white font-semibold'
                  : 'text-slate-200 hover:text-white hover:bg-cyan-500/20'
              }`}
            >
              <span>{m}</span>
              {activeMode === m && <span className="text-cyan-400 font-bold">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Staged attachments chips */}
      {stagedAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto px-1">
          {stagedAttachments.map((att) => (
            <div
              key={att.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs shadow-sm backdrop-blur-md"
            >
              <Paperclip className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate max-w-[140px] font-medium">{att.name}</span>
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
              <button
                onClick={() => handleRemoveAttachment(att.id)}
                className="text-cyan-400 hover:text-white font-bold ml-1 cursor-pointer"
                title="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detected URL badges */}
      {detectedUrls.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1 px-1">
          {detectedUrls.map((u) => {
            let host = u;
            try {
              host = new URL(u).hostname;
            } catch {}
            return (
              <div
                key={u}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-400/40 text-indigo-200 text-[11px]"
              >
                <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                <span className="truncate max-w-[180px]">{host}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer Input Bar */}
      {variant === 'compact' ? (
        /* Compact Variant (e.g. Panel / Inline) */
        <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/30 p-2 space-y-2 backdrop-blur-xl shadow-lg">
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            rows={2}
            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:text-white hover:bg-cyan-600/40 transition-all cursor-pointer"
                title="Attach Files"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-cyan-300 font-mono px-2 py-0.5 rounded bg-slate-800/80">
                {activeMode}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={(!text.trim() && stagedAttachments.length === 0) || isSubmitting}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? 'Sending...' : 'Submit'}</span>
            </button>
          </div>
        </div>
      ) : variant === 'simple' ? (
        /* Simple Variant (Clean single line bar) */
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-full bg-[#070b1e]/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] focus-within:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#10183b]/80 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-600 transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)] shrink-0 double-glow-pulse-rounded cursor-pointer"
            title="Attach Files"
          >
            <Plus className="w-4 h-4" />
          </button>

          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            rows={1}
            className="flex-1 min-w-0 bg-transparent px-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none tracking-wide resize-none h-6 sm:h-7 py-0.5 leading-normal overflow-y-auto"
          />

          <button
            onClick={toggleDictation}
            className={`p-2 rounded-full transition-all shrink-0 double-glow-pulse-rounded cursor-pointer shadow-[0_0_12px_rgba(56,189,248,0.4)] ${
              isDictating
                ? 'bg-cyan-500/30 text-cyan-300 animate-pulse border border-cyan-400/50'
                : 'text-cyan-300 hover:text-white hover:bg-white/10'
            }`}
            title="Dictate with voice"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            onClick={handleSubmit}
            disabled={(!text.trim() && stagedAttachments.length === 0) || isSubmitting}
            className="p-2 sm:p-2.5 rounded-full bg-transparent hover:bg-white/10 disabled:opacity-30 text-cyan-300 hover:text-white transition-all drop-shadow-[0_0_12px_rgba(56,189,248,0.8)] shrink-0 double-glow-pulse-rounded flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(56,189,248,0.4)]"
            title="Send Message"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        /* Full Variant (Full-width cosmic bar with controls) */
        <div className="w-full rounded-full bg-[#070b1e]/40 p-1.5 sm:p-2.5 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.4)] flex items-center gap-1.5 sm:gap-3 transition-all focus-within:shadow-[0_0_25px_rgba(59,130,246,0.3)]">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#10183b]/80 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-600 transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)] shrink-0 double-glow-pulse-rounded cursor-pointer"
            title="Attach Files"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            rows={1}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none px-1.5 sm:px-2 tracking-wide resize-none h-6 sm:h-8 py-0.5 leading-normal overflow-y-auto"
          />

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-0.5 sm:pr-1">
            <button
              onClick={() => {
                setShowModesMenu(!showModesMenu);
                setShowVisualMenu(false);
              }}
              className="p-2 sm:p-2.5 rounded-full text-cyan-300 hover:text-white hover:bg-white/10 transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded cursor-pointer"
              title={`Angel Controls (${activeMode})`}
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={() => {
                setShowVisualMenu(!showVisualMenu);
                setShowModesMenu(false);
              }}
              className="p-2 sm:p-2.5 rounded-full text-cyan-300 hover:text-white hover:bg-white/10 transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded cursor-pointer"
              title="Visual Context (Camera & Screen)"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={toggleDictation}
              className={`p-2 sm:p-2.5 rounded-full transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded cursor-pointer ${
                isDictating
                  ? 'bg-cyan-500/30 text-cyan-300 animate-pulse border border-cyan-400/50'
                  : 'text-cyan-300 hover:text-white hover:bg-white/10'
              }`}
              title="Dictation (Mic)"
            >
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {text.trim() || stagedAttachments.length > 0 ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="p-2.5 sm:p-3 rounded-full bg-transparent hover:bg-white/10 text-cyan-300 hover:text-white transition-all drop-shadow-[0_0_12px_rgba(56,189,248,0.8)] shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded flex items-center justify-center cursor-pointer"
                title="Send Message"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (onStartVoiceSession) onStartVoiceSession();
                  else toggleDictation();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-transparent flex items-center justify-center text-cyan-300 hover:text-white hover:bg-white/10 transition-all drop-shadow-[0_0_12px_rgba(56,189,248,0.6)] shadow-[0_0_12px_rgba(56,189,248,0.4)] group double-glow-pulse-rounded cursor-pointer"
                title="Start Voice Session"
              >
                <div className="flex items-center gap-[2.5px] h-4">
                  <span className="w-[2px] h-2 bg-cyan-400 group-hover:bg-white rounded-full transition-all group-hover:h-3" />
                  <span className="w-[2px] h-3.5 bg-cyan-300 group-hover:bg-white rounded-full transition-all group-hover:h-4" />
                  <span className="w-[2px] h-4 bg-white rounded-full transition-all group-hover:h-3" />
                  <span className="w-[2px] h-3 bg-cyan-300 group-hover:bg-white rounded-full transition-all group-hover:h-4" />
                  <span className="w-[2px] h-2 bg-cyan-400 group-hover:bg-white rounded-full transition-all group-hover:h-3" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
