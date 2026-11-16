export interface FrameScheduler {
  requestFrame: (cb: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
}

export interface RenderLoopControllerOptions {
  reducedMotion?: boolean;
  onFrame: (timestamp: number) => void;
  scheduler?: FrameScheduler;
  isDocumentHidden?: () => boolean;
}

export class RenderLoopController {
  private rafId = 0;
  private isDisposed = false;
  private isLoopActive = false;
  private isInViewport = true;
  private reducedMotion: boolean;
  private readonly onFrame: (timestamp: number) => void;
  private readonly scheduler: FrameScheduler;
  private readonly isDocumentHidden: () => boolean;

  constructor(options: RenderLoopControllerOptions) {
    this.reducedMotion = Boolean(options.reducedMotion);
    this.onFrame = options.onFrame;
    this.scheduler = options.scheduler || {
      requestFrame: (cb) => requestAnimationFrame(cb),
      cancelFrame: (id) => cancelAnimationFrame(id),
    };
    this.isDocumentHidden =
      options.isDocumentHidden ||
      (() => (typeof document !== 'undefined' ? Boolean(document.hidden) : false));
  }

  public shouldRunContinuously(): boolean {
    return !this.isDisposed && !this.reducedMotion && this.isInViewport && !this.isDocumentHidden();
  }

  public isRunning(): boolean {
    return this.isLoopActive;
  }

  public start(): void {
    if (this.isDisposed) return;

    if (this.reducedMotion) {
      this.onFrame(performance.now());
      return;
    }

    if (!this.shouldRunContinuously()) {
      this.onFrame(performance.now());
      return;
    }

    if (this.isLoopActive) return;
    this.isLoopActive = true;
    this.rafId = this.scheduler.requestFrame(this.tick);
  }

  public setViewportVisible(visible: boolean): void {
    this.isInViewport = visible;
    this.reconcile();
  }

  public handleVisibilityChange(): void {
    this.reconcile();
  }

  private reconcile(): void {
    if (this.shouldRunContinuously()) {
      if (!this.isLoopActive) {
        this.isLoopActive = true;
        this.rafId = this.scheduler.requestFrame(this.tick);
      }
    } else {
      this.pause();
    }
  }

  private tick = (timestamp: number): void => {
    if (!this.shouldRunContinuously()) {
      this.isLoopActive = false;
      this.rafId = 0;
      return;
    }

    this.onFrame(timestamp);

    if (this.shouldRunContinuously()) {
      this.rafId = this.scheduler.requestFrame(this.tick);
    } else {
      this.isLoopActive = false;
      this.rafId = 0;
    }
  };

  public pause(): void {
    this.isLoopActive = false;
    if (this.rafId) {
      this.scheduler.cancelFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.pause();
  }
}
