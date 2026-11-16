import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ThemeMode } from '../../services/authValidation';
import { SmartImage } from '../ui/SmartImage';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { resolveHorizontalSwipeDirection } from '../../utils/mobileCardFan';

interface CapabilityItem {
  id: string;
  motionKey: string;
  title: string;
  shortTitle: string;
  previewLabel: string;
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
    previewLabel: 'Multi-turn dialogue, Think Mode & writing workflows',
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
    previewLabel: 'Dynamic workbenches for writing, research, tasks & code',
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
    previewLabel: 'Bounded multi-step agent dispatch & status tracking',
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
    previewLabel: 'Creative visuals, media direction & domain-isolated studios',
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
    previewLabel: 'Structured project folders, documents, deliverables & code',
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
    previewLabel: 'Callable capabilities, plugins & external connector readiness',
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
    previewLabel: 'Scoped context separation across General and Studio boundaries',
    summary:
      'Scoped local memory separation distinguishes general conversation context from Studio-specific context and Libraries, with conflict/duplicate detection implemented in local storage.',
    workspaceRelation:
      'Persists across browser storage with user-scoped Supabase cloud synchronization verified on sign-in.',
    screenshotSrc: '/assets/showcase/desktop-home.png',
    screenshotAlt: 'Angel Home dashboard showing contextual quick actions, recent activity, and companion orb',
    highlights: ['General vs Studio scope isolation', 'Local conflict & duplicate checks', 'Verified user-scoped sync'],
    icon: Brain,
  },
  {
    id: 'knowledge-library',
    motionKey: 'library',
    title: '8. Knowledge Library',
    shortTitle: 'Library',
    previewLabel: 'Centralized research files, references, templates & assets',
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
    previewLabel: 'Voice dictation, media attachments, camera & screen inspection',
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

const CAPABILITY_AUTO_INTERVAL_MS = 5400;
const CAPABILITY_COOLDOWN_MS = 9500;

interface CapabilitiesShowcaseProps {
  theme: ThemeMode;
}

export const CapabilitiesShowcase: React.FC<CapabilitiesShowcaseProps> = ({ theme }) => {
  const [activeId, setActiveId] = useState<string>('conversations');
  const [isInViewport, setIsInViewport] = useState<boolean>(false);
  const [isPausedByHover, setIsPausedByHover] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxZoomed, setLightboxZoomed] = useState<boolean>(false);

  const containerRef = useRef<HTMLElement>(null);
  const manualPauseUntilRef = useRef<number>(0);
  const lightboxTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const isLight = theme === 'light';
  const activeIndex = Math.max(0, CAPABILITIES.findIndex((c) => c.id === activeId));
  const active = CAPABILITIES[activeIndex] || CAPABILITIES[0];
  const ActiveIcon = active.icon;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setIsInViewport(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !isInViewport || lightboxOpen) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setActiveId((prevId) => {
        const idx = CAPABILITIES.findIndex((c) => c.id === prevId);
        const nextIdx = (idx + 1) % CAPABILITIES.length;
        return CAPABILITIES[nextIdx].id;
      });
    }, CAPABILITY_AUTO_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, isInViewport, lightboxOpen]);

  const selectCapabilityManually = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const stepCapability = useCallback(
    (delta: number) => {
      const nextIdx = (activeIndex + delta + CAPABILITIES.length) % CAPABILITIES.length;
      setActiveId(CAPABILITIES[nextIdx].id);
      setLightboxZoomed(false);
    },
    [activeIndex]
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setLightboxZoomed(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepCapability(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepCapability(-1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, stepCapability]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectCapabilityManually(CAPABILITIES[(index + 1) % CAPABILITIES.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectCapabilityManually(CAPABILITIES[(index - 1 + CAPABILITIES.length) % CAPABILITIES.length].id);
    }
  };

  return (
    <section
      ref={containerRef}
      aria-labelledby="capabilities-heading"
      onMouseEnter={() => setIsPausedByHover(true)}
      onMouseLeave={() => setIsPausedByHover(false)}
      className="landing-section-capabilities relative w-full py-14 sm:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-9 sm:mb-12">
          <div className="inline-flex items-center justify-center gap-2">
            <AngelEmblem3D size={22} seed="landing-cap-mark" renderMode="svg" rotationSpeed={14} />
            <p className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
              Core Capabilities
            </p>
          </div>
          <h2
            id="capabilities-heading"
            className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            Nine Interconnected Environments Under One Companion
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Explore every workspace interactively—previews rotate automatically and open in an inspectable viewer on click.
          </p>
        </div>

        {/* Responsive Intelligent Glass Capability Cards - Borderless glass */}
        <div
          role="tablist"
          aria-label="Angel Core Capabilities"
          className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5 sm:gap-3 mb-8"
        >
          {CAPABILITIES.map((cap, idx) => {
            const Icon = cap.icon;
            const isSelected = cap.id === active.id;
            return (
              <button
                key={cap.id}
                id={`cap-tab-${cap.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls="capability-stage-panel"
                data-active={isSelected ? 'true' : 'false'}
                onClick={() => selectCapabilityManually(cap.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`cap-card group relative px-2.5 sm:px-3.5 py-3 sm:py-3.5 rounded-2xl text-[11px] sm:text-xs font-semibold flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                  isSelected
                    ? isLight
                      ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-[0_12px_32px_rgba(79,70,229,0.38)] -translate-y-1'
                      : 'bg-gradient-to-br from-blue-600/95 via-indigo-600/95 to-purple-600/95 text-white shadow-[0_12px_32px_rgba(56,189,248,0.32)] -translate-y-1'
                    : isLight
                      ? 'bg-white/55 hover:bg-white/85 text-slate-700 shadow-[0_6px_20px_rgba(30,64,175,0.06)] hover:shadow-[0_10px_28px_rgba(59,130,246,0.15)] backdrop-blur-2xl'
                      : 'bg-[#090e26]/32 hover:bg-[#0e1538]/65 text-slate-300 hover:text-white shadow-[0_6px_24px_rgba(0,0,0,0.22)] hover:shadow-[0_0_24px_rgba(56,189,248,0.22)] backdrop-blur-2xl'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                    isSelected
                      ? 'text-cyan-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                      : isLight
                        ? 'text-indigo-600 group-hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                        : 'text-cyan-400 group-hover:drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 cap-icon icon-motion-${cap.motionKey}`} />
                </div>
                <span className="leading-tight text-center truncate w-full">{cap.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Feature & Screenshot Presentation Stage */}
        <div
          id="capability-stage-panel"
          role="tabpanel"
          aria-labelledby={`cap-tab-${active.id}`}
          className={`landing-glass-card angel-blurred-surface rounded-[28px] sm:rounded-[36px] p-5 sm:p-9 lg:p-11 ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          {/* Preview Label & Inspect Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3">
            <div className="flex items-center gap-2 text-xs font-medium opacity-85">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.85)]" />
              <span>Illustrative Preview {activeIndex + 1} of {CAPABILITIES.length} — {active.previewLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLightboxOpen(true);
                  setLightboxZoomed(false);
                }}
                aria-label={`Open full preview lightbox for ${active.shortTitle}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
                  isLight ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700' : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200'
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span>Inspect Preview</span>
              </button>
            </div>
          </div>

          <div
            key={active.id}
            className="animate-landing-reveal grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-7 lg:gap-11 items-center"
          >
            {/* Left: Clickable Lazy-Loaded Screenshot Viewport Frame */}
            <div className="relative group transition-transform duration-500 hover:scale-[1.01]" style={{ perspective: '1200px' }}>
              <button
                type="button"
                onClick={() => {
                  setLightboxOpen(true);
                  setLightboxZoomed(false);
                }}
                aria-label={`Enlarge ${active.shortTitle} workspace preview`}
                className="block w-full text-left rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] transition-all duration-300 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {/* Browser Top Chrome */}
                <div className="px-4 py-2.5 bg-slate-950/90 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 truncate max-w-[200px] sm:max-w-none">
                    Angel Workspace • {active.shortTitle}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 opacity-75 group-hover:opacity-100">
                    <Maximize2 className="w-3 h-3" />
                  </span>
                </div>

                <SmartImage
                  src={active.screenshotSrc}
                  alt={active.screenshotAlt}
                  aspectRatioClass="aspect-[16/10] w-full bg-[#050714]"
                  imgClassName="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                  placeholderLabel={`Loading ${active.shortTitle}...`}
                />
              </button>
            </div>

            {/* Right: Capability Storytelling */}
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl transition-transform duration-300 hover:scale-110 hover:shadow-[0_0_16px_rgba(56,189,248,0.5)] ${
                    isLight
                      ? 'bg-sky-100/80 text-indigo-600'
                      : 'bg-indigo-500/20 text-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.25)]'
                  }`}
                >
                  <ActiveIcon className={`w-6 h-6 cap-icon icon-motion-${active.motionKey}`} />
                </div>
                <span className={`text-xs font-bold uppercase tracking-[0.2em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                  {active.shortTitle} Environment
                </span>
              </div>

              <h3 className={`text-xl sm:text-2xl font-bold font-heading ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {active.title}
              </h3>

              <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                {active.summary}
              </p>

              <div
                className={`p-4 rounded-2xl text-xs leading-relaxed transition-all hover:shadow-lg ${
                  isLight
                    ? 'bg-sky-50/90 text-slate-700 shadow-xs'
                    : 'bg-slate-950/60 text-slate-300 shadow-md'
                }`}
              >
                <span className={`font-bold block mb-1 ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                  How it connects across Angel
                </span>
                {active.workspaceRelation}
              </div>

              <ul className="space-y-2 pt-1">
                {active.highlights.map((item) => (
                  <li
                    key={item}
                    className={`flex items-center gap-2.5 text-xs font-medium ${
                      isLight ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Media Lightbox Modal (Zoom, Next/Prev, Keyboard Esc/Arrows, Mobile Swipe) */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${active.shortTitle} capability preview viewer`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxOpen(false);
              setLightboxZoomed(false);
            }
          }}
          onPointerDown={(e) => {
            lightboxTouchStartRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = lightboxTouchStartRef.current;
            lightboxTouchStartRef.current = null;
            if (!start) return;
            const dir = resolveHorizontalSwipeDirection(e.clientX - start.x, e.clientY - start.y, 48);
            if (dir === 'next') stepCapability(1);
            else if (dir === 'prev') stepCapability(-1);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
        >
          <div
            className={`relative w-full max-w-5xl rounded-3xl angel-blurred-surface overflow-hidden flex flex-col max-h-[92vh] ${
              isLight ? 'bg-white/95 text-slate-900' : 'bg-[#070b20]/95 text-slate-100'
            }`}
          >
            {/* Lightbox Header */}
            <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                  Illustrative Preview {activeIndex + 1} of {CAPABILITIES.length} • {active.shortTitle}
                </p>
                <h3 className="text-sm sm:text-base font-bold font-heading truncate">{active.title}</h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setLightboxZoomed((prev) => !prev)}
                  aria-label={lightboxZoomed ? 'Reset zoom' : 'Zoom in preview'}
                  className={`p-2 rounded-xl cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  {lightboxZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLightboxOpen(false);
                    setLightboxZoomed(false);
                  }}
                  aria-label="Close preview lightbox"
                  className={`p-2 rounded-xl cursor-pointer transition-colors ${
                    isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lightbox Media Canvas */}
            <div className="relative flex-1 overflow-auto bg-[#040714] flex items-center justify-center p-2 sm:p-4">
              <div
                onClick={() => setLightboxZoomed((prev) => !prev)}
                className={`transition-transform duration-300 origin-center ${
                  lightboxZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                } max-w-full`}
              >
                <SmartImage
                  src={active.screenshotSrc}
                  alt={active.screenshotAlt}
                  priority="high"
                  aspectRatioClass="w-full max-w-4xl aspect-[16/10]"
                  imgClassName="object-contain rounded-xl"
                  placeholderLabel={`Loading ${active.shortTitle}...`}
                />
              </div>
            </div>

            {/* Lightbox Caption Footer */}
            <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <p className="opacity-85 max-w-2xl">{active.summary}</p>
              <span className="text-[11px] font-medium opacity-70">
                Illustrative workspace view • Sign in for interactive execution
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
