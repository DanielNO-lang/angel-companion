import { StudioId, ChatMessage } from '../types/angel';
import {
  IntentType,
  ParsedPromptIntent,
  PromptContext,
  PromptExecutionSpec,
  CapabilityExecutionResult,
  PermissionLevel,
} from '../types/promptEngine';
import { getStudioConfig } from './studioConfigs';
import { capabilityRegistry } from './capabilityRegistry';
import { capabilityRouter } from './capabilityRouter';
import { executionPlanEngine } from './executionPlanEngine';
import { personalityAdapter } from './personalityAdapter';
import { conversationalIntelligence } from './conversationalIntelligence';

export class PromptIntelligenceEngine {
  /**
   * 1. Analyze and classify user input
   */
  public analyzeInput(input: string, context: PromptContext): ParsedPromptIntent {
    const rawInput = input.trim();
    const lower = rawInput.toLowerCase();

    let intent: IntentType = 'conversational';
    let detectedTask = 'Universal Conversation';
    let isMultiStep = false;
    const missingEssentialInfo: string[] = [];
    let clarificationQuestion: string | undefined = undefined;
    const selectedCapIds: string[] = [];
    let permissionLevelRequired: PermissionLevel = 'none';

    // Conversational Greetings & Social Interactions
    if (/^(hi|hello|hey|greetings|good morning|good evening|thank|how are you)\b/i.test(lower) && lower.length < 35) {
      intent = 'greeting';
      detectedTask = 'General Greeting';
      selectedCapIds.push('cap_general_chat');
    }
    // Coding / Development / Software Architecture
    else if (
      lower.includes('code') ||
      lower.includes('refactor') ||
      lower.includes('typescript') ||
      lower.includes('javascript') ||
      lower.includes('python') ||
      lower.includes('function') ||
      lower.includes('bug') ||
      lower.includes('ast') ||
      lower.includes('app') ||
      lower.includes('architecture') ||
      lower.includes('orchestration') ||
      lower.includes('api') ||
      lower.includes('backend') ||
      lower.includes('database')
    ) {
      intent = 'coding_development';
      detectedTask = 'Software Development & Code Synthesis';
      selectedCapIds.push('cap_code_generator');

      if (lower.includes('file') || lower.includes('save') || lower.includes('project')) {
        selectedCapIds.push('cap_workspace_file_ops');
        permissionLevelRequired = 'file_modification';
        isMultiStep = true;
      }

      // Check missing essential info for complex refactor without target
      if (lower.includes('refactor') && !lower.includes('typescript') && !lower.includes('javascript') && !lower.includes('python') && rawInput.length < 30) {
        missingEssentialInfo.push('Target programming language or module code');
        clarificationQuestion = 'Which programming language or code module would you like to refactor?';
      }
    }
    // Research / Investigation
    else if (
      lower.includes('research') ||
      lower.includes('arxiv') ||
      lower.includes('literature') ||
      lower.includes('paper') ||
      lower.includes('study') ||
      lower.includes('hypothesis') ||
      lower.includes('quantum')
    ) {
      intent = 'research_investigation';
      detectedTask = 'Academic Literature & Research Synthesis';
      selectedCapIds.push('cap_research_synthesis');
    }
    // Creative Media (Image, Video, Audio, Graphic, SVG, Visual Design)
    else if (
      lower.includes('image') ||
      lower.includes('draw') ||
      lower.includes('illustration') ||
      lower.includes('svg') ||
      lower.includes('video') ||
      lower.includes('audio') ||
      lower.includes('storyboard') ||
      lower.includes('logo') ||
      lower.includes('graphic') ||
      (lower.includes('design') && !lower.includes('system') && !lower.includes('software') && !lower.includes('database'))
    ) {
      intent = 'creative_media';
      detectedTask = 'Creative Media & Visual Design Concepts';
      selectedCapIds.push('cap_creative_image_gen');
    }
    // Learning & Education / Factual Explanations
    else if (
      lower.includes('lesson') ||
      lower.includes('learn') ||
      lower.includes('quiz') ||
      lower.includes('curriculum') ||
      lower.includes('explain') ||
      lower.includes('teach') ||
      lower.includes('photosynthesis') ||
      lower.includes('what is') ||
      lower.includes('% of')
    ) {
      intent = 'question_explanation';
      detectedTask = 'Educational Lesson Plan & Information Response';
      selectedCapIds.push('cap_education_lesson_plan');
    }
    // Professional Intelligence
    else if (
      lower.includes('executive') ||
      lower.includes('compliance') ||
      lower.includes('strategy') ||
      lower.includes('gdpr') ||
      lower.includes('soc2') ||
      lower.includes('briefing')
    ) {
      intent = 'professional_intelligence';
      detectedTask = 'Executive Strategy & Compliance Briefing';
      selectedCapIds.push('cap_prof_intel_workflow');
    }
    // Personal Life
    else if (
      lower.includes('schedule') ||
      lower.includes('travel') ||
      lower.includes('itinerary') ||
      lower.includes('habit') ||
      lower.includes('tokyo') ||
      lower.includes('meal plan')
    ) {
      intent = 'personal_organization';
      detectedTask = 'Personal Schedule & Travel Itinerary';
      selectedCapIds.push('cap_personal_planner');
    }
    // Agent & Automation
    else if (
      lower.includes('automation') ||
      lower.includes('trigger') ||
      lower.includes('agent') ||
      lower.includes('workflow') ||
      lower.includes('cron')
    ) {
      intent = 'agent_automation';
      detectedTask = 'Automated Workflow & Trigger Configuration';
      selectedCapIds.push('cap_agent_workflow_trigger');
    }
    // Device & Environment
    else if (
      lower.includes('browser') ||
      lower.includes('dom') ||
      lower.includes('camera') ||
      lower.includes('screen') ||
      lower.includes('hardware')
    ) {
      intent = 'device_environment';
      detectedTask = 'Hardware & Browser Automation Protocol';
      if (lower.includes('browser') || lower.includes('dom')) {
        selectedCapIds.push('cap_device_browser_automation');
      } else if (lower.includes('camera')) {
        selectedCapIds.push('cap_hardware_camera_stream');
      } else {
        selectedCapIds.push('cap_screen_share_capture');
      }
      permissionLevelRequired = 'device_control';
    }
    // Mode-specific routing when explicit mode is active
    else if (context.mode === 'Deep Research') {
      intent = 'research_investigation';
      detectedTask = 'Deep Research Investigation & Synthesis';
      selectedCapIds.push('cap_research_synthesis');
    } else if (context.mode === 'Code Analysis') {
      intent = 'coding_development';
      detectedTask = 'Structural Code Analysis & Architecture';
      selectedCapIds.push('cap_code_generator');
    } else if (context.mode === 'Creative Brainstorm') {
      intent = 'creative_media';
      detectedTask = 'Creative Visual & Conceptual Brainstorm';
      selectedCapIds.push('cap_creative_image_gen');
    }
    // General Questions / Explanations
    else {
      intent = 'question_explanation';
      detectedTask = 'General Query & Information Response';
      selectedCapIds.push('cap_general_chat');
    }

    // Extract basic entities
    const extractedEntities: Record<string, any> = {
      rawText: rawInput,
      wordCount: rawInput.split(/\s+/).length,
    };

    return {
      rawInput,
      intent,
      confidence: 0.95,
      extractedEntities,
      detectedTask,
      isMultiStep,
      missingEssentialInfo,
      clarificationQuestion,
      selectedCapabilityIds: selectedCapIds,
      permissionLevelRequired,
    };
  }

