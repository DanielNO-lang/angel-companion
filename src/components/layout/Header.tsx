import React, { useState } from 'react';
import { Bell, Glasses, Shield, Sun, Moon } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenProfile?: () => void;
  onOpenAuthModal?: () => void;
  isIncognitoActive?: boolean;
  onOpenIncognitoChat?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenNotifications,
  unreadCount,
  theme = 'dark',
  onToggleTheme,
  onOpenAuthModal,
  isIncognitoActive = false,
  onOpenIncognitoChat,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full py-2 px-3 sm:px-4 md:px-6 flex items-center justify-between pointer-events-auto select-none">
      {/* Left Top Bar Section - Mobile Trigger */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 rounded-2xl glass-panel hover:bg-slate-800/60 flex items-center gap-2"
          title="Open Navigation"
        >
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            <AngelEmblem3D size={28} rotationSpeed={10} tiltOnHover={true} />
          </div>
          <span className="text-xs font-bold font-heading text-white">ANGEL</span>
        </button>
      </div>

      {/* Right Top Bar Section: Plan Badge -> Theme Toggle -> Notifications -> Incognito Private Mode */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Plan Badge - Positioned on right side before Notifications */}
        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#090d24]/40 backdrop-blur-md text-[11px] sm:text-xs font-medium text-slate-200 border-0 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent font-bold">Plan</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300 font-medium">Pro</span>
        </div>

        {/* Theme Toggle (Light / Dark Mode) */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full glass-panel hover:bg-slate-800/60 text-slate-300 hover:text-white transition-all"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-300" />
            )}
          </button>
        )}

        {/* Notification Bell with Breathing Animation when there are unread items */}
        <button
          onClick={onOpenNotifications}
          className={`relative p-2 rounded-full glass-panel hover:bg-slate-800/60 text-slate-300 hover:text-white transition-colors ${
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
          className={`p-2 rounded-full transition-all flex items-center gap-1.5 ${
            isIncognitoActive
              ? 'bg-indigo-950/80 text-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
              : 'glass-panel text-slate-400 hover:text-white'
          }`}
          title={isIncognitoActive ? 'Incognito Mode Active • Private Session' : 'Enable Incognito Session'}
        >
          <Glasses className="w-4 h-4 text-cyan-300" />
          {isIncognitoActive && <Shield className="w-3 h-3 text-emerald-400 hidden sm:inline" />}
        </button>
      </div>
    </header>
  );
};
