import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Volume2,
  Copy,
  Check,
  RotateCw,
  ArrowDown,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Mic,
  Send,
  Sparkles,
  ChevronUp,
} from 'lucide-react';
import { CompanionOrbState, StudioId } from '../../types/angel';
import { conversationEngine, ConversationThread } from '../../services/conversationEngine';
import { voiceEngine } from '../../services/voiceEngine';
import { companionData, type CloudSyncHealthState } from '../../services/companionData';
import { cloudSyncCoordinator } from '../../services/cloudSyncCoordinator';
import { universalComposerService } from '../../services/universalComposerService';
import { voiceConversationService, type VoiceSessionSnapshot } from '../../services/voiceConversationService';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ComposerBar } from '../home/ComposerBar';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { MessageAttachmentsAndLinks } from '../chat/MessageAttachmentsAndLinks';

interface NewConversationPageProps {
  orbState: CompanionOrbState;
  onOrbStateChange: (state: CompanionOrbState) => void;
  onNavigateToStudio?: (studioId: StudioId) => void;
}

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm font-bold text-white font-heading mt-2.5 mb-1">
              {line.replace('### ', '')}
            </h4>
          );
        }

        if (line.startsWith('- ')) {
          const itemText = line.replace('- ', '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="text-cyan-400 font-bold leading-tight">•</span>
              <span className="text-slate-200 text-xs sm:text-sm leading-relaxed">
                {renderBold(itemText)}
              </span>
            </div>
          );
        }

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        return (
          <p key={idx} className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {renderBold(line)}
          </p>
        );
      })}
    </div>
  );
};

function renderBold(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function fallbackCopyText(text: string) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  } catch {
    // Suppress in sandboxed test runtimes
  }
}

