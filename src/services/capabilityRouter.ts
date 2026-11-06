import {
  ParsedPromptIntent,
  PromptContext,
  AngelCapability,
  PermissionLevel,
} from '../types/promptEngine';
import { capabilityRegistry } from './capabilityRegistry';
import { permissionsEngine } from './permissionsEngine';
import { StudioId } from '../types/angel';

export interface RouteSelectionResult {
  selectedCapabilities: AngelCapability[];
  executionSequence: Array<{
    stepId: string;
    stepName: string;
    capabilityId: string;
    requiresApproval: boolean;
    inputs: Record<string, any>;
    dependsOnStepIds: string[];
  }>;
  recommendedStudioId?: StudioId;
  recommendedStudioReason?: string;
  missingPermissions: PermissionLevel[];
}

export class CapabilityRouter {
  public route(intent: ParsedPromptIntent, context: PromptContext): RouteSelectionResult {
    const scope = context.scope || 'general';
    const studioId = context.studioId;

    // 1. Get candidate capabilities for scope/studio
    const candidateCapabilities = capabilityRegistry.getCapabilitiesForStudio(studioId);

    // 2. Select matching capabilities based on intent
    const selectedCaps: AngelCapability[] = [];
    const missingPermissions: PermissionLevel[] = [];

    // Primary match based on intent type
    for (const capId of intent.selectedCapabilityIds) {
      const cap = candidateCapabilities.find((c) => c.id === capId) || capabilityRegistry.getCapability(capId);
      if (cap) {
        selectedCaps.push(cap);
      }
    }

    // Fallback if no specific capability mapped
    if (selectedCaps.length === 0) {
      const defaultCap = capabilityRegistry.getCapability('cap_general_chat');
      if (defaultCap) selectedCaps.push(defaultCap);
    }

    // Check permissions
    for (const cap of selectedCaps) {
      if (cap.permissionLevel !== 'none') {
        const isGranted = permissionsEngine.isPermissionGranted(
          cap.permissionLevel as any
        );
        if (!isGranted) {
          missingPermissions.push(cap.permissionLevel);
        }
      }
    }

    // 3. Build execution sequence
    const executionSequence: RouteSelectionResult['executionSequence'] = [];

    if (intent.isMultiStep && selectedCaps.length > 1) {
      // Build ordered multi-step sequence
      selectedCaps.forEach((cap, idx) => {
        const stepId = `step_${idx + 1}`;
        const dependsOn = idx > 0 ? [`step_${idx}`] : [];
        executionSequence.push({
          stepId,
          stepName: `${cap.name}`,
          capabilityId: cap.id,
          requiresApproval: cap.permissionLevel !== 'none',
          inputs: { text: intent.rawInput, entities: intent.extractedEntities },
          dependsOnStepIds: dependsOn,
        });
      });
    } else {
      // Single step sequence
      const primaryCap = selectedCaps[0];
      executionSequence.push({
        stepId: 'step_1',
        stepName: primaryCap.name,
        capabilityId: primaryCap.id,
        requiresApproval: primaryCap.permissionLevel !== 'none',
        inputs: { text: intent.rawInput, entities: intent.extractedEntities },
        dependsOnStepIds: [],
      });
    }

    // 4. Studio recommendation for General Conversation (if applicable)
    let recommendedStudioId: StudioId | undefined = undefined;
    let recommendedStudioReason: string | undefined = undefined;

    if (scope === 'general') {
      if (intent.intent === 'research_investigation') {
        recommendedStudioId = 'research-studio';
        recommendedStudioReason = 'For deep academic citation analysis and structured research synthesis, Research Studio provides a specialized workflow.';
      } else if (intent.intent === 'coding_development') {
        recommendedStudioId = 'development-studio';
        recommendedStudioReason = 'Development Studio offers full project file management, AST refactoring, and code debugging capabilities.';
      } else if (intent.intent === 'creative_media') {
        recommendedStudioId = 'creative-studio';
        recommendedStudioReason = 'Creative Studio provides multi-modal audio, video, SVG, and image concept generators.';
      } else if (intent.intent === 'learning_education') {
        recommendedStudioId = 'learning-education-studio';
        recommendedStudioReason = 'Learning & Education Studio specializes in adaptive curricula, assessments, and lesson plans.';
      } else if (intent.intent === 'professional_intelligence') {
        recommendedStudioId = 'professional-intelligence-studio';
        recommendedStudioReason = 'Professional Intelligence Studio includes regulatory compliance frameworks and executive briefing tools.';
      } else if (intent.intent === 'personal_organization') {
        recommendedStudioId = 'personal-life-studio';
        recommendedStudioReason = 'Personal Life Studio includes daily routines, travel itineraries, and habit tracking.';
      } else if (intent.intent === 'agent_automation') {
        recommendedStudioId = 'agent-automation-studio';
        recommendedStudioReason = 'Agent & Automation Studio provides trigger conditions, multi-agent workflows, and event monitoring.';
      } else if (intent.intent === 'device_environment') {
        recommendedStudioId = 'device-environment-studio';
        recommendedStudioReason = 'Device & Environment Studio provides hardware protocols and browser automation interfaces.';
      }
    }

    return {
      selectedCapabilities: selectedCaps,
      executionSequence,
      recommendedStudioId,
      recommendedStudioReason,
      missingPermissions,
    };
  }
}

export const capabilityRouter = new CapabilityRouter();
