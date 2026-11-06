import { useState, useEffect } from 'react';
import { PrimaryNavItem, CompanionOrbState, ActivityRecord, NotificationItem, FeatureMeta } from '../types/angel';
import { ANGEL_FEATURE_REGISTRY } from '../services/featureStatus';
import { conversationEngine } from '../services/conversationEngine';

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

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Search Query
  const [searchQuery, setSearchQuery] = useState('');

  // Real Activities List
  const [activities, setActivities] = useState<ActivityRecord[]>([
    { id: 'a1', title: 'Research Analysis & Synthesis', category: 'Research', timestamp: '2m ago', durationMs: 1200, status: 'completed' },
    { id: 'a2', title: 'Project Planning & Architecture', category: 'Workspace', timestamp: '12m ago', durationMs: 450, status: 'completed' },
    { id: 'a3', title: 'Marketing Strategy Outline', category: 'Strategy', timestamp: '1h ago', durationMs: 3400, status: 'completed' },
  ]);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 'n1', title: 'System Engine Operational', message: 'Three.js 3D Emblem & Companion Orb rendering active.', timestamp: 'Just now', read: false, type: 'system' },
    { id: 'n2', title: 'Agent Ready', message: 'Research Agent completed literature synthesis.', timestamp: '10m ago', read: false, type: 'agent' },
    { id: 'n3', title: 'Workspace Synced', message: 'Local session state memory synced.', timestamp: '1h ago', read: false, type: 'activity' },
  ]);

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
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
