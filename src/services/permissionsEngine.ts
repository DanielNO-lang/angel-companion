import { storageService, STORAGE_KEYS } from './storageService';

export type PermissionType = 'camera' | 'microphone' | 'screen_share' | 'local_storage' | 'network_fetch';

export interface PermissionRecord {
  type: PermissionType;
  label: string;
  state: 'granted' | 'denied' | 'prompt';
  lastRequestedAt?: string;
}

const DEFAULT_PERMISSIONS: PermissionRecord[] = [
  { type: 'camera', label: 'Camera Vision Access', state: 'prompt' },
  { type: 'microphone', label: 'Microphone Dictation & Audio', state: 'prompt' },
  { type: 'screen_share', label: 'Screen Sharing Workspace Vision', state: 'prompt' },
  { type: 'local_storage', label: 'Local Persistence Auto-Sync', state: 'granted' },
  { type: 'network_fetch', label: 'External Provider Network API', state: 'granted' },
];

export class PermissionsEngine {
  private permissions: PermissionRecord[];

  constructor() {
    this.permissions = storageService.load<PermissionRecord[]>(
      STORAGE_KEYS.permissions,
      DEFAULT_PERMISSIONS
    );
  }

  private persist() {
    storageService.save(STORAGE_KEYS.permissions, this.permissions);
  }

  getPermissions(): PermissionRecord[] {
    return this.permissions;
  }

  isPermissionGranted(permission: string): boolean {
    if (permission === 'none') return true;
    const record = this.permissions.find(
      (p) => p.type === permission || p.type.includes(permission) || (permission === 'file_modification' && p.type === 'local_storage')
    );
    return record ? record.state === 'granted' : false;
  }

  async requestPermission(type: PermissionType): Promise<boolean> {
    const record = this.permissions.find((p) => p.type === type);
    if (!record) return false;

    record.lastRequestedAt = new Date().toISOString();

    // Genuine Browser Permission Checks
    if (type === 'microphone') {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
    } else if (type === 'camera') {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
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
    } else if (type === 'screen_share') {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
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
    }

    // Default toggle if no native API required
    record.state = record.state === 'granted' ? 'prompt' : 'granted';
    this.persist();
    return record.state === 'granted';
  }
}

export const permissionsEngine = new PermissionsEngine();
