/**
 * Voice Engine - Web Speech Recognition (STT) & Web Speech Synthesis (TTS)
 * Hardened lifecycle, dynamic SpeechRecognition resolution, and clean unmount cleanup.
 */

import { appendDictationText, combineDictationPreview } from '../utils/dictationFormatter';

export interface SpeechRecognitionListener {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export class VoiceEngine {
  private static instance: VoiceEngine;
  private recognition: any = null;
  private isListening = false;
  private shouldKeepListening = false;
  private isSynthesizing = false;
  private baseTranscript = '';
  private activeListener: SpeechRecognitionListener | null = null;
  private sessionSeq = 0;

  private constructor() {
    this.recognition = this.createRecognitionInstance();
  }

  public static getInstance(): VoiceEngine {
    if (!VoiceEngine.instance) {
      VoiceEngine.instance = new VoiceEngine();
    }
    return VoiceEngine.instance;
  }

  public isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public isSynthesisSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined');
  }

  private createRecognitionInstance(): any {
    if (typeof window === 'undefined') return null;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return null;

    try {
      const instance = new SpeechRecognitionCtor();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      return instance;
    } catch (e) {
      console.warn('[VoiceEngine] Could not initialize SpeechRecognition:', e);
      return null;
    }
  }

  private formatSpeechError(code?: string): string {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone access was denied. Enable microphone permission in your browser settings to use voice dictation.';
      case 'audio-capture':
        return 'No working microphone device was detected.';
      case 'network':
        return 'Voice dictation requires a network connection to your browser speech service.';
      case 'language-not-supported':
        return 'Speech recognition language is not supported on this device.';
      case 'aborted':
        return 'Voice dictation was stopped.';
      default:
        return code || 'Microphone capture error.';
    }
  }

  public startListening(listener: SpeechRecognitionListener, initialText = ''): boolean {
    if (this.isListening) {
      this.stopListening();
    }

    if (!this.isRecognitionSupported()) {
      listener.onError(
        'Speech recognition is not supported in this browser. Please type your message or use a Chromium-based browser.'
      );
      return false;
    }

    // Re-create a fresh SpeechRecognition instance per session so dynamic browser/test
    // implementations and post-abort restarts never hit InvalidStateError.
    this.recognition = this.createRecognitionInstance();
    if (!this.recognition) {
      listener.onError('Speech recognition could not be initialized on this device.');
      return false;
    }

    this.sessionSeq += 1;
    const currentSeq = this.sessionSeq;
    const normalizedInitial = initialText.trim();
    this.baseTranscript = normalizedInitial ? `${normalizedInitial} ` : '';
    this.activeListener = listener;
    this.shouldKeepListening = true;

    try {
      this.recognition.onresult = (event: any) => {
        if (this.sessionSeq !== currentSeq || !this.shouldKeepListening) return;
        let finalChunk = '';
        let interimChunk = '';

        const startIdx = typeof event?.resultIndex === 'number' ? event.resultIndex : 0;
        const results = event?.results || [];

        for (let i = startIdx; i < results.length; ++i) {
          const item = results[i];
          const trans = item?.[0]?.transcript || '';
          if (item?.isFinal) {
            finalChunk += `${trans} `;
          } else {
            interimChunk += trans;
          }
        }

        if (finalChunk) {
          this.baseTranscript = appendDictationText(this.baseTranscript, finalChunk);
        }

        const fullText = `${this.baseTranscript}${interimChunk}`.replace(/\s+/g, ' ').trim();
        if (this.activeListener && (fullText || finalChunk || interimChunk)) {
          this.activeListener.onTranscript(fullText, Boolean(finalChunk));
        }
      };

      this.recognition.onerror = (event: any) => {
        if (this.sessionSeq !== currentSeq) return;
        const errCode = event?.error;
        if (
          errCode === 'not-allowed' ||
          errCode === 'service-not-allowed' ||
          errCode === 'audio-capture' ||
          errCode === 'network' ||
          errCode === 'language-not-supported'
        ) {
          this.shouldKeepListening = false;
          this.isListening = false;
        }
        if (errCode !== 'no-speech' && errCode !== 'aborted' && this.activeListener) {
          this.activeListener.onError(this.formatSpeechError(errCode));
        }
      };

      this.recognition.onend = () => {
        if (this.sessionSeq !== currentSeq) return;
        if (this.shouldKeepListening && this.recognition) {
          try {
            this.recognition.start();
            return;
          } catch {
            // Fall through to clean stop if browser prevents immediate restart
          }
        }
        this.isListening = false;
        this.shouldKeepListening = false;
        const listenerRef = this.activeListener;
        this.activeListener = null;
        if (listenerRef) {
          listenerRef.onEnd();
        }
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err: any) {
      listener.onError(err?.message || 'Failed to start microphone dictation.');
      this.isListening = false;
      this.shouldKeepListening = false;
      this.activeListener = null;
      return false;
    }
  }

  public stopListening() {
    this.sessionSeq += 1;
    this.shouldKeepListening = false;
    const listenerRef = this.activeListener;
    this.activeListener = null;

    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        if (this.isListening && typeof this.recognition.stop === 'function') {
          this.recognition.stop();
        }
      } catch {
        // Ignore stop errors when recognition already ended
      }
    }
    const wasListening = this.isListening;
    this.isListening = false;
    if (wasListening && listenerRef) {
      listenerRef.onEnd();
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): boolean {
    if (!this.isSynthesisSupported()) {
      if (onEnd) onEnd();
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code block omitted for speech.')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[#*_~>]/g, '')
        .trim();

      if (!cleanText) {
        if (onEnd) onEnd();
        return false;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.1;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            (v.name.includes('Natural') ||
              v.name.includes('Samantha') ||
              v.name.includes('Karen') ||
              v.name.includes('Victoria') ||
              v.name.includes('Google UK English Female') ||
              v.name.includes('Female')) &&
            v.lang.startsWith('en')
        ) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.isSynthesizing = true;
      if (onStart) onStart();

      utterance.onstart = () => {
        this.isSynthesizing = true;
      };

      utterance.onend = () => {
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      this.isSynthesizing = false;
      if (onEnd) onEnd();
      return false;
    }
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore cancel error
      }
    }
    this.isSynthesizing = false;
  }

  public stopAll() {
    this.stopListening();
    this.stopSpeaking();
  }

  public getIsSynthesizing(): boolean {
    return this.isSynthesizing;
  }
}

export const voiceEngine = VoiceEngine.getInstance();
