/**
 * Voice Engine - Real Web Speech Recognition (Dictation) & Web Speech Synthesis (Angel Voice)
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
  private isSynthesizing: boolean = false;

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
   * Start dictation / speech-to-text
   */
  public startListening(listener: SpeechRecognitionListener): boolean {
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

    try {
      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text) {
          listener.onTranscript(text, !!finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[VoiceEngine] Speech recognition event error:', event.error);
        listener.onError(event.error || 'Microphone capture error');
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        listener.onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err: any) {
      console.warn('[VoiceEngine] Error starting speech recognition:', err);
      listener.onError(err.message || 'Failed to start microphone');
      this.isListening = false;
      return false;
    }
  }

  /**
   * Stop dictation
   */
  public stopListening() {
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
   * Speak response aloud using Angel's natural AI voice
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
      window.speechSynthesis.cancel();

      // Clean markdown tags and code snippets from spoken text
      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code block omitted for speech.')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[#*_~>]/g, '')
        .trim();

      if (!cleanText) return false;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.08;

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

      utterance.onstart = () => {
        this.isSynthesizing = true;
        if (onStart) onStart();
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
