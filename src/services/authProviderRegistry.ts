import { getSupabaseConfigState } from './supabaseClient';

export type AuthProviderId =
  | 'google'
  | 'apple'
  | 'azure'
  | 'github'
  | 'discord'
  | 'facebook'
  | 'gitlab'
  | 'linkedin_oidc'
  | 'bitbucket'
  | 'slack_oidc'
  | 'notion'
  | 'spotify'
  | 'twitch'
  | 'zoom';

export interface AuthProviderDescriptor {
  id: AuthProviderId;
  displayName: string;
  buttonLabel: string;
  tier: 'primary' | 'extensible';
  priority: number;
  scopes?: string;
  requiresSecretSetupInSupabase: boolean;
  setupSummary: string;
  missingRequirements: string[];
}

export interface AuthProviderStatus extends AuthProviderDescriptor {
  supabaseConfigured: boolean;
  providerEnabledInEnv: boolean;
  isReady: boolean;
}

export interface ExternalAppIntegrationDescriptor {
  id: string;
  name: string;
  vendor: 'Google' | 'Microsoft' | 'GitHub';
  scopeType: 'external_app_integration';
  description: string;
  requestedScopes: string[];
  status: 'Not Connected' | 'Local Workspace Only';
  permissionNote: string;
}

/**
 * Primary OAuth providers prioritized by Angel Companion (Google first).
 * Additional supported Supabase providers live in EXTENSIBLE_PROVIDER_CATALOG
 * and can be activated via VITE_SUPABASE_ENABLED_PROVIDERS + Supabase Dashboard
 * without redesigning any authentication UI.
 */
export const PRIMARY_AUTH_PROVIDERS: AuthProviderDescriptor[] = [
  {
    id: 'google',
    displayName: 'Google',
    buttonLabel: 'Continue with Google',
    tier: 'primary',
    priority: 1,
    scopes: 'openid email profile',
    requiresSecretSetupInSupabase: true,
    setupSummary: 'Requires Google Cloud OAuth 2.0 Web Client ID & Secret configured in Supabase Auth -> Providers -> Google.',
    missingRequirements: ['Google OAuth Client ID', 'Google OAuth Client Secret', 'Supabase Google Provider toggle'],
  },
  {
    id: 'apple',
    displayName: 'Apple',
    buttonLabel: 'Continue with Apple',
    tier: 'primary',
    priority: 2,
    scopes: 'name email',
    requiresSecretSetupInSupabase: true,
    setupSummary: 'Requires Apple Developer Services ID, Team ID, Key ID, and .p8 Private Key configured in Supabase.',
    missingRequirements: ['Apple Services ID', 'Apple Signing Key (.p8)', 'Supabase Apple Provider toggle'],
  },
  {
    id: 'azure',
    displayName: 'Microsoft',
    buttonLabel: 'Continue with Microsoft',
    tier: 'primary',
    priority: 3,
    scopes: 'openid email profile',
    requiresSecretSetupInSupabase: true,
    setupSummary: 'Requires Microsoft Entra ID (Azure AD) Application Client ID & Client Secret in Supabase Azure Provider.',
    missingRequirements: ['Azure Application (Client) ID', 'Azure Client Secret', 'Supabase Azure Provider toggle'],
  },
  {
    id: 'github',
    displayName: 'GitHub',
    buttonLabel: 'Continue with GitHub',
    tier: 'primary',
    priority: 4,
    scopes: 'read:user user:email',
    requiresSecretSetupInSupabase: true,
    setupSummary: 'Requires GitHub OAuth App Client ID & Client Secret configured in Supabase Auth -> Providers -> GitHub.',
    missingRequirements: ['GitHub OAuth Client ID', 'GitHub OAuth Client Secret', 'Supabase GitHub Provider toggle'],
  },
  {
    id: 'discord',
    displayName: 'Discord',
    buttonLabel: 'Continue with Discord',
    tier: 'primary',
    priority: 5,
    scopes: 'identify email',
    requiresSecretSetupInSupabase: true,
    setupSummary: 'Requires Discord Application Client ID & Client Secret configured in Supabase Auth -> Providers -> Discord.',
    missingRequirements: ['Discord Client ID', 'Discord Client Secret', 'Supabase Discord Provider toggle'],
  },
];