  /**
   * 2. Build structured prompt execution specification
   */
  public constructPromptSpec(intent: ParsedPromptIntent, context: PromptContext): PromptExecutionSpec {
    const scope = context.scope || 'general';
    const studioId = context.studioId;

    let systemPrefix = 'You are Angel, a unified intelligent AI companion.';
    const defaultConstraints: string[] = ['Be helpful, precise, and clear.'];

    if (scope === 'studio' && studioId) {
      const studioCfg = getStudioConfig(studioId);
      if (studioCfg) {
        systemPrefix = studioCfg.systemPromptPrefix;
        defaultConstraints.push(...studioCfg.defaultConstraints);
      }
    }

    if (context.mode) {
      defaultConstraints.push(`Active Mode: ${context.mode}`);
      if (context.mode === 'Deep Research') {
        systemPrefix += ' Prioritize structured investigation, conceptual taxonomy, and literature synthesis.';
      } else if (context.mode === 'Code Analysis') {
        systemPrefix += ' Prioritize architectural patterns, AST analysis, and TypeScript interface contracts.';
      } else if (context.mode === 'Creative Brainstorm') {
        systemPrefix += ' Prioritize creative visual concepts, aesthetic styling directions, and spatial drafting.';
      }
    }

    const routeResult = capabilityRouter.route(intent, context);

    const stepsSpec = routeResult.executionSequence.map((step) => ({
      stepId: step.stepId,
      name: step.stepName,
      capabilityId: step.capabilityId,
      inputs: step.inputs,
      dependsOnStepIds: step.dependsOnStepIds,
      requiresApproval: step.requiresApproval,
    }));

    return {
      id: `spec_${Date.now()}`,
      scope,
      studioId,
      objective: intent.detectedTask,
      systemInstruction: systemPrefix,
      extractedConstraints: defaultConstraints,
      requiredTools: intent.selectedCapabilityIds,
      contextPayload: JSON.stringify({ scope, studioId, historyLength: context.conversationHistory?.length || 0 }),
      executionSteps: stepsSpec,
      isValidated: intent.missingEssentialInfo.length === 0,
    };
  }

