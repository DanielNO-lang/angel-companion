import React, { useState } from 'react';
import {
  MessageSquare,
  LayoutGrid,
  Bot,
  Clapperboard,
  FolderKanban,
  Wrench,
  BookOpen,
  Brain,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import type { ThemeMode } from '../../services/authValidation';

interface ArchitectureNode {
  id: string;
  label: string;
  role: string;
  detail: string;
  connectsTo: string[];
  icon: React.FC<{ className?: string }>;
}

const ECOSYSTEM_NODES: ArchitectureNode[] = [
  {
    id: 'conversations',
    label: 'Conversations',
    role: 'Natural Dialogue Entry',
    detail: 'General multi-turn reasoning and voice/multimodal interaction. Links directly to Library records or exports work into Projects.',
    connectsTo: ['library', 'memory', 'workspace'],
    icon: MessageSquare,
  },
  {
    id: 'adaptive',
    label: 'Adaptive Workspace',
    role: 'Task-Shaped Workbench',
    detail: 'Reconfigures for Research, Development, Writing, or Creative work using live project context and authorized Library references.',
    connectsTo: ['workspace', 'library', 'tools'],
    icon: LayoutGrid,
  },
  {
    id: 'studios',
    label: 'Studios',
    role: '8 Specialist Environments',
    detail: 'Isolated domain environments (Research, Development, Creative, Education, Professional, Personal, Automation, Devices) with dedicated tools.',
    connectsTo: ['library', 'tools', 'memory'],
    icon: Clapperboard,
  },
  {
    id: 'agents',
    label: 'Agents',
    role: 'Bounded Task Dispatch',
    detail: 'Specialized agents execute scoped instructions inside defined read/write/network capability boundaries.',
    connectsTo: ['tools', 'workspace', 'adaptive'],
    icon: Bot,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    role: 'Persistent Projects & Files',
    detail: 'Stores multi-file deliverables, documentation, architecture notes, and code artifacts organized by project.',
    connectsTo: ['adaptive', 'library', 'conversations'],
    icon: FolderKanban,
  },
  {
    id: 'library',
    label: 'Library',
    role: 'Authorized Reference Repository',
    detail: 'Independent long-lived knowledge repository storing documents, citations, code snippets, and templates—never conflated with personal memory.',
    connectsTo: ['studios', 'adaptive', 'conversations', 'workspace'],
    icon: BookOpen,
  },
  {
    id: 'tools',
    label: 'Tools',
    role: 'Capabilities & Connectors',
    detail: 'Hosts callable system capabilities, plugins, and external service connectors under explicit permission separation.',
    connectsTo: ['agents', 'studios', 'adaptive'],
    icon: Wrench,
  },
  {
    id: 'memory',
    label: 'Memory',
    role: 'Scoped Context Isolation',
    detail: 'Separates general conversation preferences from Studio context locally, with Supabase cloud sync prepared in schema blueprints.',
    connectsTo: ['conversations', 'studios'],
    icon: Brain,
  },
];

// Normalized 4x2 grid center coordinates for SVG directional relationship overlay (viewBox 0 0 400 200)
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  conversations: { x: 50, y: 50 },
  adaptive: { x: 150, y: 50 },
  studios: { x: 250, y: 50 },
  agents: { x: 350, y: 50 },
  workspace: { x: 50, y: 150 },
  library: { x: 150, y: 150 },
  tools: { x: 250, y: 150 },
  memory: { x: 350, y: 150 },
};

interface ArchitectureAndSymbolismProps {
  theme: ThemeMode;
}

