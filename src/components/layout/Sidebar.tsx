import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  MessageSquare, 
  LayoutGrid, 
  Bot, 
  Clapperboard, 
  MoreHorizontal, 
  ChevronRight, 
  HelpCircle, 
  Settings, 
  Search, 
  ChevronsLeft,
  ChevronsRight,
  X,
  LogOut,
  LogIn,
  CheckCircle2,
  Quote,
  Activity
} from 'lucide-react';
import { conversationEngine } from '../../services/conversationEngine';
import { PrimaryNavItem, SecondaryNavItem } from '../../types/angel';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';

interface SidebarProps {
  activeTab: PrimaryNavItem;
  onNavClick: (item: PrimaryNavItem) => void;
  onSecondaryNavClick: (item: SecondaryNavItem) => void;
  onToggleMore: () => void;
  onHoverMore?: () => void;
  onLeaveMore?: () => void;
  onCloseMore?: () => void;
  morePopupOpen?: boolean;
  isMorePinned?: boolean;
  onOpenSearch: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentUser: { email: string; name: string } | null;
  onSignIn: () => void;
  onSignOut: () => void | Promise<void>;
}

const COSMIC_QUOTES = [
  { quote: "Creativity is intelligence having fun.", author: "Albert Einstein" },
  { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { quote: "Ideas are the raw material of progress.", author: "Angel Philosophy" },
  { quote: "Build with purpose, create with passion.", author: "Steve Jobs" },
  { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { quote: "The mind is everything. What you think you become.", author: "Buddha" }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavClick,
  onSecondaryNavClick,
  onToggleMore,
  onHoverMore,
  onLeaveMore,
  onCloseMore,
  morePopupOpen = false,
  isMorePinned = false,
  onOpenSearch,
  isMobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
  currentUser,
  onSignIn,
  onSignOut,
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Close account menu if clicked outside
  useEffect(() => {
    if (!showAccountMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  // When clicking outside the sidebar and the More pop-up, close temporary sidebar expansion & more popup
  useEffect(() => {
    if (!collapsed) return;
    if (!isHoverExpanded && !morePopupOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideSidebar = sidebarRef.current && sidebarRef.current.contains(target);
      const isInsideMorePopup = document.getElementById('angel-more-popup')?.contains(target);

      if (!isInsideSidebar && !isInsideMorePopup) {
        setIsHoverExpanded(false);
        if (morePopupOpen && onCloseMore) {
          onCloseMore();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [collapsed, isHoverExpanded, morePopupOpen, onCloseMore]);

  // When more popup is closed while sidebar is collapsed, reset hover expanded state
  useEffect(() => {
    if (!morePopupOpen && collapsed) {
      setIsHoverExpanded(false);
    }
  }, [morePopupOpen, collapsed]);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % COSMIC_QUOTES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Primary top 3 navigation items
  const stickyNavItems: { id: PrimaryNavItem; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'new-conversation', label: 'New Conversation', icon: MessageSquare },
    { id: 'adaptive-workspace', label: 'Adaptive Workspace', icon: LayoutGrid },
  ];

  // Middle items (activities, workspace, tools moved to More; Agents and Studios stay with distinct icons)
  const middleNavItems: { id: PrimaryNavItem; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'studios', label: 'Studios', icon: Clapperboard },
  ];

  const recentConversations = [
    { id: 'project-planning', title: 'Project Planning' },
    { id: 'research-analysis', title: 'Research Analysis' },
    { id: 'personal-assistant', title: 'Personal Assistant' },
  ];

  const handleToggleAuth = async () => {
    setShowAccountMenu(false);
    if (currentUser) {
      await onSignOut();
      setAuthToast('You have been signed out.');
    } else {
      onSignIn();
    }
    setTimeout(() => setAuthToast(null), 3000);
  };

  // Whether sidebar is visually showing full expanded view
  // Stays open if explicitly expanded, hovered, or if the More pop-up is active
  const isExpandedView = !collapsed || isHoverExpanded || morePopupOpen;

  const handleNavAction = (id: PrimaryNavItem) => {
    onNavClick(id);
    if (onCloseMore) {
      onCloseMore();
    }
    if (collapsed) {
      setIsHoverExpanded(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full select-none relative z-10">
      {/* Toast alert for auth/profile actions */}
      {authToast && (
        <div className="absolute top-14 left-2 right-2 z-50 p-2 rounded-xl bg-slate-950 border border-blue-400 text-xs text-blue-200 text-center font-semibold shadow-2xl animate-in fade-in">
          {authToast}
        </div>
      )}

      {/* Header with 3D Chrome Angel Trefoil Knot & Quick Controls */}
      <div className={`flex items-center ${isExpandedView ? 'justify-between px-3' : 'justify-center px-1'} pt-3.5 pb-2 mb-1 shrink-0`}>
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => handleNavAction('home')}
          title="Angel Home"
        >
          <div className="w-8 h-8 flex items-center justify-center shrink-0 drop-shadow-[0_0_12px_rgba(147,197,253,0.7)] group-hover:scale-105 transition-transform">
            <AngelEmblem3D size={32} rotationSpeed={10} tiltOnHover={true} />
          </div>
          {isExpandedView && (
            <span className="text-base font-bold tracking-widest text-white font-heading">
              ANGEL
            </span>
          )}
        </div>

        {isExpandedView && (
          <div className="flex items-center gap-1 text-slate-300">
            <button
              onClick={onOpenSearch}
              className="p-1.5 rounded-lg hover:text-cyan-300 bg-transparent transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg hover:text-cyan-300 text-slate-400 bg-transparent transition-colors"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {!collapsed ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4 text-cyan-300" />}
            </button>

            {/* Mobile Close */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg hover:text-cyan-300 bg-transparent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* TOP ITEMS - Transparent background, only icon colour changes on hover */}
      <div className={`px-2 space-y-1 pb-1.5 shrink-0 ${!isExpandedView ? 'flex flex-col items-center' : ''}`}>
        {stickyNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavAction(item.id)}
              title={item.label}
              className={`w-full flex items-center ${isExpandedView ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-xl text-xs font-medium transition-colors bg-transparent group`}
            >
              <Icon 
                className={`w-4 h-4 shrink-0 transition-all ${
                  isActive 
                    ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)] scale-110' 
                    : 'text-slate-400 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                }`} 
              />
              {isExpandedView && (
                <span className={`text-xs transition-colors ${isActive ? 'text-white font-bold tracking-wide' : 'text-slate-300 group-hover:text-white'}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MIDDLE NAVIGATION (Agents & Studios; Search down here in collapsed mode) */}
      <div 
        className={`flex-1 overflow-y-auto overscroll-contain px-2 space-y-1 py-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800 ${!isExpandedView ? 'flex flex-col items-center' : ''}`}
        onWheel={(e) => e.stopPropagation()}
      >
        {middleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavAction(item.id)}
              title={item.label}
              className={`w-full flex items-center ${isExpandedView ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-xl text-xs font-medium transition-colors bg-transparent group`}
            >
              <Icon 
                className={`w-4 h-4 shrink-0 transition-all ${
                  isActive 
                    ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)] scale-110' 
                    : 'text-slate-400 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                }`} 
              />
              {isExpandedView && (
                <span className={`text-xs transition-colors ${isActive ? 'text-white font-bold tracking-wide' : 'text-slate-300 group-hover:text-white'}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

        {/* More Item - Hover preview or click to open permanently (pinned) */}
        <button
          onClick={onToggleMore}
          onMouseEnter={() => {
            if (collapsed) setIsHoverExpanded(true);
            if (onHoverMore) onHoverMore();
          }}
          onMouseLeave={() => {
            if (!isMorePinned && onLeaveMore) onLeaveMore();
          }}
          title="More"
          className={`w-full flex items-center ${isExpandedView ? 'justify-between px-3' : 'justify-center px-0'} py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-colors group`}
        >
          <div className="flex items-center gap-3">
            <MoreHorizontal className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors" />
            {isExpandedView && <span className="text-xs group-hover:text-white transition-colors">More</span>}
          </div>
          {isExpandedView && <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300" />}
        </button>

        {/* Search Icon visible in collapsed sidebar as requested */}
        {!isExpandedView && (
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-cyan-300 bg-transparent transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {/* RECENT CONVERSATIONS - only in expanded view */}
        {isExpandedView && (
          <div className="pt-3 pb-1 px-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-heading">
              Recent Conversations
            </span>
          </div>
        )}

        {isExpandedView &&
          recentConversations.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                const activeThread = conversationEngine.getActiveThread('general');
                conversationEngine.renameThread(activeThread.id, thread.title);
                handleNavAction('new-conversation');
              }}
              className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-colors truncate group text-left"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 shrink-0 transition-colors" />
              <span className="truncate text-xs group-hover:text-white transition-colors">{thread.title}</span>
            </button>
          ))}
      </div>

      {/* ROTATING DAILY COSMIC QUOTES WIDGET - only when expanded */}
      {isExpandedView && (
        <div className="mx-2 mb-2 p-2 rounded-2xl bg-transparent border-0 text-[11px] text-slate-300 flex items-start gap-2 animate-in fade-in transition-all">
          <Quote className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="italic leading-snug font-serif text-[11px] text-cyan-100">
              "{COSMIC_QUOTES[quoteIndex].quote}"
            </p>
            <span className="text-[10px] font-semibold text-cyan-400/80 not-italic font-sans tracking-wide">
              — {COSMIC_QUOTES[quoteIndex].author}
            </span>
          </div>
        </div>
      )}

      {/* BOTTOM ACCOUNT PROFILE CARD WITH POPUP */}
      <div 
        ref={accountMenuRef} 
        onMouseLeave={() => setShowAccountMenu(false)}
        className="relative mt-auto pt-1 pb-2 px-2 shrink-0 z-30"
      >
        {/* Floating Account Menu Popup with outside click dismiss */}
        {showAccountMenu && (
          <div className={`absolute ${isExpandedView ? 'left-2 right-2' : 'left-14 w-56'} bottom-16 z-50 p-2.5 rounded-2xl bg-[#090d24]/95 text-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-in zoom-in-95 duration-150`}>
            {/* User Profile Header */}
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800/80 mb-2 px-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
                {currentUser?.name.split(/\\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">John Doe</div>
                <div className="text-[10px] text-blue-300 truncate">danielokohnwachukwu22@gmail.com</div>
              </div>
            </div>

            {/* Menu Items: Settings, System Status, Help */}
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onSecondaryNavClick('settings');
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-colors text-left"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Settings</span>
              </button>

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onSecondaryNavClick('system-status');
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-colors text-left"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>System Status</span>
              </button>

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  onSecondaryNavClick('help');
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-transparent transition-colors text-left"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Help & Documentation</span>
              </button>

              <div className="h-px bg-slate-800/80 my-1" />

              {/* Logout / Login Action */}
              <button
                onClick={handleToggleAuth}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-300 hover:text-white bg-transparent transition-colors text-left"
              >
                {currentUser ? (
                  <>
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Log Out</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Sign In</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* User Account Pill at bottom of Sidebar */}
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className={`w-full flex items-center ${isExpandedView ? 'justify-between p-2 rounded-2xl bg-[#0b102c]/70' : 'justify-center p-1 rounded-full bg-transparent'} transition-all cursor-pointer group`}
          title="Account & Settings"
        >
          <div className="flex items-center justify-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)] overflow-hidden">
              JD
            </div>
            {isExpandedView && (
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold text-white truncate">{currentUser?.name || 'Guest'}</div>
                <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>{currentUser ? 'Signed in' : 'Guest'}</span>
                </div>
              </div>
            )}
          </div>
          {isExpandedView && (
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showAccountMenu ? '-rotate-90 text-white' : 'rotate-90'}`} />
          )}
        </button>
      </div>
    </div>
  );

  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX - touchEndX > 50) {
      onCloseMobile();
    }
    setTouchStartX(null);
  };

  return (
    <>
      {/* Desktop Fixed Sidebar with floating hover overlay when collapsed */}
      <aside 
        ref={sidebarRef}
        onMouseEnter={() => {
          if (collapsed) setIsHoverExpanded(true);
          if (morePopupOpen && onHoverMore) onHoverMore();
        }}
        onMouseLeave={() => {
          if (!isMorePinned && onLeaveMore) {
            onLeaveMore();
          }
          if (collapsed && !morePopupOpen) {
            setIsHoverExpanded(false);
          }
        }}
        className={`hidden md:block shrink-0 h-screen sticky top-0 transition-all duration-300 z-40 ${
          !collapsed ? 'w-60 lg:w-64' : 'w-16'
        }`}
      >
        <div 
          className={`h-screen transition-all duration-300 p-2.5 ${
            !collapsed
              ? 'w-full relative'
              : isExpandedView
                ? 'absolute top-0 left-0 w-60 lg:w-64 z-50 shadow-[0_12px_45px_rgba(0,0,0,0.9)]'
                : 'w-16 relative'
          }`}
        >
          <div className={`w-full h-full rounded-3xl overflow-hidden relative flex flex-col transition-all duration-300 border-0 ${
            isExpandedView 
              ? 'bg-[#07091a]/30 shadow-none backdrop-blur-xl border-0' 
              : 'bg-transparent shadow-none backdrop-blur-none border-0'
          }`}>
            {sidebarContent}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Sidebar Drawer with Touch Swipe-to-Close */}
      <aside 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed top-0 left-0 bottom-0 w-64 max-w-[80vw] h-[100dvh] z-50 p-2.5 md:hidden transition-transform duration-300 ease-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="w-full h-full rounded-3xl glass-panel bg-[#07091a]/85 shadow-[0_10px_40px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden relative flex flex-col">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
};
