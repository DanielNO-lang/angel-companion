import React, { useState } from 'react';
import { Plus, Sliders, Eye, Mic, Send, Camera, Monitor, X } from 'lucide-react';
import { CompanionOrbState } from '../../types/angel';
import { permissionsEngine } from '../../services/permissionsEngine';
import { voiceEngine } from '../../services/voiceEngine';

interface ComposerBarProps {
  onSendMessage: (text: string) => void;
  onOrbStateChange: (state: CompanionOrbState) => void;
  onStartVoiceSession: () => void;
}

export const ComposerBar: React.FC<ComposerBarProps> = ({
  onSendMessage,
  onOrbStateChange,
  onStartVoiceSession,
}) => {
  const [text, setText] = useState('');
  const [showVisualMenu, setShowVisualMenu] = useState(false);
  const [showModesMenu, setShowModesMenu] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [visualFeedback, setVisualFeedback] = useState<string | null>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    const msg = text;
    onSendMessage(msg);
    onOrbStateChange('thinking');
    setText('');
    if (isDictating) {
      voiceEngine.stopListening();
      setIsDictating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const toggleDictation = () => {
    if (isDictating) {
      voiceEngine.stopListening();
      setIsDictating(false);
      onOrbStateChange('idle');
    } else {
      const started = voiceEngine.startListening({
        onTranscript: (transcript, isFinal) => {
          setText(transcript);
          onOrbStateChange('listening');
        },
        onError: (err) => {
          setVisualFeedback(`Mic: ${err}`);
          setIsDictating(false);
          onOrbStateChange('idle');
          setTimeout(() => setVisualFeedback(null), 3000);
        },
        onEnd: () => {
          setIsDictating(false);
          onOrbStateChange('idle');
        },
      });

      if (started) {
        setIsDictating(true);
        onOrbStateChange('listening');
        setVisualFeedback('Listening... Speak naturally');
        setTimeout(() => setVisualFeedback(null), 2500);
      }
    }
  };

  const handleCameraRequest = async () => {
    setShowVisualMenu(false);
    const granted = await permissionsEngine.requestPermission('camera');
    if (granted) {
      setVisualFeedback('Camera stream active & bound to visual context.');
    } else {
      setVisualFeedback('Camera permission required for visual context.');
    }
    setTimeout(() => setVisualFeedback(null), 3500);
  };

  const handleScreenShareRequest = async () => {
    setShowVisualMenu(false);
    const granted = await permissionsEngine.requestPermission('screen_share');
    if (granted) {
      setVisualFeedback('Screen share session active.');
    } else {
      setVisualFeedback('Screen share permission required.');
    }
    setTimeout(() => setVisualFeedback(null), 3500);
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-4 select-none relative">
      {/* Visual Feedback Toast Banner */}
      {visualFeedback && (
        <div className="absolute left-1/2 -top-12 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-slate-950 border border-blue-500/40 text-xs text-blue-200 font-semibold shadow-2xl animate-in fade-in zoom-in-95">
          {visualFeedback}
        </div>
      )}

      {/* Visual Menu Popup (Camera & Share Screen) */}
      {showVisualMenu && (
        <div className="absolute right-12 -top-24 z-30 w-48 p-2 rounded-2xl border border-blue-500/40 bg-[#090d24]/95 text-slate-100 shadow-2xl animate-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Visual Input</span>
            <button onClick={() => setShowVisualMenu(false)} className="p-0.5 text-slate-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={handleCameraRequest}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-blue-600/30 transition-colors text-left"
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span>Camera</span>
          </button>
          <button
            onClick={handleScreenShareRequest}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-blue-600/30 transition-colors text-left"
          >
            <Monitor className="w-4 h-4 text-blue-400" />
            <span>Share Screen</span>
          </button>
        </div>
      )}

      {/* Modes Menu Popup */}
      {showModesMenu && (
        <div className="absolute right-24 -top-32 z-30 w-52 p-2 rounded-2xl border border-blue-500/40 bg-[#090d24]/95 text-slate-100 shadow-2xl animate-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Angel Modes</span>
            <button onClick={() => setShowModesMenu(false)} className="p-0.5 text-slate-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
          {['Standard Intelligent', 'Deep Research', 'Code Analysis', 'Creative Brainstorm'].map((m) => (
            <button
              key={m}
              onClick={() => setShowModesMenu(false)}
              className="w-full text-left px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-blue-600/30 transition-colors"
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Horizontal Composer Container - Borderless glass blending */}
      <div className="w-full rounded-full bg-[#070b1e]/40 p-1.5 sm:p-2.5 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.4)] flex items-center gap-1.5 sm:gap-3 transition-all focus-within:shadow-[0_0_25px_rgba(59,130,246,0.3)]">
        {/* Add (+) Button with Pulsing Double Glow */}
        <button
          onClick={() => onSendMessage('Attachment context ready')}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#10183b]/80 flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] shrink-0 double-glow-pulse-rounded"
          title="Add Attachment"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Input with min-w-0 to prevent flex item blowout on small screens */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Angel..."
          className="flex-1 min-w-0 bg-transparent text-xs sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none px-1.5 sm:px-2 tracking-wide"
        />

        {/* Right Single Line Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 pr-0.5 sm:pr-1">
          {/* Modes Button */}
          <button
            onClick={() => {
              setShowModesMenu(!showModesMenu);
              setShowVisualMenu(false);
            }}
            className="p-1.5 sm:p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Angel Controls"
          >
            <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Visual Eye Button */}
          <button
            onClick={() => {
              setShowVisualMenu(!showVisualMenu);
              setShowModesMenu(false);
            }}
            className="p-1.5 sm:p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Visual Context (Camera & Screen)"
          >
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Dictation (Mic) with Pulsing Double Glow */}
          <button
            onClick={toggleDictation}
            className={`p-1.5 sm:p-2 rounded-full transition-colors double-glow-pulse-rounded ${
              isDictating 
                ? 'bg-cyan-500/30 text-cyan-300 animate-pulse' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Dictation (Mic)"
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Audio Waveform / Voice Activity Indicator Capsule Button or Send Button with Pulsing Double Glow */}
          {text.trim() ? (
            <button
              onClick={handleSend}
              className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.6)] double-glow-pulse-rounded"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onStartVoiceSession}
              className="w-10 h-10 rounded-full bg-[#10183b]/90 flex items-center justify-center text-blue-300 hover:text-white hover:bg-blue-600/40 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] group double-glow-pulse-rounded"
              title="Start Voice Session"
            >
              {/* 5 Vertical Soundwave Bars matching reference icon */}
              <div className="flex items-center gap-[2.5px] h-4">
                <span className="w-[2px] h-2 bg-blue-400 group-hover:bg-white rounded-full transition-all group-hover:h-3" />
                <span className="w-[2px] h-3.5 bg-blue-300 group-hover:bg-white rounded-full transition-all group-hover:h-4" />
                <span className="w-[2px] h-4 bg-white rounded-full transition-all group-hover:h-3" />
                <span className="w-[2px] h-3 bg-blue-300 group-hover:bg-white rounded-full transition-all group-hover:h-4" />
                <span className="w-[2px] h-2 bg-blue-400 group-hover:bg-white rounded-full transition-all group-hover:h-3" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
