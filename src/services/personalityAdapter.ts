import { PersonalityAdapterConfig } from '../types/promptEngine';
import { storageService } from './storageService';

const PERSONALITY_CONFIG_KEY = 'angel_personality_config_v1';

class PersonalityAdapter {
  private config: PersonalityAdapterConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public getConfig(): PersonalityAdapterConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<PersonalityAdapterConfig>): PersonalityAdapterConfig {
    this.config = { ...this.config, ...updates };
    storageService.save(PERSONALITY_CONFIG_KEY, this.config);
    return this.config;
  }

  public formatResponseTone(text: string, studioId?: string): string {
    // Pure formatting wrapper applying configured communication style
    if (this.config.communicationStyle === 'concise') {
      return text;
    }
    if (this.config.humanSupervisionWarnings && studioId === 'professional-intelligence-studio') {
      if (!text.includes('REGULATORY NOTICE')) {
        return `${text}\n\n*Note: Professional intelligence outputs represent analytical assistance. Mandatory qualified human supervision is required for binding decisions.*`;
      }
    }
    return text;
  }

  private loadConfig(): PersonalityAdapterConfig {
    return storageService.load<PersonalityAdapterConfig>(PERSONALITY_CONFIG_KEY, {
      communicationStyle: 'detailed',
      reasoningDepth: 'step_by_step',
      autonomyLevel: 'balanced',
      humanSupervisionWarnings: true,
    });
  }
}

export const personalityAdapter = new PersonalityAdapter();
