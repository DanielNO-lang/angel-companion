import { PromptContext } from '../types/promptEngine';
import { geminiModelService } from './geminiModelService';

export class ConversationalIntelligence {
  /**
   * Generates a conversational response strictly through the authenticated Gemini model path.
   * Never synthesizes canned chatbot replies or fabricated facts when the model is unavailable.
   */
  public async generateResponse(
    userMessage: string,
    context: PromptContext,
    accessToken?: string
  ): Promise<{
    success: boolean;
    response: string;
    error?: string;
    status?: string;
    modelUsed?: string;
    requestedModel?: string;
    fallbackActivated?: boolean;
    appliedMode?: string;
    thinkingLevel?: string;
  }> {
    const rawInput = userMessage.trim();
    const history = context.conversationHistory || [];

    const modelRes = await geminiModelService.generateChatResponse(
      history,
      rawInput,
      context.mode,
      this.buildSystemInstruction(context),
      accessToken
    );

    if (modelRes.success && modelRes.text && modelRes.text.trim()) {
      return {
        success: true,
        response: modelRes.text.trim(),
        modelUsed: modelRes.modelUsed,
        requestedModel: modelRes.requestedModel,
        fallbackActivated: modelRes.fallbackActivated,
        appliedMode: modelRes.appliedMode,
        thinkingLevel: modelRes.thinkingLevel,
      };
    }

    return {
      success: false,
      response: '',
      error: modelRes.error || 'Gemini conversation service is unavailable.',
      status: modelRes.status || 'provider_unavailable',
    };
  }

  public buildSystemInstruction(context: PromptContext): string {
    const parts = [
      'You are Angel, a universal personal AI companion and intelligent workspace partner.',
      'Communicate naturally, concisely, and substantively. Do not use robotic boilerplate, generic acknowledgements, or formulas like "I understand".',
      'Remember previous conversation turns, follow up seamlessly, and resolve references like "that" and "the previous one".',
      'Be strictly truthful: do not fabricate citations, live weather, or claim external integrations are active unless connected.',
    ];

    if (context.scope === 'studio' && context.studioId) {
      parts.push(`You are currently operating in the ${context.studioId} environment. Specialize your tone and depth for this context.`);
    }

    if (context.mode === 'Think') {
      parts.push('Think Mode is active: Provide a deeply reasoned, structured, and thorough analytical breakdown.');
    } else if (context.mode === 'Deep Research') {
      parts.push('Deep Research mode is active: Synthesize comprehensive, well-structured, nuanced analysis with explicit caveats for anything uncertain.');
    } else if (context.mode === 'Code Analysis') {
      parts.push('Code Analysis mode is active: Focus on exact engineering correctness, edge cases, types, and clean, minimal idiomatic code.');
    } else if (context.mode === 'Creative Brainstorm') {
      parts.push('Creative Brainstorm mode is active: Explore original angles and concrete options clearly without fluff.');
    }

    return parts.join(' ');
  }
}

export const conversationalIntelligence = new ConversationalIntelligence();
