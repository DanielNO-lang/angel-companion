import React, { Suspense } from 'react';
import { useAngelState } from './hooks/useAngelState';
import { CosmicEnvironment } from './components/background/CosmicEnvironment';
import { CloudySkyEnvironment } from './components/background/CloudySkyEnvironment';
import './components/background/environment.css';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MoreNavigationPopup } from './components/layout/MoreNavigationPopup';
import { CommandPalette } from './components/layout/CommandPalette';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { FeatureStatusModal } from './components/modals/FeatureStatusModal';
import { SupabaseBoundaryModal } from './components/modals/SupabaseBoundaryModal';
import { SystemDetailsModal } from './components/modals/SystemDetailsModal';
import { MediaStreamOverlays } from './components/media/MediaStreamOverlays';
import { AppShellSkeleton, PageSkeleton } from './components/ui/Skeleton';
import { FriendlyErrorScreen } from './components/ui/FriendlyErrorScreen';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Public Landing & Dedicated Authentication Pages
import { LandingPage } from './components/landing/LandingPage';
import { SignInPage } from './components/auth/SignInPage';
import { SignUpPage } from './components/auth/SignUpPage';
import { EmailVerificationPage } from './components/auth/EmailVerificationPage';
import { PasswordRecoveryPage } from './components/auth/PasswordRecoveryPage';
import { AuthLayout } from './components/auth/AuthLayout';

// Auth, Error Handling & Recovery Navigation Services
import { authService, type AuthStateSnapshot } from './services/authService';
import {
  FRIENDLY_ERROR_MESSAGES,
  logSanitizedDiagnostic,
  toFriendlyError,
} from './services/errorHandlingService';
import {
  getAuthFlowOrigin,
  popSafeReturnRoute,
  pushSafeRoute,
  scrubCallbackUrlFromHistory,
} from './services/recoveryNavigationService';
import {
  canAccessWorkspace,
  getPathForRoute,
  parseAppRoute,
  parseAuthCallbackParams,
  sanitizeRedirectPath,
  type AppRoute,
} from './services/authValidation';

// Home View Components
import { HeroSection } from './components/home/HeroSection';
import { SimpleComposerBar } from './components/home/SimpleComposerBar';
import { FourCoreCards } from './components/home/FourCoreCards';
import { ActivityPanel } from './components/home/ActivityPanel';
import { QuickAccessPanel } from './components/home/QuickAccessPanel';
import { SystemStatusPanel } from './components/home/SystemStatusPanel';

