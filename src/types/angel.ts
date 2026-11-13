export type PrimaryNavItem =
  | 'home'
  | 'new-conversation'
  | 'adaptive-workspace'
  | 'activities'
  | 'agents'
  | 'workspace'
  | 'library'
  | 'studios'
  | 'tools'
  | 'more'
  | 'settings'
  | 'help'
  | 'system-status'
  | 'account'
  | 'incognito-chat';

export type MoreSubNavItem =
  | 'activities'
  | 'workspace'
  | 'library'
  | 'tools'
  | 'apps'
  | 'devices'
  | 'schedules'
  | 'locked-chats'
  | 'archive'
  | 'recycle-bin';

export type SecondaryNavItem =
  | 'help'
  | 'system-status'
  | 'settings'
  | 'account';

export type NavItem = PrimaryNavItem | MoreSubNavItem | SecondaryNavItem;

export type CompanionOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'attention' | 'sleeping';
export type OrbState = CompanionOrbState;

export type StudioId =
  | 'research-studio'
  | 'development-studio'
  | 'creative-studio'
  | 'learning-education-studio'
  | 'professional-intelligence-studio'
  | 'personal-life-studio'
  | 'agent-automation-studio'
  | 'device-environment-studio';

export interface StudioInfo {
  id: StudioId;
  name: string;
  tagline: string;
  iconName: string;
  category: string;
  description: string;
  tools: string[];
}

import { AttachmentRecord, LinkPreview } from './attachment';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'angel' | 'system';
  content: string;
  timestamp: string;
  attachments?: string[];
  attachmentDetails?: AttachmentRecord[];
  linkPreviews?: LinkPreview[];
  mode?: string;
}

export interface ActivityRecord {
  id: string;
  title: string;
  category: string;
  timestamp: string;
  durationMs: number;
  status: 'completed' | 'in_progress' | 'queued' | 'standby';
}

export type ActivityItem = {
  id: string;
  title: string;
  timestamp: string;
  status: 'completed' | 'in_progress' | 'queued' | 'standby';
  category: string;
};

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'system' | 'agent' | 'activity';
}

export type FeatureStatusType =
  | 'IMPLEMENTED'
  | 'PARTIALLY_IMPLEMENTED'
  | 'UI_ONLY'
  | 'AWAITING_CONFIGURATION'
  | 'NOT_IMPLEMENTED'
  | 'BLOCKED_BY_PLATFORM';

export interface FeatureMeta {
  id: string;
  name: string;
  category: string;
  status: FeatureStatusType;
  description: string;
  requirements: string[];
  dependencies: string[];
  targetPhase: string;
}

export interface SystemServiceStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'standby';
  latencyMs: number;
  lastChecked: string;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  reduceMotion: boolean;
  voiceAutoPlay: boolean;
  orbSensitivity: 'low' | 'medium' | 'high';
  compactSidebar: boolean;
}
