import React, { useState, useEffect, useRef } from 'react';
import { Plus, Sliders, Eye, Mic, Send, Camera, Monitor, Paperclip, Loader2, AlertCircle, RotateCw, X, Square } from 'lucide-react';
import { CompanionOrbState } from '../../types/angel';
import { ComposerContext, ComposerMode, ComposerSubmissionResult } from '../../types/composer';
import { AttachmentRecord } from '../../types/attachment';
import { universalComposerService } from '../../services/universalComposerService';
import { universalAttachmentService } from '../../services/universalAttachmentService';
import { voiceEngine } from '../../services/voiceEngine';
import { mediaStreamService } from '../../services/mediaStreamService';

export interface UniversalComposerProps {
  context: ComposerContext;
  variant?: 'full' | 'simple' | 'compact';
  onSubmissionStarted?: (threadId?: string) => void;
  onSubmitted?: (result: ComposerSubmissionResult) => void;
  onOrbStateChange?: (state: CompanionOrbState) => void;
  onStartVoiceSession?: () => void;
  isGenerating?: boolean;
  onStopGenerating?: () => void;
  placeholder?: string;
  className?: string;
  autoFocusOnOpen?: boolean;
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
  onSubmissionStarted,
  onSubmitted,
  onOrbStateChange,
  onStartVoiceSession,
  isGenerating = false,
  onStopGenerating,
  placeholder,
  className = '',
  autoFocusOnOpen = false,
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
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'error'; canRetry?: boolean } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef(text);
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  textRef.current = text;

  // Cleanup active dictation timer and SpeechRecognition on unmount
  useEffect(() => {
    return () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
      if (voiceEngine.getIsListening()) {
        voiceEngine.stopListening();
      }
    };
  }, []);

  // Put the writing field in focus whenever the user opens or switches conversations.
  useEffect(() => {
    if (!autoFocusOnOpen || variant === 'compact') return;
    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [autoFocusOnOpen, context.type, context.conversationId, context.studioId, context.projectId, context.agentId, variant]);

  // Grow the composer upward to five visible lines, then scroll within the input.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || variant === 'compact') return;
    textarea.style.height = 'auto';
    const maxHeight = 120;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [text, variant]);

  // Subscribe to external staged attachments (e.g. Camera / Screen Share frame capture)
  useEffect(() => {
    return universalAttachmentService.subscribe(() => {
      setStagedAttachments(universalAttachmentService.getStagedAttachments(context));
    });
  }, [context.type, context.conversationId, context.studioId, context.projectId, context.agentId]);

  // Sync draft and staged attachments when context changes
  useEffect(() => {
    if (voiceEngine.getIsListening()) {
      voiceEngine.stopListening();
      setIsDictating(false);
    }
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

  const showTransientInfo = (message: string, durationMs = 3500) => {
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    setFeedback({ message, type: 'info' });
    infoTimeoutRef.current = setTimeout(() => {
      setFeedback((prev) => (prev?.type === 'info' ? null : prev));
    }, durationMs);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    textRef.current = val;
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
        /\.(txt|md|markdown|csv|tsv|json|ts|tsx|js|jsx|sql|py|html|css|yaml|yml|rtf)$/i.test(file.name);

      reader.onload = async () => {
        const content = reader.result;
        if (content === null || content === undefined) return;

        const res = await universalAttachmentService.stageAttachment(context, {
          name: file.name,
          size: file.size,
          content: content as string | ArrayBuffer,
        });

        if (res.success) {
          setStagedAttachments(universalAttachmentService.getStagedAttachments(context));
          showTransientInfo(`Attached: ${file.name}`);
        } else {
          if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
          setFeedback({ message: res.error || 'Failed to attach file', type: 'error', canRetry: false });
        }
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
    const latestText = textRef.current;
    if ((!latestText.trim() && stagedAttachments.length === 0) || isSubmitting) return;

    // Stop active SpeechRecognition BEFORE dispatching submit so final transcript is locked in cleanly
    if (isDictating || voiceEngine.getIsListening()) {
      voiceEngine.stopListening();
      setIsDictating(false);
    }

    setIsSubmitting(true);
    setFeedback(null);
    if (onOrbStateChange) onOrbStateChange('thinking');

    try {
      const result = await universalComposerService.submit(context, latestText, undefined, {
        onUserTurnSaved: (threadId) => {
          setText('');
          textRef.current = '';
          setStagedAttachments([]);
          if (onSubmissionStarted) onSubmissionStarted(threadId);
        },
      });

      if (result.success) {
        setText('');
        textRef.current = '';
        setStagedAttachments([]);
        if (onOrbStateChange) onOrbStateChange('speaking');
        if (onSubmitted) onSubmitted(result);
      } else {
        setStagedAttachments(universalAttachmentService.getStagedAttachments(context));
        setFeedback({
          message: result.error || 'Submission failed.',
          type: 'error',
          canRetry: Boolean(latestText.trim() || universalAttachmentService.getStagedAttachments(context).length > 0),
        });
        if (onOrbStateChange) onOrbStateChange('idle');
      }
    } catch (err: any) {
      setFeedback({
        message: err?.message || 'Unexpected error submitting message.',
        type: 'error',
        canRetry: true,
      });
      if (onOrbStateChange) onOrbStateChange('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const toggleDictation = () => {
    if (isDictating || voiceEngine.getIsListening()) {
      voiceEngine.stopListening();
      setIsDictating(false);
      if (onOrbStateChange) onOrbStateChange('idle');
      return;
    }

    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    setFeedback(null);

    const started = voiceEngine.startListening(
      {
        onTranscript: (transcript) => {
          handleTextChange(transcript);
          if (onOrbStateChange) onOrbStateChange('listening');
        },
        onError: (err) => {
          setFeedback({ message: `Mic: ${err}`, type: 'error', canRetry: false });
          setIsDictating(false);
          if (onOrbStateChange) onOrbStateChange('idle');
        },
        onEnd: () => {
          setIsDictating(false);
          if (onOrbStateChange) onOrbStateChange('idle');
        },
      },
      textRef.current
    );

    if (started) {
      setIsDictating(true);
      if (onOrbStateChange) onOrbStateChange('listening');
    }
  };

  const handleCameraRequest = async () => {
    setShowVisualMenu(false);
    const res = await mediaStreamService.startCamera();
    if (res.success) {
      showTransientInfo('Live camera feed active.');
    } else {
      setFeedback({ message: res.error || 'Camera permission required.', type: 'error', canRetry: false });
    }
  };

  const handleScreenShareRequest = async () => {
    setShowVisualMenu(false);
    const res = await mediaStreamService.startScreenShare();
    if (res.success) {
      showTransientInfo('Live screen sharing active.');
    } else {
      setFeedback({ message: res.error || 'Screen share permission required.', type: 'error', canRetry: false });
    }
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
          if (e.target.files) {
            void handleFileSelection(e.target.files);
          }
          e.target.value = '';
        }}
        multiple
        className="hidden"
      />

      {/* Feedback Banner (Persistent on error with Retry & Dismiss) */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-2 mx-auto max-w-2xl px-3.5 py-1.5 rounded-2xl text-xs font-medium shadow-lg backdrop-blur-md animate-in fade-in flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-950/90 border border-rose-500/50 text-rose-100'
              : 'bg-slate-950/90 border border-cyan-400/50 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {feedback.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-300 shrink-0" />}
            <span className="truncate sm:whitespace-normal">{feedback.message}</span>
          </div>
          {feedback.type === 'error' && (
            <div className="flex items-center gap-1 shrink-0">
              {feedback.canRetry && (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss error"
                className="p-0.5 rounded-lg text-rose-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Visual Menu Popup */}
      {showVisualMenu && (
        <div className="absolute right-12 -top-24 z-30 w-44 p-1.5 rounded-2xl border border-cyan-500/30 bg-[#090d24]/95 text-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(56,189,248,0.3)] animate-in zoom-in-95 duration-150 backdrop-blur-2xl space-y-1">
          <button
            type="button"
            onClick={handleCameraRequest}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white hover:bg-cyan-500/20 transition-all text-left cursor-pointer"
          >
            <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Camera</span>
          </button>
          <button
            type="button"
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
              type="button"
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
              <button
                type="button"
                onClick={() => void handleRemoveAttachment(att.id)}
                className="text-cyan-400 hover:text-white font-bold ml-1 cursor-pointer"
                aria-label={`Remove attachment ${att.name}`}
                title="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
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
            aria-label={inputPlaceholder}
            rows={2}
            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:text-white hover:bg-cyan-600/40 transition-all cursor-pointer"
                aria-label="Attach Files"
                title="Attach Files"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={toggleDictation}
                aria-pressed={isDictating}
                aria-label={isDictating ? 'Stop voice dictation' : 'Dictate with voice'}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isDictating
                    ? 'bg-cyan-500/30 text-cyan-300 animate-pulse border border-cyan-400/50'
                    : 'bg-slate-800 text-cyan-400 hover:text-white hover:bg-cyan-600/40'
                }`}
                title={isDictating ? 'Stop voice dictation' : 'Dictate with voice'}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-cyan-300 font-mono px-2 py-0.5 rounded bg-slate-800/80">
                {activeMode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleSubmit()}
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
        /* Simple Variant (Clean single line bar - SimpleComposerBar) */
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-3xl bg-[#070b1e]/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] focus-within:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#10183b]/80 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-600 transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)] shrink-0 double-glow-pulse-rounded cursor-pointer"
            aria-label="Attach Files"
            title="Attach Files"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {isDictating ? (
            <div className="flex-1 min-w-0 min-h-10 flex items-center gap-3 px-2" role="status" aria-live="polite" aria-label="Dictation recording and speech-to-text transcription">
              <div className="flex items-center gap-[3px] h-8 shrink-0" aria-hidden="true">
                {[8, 14, 22, 12, 27, 17, 10, 24, 15, 29, 18, 11, 23, 14, 26, 9, 19, 28, 13, 22, 10, 17, 25, 12, 20, 8, 16, 27, 13, 21, 9].map((height, index) => (
                  <span key={index} className="w-[2px] rounded-full bg-cyan-300 dictation-wave-bar" style={{ height: `${height}px`, animationDelay: `${index * 38}ms` }} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 font-semibold">Listening · Speech to text</div>
                <div className="text-xs text-slate-100 truncate">{text.trim() || 'Speak naturally. Your words will appear here…'}</div>
              </div>
            </div>
          ) : (
                      <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            aria-label={inputPlaceholder}
            rows={1}
            className="flex-1 min-w-0 bg-transparent px-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none tracking-wide resize-none min-h-6 max-h-[120px] py-1 leading-6 overflow-y-hidden"
          />
          )}

          <button
            type="button"
            onClick={() => {
              if (onStartVoiceSession) onStartVoiceSession();
              else toggleDictation();
            }}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-transparent flex items-center justify-center text-cyan-300 hover:text-white hover:bg-white/10 transition-all shrink-0 group cursor-pointer"
            aria-label="Start Voice Conversation"
            title="Start Voice Conversation"
          >
            <div className="flex items-center gap-[2px] h-3.5">
              <span className="w-[2px] h-2 bg-cyan-400 group-hover:bg-white rounded-full transition-all group-hover:h-2.5" />
              <span className="w-[2px] h-3 bg-cyan-300 group-hover:bg-white rounded-full transition-all group-hover:h-3.5" />
              <span className="w-[2px] h-3.5 bg-white rounded-full transition-all group-hover:h-2.5" />
              <span className="w-[2px] h-3 bg-cyan-300 group-hover:bg-white rounded-full transition-all group-hover:h-3.5" />
              <span className="w-[2px] h-2 bg-cyan-400 group-hover:bg-white rounded-full transition-all group-hover:h-2.5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={(!text.trim() && stagedAttachments.length === 0) || isSubmitting}
            className="p-1.5 sm:p-2 rounded-full bg-transparent hover:bg-white/10 disabled:opacity-30 text-cyan-300 hover:text-white transition-all drop-shadow-[0_0_12px_rgba(56,189,248,0.8)] shrink-0 double-glow-pulse-rounded flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(56,189,248,0.4)]"
            aria-label="Send Message"
            title="Send Message"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        /* Full Variant (Full-width cosmic bar with controls) */
        <div className="w-full rounded-3xl bg-[#070b1e]/40 p-1.5 sm:p-2 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.4)] flex items-center gap-1.5 sm:gap-3 transition-all focus-within:shadow-[0_0_25px_rgba(59,130,246,0.3)]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#10183b]/80 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-600 transition-all shadow-[0_0_15px_rgba(56,189,248,0.4)] shrink-0 double-glow-pulse-rounded cursor-pointer"
            aria-label="Attach Files"
            title="Attach Files"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {isDictating ? (
            <div className="flex-1 min-w-0 min-h-10 flex items-center gap-3 px-2" role="status" aria-live="polite" aria-label="Dictation recording and speech-to-text transcription">
              <div className="flex items-center gap-[3px] h-8 shrink-0" aria-hidden="true">
                {[8, 14, 22, 12, 27, 17, 10, 24, 15, 29, 18, 11, 23, 14, 26, 9, 19, 28, 13, 22, 10, 17, 25, 12, 20, 8, 16, 27, 13, 21, 9].map((height, index) => (
                  <span key={index} className="w-[2px] rounded-full bg-cyan-300 dictation-wave-bar" style={{ height: `${height}px`, animationDelay: `${index * 38}ms` }} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300 font-semibold">Listening · Speech to text</div>
                <div className="text-xs text-slate-100 truncate">{text.trim() || 'Speak naturally. Your words will appear here…'}</div>
              </div>
            </div>
          ) : (
                      <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            aria-label={inputPlaceholder}
            rows={1}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none px-1.5 sm:px-2 tracking-wide resize-none min-h-6 max-h-[120px] py-1 leading-6 overflow-y-hidden"
          />
          )}

          <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-0.5 sm:pr-1">
            <button
              type="button"
              onClick={() => {
                setShowModesMenu(!showModesMenu);
                setShowVisualMenu(false);
              }}
              className="p-1.5 sm:p-2 rounded-full text-cyan-300 hover:text-white hover:bg-white/10 transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded cursor-pointer"
              aria-label={`Angel Controls (${activeMode})`}
              title={`Angel Controls (${activeMode})`}
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowVisualMenu(!showVisualMenu);
                setShowModesMenu(false);
              }}
              className="p-2 sm:p-2.5 rounded-full text-cyan-300 hover:text-white hover:bg-white/10 transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded cursor-pointer"
              aria-label="Visual Context (Camera & Screen)"
              title="Visual Context (Camera & Screen)"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={toggleDictation}
              aria-pressed={isDictating}
              aria-label={isDictating ? 'Stop voice dictation' : 'Dictation (Mic)'}
              className={`p-2 sm:p-2.5 rounded-full transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded cursor-pointer ${
                isDictating
                  ? 'bg-cyan-500/30 text-cyan-300 animate-pulse border border-cyan-400/50'
                  : 'text-cyan-300 hover:text-white hover:bg-white/10'
              }`}
              title={isDictating ? 'Stop voice dictation' : 'Dictation (Mic)'}
            >
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {isGenerating && onStopGenerating ? (
              <button
                type="button"
                onClick={onStopGenerating}
                className="p-2 sm:p-2.5 rounded-full bg-rose-600/80 hover:bg-rose-500 text-white transition-all shadow-[0_0_12px_rgba(244,63,94,0.6)] flex items-center justify-center cursor-pointer"
                aria-label="Stop generating"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : text.trim() || stagedAttachments.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="p-2 sm:p-2.5 rounded-full bg-transparent hover:bg-white/10 text-cyan-300 hover:text-white transition-all drop-shadow-[0_0_12px_rgba(56,189,248,0.8)] shadow-[0_0_12px_rgba(56,189,248,0.4)] double-glow-pulse-rounded flex items-center justify-center cursor-pointer"
                aria-label="Send Message"
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
                type="button"
                onClick={() => {
                  if (onStartVoiceSession) onStartVoiceSession();
                  else toggleDictation();
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-transparent flex items-center justify-center text-cyan-300 hover:text-white hover:bg-white/10 transition-all drop-shadow-[0_0_12px_rgba(56,189,248,0.6)] shadow-[0_0_12px_rgba(56,189,248,0.4)] group double-glow-pulse-rounded cursor-pointer"
                aria-label="Start Voice Session"
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
