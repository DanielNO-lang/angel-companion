import React, { useEffect, useRef } from 'react';
import {
  Activity,
  Folder,
  BookOpen,
  Wrench,
  Bot,
  Clapperboard,
  EyeOff,
  ActivitySquare,
} from 'lucide-react';
import { PrimaryNavItem } from '../../types/angel';

interface MoreNavigationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSubItem: (subItem: PrimaryNavItem) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const MoreNavigationPopup: React.FC<MoreNavigationPopupProps> = ({
  isOpen,
  onClose,
  onSelectSubItem,
  onMouseEnter,
  onMouseLeave,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items: { id: PrimaryNavItem; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'activities', label: 'Activities', icon: Activity },
    { id: 'workspace', label: 'Workspace', icon: Folder },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'studios', label: 'Studios', icon: Clapperboard },
    { id: 'incognito-chat', label: 'Incognito Session', icon: EyeOff },
    { id: 'system-status', label: 'System Status', icon: ActivitySquare },
  ];

  return (
    <div
      ref={popupRef}
      id="angel-more-popup"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed left-16 md:left-60 lg:left-64 top-1/2 -translate-y-1/2 z-50 w-56 max-h-[85vh] overflow-y-auto p-2 rounded-2xl angel-blurred-surface bg-[#080c22]/92 text-slate-100 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 scrollbar-thin scrollbar-thumb-slate-800"
    >
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSubItem(item.id);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-all text-left group cursor-pointer"
            >
              <div className="p-1 rounded-lg bg-transparent text-slate-400 group-hover:text-cyan-300 transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <span className="group-hover:text-white transition-colors">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
