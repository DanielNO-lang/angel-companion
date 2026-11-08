import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Volume2, Copy, Check } from 'lucide-react';
import { CompanionOrbState, StudioId } from '../../types/angel';
import { conversationEngine, ConversationThread } from '../../services/conversationEngine';
import { voiceEngine } from '../../services/voiceEngine';
import { ComposerBar } from '../home/ComposerBar';

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

export const NewConversationPage: React.FC<NewConversationPageProps> = ({
  orbState,
  onOrbStateChange,
}) => {
  const [activeThread, setActiveThread] = useState<ConversationThread>(() =>
    conversationEngine.getActiveThread('general')
  );
  const [inputText, setInputText] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Keep activeThread synced with engine
    const current = conversationEngine.getActiveThread('general');
    setActiveThread({ ...current });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeThread.messages]);

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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-slate-950/90 text-xs text-cyan-200 font-semibold shadow-[0_0_20px_rgba(56,189,248,0.5)] animate-in fade-in">
          {statusNotice}
        </div>
      )}

      {/* Message History Stream - Scrollable Middle Body */}
      <div className="flex-1 overflow-y-auto space-y-4 px-2 sm:px-4 py-3 scrollbar-thin scrollbar-thumb-slate-800/50">
        {activeThread.messages.map((msg) => (
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
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className="flex flex-col max-w-[88%] sm:max-w-[80%]">
              <div
                className={`p-3.5 sm:p-4 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600/90 text-white rounded-tr-none shadow-lg'
                    : 'bg-[#090e26]/40 backdrop-blur-xl text-slate-200 rounded-tl-none shadow-md border border-cyan-500/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 opacity-60 text-[10px]">
                  <span className="font-bold uppercase tracking-wider">{msg.sender === 'angel' ? 'Angel' : 'You'}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <RichMessageContent content={msg.content} />
              </div>

              {/* Per-Message Toolbar */}
              {msg.sender === 'angel' && (
                <div className="flex items-center gap-1.5 mt-1.5 pl-2 opacity-80 hover:opacity-100 transition-opacity">
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
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Composer Bar - Pinned at the Utmost Bottom */}
      <div className="w-full sticky bottom-0 z-30 p-2 sm:p-3 bg-transparent shrink-0">
        <ComposerBar
          context={{
            type: 'general',
            conversationId: activeThread.id,
          }}
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
