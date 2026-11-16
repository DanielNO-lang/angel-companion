export interface MediaStreamListener {
  onCameraStreamChanged: (stream: MediaStream | null) => void;
  onScreenStreamChanged: (stream: MediaStream | null) => void;
}

function formatMediaError(err: any, kind: 'camera' | 'screen'): string {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return kind === 'camera'
      ? 'Camera access was denied. Grant camera permission in your browser settings and try again.'
      : 'Screen sharing permission was cancelled or denied.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera hardware device was found on this system.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return kind === 'camera'
      ? 'The camera is already in use by another application.'
      : 'Unable to capture display media on this device.';
  }
  return err?.message || (kind === 'camera' ? 'Camera access failed.' : 'Screen sharing failed.');
}

export class MediaStreamService {
  private static instance: MediaStreamService;
  private activeCameraStream: MediaStream | null = null;
  private activeScreenStream: MediaStream | null = null;
  private listeners: Set<MediaStreamListener> = new Set();

  private constructor() {}

  public static getInstance(): MediaStreamService {
    if (!MediaStreamService.instance) {
      MediaStreamService.instance = new MediaStreamService();
    }
    return MediaStreamService.instance;
  }

  public subscribe(listener: MediaStreamListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyCamera() {
    this.listeners.forEach((l) => l.onCameraStreamChanged(this.activeCameraStream));
  }

  private notifyScreen() {
    this.listeners.forEach((l) => l.onScreenStreamChanged(this.activeScreenStream));
  }

  public getCameraStream(): MediaStream | null {
    return this.activeCameraStream;
  }

  public getScreenStream(): MediaStream | null {
    return this.activeScreenStream;
  }

  public async startCamera(): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
    if (this.activeCameraStream) {
      return { success: true, stream: this.activeCameraStream };
    }

    let acquiredStream: MediaStream | null = null;
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return { success: false, error: 'Camera capture is not supported in this browser or context.' };
      }

      acquiredStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });

      this.activeCameraStream = acquiredStream;

      acquiredStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          this.stopCamera();
        };
      });

      this.notifyCamera();
      return { success: true, stream: acquiredStream };
    } catch (err: any) {
      if (acquiredStream) {
        acquiredStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore track stop failure
          }
        });
      }
      return { success: false, error: formatMediaError(err, 'camera') };
    }
  }

  public stopCamera() {
    if (this.activeCameraStream) {
      this.activeCameraStream.getTracks().forEach((track) => {
        track.onended = null;
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.activeCameraStream = null;
      this.notifyCamera();
    }
  }

  public async startScreenShare(): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
    if (this.activeScreenStream) {
      return { success: true, stream: this.activeScreenStream };
    }

    let acquiredStream: MediaStream | null = null;
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        return { success: false, error: 'Screen sharing is not supported on this device or browser.' };
      }

      acquiredStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      this.activeScreenStream = acquiredStream;

      acquiredStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          this.stopScreenShare();
        };
      });

      this.notifyScreen();
      return { success: true, stream: acquiredStream };
    } catch (err: any) {
      if (acquiredStream) {
        acquiredStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
      }
      return { success: false, error: formatMediaError(err, 'screen') };
    }
  }

  public stopScreenShare() {
    if (this.activeScreenStream) {
      this.activeScreenStream.getTracks().forEach((track) => {
        track.onended = null;
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.activeScreenStream = null;
      this.notifyScreen();
    }
  }

  public stopAll() {
    this.stopCamera();
    this.stopScreenShare();
  }
}

export const mediaStreamService = MediaStreamService.getInstance();