  /**
   * 3. Process prompt and execute capability workflows
   */
  public async processPrompt(
    userMessage: string,
    context: PromptContext
  ): Promise<{
    responseMessage: string;
    parsedIntent: ParsedPromptIntent;
    executionResults: CapabilityExecutionResult[];
    recommendedStudioId?: StudioId;
    recommendedStudioReason?: string;
  }> {
    const parsedIntent = this.analyzeInput(userMessage, context);

    // If essential missing info exists, ask smallest necessary question
    if (parsedIntent.missingEssentialInfo.length > 0 && parsedIntent.clarificationQuestion) {
      return {
        responseMessage: parsedIntent.clarificationQuestion,
        parsedIntent,
        executionResults: [],
      };
    }

    const routeResult = capabilityRouter.route(parsedIntent, context);

    // Execute capability handlers
    const executionResults: CapabilityExecutionResult[] = [];
    for (const cap of routeResult.selectedCapabilities) {
      const res = await capabilityRegistry.executeCapability(
        cap.id,
        { text: userMessage, topic: userMessage, spec: userMessage, prompt: userMessage, goal: userMessage },
        context
      );
      executionResults.push(res);
    }

    // Build synthesized natural companion response via conversational intelligence engine
    const convResult = await conversationalIntelligence.generateResponse(userMessage, context);
    let responseText = convResult.response;

    // Studio recommendation only for specialized academic research or complex workflows
    if (context.scope === 'general' && routeResult.recommendedStudioId && routeResult.recommendedStudioReason && (userMessage.toLowerCase().includes('quantum') || userMessage.toLowerCase().includes('arxiv') || userMessage.toLowerCase().includes('literature'))) {
      responseText += `\n\n*💡 Studio Recommendation: ${routeResult.recommendedStudioReason} You can hand off this context to that Studio anytime from the menu, or we can keep working right here!*`;
    }

    // Format response tone via Personality Adapter
    responseText = personalityAdapter.formatResponseTone(responseText, context.studioId);

    return {
      responseMessage: responseText,
      parsedIntent,
      executionResults,
      recommendedStudioId: routeResult.recommendedStudioId,
      recommendedStudioReason: routeResult.recommendedStudioReason,
    };
  }
}

export const promptIntelligenceEngine = new PromptIntelligenceEngine();
