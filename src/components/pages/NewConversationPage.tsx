import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Mic, Volume2, VolumeX, RotateCcw, Copy, Check } from 'lucide-react';
import { CompanionOrbState, StudioId } from '../../types/angel';
import { conversationEngine, ConversationThread } from '../../services/conversationEngine';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { voiceEngine } from '../../services/voiceEngine';

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

        // Heading 3
        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-sm font-bold text-white font-heading mt-2.5 mb-1">
              {line.replace('### ', '')}
            </h4>
          );
        }

        // Bullet point
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
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
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
  const [isDictating, setIsDictating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeThread.messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userText = inputText;
    setInputText('');
    if (isDictating) {
      voiceEngine.stopListening();
      setIsDictating(false);
    }

    onOrbStateChange('thinking');

    // Add user message to active General Thread
    await conversationEngine.addMessage(activeThread.id, userText, 'user');
    setActiveThread({ ...conversationEngine.getActiveThread('general') });

    // Generate assistant response without auto speech
    setTimeout(async () => {
      onOrbStateChange('speaking');
      await conversationEngine.generateAssistantResponse(activeThread.id);
      setActiveThread({ ...conversationEngine.getActiveThread('general') });
      setTimeout(() => onOrbStateChange('idle'), 1500);
    }, 600);
  };

  const handleResetConversation = () => {
    voiceEngine.stopSpeaking();
    voiceEngine.stopListening();
    const newThread = conversationEngine.createThread('general', undefined, 'Conversation with Angel');
    setActiveThread(newThread);
    setStatusNotice('Started fresh conversation.');
    setTimeout(() => setStatusNotice(null), 2500);
  };

  const toggleDictation = () => {
    if (isDictating) {
      voiceEngine.stopListening();
      setIsDictating(false);
      onOrbStateChange('idle');
    } else {
      const started = voiceEngine.startListening({
        onTranscript: (transcript) => {
          setInputText(transcript);
          onOrbStateChange('listening');
        },
        onError: (err) => {
          setStatusNotice(`Mic: ${err}`);
          setIsDictating(false);
          onOrbStateChange('idle');
          setTimeout(() => setStatusNotice(null), 3000);
        },
        onEnd: () => {
          setIsDictating(false);
          onOrbStateChange('idle');
        },
      });

      if (started) {
        setIsDictating(true);
        onOrbStateChange('listening');
        setStatusNotice('Listening... Speak now');
        setTimeout(() => setStatusNotice(null), 2000);
      }
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
    <div className="h-[calc(100vh-100px)] flex flex-col p-2 sm:p-4 relative overflow-hidden select-none">
      {/* Toast Notice */}
      {statusNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-slate-950/90 text-xs text-blue-200 font-semibold shadow-2xl animate-in fade-in">
          {statusNotice}
        </div>
      )}

      {/* Clean Conversation Header displaying conversation title */}
      <div className="flex items-center justify-between pb-3 px-1 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold font-heading text-white tracking-wide truncate">
                {activeThread.title || 'New Conversation'}
              </h2>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] text-emerald-400 font-medium shrink-0">Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* New / Reset Conversation */}
          <button
            onClick={handleResetConversation}
            className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Start new conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Message History List */}
      <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800/50">
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
                    : 'bg-[#090e26]/40 backdrop-blur-xl text-slate-200 rounded-tl-none shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 opacity-60 text-[10px]">
                  <span className="font-bold uppercase tracking-wider">{msg.sender === 'angel' ? 'Angel' : 'You'}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <RichMessageContent content={msg.content} />
              </div>

              {/* Per-Message Interactive Options for Angel's Replies - Clean Icon-Only Action Toolbar */}
              {msg.sender === 'angel' && (
                <div className="flex items-center gap-1.5 mt-1.5 pl-2 opacity-80 hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleSpeakMessage(msg.content)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-white transition-colors"
                    title="Read out loud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => fallbackCopyText(msg.content)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
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

      {/* Composer Input Bar */}
      <div className="pt-2 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-full bg-[#070b1e]/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Talk with Angel..."
            className="flex-1 min-w-0 bg-transparent px-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
          />

          {/* Dictation (Mic) Button with Pulsing Double Glow */}
          <button
            onClick={toggleDictation}
            className={`p-2 rounded-full transition-all shrink-0 double-glow-pulse-rounded ${
              isDictating
                ? 'bg-cyan-500/30 text-cyan-300 animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title="Dictate with voice"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Send Button with Pulsing Double Glow */}
          <button
            onClick={handleSend}
            className="p-2 sm:p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] shrink-0 double-glow-pulse-rounded"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
