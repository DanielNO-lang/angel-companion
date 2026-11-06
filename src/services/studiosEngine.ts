import { StudioId, StudioInfo } from '../types/angel';
import { storageService, STORAGE_KEYS } from './storageService';

export interface StudioState {
  studioId: StudioId;
  activeTool: string;
  canvasBuffer: string;
  history: string[];
}

export const APPROVED_EIGHT_STUDIOS: StudioInfo[] = [
  {
    id: 'research-studio',
    name: 'Research Studio',
    tagline: 'Deep Literature Synthesis & Scientific Discovery',
    iconName: 'Search',
    category: 'Research & Knowledge',
    description: 'Analyze academic papers, query scholarly databases, extract key metrics, and formulate literature reviews.',
    tools: ['Paper Synthesizer', 'Citation Graph Engine', 'Dataset Extraction', 'Hypothesis Validator'],
  },
  {
    id: 'development-studio',
    name: 'Development Studio',
    tagline: 'Full-Stack Code Generation & Architecture',
    iconName: 'Code2',
    category: 'Software Engineering',
    description: 'Write, debug, and optimize TypeScript, React, Python, and SQL with real-time AST linting and unit test synthesis.',
    tools: ['Code Completion Engine', 'AST Linter', 'Database Schema Designer', 'API Proxy Builder'],
  },
  {
    id: 'creative-studio',
    name: 'Creative Studio',
    tagline: 'Multi-Modal Visuals, Writing & Audio Canvas',
    iconName: 'Palette',
    category: 'Creative Media',
    description: 'Design UI interfaces, synthesize 3D procedural geometries, generate copy, and compose spatial audio tracks.',
    tools: ['3D Mesh Generator', 'SVG Vector Studio', 'Copywriter Assistant', 'Audio Synthesizer'],
  },
  {
    id: 'learning-education-studio',
    name: 'Learning & Education Studio',
    tagline: 'Interactive Knowledge Maps & Adaptive Tutoring',
    iconName: 'GraduationCap',
    category: 'Education',
    description: 'Build personalized curriculum roadmaps, generate interactive flashcards, and solve complex STEM equations.',
    tools: ['Knowledge Graph Creator', 'Quiz & Flashcard Engine', 'LaTeX Equation Solver', 'Socratic Tutor'],
  },
  {
    id: 'professional-intelligence-studio',
    name: 'Professional Intelligence Studio',
    tagline: 'Business Strategy, Financial Modeling & Pitching',
    iconName: 'Briefcase',
    category: 'Business & Strategy',
    description: 'Draft pitch decks, model financial projections, analyze competitor markets, and draft executive briefings.',
    tools: ['Financial Model Builder', 'Competitor Matrix', 'Executive Briefing Generator', 'Pitch Deck Outline'],
  },
  {
    id: 'personal-life-studio',
    name: 'Personal Life Studio',
    tagline: 'Habit Tracking, Wellness & Everyday Management',
    iconName: 'Heart',
    category: 'Personal Life',
    description: 'Plan travel itineraries, track daily health metrics, manage household schedules, and optimize routine habits.',
    tools: ['Travel Itinerary Builder', 'Habit Matrix', 'Meal & Wellness Planner', 'Personal Budget Manager'],
  },
  {
    id: 'agent-automation-studio',
    name: 'Agent & Automation Studio',
    tagline: 'Multi-Agent Workflow Pipelines & Webhooks',
    iconName: 'Cpu',
    category: 'Automation',
    description: 'Chain autonomous sub-agents together, configure trigger conditions, and deploy recurring webhook tasks.',
    tools: ['Agent Pipeline Builder', 'Webhook Listener', 'Trigger Matrix', 'Cron Task Scheduler'],
  },
  {
    id: 'device-environment-studio',
    name: 'Device & Environment Studio',
    tagline: 'IoT Device Integration & Contextual Permissions',
    iconName: 'Monitor',
    category: 'IoT & System',
    description: 'Connect hardware peripherals, manage screen context permissions, and configure local hardware accelerators.',
    tools: ['Peripheral Manager', 'Screen Vision Connector', 'Hardware Telemetry', 'Permission Matrix'],
  },
];

export class StudiosEngine {
  private studioStates: Record<StudioId, StudioState>;
  private activeStudioId: StudioId = 'research-studio';

  getActiveStudioId(): StudioId {
    return this.activeStudioId;
  }

  setActiveStudioId(id: StudioId): void {
    this.activeStudioId = id;
  }

  constructor() {
    const fallbackStates: Record<StudioId, StudioState> = {
      'research-studio': { studioId: 'research-studio', activeTool: 'Paper Synthesizer', canvasBuffer: '', history: [] },
      'development-studio': { studioId: 'development-studio', activeTool: 'Code Completion Engine', canvasBuffer: '', history: [] },
      'creative-studio': { studioId: 'creative-studio', activeTool: '3D Mesh Generator', canvasBuffer: '', history: [] },
      'learning-education-studio': { studioId: 'learning-education-studio', activeTool: 'Knowledge Graph Creator', canvasBuffer: '', history: [] },
      'professional-intelligence-studio': { studioId: 'professional-intelligence-studio', activeTool: 'Financial Model Builder', canvasBuffer: '', history: [] },
      'personal-life-studio': { studioId: 'personal-life-studio', activeTool: 'Travel Itinerary Builder', canvasBuffer: '', history: [] },
      'agent-automation-studio': { studioId: 'agent-automation-studio', activeTool: 'Agent Pipeline Builder', canvasBuffer: '', history: [] },
      'device-environment-studio': { studioId: 'device-environment-studio', activeTool: 'Peripheral Manager', canvasBuffer: '', history: [] },
    };

    this.studioStates = storageService.load<Record<StudioId, StudioState>>(
      STORAGE_KEYS.studiosState,
      fallbackStates
    );
  }

  private persist() {
    storageService.save(STORAGE_KEYS.studiosState, this.studioStates);
  }

  getStudioInfo(studioId: StudioId): StudioInfo {
    return APPROVED_EIGHT_STUDIOS.find((s) => s.id === studioId) || APPROVED_EIGHT_STUDIOS[0];
  }

  getStudioState(studioId: StudioId): StudioState {
    if (!this.studioStates[studioId]) {
      const info = this.getStudioInfo(studioId);
      this.studioStates[studioId] = {
        studioId,
        activeTool: info.tools[0] || 'Default Tool',
        canvasBuffer: '',
        history: [],
      };
      this.persist();
    }
    return this.studioStates[studioId];
  }

  updateStudioTool(studioId: StudioId, toolName: string): void {
    const state = this.getStudioState(studioId);
    state.activeTool = toolName;
    this.persist();
  }

  updateCanvasBuffer(studioId: StudioId, text: string): void {
    const state = this.getStudioState(studioId);
    state.canvasBuffer = text;
    if (text.trim()) {
      state.history.unshift(`${new Date().toLocaleTimeString()}: Updated canvas`);
    }
    this.persist();
  }
}

export const studiosEngine = new StudiosEngine();
