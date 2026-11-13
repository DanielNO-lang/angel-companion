import React from 'react';
import { useAngelState } from './hooks/useAngelState';
import { CosmicEnvironment } from './components/background/CosmicEnvironment';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MoreNavigationPopup } from './components/layout/MoreNavigationPopup';
import { CommandPalette } from './components/layout/CommandPalette';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { AuthModal } from './components/modals/AuthModal';
import { FeatureStatusModal } from './components/modals/FeatureStatusModal';
import { SupabaseBoundaryModal } from './components/modals/SupabaseBoundaryModal';
import { SystemDetailsModal } from './components/modals/SystemDetailsModal';
import { MediaStreamOverlays } from './components/media/MediaStreamOverlays';

// Home View Components
import { HeroSection } from './components/home/HeroSection';
import { SimpleComposerBar } from './components/home/SimpleComposerBar';
import { FourCoreCards } from './components/home/FourCoreCards';
import { ActivityPanel } from './components/home/ActivityPanel';
import { QuickAccessPanel } from './components/home/QuickAccessPanel';
import { SystemStatusPanel } from './components/home/SystemStatusPanel';

// Real Functioning Destination Pages
import { NewConversationPage } from './components/pages/NewConversationPage';
import { AdaptiveWorkspacePage } from './components/pages/AdaptiveWorkspacePage';
import { ActivitiesPage } from './components/pages/ActivitiesPage';
import { AgentsPage } from './components/pages/AgentsPage';
import { WorkspacePage } from './components/pages/WorkspacePage';
import { StudiosPage } from './components/pages/StudiosPage';
import { ToolsPage } from './components/pages/ToolsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { HelpPage } from './components/pages/HelpPage';
import { SystemStatusPage } from './components/pages/SystemStatusPage';
import { AccountPage } from './components/pages/AccountPage';
import { IncognitoChatPage } from './components/pages/IncognitoChatPage';
import { studiosEngine } from './services/studiosEngine';
import { conversationEngine } from './services/conversationEngine';
import { voiceEngine } from './services/voiceEngine';
import { companionAuth } from './services/companionAuth';

import { ArrowLeft } from 'lucide-react';