export const ArchitectureAndSymbolism: React.FC<ArchitectureAndSymbolismProps> = ({ theme }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('adaptive');
  const isLight = theme === 'light';
  const selectedNode = ECOSYSTEM_NODES.find((n) => n.id === selectedNodeId) || ECOSYSTEM_NODES[0];
  const SelectedIcon = selectedNode.icon;
  const selectedPos = NODE_POSITIONS[selectedNode.id];

  return (
    <div id="about" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 py-14 sm:py-20">
      {/* 1. ABOUT ANGEL & THE TREFOIL EMBLEM IN MOTION */}
      <section aria-labelledby="emblem-story-heading">
        <div
          className={`landing-glass-card rounded-[28px] sm:rounded-[32px] p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-[0.95fr_1.15fr] gap-8 lg:gap-12 items-center ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          }`}
        >
          {/* Animated Emblem Motion Stage */}
          <div className="relative flex flex-col items-center justify-center py-6">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-60 h-60 sm:w-72 sm:h-72 rounded-full border animate-spin-slow pointer-events-none ${
                  isLight ? 'border-sky-500/35' : 'border-cyan-400/25'
                }`}
              />
              <div
                className={`absolute w-48 h-48 rounded-full blur-2xl pointer-events-none ${
                  isLight
                    ? 'bg-gradient-to-tr from-sky-300/45 via-indigo-300/35 to-purple-300/45'
                    : 'bg-gradient-to-tr from-cyan-500/25 via-indigo-500/20 to-purple-500/25'
                }`}
              />
              <div className="absolute z-10 flex items-center justify-center">
                {isLight && (
                  <div className="absolute w-36 h-36 rounded-full bg-gradient-to-br from-slate-900/85 via-indigo-950/85 to-slate-900/85 blur-xl opacity-25 pointer-events-none" />
                )}
                <AngelEmblem3D size={168} rotationSpeed={18} pointerTracking={true} />
              </div>
            </div>
            <p className={`mt-4 text-xs font-mono uppercase tracking-widest text-center ${isLight ? 'text-slate-600' : 'text-cyan-300/80'}`}>
              Continuous 3D Intertwined Trefoil Form
            </p>
          </div>

          {/* Grounded Symbolism Explanation (no invented history) */}
          <div className="space-y-5 text-left">
            <p className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
              About Angel & The Emblem
            </p>
            <h2
              id="emblem-story-heading"
              className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
            >
              One Continuous Form Connecting Every Discipline
            </h2>
            <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Angel’s 3D emblem is built from a single continuous intertwined trefoil curve—reflecting how different ways
              of thinking, building, and organizing remain distinct yet seamlessly connected inside one companion.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[
                {
                  title: 'Connection',
                  text: 'Three interwoven loops meeting without hard breaks mirror Dialogue, Workspace, and Specialized Studios working together.',
                },
                {
                  title: 'Continuity',
                  text: 'Its unbroken metallic geometry reflects preserving project context and organized knowledge across tasks.',
                },
                {
                  title: 'Balance',
                  text: 'Blue and violet ambient highlights represent calm everyday guidance paired with structured technical execution.',
                },
              ].map((pillar) => (
                <div
                  key={pillar.title}
                  className={`p-4 rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 ${
                    isLight
                      ? 'bg-white/80 hover:bg-white border-slate-200 hover:border-blue-300 text-slate-800 shadow-xs'
                      : 'bg-slate-950/50 hover:bg-slate-900/65 border-indigo-500/20 hover:border-cyan-400/40 text-slate-200'
                  }`}
                >
                  <h3 className={`text-sm font-bold font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                    {pillar.title}
                  </h3>
                  <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {pillar.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW ANGEL WORKS TOGETHER (INTERACTIVE ARCHITECTURE DIAGRAM) */}
      <section aria-labelledby="ecosystem-diagram-heading" className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
            System Architecture
          </p>
          <h2
            id="ecosystem-diagram-heading"
            className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            How Angel&apos;s Environments Work Together
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Each area in Angel has a distinct responsibility—not overlapping clones. Select any environment below to
            inspect how it connects without collapsing boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 items-stretch">
          {/* Interactive Spatial Node Grid with Animated Relationship Connectors */}
          <div className="relative">
            {/* Desktop/Wide SVG Connection Beams Behind 4x2 Node Grid */}
            <svg
              aria-hidden="true"
              viewBox="0 0 400 200"
              preserveAspectRatio="none"
              className="hidden sm:block absolute inset-0 w-full h-full pointer-events-none z-0"
            >
              {selectedPos &&
                selectedNode.connectsTo.map((targetId) => {
                  const targetPos = NODE_POSITIONS[targetId];
                  if (!targetPos) return null;
                  return (
                    <g key={selectedNode.id + '-' + targetId}>
                      <line
                        x1={selectedPos.x}
                        y1={selectedPos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke={isLight ? 'rgba(59, 130, 246, 0.25)' : 'rgba(56, 189, 248, 0.22)'}
                        strokeWidth="2.5"
                      />
                      <line
                        x1={selectedPos.x}
                        y1={selectedPos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke={isLight ? '#2563eb' : '#38bdf8'}
                        strokeWidth="2"
                        className="animate-flow-beam"
                      />
                    </g>
                  );
                })}
            </svg>

            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ECOSYSTEM_NODES.map((node) => {
                const Icon = node.icon;
                const isSelected = node.id === selectedNode.id;
                const isLinked = selectedNode.connectsTo.includes(node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    aria-pressed={isSelected}
                    className={`group p-4 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[126px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white border-cyan-300/70 shadow-[0_10px_30px_rgba(79,70,229,0.45)] -translate-y-0.5 scale-[1.02]'
                        : isLinked
                          ? isLight
                            ? 'bg-sky-50/95 hover:bg-white border-sky-400/80 text-slate-900 shadow-[0_6px_20px_rgba(59,130,246,0.14)] backdrop-blur-xl'
                            : 'bg-indigo-950/75 hover:bg-indigo-900/75 border-cyan-400/55 text-slate-100 shadow-[0_0_22px_rgba(56,189,248,0.2)] backdrop-blur-xl'
                          : isLight
                            ? 'bg-white/70 hover:bg-white/95 border-slate-200/90 hover:border-blue-300 text-slate-800 backdrop-blur-xl'
                            : 'bg-[#090e26]/55 hover:bg-[#0e1538]/75 border-indigo-500/20 hover:border-cyan-400/40 text-slate-300 backdrop-blur-xl'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon
                        className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                          isSelected
                            ? 'text-cyan-200 scale-110'
                            : isLinked
                              ? 'text-cyan-400'
                              : isLight
                                ? 'text-indigo-600'
                                : 'text-indigo-400'
                        }`}
                      />
                      {isLinked && !isSelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          Linked
                        </span>
                      )}
                    </div>
                    <div className="pt-3">
                      <div className="text-xs font-bold font-heading">{node.label}</div>
                      <div
                        className={`text-[11px] mt-0.5 leading-snug ${
                          isSelected ? 'text-blue-100' : isLight ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        {node.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Node Relationship Inspector */}
          <div
            className={`landing-glass-card rounded-3xl p-6 flex flex-col justify-between ${
              isLight ? 'text-slate-900' : 'text-slate-100'
            }`}
          >
            <div key={selectedNode.id} className="animate-landing-reveal space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-2xl border ${
                    isLight
                      ? 'bg-sky-50 border-sky-200 text-indigo-600'
                      : 'bg-indigo-500/15 border-indigo-400/30 text-cyan-400'
                  }`}
                >
                  <SelectedIcon className="w-6 h-6" />
                </div>
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                    {selectedNode.role}
                  </span>
                  <h3 className="text-xl font-bold font-heading">{selectedNode.label}</h3>
                </div>
              </div>

              <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                {selectedNode.detail}
              </p>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-500/20">
              <span className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Directly Interacts With
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedNode.connectsTo.map((targetId) => {
                  const target = ECOSYSTEM_NODES.find((n) => n.id === targetId);
                  if (!target) return null;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setSelectedNodeId(target.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                        isLight
                          ? 'bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-200'
                          : 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/30 hover:border-cyan-400/60'
                      }`}
                    >
                      {target.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHAT MAKES ANGEL DIFFERENT */}
      <section aria-labelledby="different-heading" className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
            Beyond Prompt Boxes
          </p>
          <h2
            id="different-heading"
            className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            What Makes Angel Different From an Ordinary Chatbot
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className={`landing-glass-card rounded-3xl p-6 sm:p-8 space-y-4 ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}
          >
            <h3 className={`text-lg font-bold font-heading ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              Ordinary Prompt Chatbot
            </h3>
            <ul className="space-y-3 text-sm">
              {[
                'Isolated linear threads where work disappears once you start a new chat.',
                'No dedicated workbenches, Studio scopes, or structured project file trees.',
                'Blurs reference files, drafts, and casual prompts inside one stream.',
                'Forces users to copy-paste between unrelated apps just to organize deliverables.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`landing-glass-card rounded-3xl p-6 sm:p-8 space-y-4 ${
              isLight
                ? '!border-sky-300 text-slate-900'
                : '!border-cyan-400/35 text-slate-100'
            }`}
          >
            <h3 className="text-lg font-bold font-heading gradient-text-angel">
              Angel Companion Environment
            </h3>
            <ul className="space-y-3 text-sm">
              {[
                'Brings conversation together with Adaptive Workbenches, 8 Studios, and persistent Projects.',
                'Separates your Knowledge Library from scoped memories and active project deliverables.',
                'Provides bounded Agents, voice/camera/attachment controls, and transparent capability status.',
                'Built to expand methodically—clearly distinguishing live features from connectors awaiting configuration.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
