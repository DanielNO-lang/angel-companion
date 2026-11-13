import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  LayoutGrid,
  Bot,
  Clapperboard,
  FolderKanban,
  Wrench,
  Brain,
  BookOpen,
  Mic,
  CheckCircle2,
  Clock,
  Sliders,
} from 'lucide-react';
import type { ThemeMode } from '../../services/authValidation';

interface CapabilityItem {
  id: string;
  motionKey: string;
  title: string;
  shortTitle: string;
  status: 'Active in Workspace' | 'Local Scoped + Sync Pending' | 'Configurable Integrations';
  statusTone: 'emerald' | 'amber' | 'sky';
  summary: string;
  workspaceRelation: string;
  screenshotSrc: string;
  screenshotAlt: string;
  highlights: string[];
  icon: React.FC<{ className?: string }>;
}

const CAPABILITIES: CapabilityItem[] = [
  {
    id: 'conversations',
    motionKey: 'conversations',
    title: '1. Intelligent Conversations',
    shortTitle: 'Conversations',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'Think naturally with Angel in multi-turn conversations powered by server-side Gemini reasoning, follow-up pronoun context resolution, analytical Think Mode, and Incognito private sessions.',
    workspaceRelation:
      'Conversations can reference Library materials, capture deliverables into Workspace projects, or transition into a specialized Studio.',
    screenshotSrc: '/assets/showcase/desktop-conversation.png',
    screenshotAlt: 'Angel New Conversation interface inside the cosmic workspace',
    highlights: ['Multi-turn context resolution', 'Think Mode & Auto-Title synthesis', 'Private Incognito session view'],
    icon: MessageSquare,
  },
  {
    id: 'adaptive-workspace',
    motionKey: 'adaptive',
    title: '2. Adaptive Workspace',
    shortTitle: 'Adaptive',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'A dynamic interactive workbench that reshapes its surface around your active task mode—Research, Development, Writing & Content, or Creative Design—distinct from linear chat.',
    workspaceRelation:
      'Binds directly to your active Workspace project and authorized Library documents, saving drafts back to persistent project files.',
    screenshotSrc: '/assets/showcase/desktop-adaptive-workspace.png',
    screenshotAlt: 'Angel Adaptive Workspace in Research Workbench mode',
    highlights: ['4 tailored workbench modes', 'Live working document canvas', 'Direct Save to Workspace or Library'],
    icon: LayoutGrid,
  },
  {
    id: 'agents',
    motionKey: 'agents',
    title: '3. Specialized Agents',
    shortTitle: 'Agents',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'Task-focused agents—including Research Synthesis, Code Generation Orchestrator, Data & Analytics, and Workflow Automation—with explicit capability permission boundaries.',
    workspaceRelation:
      'Agents execute bounded task instructions from the shared Universal Composer and log transparent execution status locally.',
    screenshotSrc: '/assets/showcase/desktop-agents.png',
    screenshotAlt: 'Angel Agents orchestration cards showing Research, Code, Data, and Workflow agents',
    highlights: ['Explicit tool boundary chips', 'Task submission via Universal Composer', 'Honest execution status tracking'],
    icon: Bot,
  },
  {
    id: 'studios',
    motionKey: 'studios',
    title: '4. Eight Specialized Studios',
    shortTitle: 'Studios',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'Dedicated specialist environments for Research, Development, Creative, Learning & Education, Professional Intelligence, Personal Life, Agent & Automation, and Device & Environment.',
    workspaceRelation:
      'Each Studio owns isolated conversation threads, domain-specific tools, an active Studio canvas, and Studio-scoped resources.',
    screenshotSrc: '/assets/showcase/desktop-studios.png',
    screenshotAlt: 'Angel Studios workspace displaying all 8 specialized studio environments and Research Studio canvas',
    highlights: ['Strictly isolated Studio scopes', 'Domain-specific interactive tools', 'Dedicated Studio Assistant chat'],
    icon: Clapperboard,
  },
  {
    id: 'workspace-projects',
    motionKey: 'workspace',
    title: '5. Workspace & Projects',
    shortTitle: 'Workspace',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'Persistent project folders for organizing deliverables, architecture notes, documents, and code files with searchable filtering and full file lifecycle editing.',
    workspaceRelation:
      'Projects supply active context to Adaptive Workspace, connect to Studios, and export finished records to the Library.',
    screenshotSrc: '/assets/showcase/desktop-workspace.png',
    screenshotAlt: 'Angel Workspace project explorer and markdown document editor',
    highlights: ['Multi-project file tree', 'Inline file search & editing', 'Studio association & Library export'],
    icon: FolderKanban,
  },
  {
    id: 'tools-integrations',
    motionKey: 'tools',
    title: '6. Tools & Integrations',
    shortTitle: 'Tools',
    status: 'Configurable Integrations',
    statusTone: 'sky',
    summary:
      'Inspect Angel’s active callable tools, reasoning plugins, and external service connectors—clearly separating working local capabilities from external OAuth integrations awaiting setup.',
    workspaceRelation:
      'External app connectors (such as Google Workspace or Slack) are managed separately from sign-in authentication with explicit permission controls.',
    screenshotSrc: '/assets/showcase/desktop-tools.png',
    screenshotAlt: 'Angel Tools & Integrations view showing Connectors, Plugins, Skills, and Callable Tools',
    highlights: ['12 callable capability definitions', 'Plugins & system skills catalog', 'Honest Connected vs Not Connected states'],
    icon: Wrench,
  },
  {
    id: 'memory-personalisation',
    motionKey: 'memory',
    title: '7. Memory & Personalisation',
    shortTitle: 'Memory',
    status: 'Local Scoped + Sync Pending',
    statusTone: 'amber',
    summary:
      'Scoped local memory separation distinguishes general conversation context from Studio-specific context and Libraries, with conflict/duplicate detection implemented in local storage.',
    workspaceRelation:
      'Currently persists in browser storage with cross-device Supabase database tables prepared in the migration blueprint for activation.',
    screenshotSrc: '/assets/showcase/desktop-home.png',
    screenshotAlt: 'Angel Home dashboard showing contextual quick actions, recent activity, and companion orb',
    highlights: ['General vs Studio scope isolation', 'Local conflict & duplicate checks', 'Cloud database sync in development'],
    icon: Brain,
  },
  {
    id: 'knowledge-library',
    motionKey: 'library',
    title: '8. Knowledge Library',
    shortTitle: 'Library',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'An independent central repository for documents, research references, code assets, templates, and media—filterable by category, Studio scope, and linked project.',
    workspaceRelation:
      'Feeds authorized reference files directly into Studios and Adaptive Workspace workbenches without cluttering personal memory.',
    screenshotSrc: '/assets/showcase/desktop-library.png',
    screenshotAlt: 'Angel Knowledge Library with categorized documents, references, code snippets, and Studio links',
    highlights: ['6 structured resource categories', 'Studio & Project link management', 'File upload & resource creation'],
    icon: BookOpen,
  },
  {
    id: 'voice-multimodal',
    motionKey: 'multimodal',
    title: '9. Voice, Vision & Multimodal',
    shortTitle: 'Multimodal',
    status: 'Active in Workspace',
    statusTone: 'emerald',
    summary:
      'Universal Composer supports file attachments (PDF, DOCX, images, audio, video, CSV, ZIP), URL link previews, browser Web Speech dictation/voice playback, and live camera/screen capture overlays.',
    workspaceRelation:
      'Available across General Conversations, Studios, Workspace, Adaptive Workspace, and Agents through one shared attachment and voice pipeline.',
    screenshotSrc: '/assets/showcase/desktop-conversation.png',
    screenshotAlt: 'Angel Universal Composer displaying attachment, voice, camera, and audio controls',
    highlights: ['Drag-and-drop multi-file attachments', 'Browser speech input & spoken audio', 'Live camera snapshot & screen share HUD'],
    icon: Mic,
  },
];

