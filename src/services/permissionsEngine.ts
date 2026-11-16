import { storageService, STORAGE_KEYS } from './storageService';

export type PermissionType = 'camera' | 'microphone' | 'screen_share' | 'local_storage' | 'network_fetch';

export interface PermissionRecord {
  type: PermissionType;
  label: string;
  state: 'granted' | 'denied' | 'prompt';
  lastRequestedAt?: string;
}

function createDefaultPermissions(): PermissionRecord[] {
  return [
    { type: 'camera', label: 'Camera Vision Access', state: 'prompt' },
    { type: 'microphone', label: 'Microphone Dictation & Audio', state: 'prompt' },
    { type: 'screen_share', label: 'Screen Sharing Workspace Vision', state: 'prompt' },
    { type: 'local_storage', label: 'Local Persistence Auto-Sync', state: 'granted' },
    { type: 'network_fetch', label: 'External Provider Network API', state: 'granted' },
  ];
}

export class PermissionsEngine {
  private permissions: PermissionRecord[] = createDefaultPermissions();
  private activeUserId: string | null = null;

  constructor() {
    this.loadCurrentScope();
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private loadCurrentScope(): void {
    const defaults = createDefaultPermissions();
    const loaded = storageService.load<PermissionRecord[]>(
      this.scopedKey(STORAGE_KEYS.permissions),
      defaults
    );
    this.permissions = Array.isArray(loaded) && loaded.length > 0 ? loaded : defaults;
  }

  public setUserContext(userId: string | null): void {
    if (this.activeUserId !== userId) {
      this.activeUserId = userId;
      this.loadCurrentScope();
    }
  }

  private persist(): void {
    storageService.save(this.scopedKey(STORAGE_KEYS.permissions), this.permissions);
  }

  getPermissions(): PermissionRecord[] {
    return this.permissions;
  }

  isPermissionGranted(permission: string): boolean {
    if (permission === 'none') return true;
    const mappedType: PermissionType | null =
      permission === 'file_modification' ||
      permission === 'read_files' ||
      permission === 'write_files' ||
      permission === 'execute_code'
        ? 'local_storage'
        : permission === 'device_control'
          ? 'screen_share'
          : (permission as PermissionType);

    const record = this.permissions.find(
      (p) => p.type === permission || (mappedType && p.type === mappedType)
    );
    return record ? record.state === 'granted' : false;
  }

  setPermissionState(type: PermissionType, state: 'granted' | 'denied' | 'prompt'): boolean {
    const record = this.permissions.find((p) => p.type === type);
    if (!record) return false;
    record.state = state;
    record.lastRequestedAt = new Date().toISOString();
    this.persist();
    return true;
  }

  revokePermission(type: PermissionType): boolean {
    return this.setPermissionState(type, 'denied');
  }

  async syncBrowserPermissionStates(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    const mapping: Array<{ name: PermissionName; type: PermissionType }> = [
      { name: 'camera' as PermissionName, type: 'camera' },
      { name: 'microphone' as PermissionName, type: 'microphone' },
    ];
    let changed = false;
    for (const item of mapping) {
      try {
        const res = await navigator.permissions.query({ name: item.name });
        const record = this.permissions.find((p) => p.type === item.type);
        if (record && (res.state === 'granted' || res.state === 'denied' || res.state === 'prompt')) {
          if (record.state !== res.state) {
            record.state = res.state;
            changed = true;
          }
        }
      } catch {
        // Browser may not support querying camera/microphone via permissions API
      }
    }
    if (changed) this.persist();
  }

  async requestPermission(type: PermissionType): Promise<boolean> {
    const record = this.permissions.find((p) => p.type === type);
    if (!record) return false;

    record.lastRequestedAt = new Date().toISOString();

    if (type === 'microphone') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          record.state = 'granted';
          this.persist();
          return true;
        }
      } catch (err) {
        console.warn('[PermissionsEngine] Microphone permission denied by browser:', err);
        record.state = 'denied';
        this.persist();
        return false;
      }
      record.state = 'denied';
      this.persist();
      return false;
    }

    if (type === 'camera') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
          record.state = 'granted';
          this.persist();
          return true;
        }
      } catch (err) {
        console.warn('[PermissionsEngine] Camera permission denied by browser:', err);
        record.state = 'denied';
        this.persist();
        return false;
      }
      record.state = 'denied';
      this.persist();
      return false;
    }

    if (type === 'screen_share') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
          record.state = 'granted';
          this.persist();
          return true;
        }
      } catch (err) {
        console.warn('[PermissionsEngine] Screen share permission cancelled or denied:', err);
        record.state = 'denied';
        this.persist();
        return false;
      }
      record.state = 'denied';
      this.persist();
      return false;
    }

    record.state = record.state === 'granted' ? 'denied' : 'granted';
    this.persist();
    return record.state === 'granted';
  }
}

export const permissionsEngine = new PermissionsEngine();
