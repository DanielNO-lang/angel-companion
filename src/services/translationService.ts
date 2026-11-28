import { geminiModelService } from './geminiModelService';
import { conversationEngine } from './conversationEngine';
import { storageService } from './storageService';

export interface TranslationLanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_TRANSLATION_LANGUAGES: TranslationLanguageOption[] = [
  { code: 'English', label: 'English' },
  { code: 'Spanish', label: 'Spanish' },
  { code: 'French', label: 'French' },
  { code: 'German', label: 'German' },
  { code: 'Portuguese', label: 'Portuguese' },
  { code: 'Arabic', label: 'Arabic' },
  { code: 'Chinese (Simplified)', label: 'Chinese' },
  { code: 'Japanese', label: 'Japanese' },
  { code: 'Korean', label: 'Korean' },
  { code: 'Hindi', label: 'Hindi' },
  { code: 'Yoruba', label: 'Yoruba' },
  { code: 'Italian', label: 'Italian' },
  { code: 'Swahili', label: 'Swahili' },
];

const TRANSLATION_PREF_KEY = 'angel_voice_translation_prefs_v1';

export interface TranslationPrefs {
  enabled: boolean;
  sourceLanguage: string;
  targetLanguage: string;
}

export class TranslationService {
  private prefs: TranslationPrefs;
  private activeAbort: AbortController | null = null;

  constructor() {
    const saved = storageService.load<Partial<TranslationPrefs>>(TRANSLATION_PREF_KEY, {});
    this.prefs = {
      enabled: Boolean(saved?.enabled),
      sourceLanguage: typeof saved?.sourceLanguage === 'string' && saved.sourceLanguage ? saved.sourceLanguage : 'auto',
      targetLanguage:
        typeof saved?.targetLanguage === 'string' && saved.targetLanguage ? saved.targetLanguage : 'Spanish',
    };
  }

  public getPrefs(): TranslationPrefs {
    return { ...this.prefs };
  }

  public updatePrefs(partial: Partial<TranslationPrefs>): TranslationPrefs {
    this.prefs = {
      ...this.prefs,
      ...partial,
    };
    storageService.save(TRANSLATION_PREF_KEY, this.prefs);
    return { ...this.prefs };
  }

  public cancelInFlight(): void {
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
  }

  public async translate(
    text: string,
    targetLanguage = this.prefs.targetLanguage,
    sourceLanguage = this.prefs.sourceLanguage,
    accessTokenOverride?: string | null
  ): Promise<{ success: boolean; translatedText?: string; error?: string }> {
    const cleaned = text.trim();
    if (!cleaned) {
      return { success: false, error: 'Nothing to translate yet.' };
    }

    this.cancelInFlight();
    const controller = new AbortController();
    this.activeAbort = controller;

    const token =
      accessTokenOverride !== undefined ? accessTokenOverride : conversationEngine.getAccessToken();

    try {
      return await geminiModelService.translateText({
        text: cleaned,
        targetLanguage,
        sourceLanguage,
        accessToken: token || undefined,
        signal: controller.signal,
      });
    } finally {
      if (this.activeAbort === controller) {
        this.activeAbort = null;
      }
    }
  }
}

export const translationService = new TranslationService();
