import React from 'react';
import { Bot, Folder, MessageSquarePlus, ActivitySquare } from 'lucide-react';
import { PrimaryNavItem } from '../../types/angel';

interface QuickAccessPanelProps {
  onSelectAction: (navId: PrimaryNavItem) => void;
}

export const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({
  onSelectAction,
}) => {
  const items: { id: PrimaryNavItem; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'workspace', label: 'Files', icon: Folder },
    { id: 'new-conversation', label: 'New Chat', icon: MessageSquarePlus },
    { id: 'system-status', label: 'System Status', icon: ActivitySquare },
  ];

  return (
    <div className="rounded-3xl angel-blurred-surface bg-[#070b20]/35 p-4 sm:p-5 backdrop-blur-2xl flex flex-col justify-between min-h-[190px] h-full select-none">
      {/* Header */}
      <h3 className="text-base font-bold font-heading text-white tracking-tight mb-2">Quick Access</h3>

      {/* 2x2 Grid Layout (2 Up, 2 Down) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 my-auto flex-1 items-stretch">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAction(item.id)}
              className="flex flex-col items-center justify-center gap-1.5 group cursor-pointer p-2.5 sm:p-3 rounded-2xl bg-transparent hover:bg-cyan-500/10 border-0 transition-all duration-300 hover:shadow-[0_0_20px_rgba(56,189,248,0.25)]"
            >
              <div className="w-9 h-9 flex items-center justify-center text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.6)] group-hover:text-white group-hover:scale-110 transition-all">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-200 group-hover:text-cyan-200 transition-colors">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