export default function App() {
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<{ email: string; name: string } | null>(null);

  const {
    activeTab,
    setActiveTab,
    morePopupOpen,
    setMorePopupOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    orbState,
    setOrbState,
    activeQuickChip,
    setActiveQuickChip,
    activeModal,
    setActiveModal,
    modalFeature,
    openFeatureDetails,
    theme,
    toggleTheme,
    activities,
    notifications,
    unreadNotificationCount,
    handleNavClick,
    markNotificationsRead,
    deleteNotifications,
  } = useAngelState();

  const [isMorePinned, setIsMorePinned] = React.useState(false);
  const moreLeaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMoreTimer = () => {
    if (moreLeaveTimerRef.current) {
      clearTimeout(moreLeaveTimerRef.current);
      moreLeaveTimerRef.current = null;
    }
  };

  const handleHoverMore = () => {
    clearMoreTimer();
    setMorePopupOpen(true);
  };

  const handleLeaveMore = () => {
    if (isMorePinned) return; // When clicked, it stays open permanently until clicked elsewhere!
    clearMoreTimer();
    moreLeaveTimerRef.current = setTimeout(() => {
      setMorePopupOpen(false);
    }, 150);
  };

  const handleToggleMore = () => {
    clearMoreTimer();
    if (morePopupOpen && isMorePinned) {
      setMorePopupOpen(false);
      setIsMorePinned(false);
    } else {
      setMorePopupOpen(true);
      setIsMorePinned(true);
    }
  };

  const handleCloseAllMore = () => {
    clearMoreTimer();
    setMorePopupOpen(false);
    setIsMorePinned(false);
  };

  const [cosmicToast, setCosmicToast] = React.useState<string | null>(null);

  const handleSelectSpaceObject = async (data: {
    title: string;
    type: string;
    prompt: string;
    detail: string;
  }) => {
    const activeThread = conversationEngine.getActiveThread('general');
    handleNavClick('new-conversation');
    await conversationEngine.addMessage(activeThread.id, data.prompt, 'user');
    setOrbState('thinking');
    setCosmicToast(`🔭 Intercepted Telemetry: ${data.title}`);
    setTimeout(() => setCosmicToast(null), 4500);

    setTimeout(async () => {
      setOrbState('speaking');
      const assistantMsg = await conversationEngine.addMessage(activeThread.id, data.detail, 'angel');
      voiceEngine.speak(
        assistantMsg.content,
        () => setOrbState('speaking'),
        () => setOrbState('idle')
      );
    }, 600);
  };

  React.useEffect(() => {
    let mounted = true;
    companionAuth.getSession().then((session) => {
      if (!mounted) return;
      conversationEngine.setAccessToken(session?.access_token || null);
      if (session) setCurrentUser({
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
      });
      else setCurrentUser(null);
    });
    return () => { mounted = false; clearMoreTimer(); };
  }, []);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* 1. Hero Section (Welcome + Quick Chips + Right Companion Orb Hero Card) */}
            <HeroSection
              orbState={orbState}
              onOrbStateChange={setOrbState}
              onSelectQuickAction={(actionId) => {
                setActiveQuickChip(actionId);
                setTimeout(() => {
                  setActiveQuickChip(null);
                  if (actionId === 'ask') {
                    conversationEngine.createThread('general', undefined, 'New Conversation');
                    handleNavClick('new-conversation');
                  }
                  else if (actionId === 'plan-project') handleNavClick('workspace');
                  else if (actionId === 'create-plan') handleNavClick('adaptive-workspace');
                  else if (actionId === 'explore-studios') handleNavClick('studios');
                }, 100);
              }}
              activeChip={activeQuickChip}
            />

            {/* 2. Full-Width Single-Line Composer Bar */}
            <SimpleComposerBar
              context={{ type: 'general' }}
              onSendMessage={() => {
                setActiveTab('new-conversation');
              }}
              onOrbStateChange={setOrbState}
            />

            {/* 3. The Four Main Cards (In Exact Reference Order: Conversation, Workspace, Studios, Tools) */}
            <FourCoreCards onSelectDestination={(destId) => handleNavClick(destId)} />

            {/* 4. Three Lower Panels (Your Activity, Quick Access, System Status) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 pt-1">
              <ActivityPanel
                activities={activities.map(a => ({ id: a.id, title: a.title, timestamp: a.timestamp, status: a.status, category: a.category }))}
                onViewAll={() => handleNavClick('activities')}
              />

              <QuickAccessPanel
                onSelectAction={(actionId) => {
                  if (actionId === 'agents') handleNavClick('agents');
                  else if (actionId === 'workspace') handleNavClick('workspace');
                  else openFeatureDetails(actionId);
                }}
              />

              <SystemStatusPanel onOpenDetails={() => handleNavClick('system-status')} />
            </div>
          </div>
        );

      case 'new-conversation':
        return (
          <NewConversationPage
            orbState={orbState}
            onOrbStateChange={setOrbState}
            onNavigateToStudio={(studioId) => {
              studiosEngine.setActiveStudioId(studioId);
              setActiveTab('studios');
            }}
          />
        );

      case 'incognito-chat':
        return <IncognitoChatPage onReturnToStandard={() => setActiveTab('home')} />;

      case 'adaptive-workspace':
        return <AdaptiveWorkspacePage />;

      case 'activities':
        return <ActivitiesPage />;

      case 'agents':
        return <AgentsPage />;

      case 'workspace':
        return <WorkspacePage />;

      case 'studios':
        return <StudiosPage />;

      case 'tools':
        return <ToolsPage />;

      default:
        return (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl glass-panel border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Home Reference</span>
            </button>
            {activeTab === 'settings' && <SettingsPage theme={theme} onToggleTheme={toggleTheme} />}
            {activeTab === 'help' && <HelpPage />}
            {activeTab === 'system-status' && <SystemStatusPage />}
            {activeTab === 'account' && (
              <AccountPage
                user={currentUser}
                onSignIn={() => setAuthModalOpen(true)}
                onSignOut={async () => {
                  await companionAuth.signOut();
                  conversationEngine.setAccessToken(null);
                  setCurrentUser(null);
                }}
              />
            )}
          </div>
        );
    }
  };

  const isIncognitoMode = (activeTab as string) === 'incognito-chat';

  return (
    <div className={`h-screen w-screen relative flex flex-col md:flex-row bg-[#070815] text-slate-100 font-sans antialiased overflow-hidden theme-transition ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* Reconstructed Multi-Layer Cosmic Background Environment */}
      <CosmicEnvironment onSelectSpaceObject={handleSelectSpaceObject} />

      {/* Floating HUD Telemetry Intercept Toast */}
      {cosmicToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#090d24]/95 border border-cyan-400/50 text-cyan-200 text-xs font-semibold shadow-[0_0_30px_rgba(56,189,248,0.6)] backdrop-blur-2xl flex items-center gap-2.5 animate-in fade-in zoom-in-95">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>{cosmicToast}</span>
        </div>
      )}

      {/* Primary Sidebar - Hidden in Incognito/Private Mode */}
      {!isIncognitoMode && (
        <Sidebar
          activeTab={activeTab}
          onNavClick={(item) => {
            handleCloseAllMore();
            handleNavClick(item);
          }}
          onSecondaryNavClick={(secondaryId) => {
            handleCloseAllMore();
            handleNavClick(secondaryId as any);
          }}
          onToggleMore={handleToggleMore}
          onHoverMore={handleHoverMore}
          onLeaveMore={handleLeaveMore}
          onCloseMore={handleCloseAllMore}
          morePopupOpen={morePopupOpen}
          isMorePinned={isMorePinned}
          onOpenSearch={() => {
            handleCloseAllMore();
            setActiveModal('search');
          }}
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentUser={currentUser}
          onSignIn={() => setAuthModalOpen(true)}
          onSignOut={async () => {
            await companionAuth.signOut();
            conversationEngine.setAccessToken(null);
            setCurrentUser(null);
          }}
        />
      )}

      {/* Anchored 'More' Sub-Navigation Popup */}
      {!isIncognitoMode && (
        <MoreNavigationPopup
          isOpen={morePopupOpen}
          onClose={handleCloseAllMore}
          onMouseEnter={handleHoverMore}
          onMouseLeave={handleLeaveMore}
          onSelectSubItem={(subItem) => {
            handleCloseAllMore();
            if (subItem === 'activities' || subItem === 'workspace' || subItem === 'tools') {
              handleNavClick(subItem);
            } else {
              openFeatureDetails(subItem);
            }
          }}
        />
      )}

      {/* Main Content Area with Independent Scroll */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden relative z-10 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Top Header Bar - Hidden in Incognito Mode */}
        {!isIncognitoMode && (
          <Header
            activeTab={activeTab}
            activeThreadTitle={conversationEngine.getActiveThread('general').title}
            onResetConversation={() => {
              conversationEngine.createThread('general');
              handleNavClick('new-conversation');
            }}
            onClearMessages={() => {
              const active = conversationEngine.getActiveThread('general');
              active.messages = [];
              conversationEngine.renameThread(active.id, 'New Conversation');
              handleNavClick('new-conversation');
            }}
            onExportConversation={() => {
              const active = conversationEngine.getActiveThread('general');
              const md = conversationEngine.exportThreadMarkdown(active.id);
              const blob = new Blob([md], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${active.title.replace(/\s+/g, '_')}.md`;
              a.click();
            }}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenNotifications={() => setActiveModal('notifications')}
            unreadCount={unreadNotificationCount}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            isIncognitoActive={activeTab === 'incognito-chat'}
            onOpenIncognitoChat={() => handleNavClick('incognito-chat')}
          />
        )}

        {/* Dynamic Route Content */}
        <main className={
          isIncognitoMode 
            ? 'flex-1 p-0 w-full min-h-screen flex flex-col' 
            : activeTab === 'new-conversation'
              ? 'flex-1 p-0 w-full flex flex-col min-h-0'
              : 'flex-1 px-3 sm:px-6 md:px-8 pb-12 max-w-7xl w-full mx-auto'
        }>
          {renderActivePage()}
        </main>
      </div>

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={activeModal === 'search'}
        onClose={() => setActiveModal(null)}
        onSelectNav={(item) => handleNavClick(item)}
      />

      {/* Global Notifications Drawer with Delete Mode */}
      <NotificationDrawer
        isOpen={activeModal === 'notifications'}
        onClose={() => setActiveModal(null)}
        notifications={notifications}
        onMarkAllRead={markNotificationsRead}
        onDeleteNotifications={deleteNotifications}
      />

      {/* Auth Modal for Email/Password Sign Up & Sign In */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          conversationEngine.setAccessToken(user.accessToken);
          setCurrentUser({ email: user.email, name: user.name });
        }}
      />

      {/* Feature Readiness Inspector Modal */}
      <FeatureStatusModal
        isOpen={activeModal === 'feature_info'}
        onClose={() => setActiveModal(null)}
        feature={modalFeature}
      />

      {/* Supabase Persistence Boundary Modal */}
      <SupabaseBoundaryModal
        isOpen={activeModal === 'supabase_info'}
        onClose={() => setActiveModal(null)}
      />

      {/* System Status Details Modal */}
      <SystemDetailsModal
        isOpen={activeModal === 'system_details'}
        onClose={() => setActiveModal(null)}
      />

      {/* Global Live Camera Preview & Screen Share Overlays */}
      <MediaStreamOverlays />
    </div>
  );
}