interface CapabilitiesShowcaseProps {
  theme: ThemeMode;
}

export const CapabilitiesShowcase: React.FC<CapabilitiesShowcaseProps> = ({ theme }) => {
  const [activeId, setActiveId] = useState<string>('conversations');
  const isLight = theme === 'light';

  useEffect(() => {
    CAPABILITIES.forEach((cap) => {
      const img = new window.Image();
      img.src = cap.screenshotSrc;
    });
  }, []);
  const activeIndex = Math.max(0, CAPABILITIES.findIndex((c) => c.id === activeId));
  const active = CAPABILITIES[activeIndex] || CAPABILITIES[0];
  const ActiveIcon = active.icon;

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveId(CAPABILITIES[(index + 1) % CAPABILITIES.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveId(CAPABILITIES[(index - 1 + CAPABILITIES.length) % CAPABILITIES.length].id);
    }
  };

  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
    >
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-9 sm:mb-12">
        <p className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
          Core Capabilities • Real Workspace Proof
        </p>
        <h2
          id="capabilities-heading"
          className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
        >
          Nine Interconnected Environments Under One Companion
        </h2>
        <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          Inspect every capability directly through genuine captures of the Angel workspace. Active features are clearly
          distinguished from local-only storage or integrations pending configuration.
        </p>
      </div>

      {/* Responsive Intelligent Glass Capability Cards */}
      <div
        role="tablist"
        aria-label="Angel Core Capabilities"
        className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-2.5 mb-7"
      >
        {CAPABILITIES.map((cap, idx) => {
          const Icon = cap.icon;
          const isSelected = cap.id === active.id;
          const statusDotClass =
            cap.statusTone === 'emerald'
              ? 'bg-emerald-400'
              : cap.statusTone === 'amber'
                ? 'bg-amber-400'
                : 'bg-sky-400';
          return (
            <button
              key={cap.id}
              id={`cap-tab-${cap.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="capability-stage-panel"
              data-active={isSelected ? 'true' : 'false'}
              onClick={() => setActiveId(cap.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`cap-card group relative px-2 sm:px-3 py-2.5 sm:py-3 rounded-2xl text-[11px] sm:text-xs font-semibold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                isSelected
                  ? isLight
                    ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white border border-blue-400/70 shadow-[0_10px_28px_rgba(79,70,229,0.35)] -translate-y-0.5'
                    : 'bg-gradient-to-br from-blue-600/90 via-indigo-600/90 to-purple-600/90 text-white border border-cyan-300/60 shadow-[0_10px_28px_rgba(56,189,248,0.28)] -translate-y-0.5'
                  : isLight
                    ? 'bg-white/65 hover:bg-white/90 text-slate-700 border border-slate-200/90 hover:border-blue-300/80 hover:-translate-y-0.5 shadow-xs backdrop-blur-xl'
                    : 'bg-[#090e26]/45 hover:bg-[#0e1538]/70 text-slate-300 hover:text-white border border-indigo-500/20 hover:border-cyan-400/45 hover:-translate-y-0.5 backdrop-blur-xl'
              }`}
            >
              <span
                className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${statusDotClass} ${
                  isSelected ? 'ring-2 ring-white/50' : 'opacity-75'
                }`}
                aria-hidden="true"
              />
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-white/15 text-cyan-200'
                    : isLight
                      ? 'bg-sky-50 text-indigo-600 group-hover:bg-sky-100'
                      : 'bg-indigo-500/10 text-cyan-400 group-hover:bg-indigo-500/20'
                }`}
              >
                <Icon className={`w-4 h-4 cap-icon icon-motion-${cap.motionKey}`} />
              </div>
              <span className="leading-tight text-center truncate w-full">{cap.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive 3D-Depth Feature & Real Screenshot Presentation Stage */}
      <div
        id="capability-stage-panel"
        role="tabpanel"
        aria-labelledby={`cap-tab-${active.id}`}
        className={`landing-glass-card rounded-[28px] sm:rounded-[32px] p-4 sm:p-8 lg:p-10 ${
          isLight ? 'text-slate-900' : 'text-slate-100'
        }`}
      >
        <div
          key={active.id}
          className="animate-landing-reveal grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 lg:gap-10 items-center"
        >
          {/* Left: Illuminated Floating Desktop Viewport Frame with Real Screenshot */}
          <div className="relative group" style={{ perspective: '1200px' }}>
            <div
              className={`rounded-2xl sm:rounded-3xl overflow-hidden border transition-transform duration-500 lg:group-hover:[transform:rotateY(1.5deg)_rotateX(1deg)] ${
                isLight
                  ? 'border-sky-200 bg-slate-950 shadow-[0_24px_60px_-15px_rgba(30,64,175,0.25)]'
                  : 'border-cyan-400/25 bg-[#040714] shadow-[0_24px_70px_-12px_rgba(56,189,248,0.24)]'
              }`}
            >
              {/* Browser Top Chrome */}
              <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px] sm:max-w-none">
                  Angel Workspace • {active.shortTitle}
                </span>
                <span className="w-6 sm:w-8" />
              </div>

              {/* Crisp, Legible Real Workspace Screenshot */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#050714]">
                <img
                  key={active.screenshotSrc + active.id}
                  src={active.screenshotSrc}
                  alt={active.screenshotAlt}
                  className="w-full h-full object-cover object-top transition-opacity duration-300"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* Right: Structured Capability Storytelling */}
          <div className="space-y-4 text-left">
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className={`p-2.5 rounded-2xl border ${
                  isLight
                    ? 'bg-sky-50 border-sky-200 text-indigo-600'
                    : 'bg-indigo-500/15 border-indigo-400/30 text-cyan-400'
                }`}
              >
                <ActiveIcon className={`w-5 h-5 cap-icon icon-motion-${active.motionKey}`} />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                  active.statusTone === 'emerald'
                    ? isLight
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/35'
                    : active.statusTone === 'amber'
                      ? isLight
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : 'bg-amber-950/70 text-amber-200 border-amber-500/35'
                      : isLight
                        ? 'bg-sky-50 text-sky-900 border-sky-200'
                        : 'bg-sky-950/70 text-sky-200 border-sky-500/35'
                }`}
              >
                {active.statusTone === 'emerald' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : active.statusTone === 'amber' ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <Sliders className="w-3.5 h-3.5" />
                )}
                <span>{active.status}</span>
              </span>
            </div>

            <h3 className={`text-xl sm:text-2xl font-bold font-heading ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {active.title}
            </h3>

            <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              {active.summary}
            </p>

            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                isLight
                  ? 'bg-sky-50/80 border-sky-200/90 text-slate-700'
                  : 'bg-slate-950/55 border-indigo-500/20 text-slate-300'
              }`}
            >
              <span className={`font-bold block mb-1 ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                How it connects across Angel
              </span>
              {active.workspaceRelation}
            </div>

            <ul className="space-y-1.5 pt-1">
              {active.highlights.map((item) => (
                <li
                  key={item}
                  className={`flex items-center gap-2 text-xs font-medium ${
                    isLight ? 'text-slate-700' : 'text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
