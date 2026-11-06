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

// Home View Components
import { HeroSection } from './components/home/HeroSection';
import { ComposerBar } from './components/home/ComposerBar';
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

import { ArrowLeft } from 'lucide-react';

export default function App() {
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<{ email: string; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem('angel_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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
            <ComposerBar
              onSendMessage={async (msgText) => {
                if (!msgText.trim()) return;
                const activeThread = conversationEngine.getActiveThread('general');
                await conversationEngine.addMessage(activeThread.id, msgText, 'user');
                setActiveTab('new-conversation');
                setOrbState('thinking');
                setTimeout(async () => {
                  setOrbState('speaking');
                  const assistantMsg = await conversationEngine.generateAssistantResponse(activeThread.id);
                  voiceEngine.speak(
                    assistantMsg.content,
                    () => setOrbState('speaking'),
                    () => setOrbState('idle')
                  );
                }, 800);
              }}
              onOrbStateChange={setOrbState}
              onStartVoiceSession={() => handleNavClick('new-conversation')}
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
            {activeTab === 'account' && <AccountPage />}
          </div>
        );
    }
  };

  const isIncognitoMode = (activeTab as string) === 'incognito-chat';

  return (
    <div className={`h-screen w-screen relative flex flex-col md:flex-row bg-[#070815] text-slate-100 font-sans antialiased overflow-hidden theme-transition ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* Reconstructed Multi-Layer Cosmic Background Environment */}
      <CosmicEnvironment />

      {/* Primary Sidebar - Hidden in Incognito/Private Mode */}
      {!isIncognitoMode && (
        <Sidebar
          activeTab={activeTab}
          onNavClick={handleNavClick}
          onSecondaryNavClick={(secondaryId) => {
            handleNavClick(secondaryId as any);
          }}
          onToggleMore={() => setMorePopupOpen(!morePopupOpen)}
          onOpenSearch={() => setActiveModal('search')}
          isMobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Anchored 'More' Sub-Navigation Popup */}
      {!isIncognitoMode && (
        <MoreNavigationPopup
          isOpen={morePopupOpen}
          onClose={() => setMorePopupOpen(false)}
          onSelectSubItem={(subItem) => {
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
        {/* Top Header Bar - Hidden in Incognito Mode which has its own dedicated top bar */}
        {!isIncognitoMode && (
          <Header
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
        <main className={isIncognitoMode ? 'flex-1 p-0 w-full min-h-screen flex flex-col' : 'flex-1 px-3 sm:px-6 md:px-8 pb-12 max-w-7xl w-full mx-auto'}>
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
        onAuthSuccess={(user) => setCurrentUser(user)}
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
    </div>
  );
}
