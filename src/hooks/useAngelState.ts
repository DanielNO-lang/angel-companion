import { useState, useEffect } from 'react';
import { PrimaryNavItem, CompanionOrbState, ActivityRecord, NotificationItem, FeatureMeta } from '../types/angel';
import { ANGEL_FEATURE_REGISTRY } from '../services/featureStatus';
import { conversationEngine } from '../services/conversationEngine';
import { getStoredThemeMode, saveStoredThemeMode } from '../services/authValidation';

export function useAngelState() {
  const [activeTab, setActiveTab] = useState<PrimaryNavItem>('home');
  const [morePopupOpen, setMorePopupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Companion Orb 5-State Machine
  const [orbState, setOrbState] = useState<CompanionOrbState>('idle');

  // Composer
  const [composerText, setComposerText] = useState('');
  const [activeQuickChip, setActiveQuickChip] = useState<string | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<'feature_info' | 'supabase_info' | 'system_details' | 'search' | 'notifications' | null>(null);
  const [modalFeature, setModalFeature] = useState<FeatureMeta | null>(null);

  // Theme (persisted across landing, auth, and workspace)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getStoredThemeMode());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'light') {
        document.body.classList.add('theme-light');
      } else {
        document.body.classList.remove('theme-light');
      }
    }
    saveStoredThemeMode(theme);
  }, [theme]);

  // Search Query
  const [searchQuery, setSearchQuery] = useState('');

  // Genuine activities derived from actual user conversations (never fabricated)
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const syncActivitiesFromThreads = () => {
      const threads = [
        ...conversationEngine.getThreads('general'),
        ...conversationEngine.getThreads('studio'),
      ]
        .filter((t) => t.messages.length > 0)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5);

      const nextActivities: ActivityRecord[] = threads.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.scope === 'studio' ? (t.studioId || 'Studio').replace(/-/g, ' ') : 'Conversation',
        timestamp: new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        durationMs: 0,
        status: t.messages.some((m) => m.status === 'pending') ? 'in_progress' : 'completed',
      }));
      setActivities(nextActivities);
    };

    syncActivitiesFromThreads();
    return conversationEngine.subscribe(syncActivitiesFromThreads);
  }, []);

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const openFeatureDetails = (featureKey: string) => {
    const feat = ANGEL_FEATURE_REGISTRY[featureKey] || {
      id: featureKey,
      name: featureKey.charAt(0).toUpperCase() + featureKey.slice(1).replace('-', ' '),
      category: 'System Module',
      status: 'UI_ONLY' as const,
      description: `Module target for ${featureKey}.`,
      requirements: ['Interactive view', 'State binding'],
      dependencies: ['Angel Core'],
      targetPhase: 'Active Phase',
    };
    setModalFeature(feat);
    setActiveModal('feature_info');
  };

  const handleNavClick = (navId: PrimaryNavItem) => {
    setActiveQuickChip(null);
    if (navId === 'new-conversation') {
      conversationEngine.createThread('general', undefined, 'New Conversation');
    }
    setMorePopupOpen(false);
    setMobileMenuOpen(false);
    setActiveTab(navId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveModal('search');
      }
      if (e.key === 'Escape') {
        setActiveModal(null);
        setMorePopupOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
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
    composerText,
    setComposerText,
    activeQuickChip,
    setActiveQuickChip,
    activeModal,
    setActiveModal,
    modalFeature,
    openFeatureDetails,
    theme,
    toggleTheme,
    searchQuery,
    setSearchQuery,
    activities,
    notifications,
    unreadNotificationCount,
    handleNavClick,
    markNotificationsRead: () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    deleteNotifications: (ids: string[]) => setNotifications((prev) => prev.filter((n) => !ids.includes(n.id))),
  };
}
