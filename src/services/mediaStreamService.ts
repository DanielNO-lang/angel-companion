export interface MediaStreamListener {
  onCameraStreamChanged: (stream: MediaStream | null) => void;
  onScreenStreamChanged: (stream: MediaStream | null) => void;
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

  /**
   * Start live camera stream and retain active stream
   */
  public async startCamera(): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
    if (this.activeCameraStream) {
      return { success: true, stream: this.activeCameraStream };
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { success: false, error: 'Camera is not supported on this device/browser.' };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });

      this.activeCameraStream = stream;

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          this.stopCamera();
        };
      });

      this.notifyCamera();
      return { success: true, stream };
    } catch (err: any) {
      console.warn('[MediaStreamService] Camera start error:', err);
      return { success: false, error: err.message || 'Camera permission denied.' };
    }
  }

  public stopCamera() {
    if (this.activeCameraStream) {
      this.activeCameraStream.getTracks().forEach((track) => track.stop());
      this.activeCameraStream = null;
      this.notifyCamera();
    }
  }

  /**
   * Start live screen share stream and retain active stream
   */
  public async startScreenShare(): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
    if (this.activeScreenStream) {
      return { success: true, stream: this.activeScreenStream };
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        return { success: false, error: 'Screen sharing is not supported on this device/browser.' };
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      this.activeScreenStream = stream;

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          this.stopScreenShare();
        };
      });

      this.notifyScreen();
      return { success: true, stream };
    } catch (err: any) {
      console.warn('[MediaStreamService] Screen share error:', err);
      return { success: false, error: err.message || 'Screen sharing cancelled or denied.' };
    }
  }

  public stopScreenShare() {
    if (this.activeScreenStream) {
      this.activeScreenStream.getTracks().forEach((track) => track.stop());
      this.activeScreenStream = null;
      this.notifyScreen();
    }
  }
}

export const mediaStreamService = MediaStreamService.getInstance();
