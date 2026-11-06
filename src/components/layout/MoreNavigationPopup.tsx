import React, { useEffect, useRef } from 'react';
import { 
  Activity,
  Folder,
  Wrench,
  AppWindow, 
  Smartphone, 
  CalendarDays, 
  Lock, 
  Archive, 
  Trash2, 
  X 
} from 'lucide-react';
import { MoreSubNavItem } from '../../types/angel';

interface MoreNavigationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSubItem: (subItem: MoreSubNavItem) => void;
}

export const MoreNavigationPopup: React.FC<MoreNavigationPopupProps> = ({
  isOpen,
  onClose,
  onSelectSubItem,
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

  const items: { id: MoreSubNavItem; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'activities', label: 'Activities', icon: Activity },
    { id: 'workspace', label: 'Workspace', icon: Folder },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'apps', label: 'Apps', icon: AppWindow },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'schedules', label: 'Schedules', icon: CalendarDays },
    { id: 'locked-chats', label: 'Locked Chats', icon: Lock },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'recycle-bin', label: 'Recycle Bin', icon: Trash2 },
  ];

  return (
    <div 
      ref={popupRef}
      className="fixed left-16 md:left-64 top-1/2 -translate-y-1/2 z-50 w-56 max-h-[85vh] overflow-y-auto p-2 rounded-2xl bg-[#080c22]/95 border border-indigo-500/30 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 scrollbar-thin scrollbar-thumb-slate-800"
    >
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectSubItem(item.id);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-all text-left group"
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