export const EXTENSIBLE_PROVIDER_CATALOG: AuthProviderDescriptor[] = [
  { id: 'facebook', displayName: 'Facebook', buttonLabel: 'Continue with Facebook', tier: 'extensible', priority: 10, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Facebook App ID & Secret in Supabase.', missingRequirements: ['Facebook App ID & Secret'] },
  { id: 'gitlab', displayName: 'GitLab', buttonLabel: 'Continue with GitLab', tier: 'extensible', priority: 11, requiresSecretSetupInSupabase: true, setupSummary: 'Configure GitLab Application ID & Secret in Supabase.', missingRequirements: ['GitLab Application ID & Secret'] },
  { id: 'linkedin_oidc', displayName: 'LinkedIn', buttonLabel: 'Continue with LinkedIn', tier: 'extensible', priority: 12, requiresSecretSetupInSupabase: true, setupSummary: 'Configure LinkedIn OIDC Client ID & Secret in Supabase.', missingRequirements: ['LinkedIn OIDC Credentials'] },
  { id: 'bitbucket', displayName: 'Bitbucket', buttonLabel: 'Continue with Bitbucket', tier: 'extensible', priority: 13, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Bitbucket OAuth Consumer in Supabase.', missingRequirements: ['Bitbucket OAuth Credentials'] },
  { id: 'slack_oidc', displayName: 'Slack', buttonLabel: 'Continue with Slack', tier: 'extensible', priority: 14, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Slack OIDC Client ID & Secret in Supabase.', missingRequirements: ['Slack OIDC Credentials'] },
  { id: 'notion', displayName: 'Notion', buttonLabel: 'Continue with Notion', tier: 'extensible', priority: 15, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Notion OAuth Client ID & Secret in Supabase.', missingRequirements: ['Notion OAuth Credentials'] },
  { id: 'spotify', displayName: 'Spotify', buttonLabel: 'Continue with Spotify', tier: 'extensible', priority: 16, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Spotify Client ID & Secret in Supabase.', missingRequirements: ['Spotify Client Credentials'] },
  { id: 'twitch', displayName: 'Twitch', buttonLabel: 'Continue with Twitch', tier: 'extensible', priority: 17, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Twitch Client ID & Secret in Supabase.', missingRequirements: ['Twitch Client Credentials'] },
  { id: 'zoom', displayName: 'Zoom', buttonLabel: 'Continue with Zoom', tier: 'extensible', priority: 18, requiresSecretSetupInSupabase: true, setupSummary: 'Configure Zoom OAuth App Credentials in Supabase.', missingRequirements: ['Zoom OAuth Credentials'] },
];

export const ALL_SUPPORTED_PROVIDERS: AuthProviderDescriptor[] = [
  ...PRIMARY_AUTH_PROVIDERS,
  ...EXTENSIBLE_PROVIDER_CATALOG,
];

/**
 * Strictly separated from Sign-In Auth Identities:
 * Signing in with Google/Microsoft verifies identity only.
 * External workspace connectors require explicit separate OAuth consent and scopes.
 */
export const EXTERNAL_APP_INTEGRATIONS: ExternalAppIntegrationDescriptor[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    vendor: 'Google',
    scopeType: 'external_app_integration',
    description: 'Read and attach documents from your Google Drive inside Workspace and Library.',
    requestedScopes: ['https://www.googleapis.com/auth/drive.readonly'],
    status: 'Not Connected',
    permissionNote: 'Separate from Google Sign-In. Requires dedicated Workspace OAuth approval.',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    vendor: 'Google',
    scopeType: 'external_app_integration',
    description: 'View upcoming schedule events inside Angel planning workflows.',
    requestedScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    status: 'Not Connected',
    permissionNote: 'Separate from Google Sign-In. Never requested automatically during account login.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    vendor: 'Google',
    scopeType: 'external_app_integration',
    description: 'Summarize or reference selected email threads upon explicit user action.',
    requestedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    status: 'Not Connected',
    permissionNote: 'Separate from Google Sign-In. Requires explicit consent and secure token storage.',
  },
  {
    id: 'microsoft-onedrive',
    name: 'Microsoft OneDrive',
    vendor: 'Microsoft',
    scopeType: 'external_app_integration',
    description: 'Access authorized OneDrive workspace documents.',
    requestedScopes: ['Files.Read'],
    status: 'Not Connected',
    permissionNote: 'Separate from Microsoft Sign-In. Requires separate Microsoft Graph integration.',
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    vendor: 'Microsoft',
    scopeType: 'external_app_integration',
    description: 'Integrate calendar and mail context with explicit permission.',
    requestedScopes: ['Mail.Read', 'Calendars.Read'],
    status: 'Not Connected',
    permissionNote: 'Separate from Microsoft Sign-In. Not requested at sign-in time.',
  },
  {
    id: 'github-repos',
    name: 'GitHub Workspace Connector',
    vendor: 'GitHub',
    scopeType: 'external_app_integration',
    description: 'Repository context integration managed inside Tools.',
    requestedScopes: ['repo (when explicitly authorized)'],
    status: 'Local Workspace Only',
    permissionNote: 'Separate from GitHub Sign-In identity.',
  },
];

export function parseEnabledProvidersList(rawValue?: string | null): Set<AuthProviderId> {
  if (!rawValue || typeof rawValue !== 'string') return new Set();
  const validIds = new Set(ALL_SUPPORTED_PROVIDERS.map((p) => p.id));
  const result = new Set<AuthProviderId>();

  for (const token of rawValue.split(',')) {
    const normalized = token.trim().toLowerCase() as AuthProviderId;
    if (validIds.has(normalized)) {
      result.add(normalized);
    }
  }
  return result;
}

function readEnabledProvidersEnv(): string | null {
  try {
    const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (viteEnv?.VITE_SUPABASE_ENABLED_PROVIDERS) {
      return viteEnv.VITE_SUPABASE_ENABLED_PROVIDERS;
    }
  } catch {
    // Ignore outside Vite
  }
  if (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ENABLED_PROVIDERS) {
    return process.env.VITE_SUPABASE_ENABLED_PROVIDERS;
  }
  return null;
}

export function getAuthProviderStatuses(
  overrideEnabledCsv?: string | null,
  overrideSupabaseConfigured?: boolean
): AuthProviderStatus[] {
  const supabaseConfigured =
    typeof overrideSupabaseConfigured === 'boolean'
      ? overrideSupabaseConfigured
      : getSupabaseConfigState().isConfigured;

  const enabledSet = parseEnabledProvidersList(
    overrideEnabledCsv !== undefined ? overrideEnabledCsv : readEnabledProvidersEnv()
  );

  return ALL_SUPPORTED_PROVIDERS.map((provider) => {
    const providerEnabledInEnv = enabledSet.has(provider.id);
    return {
      ...provider,
      supabaseConfigured,
      providerEnabledInEnv,
      isReady: supabaseConfigured && providerEnabledInEnv,
    };
  }).sort((a, b) => a.priority - b.priority);
}

/**
 * Returns primary sign-in providers (Google, Apple, Microsoft, GitHub) plus any explicitly
 * enabled extensible providers so unconfigured social options are never shown as active.
 */
export function getVisibleAuthProviders(
  overrideEnabledCsv?: string | null,
  overrideSupabaseConfigured?: boolean
): AuthProviderStatus[] {
  const all = getAuthProviderStatuses(overrideEnabledCsv, overrideSupabaseConfigured);
  return all.filter(
    (p) =>
      p.id === 'google' ||
      p.id === 'apple' ||
      p.id === 'azure' ||
      p.id === 'github' ||
      (p.id === 'discord' && p.isReady) ||
      p.isReady
  );
}
