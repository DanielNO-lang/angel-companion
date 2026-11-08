/**
 * Voice Engine - Real Web Speech Recognition (Continuous Dictation) & Instant Web Speech Synthesis (Angel Voice)
 */

export interface SpeechRecognitionListener {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export class VoiceEngine {
  private static instance: VoiceEngine;
  private recognition: any = null;
  private isListening: boolean = false;
  private shouldKeepListening: boolean = false;
  private isSynthesizing: boolean = false;
  private baseTranscript: string = '';
  private activeListener: SpeechRecognitionListener | null = null;

  private constructor() {
    this.initSpeechRecognition();
  }

  public static getInstance(): VoiceEngine {
    if (!VoiceEngine.instance) {
      VoiceEngine.instance = new VoiceEngine();
    }
    return VoiceEngine.instance;
  }

  private initSpeechRecognition() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = 'en-US';
        } catch (e) {
          console.warn('[VoiceEngine] Could not initialize SpeechRecognition:', e);
        }
      }
    }
  }

  /**
   * Start continuous dictation / speech-to-text without word truncation or auto-ending
   */
  public startListening(listener: SpeechRecognitionListener, initialText: string = ''): boolean {
    if (this.isListening) {
      this.stopListening();
    }

    if (!this.recognition) {
      this.initSpeechRecognition();
    }

    if (!this.recognition) {
      listener.onError('Speech recognition is not natively supported in this browser. Please type or use Chrome.');
      return false;
    }

    this.baseTranscript = initialText ? initialText.trim() + ' ' : '';
    this.activeListener = listener;
    this.shouldKeepListening = true;

    try {
      this.recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += trans + ' ';
          } else {
            interimChunk += trans;
          }
        }

        if (finalChunk) {
          this.baseTranscript += finalChunk;
        }

        const fullText = (this.baseTranscript + interimChunk).replace(/\s+/g, ' ').trim();
        if (fullText && this.activeListener) {
          this.activeListener.onTranscript(fullText, !!finalChunk);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[VoiceEngine] Speech recognition event error:', event.error);
        if (event.error !== 'no-speech' && this.activeListener) {
          this.activeListener.onError(event.error || 'Microphone capture error');
        }
      };

      this.recognition.onend = () => {
        // Auto-restart continuous dictation if user didn't explicitly hit stop or send
        if (this.shouldKeepListening) {
          try {
            this.recognition.start();
            return;
          } catch (e) {
            console.warn('[VoiceEngine] Auto-restart failed:', e);
          }
        }
        this.isListening = false;
        if (this.activeListener) {
          this.activeListener.onEnd();
        }
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err: any) {
      console.warn('[VoiceEngine] Error starting speech recognition:', err);
      listener.onError(err.message || 'Failed to start microphone');
      this.isListening = false;
      this.shouldKeepListening = false;
      return false;
    }
  }

  /**
   * Stop dictation manually
   */
  public stopListening() {
    this.shouldKeepListening = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('[VoiceEngine] Stop error:', err);
      }
    }
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Speak response aloud immediately using Angel's natural AI voice (0ms latency)
   */
  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return false;
    }

    try {
      // Immediately cancel any pending/paused speech queue for zero-lag response
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Clean markdown tags and code snippets from spoken text
      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code block omitted for speech.')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[#*_~>]/g, '')
        .trim();

      if (!cleanText) return false;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.1; // Responsive, punchy cadence
      utterance.pitch = 1.05;

      // Select high quality voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          (v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Karen') ||
            v.name.includes('Victoria') ||
            v.name.includes('Google UK English Female') ||
            v.name.includes('Female')) &&
          v.lang.startsWith('en')
      ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Synchronously trigger onStart & set synthesizing flag for instant visual feedback
      this.isSynthesizing = true;
      if (onStart) onStart();

      utterance.onstart = () => {
        this.isSynthesizing = true;
      };

      utterance.onend = () => {
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = (err) => {
        console.warn('[VoiceEngine] Synthesis error:', err);
        this.isSynthesizing = false;
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[VoiceEngine] Synthesis exception:', err);
      return false;
    }
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isSynthesizing = false;
    }
  }

  public getIsSynthesizing(): boolean {
    return this.isSynthesizing;
  }
}

export const voiceEngine = VoiceEngine.getInstance();
