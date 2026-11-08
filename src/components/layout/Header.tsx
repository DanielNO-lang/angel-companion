import React from 'react';
import { Bell, Glasses, Shield, Sun, Moon, Plus, Trash2, Share2 } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { PrimaryNavItem } from '../../types/angel';

interface HeaderProps {
  activeTab?: PrimaryNavItem;
  onOpenMobileMenu: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenProfile?: () => void;
  onOpenAuthModal?: () => void;
  isIncognitoActive?: boolean;
  onOpenIncognitoChat?: () => void;
  activeThreadTitle?: string;
  onResetConversation?: () => void;
  onClearMessages?: () => void;
  onExportConversation?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'home',
  onOpenMobileMenu,
  onOpenNotifications,
  unreadCount,
  theme = 'dark',
  onToggleTheme,
  onOpenAuthModal,
  isIncognitoActive = false,
  onOpenIncognitoChat,
  activeThreadTitle = 'Project Planning',
  onResetConversation,
  onClearMessages,
  onExportConversation,
}) => {
  const isConversationMode = activeTab === 'new-conversation';

  return (
    <header className="sticky top-0 z-30 w-full py-2.5 px-3 sm:px-4 md:px-6 flex items-center justify-between pointer-events-auto select-none bg-transparent">
      {/* Left Top Bar Section */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 rounded-2xl glass-panel hover:bg-slate-800/60 flex items-center gap-2 shrink-0 cursor-pointer"
          title="Open Navigation"
        >
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            <AngelEmblem3D size={28} rotationSpeed={10} tiltOnHover={true} />
          </div>
          <span className="text-xs font-bold font-heading text-white">ANGEL</span>
        </button>

        {/* In Conversation Mode: Clean Title without Active Badge */}
        {isConversationMode && (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-bold font-heading text-white tracking-wide truncate drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {activeThreadTitle || 'Project Planning'}
            </h1>
          </div>
        )}
      </div>

      {/* Right Top Bar Section */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {isConversationMode ? (
          /* CONVERSATION SPECIFIC ICON-ONLY TOP OPTIONS */
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* New Conversation Plus Icon Button */}
            {onResetConversation && (
              <button
                onClick={onResetConversation}
                className="p-2 sm:p-2.5 rounded-full bg-[#090d24]/60 hover:bg-cyan-950/80 border border-slate-700/40 hover:border-cyan-400/60 text-cyan-300 hover:text-white transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] cursor-pointer flex items-center justify-center"
                title="New Conversation"
              >
                <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            )}

            {/* Delete Chats Trash Icon Button */}
            {onClearMessages && (
              <button
                onClick={onClearMessages}
                className="p-2 sm:p-2.5 rounded-full bg-[#090d24]/60 hover:bg-rose-950/80 border border-slate-700/40 hover:border-rose-400/60 text-slate-300 hover:text-rose-300 transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer flex items-center justify-center"
                title="Delete Chats"
              >
                <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-400" />
              </button>
            )}

            {/* Export Conversation Sophisticated Share Icon Button */}
            {onExportConversation && (
              <button
                onClick={onExportConversation}
                className="p-2 sm:p-2.5 rounded-full bg-[#090d24]/60 hover:bg-sky-950/80 border border-slate-700/40 hover:border-sky-400/60 text-slate-300 hover:text-white transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] cursor-pointer flex items-center justify-center"
                title="Export Conversation"
              >
                <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-cyan-300" />
              </button>
            )}
          </div>
        ) : (
          /* STANDARD HOME TOP OPTIONS */
          <>
            {/* Plan Badge */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#090d24]/40 backdrop-blur-md text-[11px] sm:text-xs font-medium text-slate-200 border-0 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent font-bold">Plan</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-medium">Pro</span>
            </div>

            {/* Theme Toggle */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-full glass-panel hover:bg-slate-800/60 text-slate-300 hover:text-white transition-all cursor-pointer"
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-300" />
                )}
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className={`relative p-2 rounded-full glass-panel hover:bg-slate-800/60 text-slate-300 hover:text-white transition-colors cursor-pointer ${
                unreadCount > 0 ? 'animate-bell-breath' : ''
              }`}
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-cyan-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md shadow-red-500/50">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Incognito Private Session Button */}
            <button
              onClick={onOpenIncognitoChat}
              className={`p-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                isIncognitoActive
                  ? 'bg-indigo-950/80 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                  : 'glass-panel text-slate-400 hover:text-white'
              }`}
              title={isIncognitoActive ? 'Incognito Mode Active • Private Session' : 'Enable Incognito Session'}
            >
              <Glasses className="w-4 h-4 text-cyan-300" />
              {isIncognitoActive && <Shield className="w-3 h-3 text-emerald-400 hidden sm:inline" />}
            </button>
          </>
        )}
      </div>
    </header>
  );
};
