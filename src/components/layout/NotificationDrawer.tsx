import React, { useState } from 'react';
import { X, CheckCheck, BellRing, Trash2, CheckSquare, Square } from 'lucide-react';
import { NotificationItem } from '../../types/angel';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onDeleteNotifications?: (ids: string[]) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onDeleteNotifications,
}) => {
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    // Swiping right closes the right drawer
    if (touchEndX - touchStartX > 60) {
      onClose();
    }
    setTouchStartX(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (onDeleteNotifications && selectedIds.length > 0) {
      onDeleteNotifications(selectedIds);
      setSelectedIds([]);
    }
    setIsDeleteMode(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="fixed top-0 right-0 bottom-0 w-80 md:w-96 z-50 p-4 bg-slate-950/95 border-l border-indigo-500/30 glass-panel-glow text-slate-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 select-none"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold font-heading text-lg text-white">Notifications</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center justify-between py-2 text-xs text-slate-400 border-b border-slate-800/60 mb-1">
          <span>{unreadCount} unread alerts</span>

          <div className="flex items-center gap-2">
            {isDeleteMode ? (
              <>
                {/* Select All Toggle */}
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1 text-slate-300 hover:text-white font-medium px-2 py-0.5 rounded-lg bg-white/5"
                  title="Select All"
                >
                  {selectedIds.length === notifications.length && notifications.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Select All</span>
                </button>

                {/* Confirm Delete Selected */}
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                  className="px-2.5 py-0.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold disabled:opacity-40 transition-colors"
                  title="Delete Selected Notifications"
                >
                  Delete ({selectedIds.length})
                </button>

                {/* Exit Delete Mode */}
                <button
                  onClick={() => {
                    setIsDeleteMode(false);
                    setSelectedIds([]);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {/* Trash Icon Button to enter Delete Mode */}
                <button
                  onClick={() => setIsDeleteMode(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                  title="Delete Notifications"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Icon-Only Mark All Read Button */}
                <button 
                  onClick={onMarkAllRead}
                  className="p-1.5 rounded-lg text-indigo-400 hover:text-cyan-300 hover:bg-white/5 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No notifications remaining.
            </div>
          ) : (
            notifications.map((n) => {
              const isSelected = selectedIds.includes(n.id);

              return (
                <div 
                  key={n.id}
                  onClick={() => isDeleteMode && handleToggleSelectOne(n.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected ? 'border-rose-500/80 bg-rose-950/20' :
                    n.read 
                      ? 'bg-slate-900/40 border-slate-800/60 text-slate-400' 
                      : 'bg-indigo-950/40 border-indigo-500/40 text-slate-100 shadow-md'
                  }`}
                >
                  {isDeleteMode && (
                    <div className="pt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-indigo-300 truncate">{n.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-1">{n.timestamp}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{n.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
