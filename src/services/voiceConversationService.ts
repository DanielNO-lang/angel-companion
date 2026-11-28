import { CompanionOrbState } from '../types/angel';
import { ComposerContext } from '../types/composer';
import { conversationEngine } from './conversationEngine';
import { universalComposerService } from './universalComposerService';
import { voiceEngine } from './voiceEngine';

export type VoiceSessionPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceSessionSnapshot {
  active: boolean;
  phase: VoiceSessionPhase;
  transcript: string;
  lastReply: string;
  error: string | null;
  threadId?: string;
}

export interface VoiceSessionOptions {
  context: ComposerContext;
  onOrbStateChange?: (state: CompanionOrbState) => void;
  onThreadActive?: (threadId: string) => void;
  silenceSubmitDelayMs?: number;
}

export class VoiceConversationService {
  private snapshot: VoiceSessionSnapshot = {
    active: false,
    phase: 'idle',
    transcript: '',
    lastReply: '',
    error: null,
  };
  private listeners = new Set<(snap: VoiceSessionSnapshot) => void>();
  private options: VoiceSessionOptions | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSessionSeq = 0;

  public subscribe(listener: (snap: VoiceSessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): VoiceSessionSnapshot {
    return { ...this.snapshot };
  }

  private publish(partial: Partial<VoiceSessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    const next = this.getSnapshot();
    this.listeners.forEach((l) => {
      try {
        l(next);
      } catch {
        // ignore listener error
      }
    });
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public startSession(options: VoiceSessionOptions): boolean {
    this.endSession();
    this.options = options;
    this.activeSessionSeq += 1;
    const seq = this.activeSessionSeq;

    if (!voiceEngine.isRecognitionSupported()) {
      this.publish({
        active: true,
        phase: 'error',
        transcript: '',
        lastReply: '',
        error: 'Speech recognition is unavailable in this browser. Try Chrome, Edge, or Safari.',
      });
      options.onOrbStateChange?.('idle');
      return false;
    }

    this.publish({
      active: true,
      phase: 'listening',
      transcript: '',
      lastReply: '',
      error: null,
      threadId: options.context.conversationId,
    });
    this.beginListeningTurn(seq);
    return true;
  }

  private beginListeningTurn(seq: number): void {
    if (seq !== this.activeSessionSeq || !this.snapshot.active || !this.options) return;
    this.clearSilenceTimer();

    this.publish({ phase: 'listening', transcript: '', error: null });
    this.options.onOrbStateChange?.('listening');

    const silenceMs = this.options.silenceSubmitDelayMs ?? 1400;
    const started = voiceEngine.startListening(
      {
        onTranscript: (fullText) => {
          if (seq !== this.activeSessionSeq || !this.snapshot.active) return;
          this.publish({ transcript: fullText, phase: 'listening', error: null });
          this.clearSilenceTimer();
          if (fullText.trim()) {
            this.silenceTimer = setTimeout(() => {
              void this.commitCurrentTurn(seq);
            }, silenceMs);
          }
        },
        onError: (errMsg) => {
          if (seq !== this.activeSessionSeq || !this.snapshot.active) return;
          this.clearSilenceTimer();
          this.publish({ phase: 'error', error: errMsg });
          this.options?.onOrbStateChange?.('idle');
        },
        onEnd: () => {
          if (seq !== this.activeSessionSeq || !this.snapshot.active) return;
          if (this.snapshot.phase === 'listening' && this.snapshot.transcript.trim()) {
            void this.commitCurrentTurn(seq);
          }
        },
      },
      ''
    );

    if (!started && seq === this.activeSessionSeq) {
      this.options.onOrbStateChange?.('idle');
    }
  }

  public async sendTurnNow(): Promise<void> {
    if (!this.snapshot.active) return;
    await this.commitCurrentTurn(this.activeSessionSeq);
  }

  private async commitCurrentTurn(seq: number): Promise<void> {
    if (seq !== this.activeSessionSeq || !this.snapshot.active || !this.options) return;
    const spoken = this.snapshot.transcript.trim();
    if (!spoken || this.snapshot.phase !== 'listening') return;

    this.clearSilenceTimer();
    voiceEngine.stopListening();
    this.publish({ phase: 'thinking', error: null });
    this.options.onOrbStateChange?.('thinking');

    const ctx = {
      ...this.options.context,
      ...(this.snapshot.threadId ? { conversationId: this.snapshot.threadId } : {}),
    };

    try {
      const result = await universalComposerService.submit(ctx, spoken, undefined, {
        onUserTurnSaved: (tid) => {
          if (seq === this.activeSessionSeq) {
            this.publish({ threadId: tid });
            this.options?.onThreadActive?.(tid);
          }
        },
      });

      if (seq !== this.activeSessionSeq || !this.snapshot.active) return;

      const resolvedThreadId = result.threadId || this.snapshot.threadId;
      if (resolvedThreadId) {
        this.options.context = { ...ctx, conversationId: resolvedThreadId };
        this.publish({ threadId: resolvedThreadId });
      }

      if (!result.success) {
        this.publish({
          phase: 'error',
          error: result.error || 'Angel could not respond right now.',
        });
        this.options.onOrbStateChange?.('idle');
        return;
      }

      const thread = conversationEngine.getThreads('general').find((t) => t.id === resolvedThreadId);
      const replyMsg = thread ? [...thread.messages].reverse().find((m) => m.sender === 'angel') : null;
      const replyText = replyMsg?.content?.trim() || '';

      if (!replyText) {
        this.beginListeningTurn(seq);
        return;
      }

      this.publish({ phase: 'speaking', lastReply: replyText, transcript: '' });
      this.options.onOrbStateChange?.('speaking');

      const spoke = voiceEngine.speak(
        replyText,
        () => {
          if (seq === this.activeSessionSeq) {
            this.options?.onOrbStateChange?.('speaking');
          }
        },
        () => {
          if (seq === this.activeSessionSeq && this.snapshot.active) {
            this.beginListeningTurn(seq);
          }
        }
      );

      if (!spoke && seq === this.activeSessionSeq && this.snapshot.active) {
        this.beginListeningTurn(seq);
      }
    } catch (err: any) {
      if (seq === this.activeSessionSeq && this.snapshot.active) {
        this.publish({ phase: 'error', error: err?.message || 'Voice turn failed.' });
        this.options?.onOrbStateChange?.('idle');
      }
    }
  }

  public interruptAndListen(): void {
    if (!this.snapshot.active) return;
    this.clearSilenceTimer();
    if (this.snapshot.threadId && conversationEngine.isGenerating(this.snapshot.threadId)) {
      conversationEngine.abortGeneration(this.snapshot.threadId);
    }
    voiceEngine.stopSpeaking();
    this.beginListeningTurn(this.activeSessionSeq);
  }

  public endSession(): void {
    this.activeSessionSeq += 1;
    this.clearSilenceTimer();
    voiceEngine.stopAll();
    const orbCb = this.options?.onOrbStateChange;
    this.options = null;
    this.publish({
      active: false,
      phase: 'idle',
      transcript: '',
      lastReply: '',
      error: null,
      threadId: undefined,
    });
    orbCb?.('idle');
  }
}

export const voiceConversationService = new VoiceConversationService();
