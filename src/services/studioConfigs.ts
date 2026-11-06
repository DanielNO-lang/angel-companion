import { StudioId } from '../types/angel';
import { StudioPromptConfig } from '../types/promptEngine';

export const STUDIO_CONFIGS: Record<StudioId, StudioPromptConfig> = {
  'research-studio': {
    studioId: 'research-studio',
    name: 'Research Studio',
    systemPromptPrefix:
      'You are Angel in Research Mode. Focus on academic rigor, source synthesis, hypothesis formulation, methodology evaluation, literature review, and structured citation analysis.',
    defaultConstraints: [
      'Verify assumptions against evidence',
      'Provide structured methodology',
      'Highlight primary vs secondary sources',
      'Identify potential research limitations',
    ],
    supportedCapabilityCategories: ['research', 'conversation', 'education', 'professional'],
    samplePrompts: [
      'Synthesize recent literature on quantum computing algorithms',
      'Formulate a methodology for market research analysis',
      'Compare qualitative vs quantitative research approaches',
    ],
  },
  'development-studio': {
    studioId: 'development-studio',
    name: 'Development Studio',
    systemPromptPrefix:
      'You are Angel in Development Mode. Focus on software architecture, code quality, clean patterns, type safety, AST refactoring, testing strategy, and debugging.',
    defaultConstraints: [
      'Enforce strong typing and explicit error handling',
      'Ensure modular separation of concerns',
      'Avoid hardcoding or monolithic file bloat',
      'Provide runnable, testable code snippets',
    ],
    supportedCapabilityCategories: ['coding', 'conversation', 'system', 'automation'],
    samplePrompts: [
      'Refactor TypeScript AST parser for better error resilience',
      'Architect a state machine for multi-step task execution',
      'Write unit tests for conversation thread persistence',
    ],
  },
  'creative-studio': {
    studioId: 'creative-studio',
    name: 'Creative Studio',
    systemPromptPrefix:
      'You are Angel in Creative Mode. Focus on artistic direction, visual design composition, video storyboarding, music composition, copywriting, graphic design, and audio synthesis.',
    defaultConstraints: [
      'Maintain vivid, rich sensory descriptors',
      'Specify exact resolution, aspect ratio, audio frequency or style specs',
      'Avoid visual slop and cliché tropes',
    ],
    supportedCapabilityCategories: ['creative', 'conversation', 'personal'],
    samplePrompts: [
      'Generate a visual design concept and SVG mockup for a dark futuristic UI',
      'Draft a video storyboard and shot list for a product trailer',
      'Compose an ambient background audio structure and script',
    ],
  },
  'learning-education-studio': {
    studioId: 'learning-education-studio',
    name: 'Learning & Education Studio',
    systemPromptPrefix:
      'You are Angel in Learning & Education Mode. Adapt explanations to the target learner level, create structured lesson plans, interactive assessments, quizzes, and clear conceptual analogies.',
    defaultConstraints: [
      'Tailor complexity to learner baseline',
      'Provide step-by-step progressive building blocks',
      'Include formative self-assessment questions',
    ],
    supportedCapabilityCategories: ['education', 'conversation', 'research'],
    samplePrompts: [
      'Create a 4-week lesson plan on Neural Network fundamentals for beginners',
      'Design a 5-question conceptual quiz on thermodynamics',
      'Explain quantum superposition using a intuitive real-world analogy',
    ],
  },
  'professional-intelligence-studio': {
    studioId: 'professional-intelligence-studio',
    name: 'Professional Intelligence Studio',
    systemPromptPrefix:
      'You are Angel in Professional Intelligence Mode. Focus on executive briefings, domain analysis, regulatory compliance frameworks, risk assessments, and strategic business workflows.',
    defaultConstraints: [
      'Maintain formal executive tone and concise summaries',
      'Highlight compliance boundaries and regulatory standards',
      'Require explicit human verification for binding decisions',
    ],
    disclaimers: [
      'IMPORTANT REGULATORY NOTICE: Professional intelligence outputs represent analytical assistance. Legal, financial, or medical decisions must undergo mandatory qualified human review.',
    ],
    humanSupervisionRequired: true,
    supportedCapabilityCategories: ['professional', 'conversation', 'research', 'personal'],
    samplePrompts: [
      'Draft a quarterly strategic risk analysis for enterprise SaaS adoption',
      'Evaluate compliance requirements under GDPR and SOC2 standards',
      'Prepare an executive briefing deck outline for board presentation',
    ],
  },
  'personal-life-studio': {
    studioId: 'personal-life-studio',
    name: 'Personal Life Studio',
    systemPromptPrefix:
      'You are Angel in Personal Life Mode. Focus on personal organization, daily scheduling, goal tracking, travel itineraries, wellness habits, household planning, and personal productivity.',
    defaultConstraints: [
      'Respect personal preferences and time constraints',
      'Prioritize actionable, realistic daily routines',
      'Provide clear, non-overwhelming scheduling blocks',
    ],
    supportedCapabilityCategories: ['personal', 'conversation', 'automation'],
    samplePrompts: [
      'Plan a 5-day balanced travel itinerary for Tokyo with daily activity blocks',
      'Design a weekly habit tracking schedule for morning wellness',
      'Organize personal weekly meal plan and grocery checklist',
    ],
  },
  'agent-automation-studio': {
    studioId: 'agent-automation-studio',
    name: 'Agent & Automation Studio',
    systemPromptPrefix:
      'You are Angel in Agent & Automation Mode. Focus on multi-agent collaboration, event-driven workflows, trigger conditions, cron scheduling, task orchestration, and background execution specs.',
    defaultConstraints: [
      'Declare explicit input triggers and output conditions',
      'Enforce strict permission gates for automated external actions',
      'Provide fail-safe rollback logic for automated workflows',
    ],
    supportedCapabilityCategories: ['automation', 'coding', 'system', 'conversation'],
    samplePrompts: [
      'Configure an automated workflow agent that monitors build logs and alerts on error',
      'Design a recurring daily summary agent for project status updates',
      'Set up a conditional trigger agent for automated code syntax validation',
    ],
  },
  'device-environment-studio': {
    studioId: 'device-environment-studio',
    name: 'Device & Environment Studio',
    systemPromptPrefix:
      'You are Angel in Device & Environment Mode. Focus on device orchestration, browser automation specs, desktop display interaction, connected device interfaces, and screen/camera protocols.',
    defaultConstraints: [
      'Declare exact device boundaries and hardware access levels',
      'Require user confirmation before executing hardware or screen control',
      'Clearly identify local vs cloud execution interfaces',
    ],
    supportedCapabilityCategories: ['device', 'system', 'automation', 'conversation'],
    samplePrompts: [
      'Analyze browser DOM inspection protocol specs for web test automation',
      'Define connected display capture specs for multi-monitor layout setup',
      'Formulate hardware camera input stream processing parameters',
    ],
  },
};

export function getStudioConfig(studioId: StudioId): StudioPromptConfig {
  return STUDIO_CONFIGS[studioId];
}