// Direct & Lazy-Loaded Destination Pages
import { LibraryPage } from './components/pages/LibraryPage';
const NewConversationPage = React.lazy(() =>
  import('./components/pages/NewConversationPage').then((m) => ({ default: m.NewConversationPage }))
);
const AdaptiveWorkspacePage = React.lazy(() =>
  import('./components/pages/AdaptiveWorkspacePage').then((m) => ({ default: m.AdaptiveWorkspacePage }))
);
const ActivitiesPage = React.lazy(() =>
  import('./components/pages/ActivitiesPage').then((m) => ({ default: m.ActivitiesPage }))
);
const AgentsPage = React.lazy(() =>
  import('./components/pages/AgentsPage').then((m) => ({ default: m.AgentsPage }))
);
const WorkspacePage = React.lazy(() =>
  import('./components/pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage }))
);
const StudiosPage = React.lazy(() =>
  import('./components/pages/StudiosPage').then((m) => ({ default: m.StudiosPage }))
);
const ToolsPage = React.lazy(() =>
  import('./components/pages/ToolsPage').then((m) => ({ default: m.ToolsPage }))
);
const SettingsPage = React.lazy(() =>
  import('./components/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const HelpPage = React.lazy(() =>
  import('./components/pages/HelpPage').then((m) => ({ default: m.HelpPage }))
);
const SystemStatusPage = React.lazy(() =>
  import('./components/pages/SystemStatusPage').then((m) => ({ default: m.SystemStatusPage }))
);
const AccountPage = React.lazy(() =>
  import('./components/pages/AccountPage').then((m) => ({ default: m.AccountPage }))
);
const IncognitoChatPage = React.lazy(() =>
  import('./components/pages/IncognitoChatPage').then((m) => ({ default: m.IncognitoChatPage }))
);
import { studiosEngine } from './services/studiosEngine';
import { conversationEngine } from './services/conversationEngine';
import { voiceEngine } from './services/voiceEngine';
import { geminiModelService } from './services/geminiModelService';
import { cloudSyncCoordinator } from './services/cloudSyncCoordinator';

import { ArrowLeft, Loader2 } from 'lucide-react';

interface AuthErrorRecoveryState {
  title: string;
  message: string;
  originRoute: 'signin' | 'signup';
  provider?: 'google';
  retryable: boolean;
}

export default function App() {
  const [authSnapshot, setAuthSnapshot] = React.useState<AuthStateSnapshot>(() => authService.getSnapshot());
  const [currentRoute, setCurrentRoute] = React.useState<AppRoute>(() =>
    typeof window !== 'undefined' ? parseAppRoute(window.location.pathname) : 'landing'
  );
  const [pendingVerifyEmail, setPendingVerifyEmail] = React.useState<string>('');
  const [authNotice, setAuthNotice] = React.useState<string | null>(null);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = React.useState(false);
  const [recoveryError, setRecoveryError] = React.useState<string | null>(null);
  const [callbackProcessing, setCallbackProcessing] = React.useState(false);
  const [authErrorState, setAuthErrorState] = React.useState<AuthErrorRecoveryState | null>(null);

  const navigateRoute = React.useCallback(
    (route: AppRoute, options?: { email?: string; notice?: string | null; replace?: boolean }) => {
      if (options?.email !== undefined) setPendingVerifyEmail(options.email);
      setAuthNotice(options?.notice ? toFriendlyError(options.notice, 'auth', { logDiagnostic: false }).userMessage : null);
      setAuthErrorState(null);
      if (route !== 'verify-email') {
        setVerifyError(null);
        setVerifySuccess(false);
      }
      if (route !== 'reset-password') {
        setRecoveryError(null);
      }

      if (!options?.replace) {
        pushSafeRoute(currentRoute);
      }
      pushSafeRoute(route);

      setCurrentRoute(route);
      if (typeof window !== 'undefined') {
        const targetPath = getPathForRoute(route);
        if (window.location.pathname !== targetPath || window.location.search || window.location.hash) {
          if (options?.replace) {
            window.history.replaceState({}, '', targetPath);
          } else {
            window.history.pushState({}, '', targetPath);
          }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentRoute]
  );

  // A Google OAuth popup shares the Supabase session with this tab. The callback
  // popup broadcasts completion so this tab can verify the session and enter Angel.
  React.useEffect(() => {
    let active = true;
    let popupSyncInProgress = false;
    let popupSyncCompleted = false;
    const syncPopupSession = async (tokens?: { access_token: string; refresh_token: string }) => {
      if (popupSyncInProgress || popupSyncCompleted) return;
      popupSyncInProgress = true;
      try {
        // Explicitly persist in this tab: sessionStorage is isolated between popup and opener.
        const restored = tokens
          ? await authService.adoptPopupSession(tokens)
          : await authService.restoreVerifiedSession();
        if (!active || restored.status !== 'authenticated') return;
        popupSyncCompleted = true;
        setAuthSnapshot(restored);
        navigateRoute('app', { replace: true });
      } catch {
        // The normal auth listener remains the fallback if a popup closes early.
      } finally {
        popupSyncInProgress = false;
      }
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ANGEL_AUTH_POPUP_SUCCESS') {
        void syncPopupSession(event.data.session);
      }
    };
    window.addEventListener('message', handleWindowMessage);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('angel-auth-popup');
        channel.onmessage = (event) => {
          if (event.data?.type === 'ANGEL_AUTH_POPUP_SUCCESS') {
            void syncPopupSession(event.data.session);
          }
        };
      }
    } catch {
      channel = null;
    }

    return () => {
      active = false;
      window.removeEventListener('message', handleWindowMessage);
      channel?.close();
    };
  }, [navigateRoute]);

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

  const prevWorkspaceTabRef = React.useRef<typeof activeTab>('home');
  const lastWorkspaceTabRef = React.useRef<typeof activeTab>(activeTab);
  React.useEffect(() => {
    if (lastWorkspaceTabRef.current !== activeTab) {
      prevWorkspaceTabRef.current = lastWorkspaceTabRef.current;
      lastWorkspaceTabRef.current = activeTab;
    }
  }, [activeTab]);

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
    if (isMorePinned) return;
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
    if (!canAccessWorkspace(authSnapshot.status)) return;
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

  const [isAppReady, setIsAppReady] = React.useState(false);

  // Sync browser back/forward navigation cleanly (excluding sensitive callback routes)
  React.useEffect(() => {
    const onPopState = () => {
      const nextRoute = parseAppRoute(window.location.pathname);
      if (nextRoute === 'auth-callback') {
        const safeReturn = popSafeReturnRoute('auth-callback', getAuthFlowOrigin());
        scrubCallbackUrlFromHistory(safeReturn);
        setCurrentRoute(safeReturn);
        return;
      }
      pushSafeRoute(nextRoute);
      setCurrentRoute(nextRoute);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Subscribe to single-source-of-truth Supabase authentication + handle initial callback / restoration
  React.useEffect(() => {
    let active = true;
    const unsubscribe = authService.subscribe((next) => {
      if (active) setAuthSnapshot(next);
    });

    const bootstrapApp = async () => {
      try {
        const search = typeof window !== 'undefined' ? window.location.search : '';
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const initialRoute = typeof window !== 'undefined' ? parseAppRoute(window.location.pathname) : 'landing';
        const parsedCallback = parseAuthCallbackParams(search, hash);

        if (initialRoute !== 'auth-callback') {
          pushSafeRoute(initialRoute);
        }

        if (parsedCallback.hasCallbackParams || initialRoute === 'auth-callback') {
          if (active) setCallbackProcessing(true);
          const cbResult = await authService.processAuthCallback(search, hash);
          if (!active) return;

          if (cbResult.outcome === 'authenticated') {
            const isPopupOAuthCallback = new URLSearchParams(search).get('angel_oauth_popup') === '1';
            if (isPopupOAuthCallback) {
              const popupSession = authService.getSnapshot().session;
              const sessionTokens = popupSession
                ? {
                    access_token: popupSession.access_token,
                    refresh_token: popupSession.refresh_token,
                  }
                : undefined;
              const completionMessage = {
                type: 'ANGEL_AUTH_POPUP_SUCCESS',
                session: sessionTokens,
              };
              try {
                if (typeof BroadcastChannel !== 'undefined') {
                  const channel = new BroadcastChannel('angel-auth-popup');
                  channel.postMessage(completionMessage);
                  channel.close();
                }
              } catch {
                // window.opener postMessage below is the fallback.
              }
              try {
                window.opener?.postMessage(completionMessage, window.location.origin);
              } catch {
                // Supabase's cross-tab auth event remains the final fallback.
              }
              window.close();
              if (!window.closed) {
                setCurrentRoute('app');
                window.history.replaceState({}, '', '/app');
              }
              return;
            }

            const safeNext = sanitizeRedirectPath(cbResult.parsed.nextPath, '/app');
            const targetRoute = parseAppRoute(safeNext);
            pushSafeRoute(targetRoute);
            setCurrentRoute(targetRoute);
            window.history.replaceState({}, '', safeNext);
          } else if (cbResult.outcome === 'recovery') {
            setCurrentRoute('reset-password');
            window.history.replaceState({}, '', '/reset-password');
          } else if (cbResult.outcome === 'verified') {
            setVerifySuccess(true);
            setCurrentRoute('verify-email');
            window.history.replaceState({}, '', '/verify-email');
          } else {
            const originRoute = getAuthFlowOrigin();
            const isRecoveryCallback = cbResult.parsed.type === 'recovery' || initialRoute === 'reset-password';
            const isSignupVerifyCallback =
              cbResult.parsed.type === 'signup' ||
              (cbResult.parsed.isExpiredOrInvalid && !cbResult.parsed.error && !cbResult.parsed.code);

            if (isRecoveryCallback) {
              const classified = toFriendlyError(cbResult.message, 'auth');
              setRecoveryError(classified.userMessage);
              setCurrentRoute('reset-password');
              scrubCallbackUrlFromHistory('reset-password');
            } else if (isSignupVerifyCallback) {
              const classified = toFriendlyError(cbResult.message, 'auth');
              setVerifyError(classified.userMessage);
              setCurrentRoute('verify-email');
              scrubCallbackUrlFromHistory('verify-email');
            } else {
              const rawContextHint = `${search} ${hash} ${cbResult.message}`;
              const isLikelyGoogleOrOAuth =
                Boolean(cbResult.parsed.error || cbResult.parsed.code || /google|oauth|provider|access_denied/i.test(rawContextHint));
              const context = isLikelyGoogleOrOAuth ? 'google_oauth' : 'auth';
              const classified = toFriendlyError(
                cbResult.parsed.errorDescription || cbResult.parsed.error || cbResult.message,
                context,
                { metadata: { originRoute, initialRoute } }
              );
              scrubCallbackUrlFromHistory(originRoute);
              setAuthErrorState({
                title: classified.title,
                message: classified.userMessage,
                originRoute,
                provider: isLikelyGoogleOrOAuth ? 'google' : undefined,
                retryable: classified.retryable,
              });
              setCurrentRoute(originRoute);
            }
          }
        } else {
          const restored = await authService.restoreVerifiedSession();
          if (active && restored.status === 'authenticated') {
            if (initialRoute === 'signin' || initialRoute === 'signup') {
              pushSafeRoute('app');
              setCurrentRoute('app');
              window.history.replaceState({}, '', '/app');
            }
          }
        }

        const minHydrationDelay = new Promise<void>((resolve) => setTimeout(resolve, 180));
        const maxCapDelay = new Promise<void>((resolve) => setTimeout(resolve, 460));
        const fontsReady =
          typeof document !== 'undefined' && document.fonts?.ready
            ? document.fonts.ready.then(() => undefined).catch(() => undefined)
            : Promise.resolve();
        const statusCheck = geminiModelService.checkStatus().then(() => undefined).catch(() => undefined);

        await Promise.race([Promise.all([minHydrationDelay, fontsReady, statusCheck]), maxCapDelay]);
      } catch (err) {
        if (active) {
          const originRoute = getAuthFlowOrigin();
          const currentPath = typeof window !== 'undefined' ? parseAppRoute(window.location.pathname) : 'landing';
          const classified = toFriendlyError(err, currentPath === 'auth-callback' ? 'google_oauth' : 'auth');
          logSanitizedDiagnostic({
            category: classified.category,
            context: 'auth',
            rawError: err,
          });
          if (currentPath === 'auth-callback') {
            scrubCallbackUrlFromHistory(originRoute);
            setAuthErrorState({
              title: classified.title,
              message: classified.userMessage,
              originRoute,
              provider: 'google',
              retryable: true,
            });
            setCurrentRoute(originRoute);
          } else {
            setAuthNotice(classified.userMessage);
          }
        }
      } finally {
        if (active) {
          setCallbackProcessing(false);
          setIsAppReady(true);
        }
      }
    };

    bootstrapApp();

    return () => {
      active = false;
      unsubscribe();
      clearMoreTimer();
    };
  }, []);

  // Bind all Companion engines to the verified Supabase identity, migrate unowned local records safely,
  // and reset all engine state on sign-out.
  React.useEffect(() => {
    const displayName = authSnapshot.user?.fullName || authSnapshot.user?.email || null;

    void cloudSyncCoordinator.handleAuthChange({
      status: authSnapshot.status,
      accessToken: authSnapshot.session?.access_token,
      userId: authSnapshot.user?.id,
      displayName,
    });
  }, [
    authSnapshot.status,
    authSnapshot.session?.access_token,
    authSnapshot.user?.id,
    authSnapshot.user?.fullName,
    authSnapshot.user?.email,
  ]);

  // Strict Route Guard enforcing verified Supabase session before allowing workspace rendering
  const isAuthenticated = canAccessWorkspace(authSnapshot.status);

  React.useEffect(() => {
    if (!isAppReady || callbackProcessing || authSnapshot.status === 'loading' || authErrorState) return;

    if (!isAuthenticated && currentRoute === 'app') {
      navigateRoute('signin', {
        replace: true,
        notice: FRIENDLY_ERROR_MESSAGES.SESSION,
      });
    } else if (isAuthenticated && (currentRoute === 'signin' || currentRoute === 'signup')) {
      navigateRoute('app', { replace: true });
    }
  }, [isAppReady, callbackProcessing, authSnapshot.status, authErrorState, isAuthenticated, currentRoute, navigateRoute]);

  const handleToggleTheme = React.useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    toggleTheme();
    if (isAuthenticated && authSnapshot.session?.access_token && authSnapshot.user?.id) {
      const displayName = authSnapshot.user?.fullName || null;
      void cloudSyncCoordinator.syncUserThemePreference(
        authSnapshot.session.access_token,
        authSnapshot.user.id,
        nextTheme,
        displayName
      );
    }
  }, [
    theme,
    toggleTheme,
    isAuthenticated,
    authSnapshot.session?.access_token,
    authSnapshot.user?.id,
    authSnapshot.user?.fullName,
  ]);

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await authService.signOut();
      cloudSyncCoordinator.resetAllEnginesOnSignOut();
      setActiveTab('home');
      navigateRoute('landing', { replace: true });
    } catch (error) {
      setSignOutError('Angel could not confirm sign-out. Your session has been left unchanged. Please try again.');
      logSanitizedDiagnostic({
        category: 'unknown_failure',
        context: 'auth',
        rawError: error,
        metadata: { action: 'sign_out' },
      });
    }
  };

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
                  if (actionId === 'new-conversation') {
                    conversationEngine.createThread('general', undefined, 'New Conversation');
                    handleNavClick('new-conversation');
                  } else {
                    handleNavClick(actionId);
                  }
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

      case 'library':
        return <LibraryPage />;

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
            {activeTab === 'settings' && (
              <SettingsPage
                theme={theme}
                onToggleTheme={handleToggleTheme}
                onOpenAccountSecurity={() => setActiveTab('account')}
              />
            )}
            {activeTab === 'help' && <HelpPage />}
            {activeTab === 'system-status' && <SystemStatusPage />}
            {activeTab === 'account' && (
              <AccountPage
                user={authSnapshot.user}
                identities={authSnapshot.identities}
                onSignOut={handleSignOut}
                onNavigateToTools={() => setActiveTab('tools')}
              />
            )}
          </div>
        );
    }
  };

  const getPageSkeletonVariant = (): 'default' | 'chat' | 'grid' | 'workspace' => {
    if (activeTab === 'new-conversation' || activeTab === 'incognito-chat') return 'chat';
    if (activeTab === 'adaptive-workspace' || activeTab === 'workspace') return 'workspace';
    if (activeTab === 'studios' || activeTab === 'agents' || activeTab === 'tools') return 'grid';
    return 'default';
  };

  const isIncognitoMode = (activeTab as string) === 'incognito-chat';
  const showWorkspace = isAppReady && isAuthenticated && currentRoute === 'app';

  return (
    <div
      className={`${
        showWorkspace ? 'h-screen overflow-hidden flex flex-col md:flex-row' : 'min-h-screen overflow-x-clip flex flex-col'
      } w-full relative font-sans antialiased theme-transition ${
        theme === 'light' ? 'theme-light bg-[#e0f2fe] text-slate-900' : 'bg-[#070815] text-slate-100'
      }`}
    >
      {/* Shared Atmospheric Environment: Cosmic Dark Void vs Cloudy-Day Light Sky */}
      {theme === 'light' ? (
        <CloudySkyEnvironment />
      ) : (
        <CosmicEnvironment onSelectSpaceObject={showWorkspace ? handleSelectSpaceObject : undefined} />
      )}

      {!isAppReady || callbackProcessing || authSnapshot.status === 'loading' ? (
        callbackProcessing ? (
          <AuthLayout
            title="Completing verification"
            subtitle="Validating your authentication callback with Supabase."
            visualHeading="Verifying Your Identity"
            visualDescription="Establishing your verified session before entering Angel."
            theme={theme}
            onToggleTheme={toggleTheme}
            onNavigate={(r) => navigateRoute(r)}
          >
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-xs">
              <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
              <span className="font-semibold">Verifying security state and tokens...</span>
            </div>
          </AuthLayout>
        ) : currentRoute === 'app' ? (
          <AppShellSkeleton collapsedSidebar={sidebarCollapsed} />
        ) : (
          <div className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center gap-3 px-6">
            <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
            <span className="text-xs font-semibold tracking-wider uppercase opacity-70">
              Loading Angel Companion
            </span>
          </div>
        )
      ) : authErrorState ? (
        <FriendlyErrorScreen
          title={authErrorState.title}
          message={authErrorState.message}
          theme={theme}
          variant="fullscreen"
          goBackLabel="Go Back"
          tryAgainLabel="Try Again"
          showTryAgain={authErrorState.retryable}
          onGoBack={() => {
            const target = authErrorState.originRoute || 'signin';
            setAuthErrorState(null);
            navigateRoute(target, { replace: true });
          }}
          onTryAgain={
            authErrorState.retryable
              ? async () => {
                  if (authErrorState.provider === 'google') {
                    const retryRes = await authService.signInWithOAuthProvider('google', 'email profile');
                    if (!retryRes.ok) {
                      const target = authErrorState.originRoute || 'signin';
                      setAuthErrorState(null);
                      navigateRoute(target, {
                        replace: true,
                        notice: toFriendlyError(retryRes.message, 'google_oauth').userMessage,
                      });
                    }
                  } else {
                    const target = authErrorState.originRoute || 'signin';
                    setAuthErrorState(null);
                    navigateRoute(target, { replace: true });
                  }
                }
              : undefined
          }
          secondaryActionLabel="Return to Angel Home"
          onSecondaryAction={() => {
            setAuthErrorState(null);
            navigateRoute('landing', { replace: true });
          }}
        />
      ) : !showWorkspace ? (
        /* PUBLIC ENTRY & DEDICATED AUTHENTICATION ROUTES */
        <>
          {currentRoute === 'signin' ? (
            <SignInPage
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onNavigate={(r, opts) => navigateRoute(r, opts)}
              initialNotice={authNotice}
            />
          ) : currentRoute === 'signup' ? (
            <SignUpPage
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onNavigate={(r, opts) => navigateRoute(r, opts)}
            />
          ) : currentRoute === 'verify-email' ? (
            <EmailVerificationPage
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onNavigate={(r) => navigateRoute(r)}
              pendingEmail={pendingVerifyEmail}
              initialError={verifyError}
              verifiedSuccess={verifySuccess}
            />
          ) : currentRoute === 'forgot-password' ? (
            <PasswordRecoveryPage
              mode="request"
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onNavigate={(r) => navigateRoute(r)}
            />
          ) : currentRoute === 'reset-password' ? (
            <PasswordRecoveryPage
              mode="complete"
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onNavigate={(r) => navigateRoute(r)}
              initialError={recoveryError}
            />
          ) : (
            <LandingPage
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onNavigate={(r) => navigateRoute(r)}
            />
          )}
        </>
      ) : (
        /* AUTHENTICATED EXISTING ANGEL WORKSPACE (PRESERVED VISUAL SOURCE OF TRUTH) */
        <>
          {/* Floating HUD Telemetry Intercept Toast */}
          {cosmicToast && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#090d24]/95 border border-cyan-400/50 text-cyan-200 text-xs font-semibold shadow-[0_0_30px_rgba(56,189,248,0.6)] backdrop-blur-2xl flex items-center gap-2.5 animate-in fade-in zoom-in-95">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span>{cosmicToast}</span>
            </div>
          )}

          {signOutError && (
            <div role="alert" className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] max-w-[min(92vw,30rem)] px-4 py-3 rounded-2xl bg-[#090d24]/95 text-rose-100 text-xs font-medium shadow-[0_0_24px_rgba(244,63,94,0.18)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <span>{signOutError}</span>
                <button type="button" className="underline underline-offset-2 shrink-0" onClick={() => setSignOutError(null)}>Dismiss</button>
              </div>
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
              user={authSnapshot.user}
              onSignOut={handleSignOut}
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
                handleNavClick(subItem as any);
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
                onToggleTheme={handleToggleTheme}
                onOpenAuthModal={() => navigateRoute('signin')}
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
              <ErrorBoundary
                theme={theme}
                variant="panel"
                resetKey={activeTab}
                goBackLabel="Go Back"
                onGoBack={() => setActiveTab(prevWorkspaceTabRef.current || 'home')}
              >
                <Suspense fallback={<PageSkeleton variant={getPageSkeletonVariant()} />}>
                  {renderActivePage()}
                </Suspense>
              </ErrorBoundary>
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
        </>
      )}
    </div>
  );
}
