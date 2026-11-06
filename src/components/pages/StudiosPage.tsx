import React, { useState, useEffect } from 'react';
import { Clapperboard, Box, Search, Code2, Palette, GraduationCap, Briefcase, Heart, Cpu, Monitor, Wrench, Send, MessageSquare, Bot, User, Plus } from 'lucide-react';
import { StudioInfo, StudioId } from '../../types/angel';
import { studiosEngine, APPROVED_EIGHT_STUDIOS } from '../../services/studiosEngine';
import { conversationEngine, ConversationThread } from '../../services/conversationEngine';

export const StudiosPage: React.FC = () => {
  const [activeStudioId, setActiveStudioId] = useState<StudioId>(studiosEngine.getActiveStudioId());

  const activeStudio = APPROVED_EIGHT_STUDIOS.find((s) => s.id === activeStudioId) || APPROVED_EIGHT_STUDIOS[0];
  const studioState = studiosEngine.getStudioState(activeStudioId);

  const [activeTool, setActiveTool] = useState(studioState.activeTool);
  const [canvasBuffer, setCanvasBuffer] = useState(studioState.canvasBuffer);

  // Studio Contextual Chat State
  const [studioThread, setStudioThread] = useState<ConversationThread>(
    conversationEngine.getActiveThread('studio', activeStudioId)
  );
  const [chatInput, setChatInput] = useState('');

  const refreshStudioChat = () => {
    setStudioThread(conversationEngine.getActiveThread('studio', activeStudioId));
  };

  useEffect(() => {
    refreshStudioChat();
  }, [activeStudioId]);

  const handleSelectStudio = (id: StudioId) => {
    setActiveStudioId(id);
    studiosEngine.setActiveStudioId(id);
    const newState = studiosEngine.getStudioState(id);
    setActiveTool(newState.activeTool);
    setCanvasBuffer(newState.canvasBuffer);
  };

  const handleSelectTool = (toolName: string) => {
    setActiveTool(toolName);
    studiosEngine.updateStudioTool(activeStudioId, toolName);
  };

  const handleSendStudioMessage = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput('');

    await conversationEngine.addMessage(studioThread.id, text, 'user');
    refreshStudioChat();

    setTimeout(async () => {
      await conversationEngine.generateAssistantResponse(studioThread.id);
      refreshStudioChat();
    }, 800);
  };

  const handleNewStudioThread = () => {
    conversationEngine.createThread('studio', activeStudioId);
    refreshStudioChat();
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Search': return Search;
      case 'Code2': return Code2;
      case 'Palette': return Palette;
      case 'GraduationCap': return GraduationCap;
      case 'Briefcase': return Briefcase;
      case 'Heart': return Heart;
      case 'Cpu': return Cpu;
      case 'Monitor': return Monitor;
      default: return Box;
    }
  };

  const IconComp = getIcon(activeStudio.iconName);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <Clapperboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">Eight Creative & Professional Studios</h2>
          </div>
        </div>
      </div>

      {/* 8 Studio Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {APPROVED_EIGHT_STUDIOS.map((st) => {
          const StIcon = getIcon(st.iconName);
          const isActive = activeStudioId === st.id;

          return (
            <button
              key={st.id}
              onClick={() => handleSelectStudio(st.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'glass-panel-glow bg-indigo-600/30 border-indigo-400/80 text-white shadow-lg'
                  : 'glass-panel bg-slate-950/60 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <StIcon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-indigo-400'}`} />
                <span className="text-xs font-bold font-heading truncate">{st.name.replace(' Studio', '')}</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{st.category}</p>
            </button>
          );
        })}
      </div>

      {/* Studio Grid: Stage & Dedicated Studio Chat Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Studio Tools & Canvas Stage (7 Cols) */}
        <div className="lg:col-span-7 rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-950 border border-indigo-500/40 text-indigo-300">
                <IconComp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-white">{activeStudio.name}</h3>
                <p className="text-xs text-slate-400">{activeStudio.tagline}</p>
              </div>
            </div>

            <span className="text-xs px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 font-semibold border border-indigo-500/30">
              Studio Scope Active
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            {activeStudio.description}
          </p>

          {/* Studio Tools Selection */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Studio Tools ({activeStudio.name}):
            </span>
            <div className="grid grid-cols-2 gap-2">
              {activeStudio.tools.map((tool) => {
                const isToolActive = activeTool === tool;
                return (
                  <button
                    key={tool}
                    onClick={() => handleSelectTool(tool)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                      isToolActive
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Wrench className={`w-3.5 h-3.5 ${isToolActive ? 'text-white' : 'text-cyan-400'}`} />
                    <span>{tool}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Studio Buffer Canvas Area */}
          <div className="pt-2">
            <label className="text-xs font-bold text-indigo-300 block mb-1">
              Active Studio Canvas ({activeTool}):
            </label>
            <textarea
              value={canvasBuffer}
              onChange={(e) => {
                setCanvasBuffer(e.target.value);
                studiosEngine.updateCanvasBuffer(activeStudioId, e.target.value);
              }}
              placeholder={`Synthesize output or edit notes for ${activeTool}...`}
              className="w-full bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-400/50 min-h-[120px]"
            />
          </div>
        </div>

        {/* Dedicated Studio Conversation Panel (5 Cols) */}
        <div className="lg:col-span-5 rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-5 flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {activeStudio.name} Conversation
                  </h4>
                  <p className="text-[10px] text-slate-400">Contextual Studio Chat</p>
                </div>
              </div>

              <button
                onClick={handleNewStudioThread}
                className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1"
                title="New Studio Session"
              >
                <Plus className="w-3 h-3" />
                <span>New Session</span>
              </button>
            </div>

            {/* Studio Messages Stream */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 my-2">
              {studioThread.messages.map((m) => (
                <div key={m.id} className={`flex items-start gap-2 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                      m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-indigo-500/40 text-cyan-300'
                    }`}
                  >
                    {m.sender === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>

                  <div
                    className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                      m.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Studio Chat Input */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-full bg-slate-900 border border-slate-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendStudioMessage()}
                placeholder={`Ask ${activeStudio.name} assistant...`}
                className="flex-1 min-w-0 bg-transparent px-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={handleSendStudioMessage}
                className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
