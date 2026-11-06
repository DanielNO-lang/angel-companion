import React, { useState } from 'react';
import { Search, X, ArrowRight, Compass } from 'lucide-react';
import { PrimaryNavItem } from '../../types/angel';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNav: (item: PrimaryNavItem) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectNav,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const searchTargets: { id: PrimaryNavItem; title: string; category: string; description: string }[] = [
    { id: 'home', title: 'Home Dashboard', category: 'Core', description: 'Locked Reference Home View' },
    { id: 'new-conversation', title: 'New Conversation', category: 'Chat', description: 'Start an intelligent chat session with Angel' },
    { id: 'adaptive-workspace', title: 'Adaptive Workspace', category: 'Workspace', description: 'Dynamic task-adapted workspace layout' },
    { id: 'activities', title: 'Task Activities', category: 'Execution', description: 'View background execution logs and tasks' },
    { id: 'agents', title: 'Agents Hub', category: 'Agents', description: 'Dispatch autonomous multi-agent workers' },
    { id: 'workspace', title: 'Projects & Files', category: 'Storage', description: 'Document repository & knowledge bases' },
    { id: 'studios', title: 'Creative Studios', category: 'Studios', description: 'Code, Design, Audio, Video & Data Studios' },
    { id: 'tools', title: 'Tool Extensions', category: 'Integrations', description: 'Connect external APIs and custom Webhooks' },
  ];

  const filtered = searchTargets.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase()) || 
    t.category.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-xl rounded-3xl glass-panel-glow border border-indigo-500/40 bg-slate-950/95 text-slate-100 shadow-2xl overflow-hidden z-10">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Angel destinations, tools, or commands..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No matching destinations found for "{query}"
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelectNav(item.id);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-indigo-600/20 border border-transparent hover:border-indigo-500/30 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:border-indigo-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 group-hover:text-white flex items-center gap-2">
                      <span>{item.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 group-hover:bg-indigo-950 group-hover:text-indigo-300">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-300 group-hover:translate-x-1 transition-all" />
              </button>
            ))
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-500">
          <span>Navigate with Universal Search</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">ESC</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
};
