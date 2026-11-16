import { conversationEngine } from './conversationEngine';
import { memoryEngine } from './memoryEngine';
import { libraryService } from './libraryService';
import { workspaceEngine } from './workspaceEngine';
import { studiosEngine } from './studiosEngine';
import { agentEngine } from './agentEngine';
import { permissionsEngine } from './permissionsEngine';
import { universalComposerService } from './universalComposerService';
import { universalAttachmentService } from './universalAttachmentService';
import { cloudMigrationService, type CloudMigrationStatus } from './cloudMigrationService';
import { companionData } from './companionData';
import { voiceEngine } from './voiceEngine';
import { mediaStreamService } from './mediaStreamService';
import { getStoredThemeMode, saveStoredThemeMode } from './authValidation';

export interface CloudAuthContextInput {
  status: string;
  accessToken?: string | null;
  userId?: string | null;
  displayName?: string | null;
}

class CloudSyncCoordinator {
  private lastBoundUserId: string | null = null;
  private lastBoundToken: string | null = null;

  public async handleAuthChange(input: CloudAuthContextInput): Promise<CloudMigrationStatus | null> {
    const isAuthed = input.status === 'authenticated' && Boolean(input.accessToken) && Boolean(input.userId);

    if (!isAuthed) {
      if (this.lastBoundUserId !== null || input.status === 'unauthenticated' || input.status === 'unconfigured') {
        this.resetAllEnginesOnSignOut();
      }
      return null;
    }

    const token = input.accessToken!;
    const userId = input.userId!;
    const identityChanged = this.lastBoundUserId !== userId;
    const tokenChanged = this.lastBoundToken !== token;

    this.lastBoundUserId = userId;
    this.lastBoundToken = token;

    // 1. Bind per-user storage scoping and cloud hydration across all engines
    conversationEngine.setAccessToken(token, userId);
    memoryEngine.setAuthContext(token, userId);
    libraryService.setAuthContext(token, userId);
    workspaceEngine.setAuthContext(token, userId);
    studiosEngine.setAuthContext(token, userId);
    agentEngine.setAuthContext(token, userId);
    permissionsEngine.setUserContext(userId);
    universalComposerService.setUserContext(userId);
    universalAttachmentService.setUserContext(userId);

    // 2. Sync browser permissions non-invasively
    void permissionsEngine.syncBrowserPermissionStates();

    // 3. Migrate unowned genuine local records once safely & hydrate cloud profile prefs
    let migrationResult: CloudMigrationStatus | null = null;
    if (identityChanged || tokenChanged) {
      migrationResult = await cloudMigrationService.runSafeMigration(token, userId);

      if (companionData.isCloudConfigured()) {
        try {
          const profile = await companionData.loadProfilePreferences(token, userId);
          if (profile?.preferences?.theme === 'dark' || profile?.preferences?.theme === 'light') {
            saveStoredThemeMode(profile.preferences.theme);
          } else {
            await companionData.syncProfilePreferences(
              token,
              {
                displayName: input.displayName || undefined,
                preferences: { theme: getStoredThemeMode() },
              },
              userId
            );
          }
        } catch {
          // Non-fatal if profile table has not yet been initialized for this user
        }
      }
    }

    return migrationResult;
  }

  public async syncUserThemePreference(
    token: string | null | undefined,
    userId: string | null | undefined,
    theme: 'dark' | 'light',
    displayName?: string | null
  ): Promise<void> {
    if (!token || !userId || !companionData.isCloudConfigured()) return;
    try {
      await companionData.syncProfilePreferences(
        token,
        {
          displayName: displayName || undefined,
          preferences: { theme },
        },
        userId
      );
    } catch {
      // ignore deferred preference sync failure
    }
  }

  public resetAllEnginesOnSignOut(): void {
    this.lastBoundUserId = null;
    this.lastBoundToken = null;

    voiceEngine.stopAll();
    mediaStreamService.stopAll();

    conversationEngine.setAccessToken(null, null);
    memoryEngine.setAuthContext(null, null);
    libraryService.setAuthContext(null, null);
    workspaceEngine.setAuthContext(null, null);
    studiosEngine.setAuthContext(null, null);
    agentEngine.setAuthContext(null, null);
    permissionsEngine.setUserContext(null);
    universalComposerService.setUserContext(null);
    universalAttachmentService.setUserContext(null);
  }
}

export const cloudSyncCoordinator = new CloudSyncCoordinator();