const RichMessageContent: React.FC<{ content: string }> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = (codeText: string, index: number) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(codeText).catch(() => {
          fallbackCopyText(codeText);
        });
      } else {
        fallbackCopyText(codeText);
      }
    } catch {
      fallbackCopyText(codeText);
    }
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let codeCount = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <FormattedText
          key={`txt_${lastIndex}`}
          text={content.substring(lastIndex, match.index)}
        />
      );
    }

    const lang = match[1] || 'code';
    const code = match[2];
    const currentIndex = codeCount++;

    elements.push(
      <div
        key={`code_${match.index}`}
        className="my-2.5 rounded-2xl overflow-hidden bg-slate-950 font-mono text-xs shadow-lg"
      >
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/90 text-slate-400 text-[11px]">
          <span className="font-semibold text-cyan-400 uppercase tracking-wider">{lang}</span>
          <button
            onClick={() => copyCode(code, currentIndex)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            {copiedIndex === currentIndex ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="font-sans">Copy</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed font-mono text-xs">
          <code>{code}</code>
        </pre>
      </div>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    elements.push(
      <FormattedText
        key={`txt_${lastIndex}`}
        text={content.substring(lastIndex)}
      />
    );
  }

  return <div className="space-y-1">{elements}</div>;
};

const VISIBLE_MESSAGE_BATCH = 30;
const STARTER_PROMPTS = [
  'Help me plan my top 3 priorities for today',
  'Analyze an architecture trade-off with clear pros and cons',
  'Brainstorm fresh project ideas I can build this week',
];

export const NewConversationPage: React.FC<NewConversationPageProps> = ({
  orbState,
  onOrbStateChange,
}) => {
  const isOnline = useOnlineStatus();
  const [activeThread, setActiveThread] = useState<ConversationThread>(() => {
    const existing = conversationEngine.peekActiveThread('general');
    if (existing) return existing;
    const now = new Date().toISOString();
    return {
      id: 'pending_general',
      title: 'General Conversation',
      scope: 'general',
      createdAt: now,
      updatedAt: now,
      isArchived: false,
      messages: [],
    };
  });
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(() => conversationEngine.isGenerating(activeThread.id));
  const [executionStage, setExecutionStage] = useState(() => conversationEngine.getExecutionStage(activeThread.id));
  const [visibleCount, setVisibleCount] = useState(VISIBLE_MESSAGE_BATCH);
  const [voiceSession, setVoiceSession] = useState<VoiceSessionSnapshot>(() => voiceConversationService.getSnapshot());
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [cloudHealth, setCloudHealth] = useState<CloudSyncHealthState>(() => companionData.getCloudSyncHealth());
  const [pendingCloudSync, setPendingCloudSync] = useState(() => conversationEngine.getOfflineCacheStatus().pendingCloudSync);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom < 100;
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    // Keep activeThread live-synced with conversationEngine (handles async AI titles, cloud sync, retries)
    const syncThread = () => {
      const current = conversationEngine.getActiveThread('general');
      setActiveThread({ ...current });
      setIsGenerating(conversationEngine.isGenerating(current.id));
      setExecutionStage(conversationEngine.getExecutionStage(current.id));
      setPendingCloudSync(conversationEngine.getOfflineCacheStatus().pendingCloudSync);
    };
    syncThread();
    const unsubConv = conversationEngine.subscribe(syncThread);
    const unsubHealth = companionData.subscribeCloudSyncHealth(setCloudHealth);
    const unsubVoice = voiceConversationService.subscribe(setVoiceSession);
    return () => {
      unsubConv();
      unsubHealth();
      unsubVoice();
      if (voiceConversationService.getSnapshot().active) {
        voiceConversationService.endSession();
      }
    };
  }, []);

  useEffect(() => {
    setVisibleCount(VISIBLE_MESSAGE_BATCH);
  }, [activeThread.id]);

  useEffect(() => {
    const lastMsg = activeThread.messages[activeThread.messages.length - 1];
    // Always auto-scroll if user just spoke or if user was already near bottom
    if (isNearBottomRef.current || lastMsg?.sender === 'user' || isGenerating) {
      scrollToBottom();
    }
  }, [activeThread.messages, isGenerating]);

  const handleRetry = async () => {
    if (!isOnline) {
      setStatusNotice('Offline — viewing cached history. Reconnect to generate a fresh reply.');
      setTimeout(() => setStatusNotice(null), 3500);
      return;
    }
    setIsRetrying(true);
    setStatusNotice('Re-attempting response...');
    try {
      const retried = await conversationEngine.retryLastTurn(activeThread.id);
      setActiveThread({ ...conversationEngine.getActiveThread('general') });
      setStatusNotice(retried?.status === 'failed' ? 'Retry failed. Please check connection.' : 'Response refreshed');
    } catch {
      setStatusNotice('Retry failed. Please check connection.');
    } finally {
      setIsRetrying(false);
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  const handleSpeakMessage = (msgContent: string) => {
    if (voiceEngine.getIsSynthesizing()) {
      voiceEngine.stopSpeaking();
      onOrbStateChange('idle');
    } else {
      voiceEngine.speak(
        msgContent,
        () => onOrbStateChange('speaking'),
        () => onOrbStateChange('idle')
      );
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col justify-between relative select-none overflow-hidden">
      {/* Toast Notice Banner */}
      {statusNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-slate-950/90 text-xs text-cyan-200 font-semibold shadow-[0_0_20px_rgba(56,189,248,0.5)] border border-cyan-500/20 animate-in fade-in">
          {statusNotice}
        </div>
      )}

      {/* Offline Cached Thread Strip */}
      {!isOnline && (
        <div
          data-thread-offline-strip="true"
          className="mx-2 sm:mx-4 mt-2 px-3.5 py-2 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs flex items-center gap-2 shrink-0 backdrop-blur-md"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>Offline — showing locally cached conversation history. Live replies resume when reconnected.</span>
        </div>
      )}

      {/* Truthful Cloud Sync Degraded / Pending Banner */}
      {isOnline && (cloudHealth.status !== 'healthy' || pendingCloudSync) && (
        <div
          data-cloud-sync-strip="true"
          className="mx-2 sm:mx-4 mt-2 px-3.5 py-2 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-100 text-xs flex items-center justify-between gap-2 shrink-0 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate sm:whitespace-normal">
              {cloudHealth.lastError || 'Local changes are preserved safely and waiting to sync with Supabase cloud.'}
            </span>
          </div>
          <button
            type="button"
            disabled={isSyncingCloud}
            onClick={() => {
              setIsSyncingCloud(true);
              void cloudSyncCoordinator.reconcilePendingSync().finally(() => {
                setIsSyncingCloud(false);
                setPendingCloudSync(conversationEngine.getOfflineCacheStatus().pendingCloudSync);
              });
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 font-semibold shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingCloud ? 'animate-spin' : ''}`} />
            <span>{isSyncingCloud ? 'Syncing...' : 'Retry Sync'}</span>
          </button>
        </div>
      )}

      {/* Message History Stream - Scrollable Middle Body */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-4 px-2 sm:px-4 py-3 scrollbar-thin scrollbar-thumb-slate-800/50"
      >
        {(() => {
          const totalMessages = activeThread.messages.length;
          const hiddenCount = Math.max(0, totalMessages - visibleCount);
          const visibleMessages = hiddenCount > 0 ? activeThread.messages.slice(hiddenCount) : activeThread.messages;

          if (totalMessages === 0 && !isGenerating) {
            return (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-4 py-8">
                <AngelEmblem3D
                  size={84}
                  seed="conversation-welcome"
                  renderMode="3d"
                  rotationSpeed={8}
                  pointerTracking={false}
                />
                <h2 className="mt-4 text-lg sm:text-xl font-bold text-white font-heading">
                  Start a Conversation with Angel
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md">
                  Ask anything, attach images, audio, code, or PDFs, or launch hands-free voice mode below.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        void universalComposerService.submit(
                          { type: 'general', conversationId: activeThread.id },
                          prompt
                        );
                      }}
                      className="px-3.5 py-2 rounded-2xl bg-slate-900/75 hover:bg-slate-800/90 border border-cyan-500/20 hover:border-cyan-400/40 text-xs text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <>
              {hiddenCount > 0 && (
                <div className="flex justify-center pt-1 pb-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + VISIBLE_MESSAGE_BATCH)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-[11px] font-semibold text-cyan-200 transition-colors cursor-pointer"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Show {Math.min(VISIBLE_MESSAGE_BATCH, hiddenCount)} earlier messages ({hiddenCount} hidden)</span>
                  </button>
                </div>
              )}

              {visibleMessages.map((msg, idx) => {
                const isLastMessage = idx === visibleMessages.length - 1;
                const isAngel = msg.sender === 'angel';
                const isPending = msg.status === 'pending';
                const stageLabel = msg.activityStage || (isPending ? executionStage?.stage : undefined) || 'Thinking';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md'
                          : 'bg-slate-900/80 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className={`w-4 h-4 ${isPending ? 'animate-pulse' : ''}`} />
                      )}
                    </div>

                    <div className="flex flex-col max-w-[88%] sm:max-w-[80%]">
                      <div
                        className={`p-3.5 sm:p-4 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-blue-600/90 text-white rounded-tr-none shadow-lg'
                            : msg.status === 'failed'
                              ? 'bg-rose-950/50 backdrop-blur-xl text-rose-100 rounded-tl-none shadow-md border border-rose-500/40'
                              : isPending
                                ? 'bg-[#090e26]/55 backdrop-blur-xl text-slate-200 rounded-tl-none shadow-md border border-cyan-400/25'
                                : 'bg-[#090e26]/40 backdrop-blur-xl text-slate-200 rounded-tl-none shadow-md border border-cyan-500/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5 opacity-75 text-[10px] flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {msg.sender === 'user' && <span className="font-bold uppercase tracking-wider">You</span>}
                            {isAngel && msg.status === 'failed' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-900/70 text-rose-200 font-semibold">
                                <AlertCircle className="w-3 h-3" />
                                <span>Delivery failed</span>
                              </span>
                            )}
                            {isAngel && !isPending && msg.status !== 'failed' && msg.appliedMode === 'Think' && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-purple-200 font-semibold">
                                Think{msg.thinkingLevel ? ` • ${msg.thinkingLevel}` : ''}
                              </span>
                            )}
                          </div>
                          <span>{msg.timestamp}</span>
                        </div>

                        {isPending && !msg.content ? (
                          <div className="flex items-center gap-2 text-cyan-200 py-0.5">
                            <span className="font-semibold">Angel is thinking</span>
                            <span className="inline-flex items-center gap-1" aria-hidden="true">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          </div>
                        ) : (
                          <div>
                            <RichMessageContent content={msg.content} />
                            {isPending && (
                              <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-cyan-400 animate-pulse rounded-xs" aria-hidden="true" />
                            )}
                          </div>
                        )}

                        <MessageAttachmentsAndLinks
                          attachments={msg.attachments}
                          attachmentDetails={msg.attachmentDetails}
                          linkPreviews={msg.linkPreviews}
                        />
                      </div>

                      {/* Response actions appear after Angel finishes. */}
                      {isAngel && !isPending && (
                        <div className="flex items-center gap-1.5 mt-1.5 pl-2 opacity-80 hover:opacity-100 transition-opacity">
                          {msg.status !== 'failed' && (
                            <>
                              <button
                                onClick={() => handleSpeakMessage(msg.content)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-white transition-colors cursor-pointer"
                                title="Read out loud"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => fallbackCopyText(msg.content)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Copy response"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {(isLastMessage || msg.status === 'failed') && (
                            <button
                              onClick={handleRetry}
                              disabled={isRetrying}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                                msg.status === 'failed'
                                  ? 'bg-rose-600/80 hover:bg-rose-500 text-white'
                                  : 'bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-white'
                              }`}
                              title="Retry response"
                            >
                              <RotateCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                              <span>Retry</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()}
        {isGenerating && !activeThread.messages.some((m) => m.status === 'pending') && (
          <div
            data-thinking-indicator="true"
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 animate-in fade-in duration-200"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-900/80 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex flex-col max-w-[88%] sm:max-w-[80%]">
              <div className="p-3.5 sm:p-4 rounded-3xl rounded-tl-none text-xs sm:text-sm bg-[#090e26]/40 backdrop-blur-xl text-slate-200 shadow-md border border-cyan-500/20">
                <div className="flex items-center gap-2 text-cyan-200">
                  <span className="font-semibold">Angel is thinking</span>
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 pl-2">
                <button
                  type="button"
                  onClick={() => conversationEngine.abortGeneration(activeThread.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/30 text-[11px] font-semibold text-rose-200 transition-colors cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop generating</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Jump to Latest Button when scrolled up */}
      {!isNearBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-cyan-300 border border-cyan-500/30 text-xs shadow-lg hover:bg-slate-800 transition-all cursor-pointer backdrop-blur-md"
        >
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          <span>Latest</span>
        </button>
      )}

      {/* Hands-Free Voice Conversation HUD */}
      {voiceSession.active && (
        <div
          data-voice-session-hud="true"
          className="mx-2 sm:mx-4 mb-2 px-3.5 py-2.5 rounded-2xl bg-[#090e26]/90 border border-cyan-400/35 backdrop-blur-xl text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                voiceSession.phase === 'error'
                  ? 'bg-rose-400'
                  : voiceSession.phase === 'listening'
                    ? 'bg-emerald-400 animate-ping'
                    : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <Mic className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-cyan-200 capitalize">{voiceSession.phase}</span>
              {voiceSession.transcript && (
                <span className="ml-2 text-slate-300 truncate">“{voiceSession.transcript}”</span>
              )}
              {voiceSession.error && (
                <span className="ml-2 text-rose-300">{voiceSession.error}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {voiceSession.phase === 'listening' && voiceSession.transcript.trim() && (
              <button
                type="button"
                onClick={() => void voiceConversationService.sendTurnNow()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Send Now</span>
              </button>
            )}
            {(voiceSession.phase === 'thinking' || voiceSession.phase === 'speaking') && (
              <button
                type="button"
                onClick={() => voiceConversationService.interruptAndListen()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 font-semibold cursor-pointer"
              >
                <Mic className="w-3 h-3" />
                <span>Interrupt</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => voiceConversationService.endSession()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-semibold cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>End Voice</span>
            </button>
          </div>
        </div>
      )}

      {/* Chat Composer Bar - Pinned at the Utmost Bottom */}
      <div className="w-full sticky bottom-0 z-30 p-2 sm:p-3 bg-transparent shrink-0">
        <ComposerBar
          context={{
            type: 'general',
            conversationId: activeThread.id,
          }}
          isGenerating={isGenerating}
          onStopGenerating={() => conversationEngine.abortGeneration(activeThread.id)}
          onStartVoiceSession={() =>
            voiceConversationService.startSession({
              context: { type: 'general', conversationId: activeThread.id },
              onOrbStateChange,
            })
          }
          onSendMessage={() => {
            const updatedThread = conversationEngine.getActiveThread('general');
            setActiveThread({ ...updatedThread });
          }}
          onOrbStateChange={onOrbStateChange}
        />
      </div>
    </div>
  );
};

