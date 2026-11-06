import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Trash2, ArrowLeft } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';

interface IncognitoMessage {
  id: string;
  sender: 'user' | 'angel';
  content: string;
  timestamp: string;
}

interface IncognitoChatPageProps {
  onReturnToStandard: () => void;
}

export const IncognitoChatPage: React.FC<IncognitoChatPageProps> = ({ onReturnToStandard }) => {
  const [messages, setMessages] = useState<IncognitoMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim() || isThinking) return;

    const userMsgText = input.trim();
    const userMsg: IncognitoMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      content: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    setTimeout(() => {
      const angelReplyText = `I have processed your private request for "${userMsgText}". No history or session logs have been saved.`;
      const angelMsg: IncognitoMessage = {
        id: 'ang_' + Date.now(),
        sender: 'angel',
        content: angelReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, angelMsg]);
      setIsThinking(false);
    }, 850);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const hasStartedChat = messages.length > 0;

  return (
    <div className="h-screen w-full flex flex-col justify-between relative select-none animate-in fade-in duration-300 overflow-hidden">
      {/* Dedicated Sticky Top Bar - 100% Transparent, no background, header & icon always visible */}
      <header className="w-full sticky top-0 z-30 px-4 sm:px-6 py-3 bg-transparent border-0 flex items-center justify-between shrink-0">
        {/* Top Left Branding - Icon & Title always visible */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            <AngelEmblem3D size={28} rotationSpeed={10} tiltOnHover={true} />
          </div>
          <span className="text-sm font-bold font-heading text-white tracking-wide">
            Private Mode
          </span>
        </div>

        {/* Top Right Options - Clear Chat & Exit Incognito */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full bg-slate-900/40 hover:bg-rose-950/70 border border-slate-700/40 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 text-xs font-semibold transition-all shadow-md"
            title="Clear all private messages"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Chat</span>
          </button>

          <button
            onClick={onReturnToStandard}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 hover:text-white text-xs font-semibold transition-all shadow-md"
            title="Exit Private Mode"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Incognito</span>
          </button>
        </div>
      </header>

      {/* Main Central Content Area */}
      <div className={`flex-1 w-full max-w-3xl mx-auto flex flex-col px-3 sm:px-6 py-4 min-h-0 ${
        hasStartedChat ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800' : 'justify-center overflow-hidden'
      }`}>
        {/* Central Hero Header - Shown only before chatting starts */}
        {!hasStartedChat && (
          <div className="flex flex-col items-center text-center my-auto animate-in zoom-in-95 duration-300">
            <div className="relative my-2 flex justify-center items-center drop-shadow-[0_0_25px_rgba(56,189,248,0.5)]">
              <AngelEmblem3D size={180} rotationSpeed={12} tiltOnHover={true} pointerTracking={true} />
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold font-heading tracking-tight text-white mb-2">
              <span className="bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
                Private Mode
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide max-w-md">
              Ephemeral & Anonymous • Zero Session Logs Saved
            </p>
          </div>
        )}

        {/* Private Messages Stream */}
        {hasStartedChat && (
          <div className="w-full space-y-4 my-auto pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  {msg.sender === 'user' ? (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md">
                      <User className="w-4 h-4" />
                    </div>
                  ) : (
                    <AngelEmblem3D size={32} rotationSpeed={12} />
                  )}
                </div>

                <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
                  <div
                    className={`p-3.5 sm:p-4 rounded-3xl text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600/90 text-white rounded-tr-none shadow-lg'
                        : 'bg-[#090e26]/50 backdrop-blur-2xl text-slate-200 rounded-tl-none border border-cyan-500/20 shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 opacity-60 text-[10px]">
                      <span className="font-bold uppercase tracking-wider">{msg.sender === 'angel' ? 'Angel Private' : 'You'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p>{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  <AngelEmblem3D size={32} rotationSpeed={6} />
                </div>
                <div className="p-3.5 rounded-3xl bg-[#090e26]/50 backdrop-blur-2xl border border-cyan-500/20 text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Processing in ephemeral memory...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Sticky Bottom Chat Composer Bar - 100% Transparent, no background */}
      <div className="w-full sticky bottom-0 z-30 p-3 sm:p-4 bg-transparent border-0 shrink-0">
        <div className="max-w-3xl mx-auto rounded-full bg-transparent p-1.5 sm:p-2.5 shadow-[0_0_20px_rgba(59,130,246,0.15)] border-0 flex items-center gap-2 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message Angel in Private Mode..."
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none px-3.5 sm:px-4 tracking-wide"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 sm:p-3 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] double-glow-pulse-rounded shrink-0 flex items-center justify-center"
            title="Send Message"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
