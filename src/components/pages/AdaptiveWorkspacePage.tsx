import React, { useState } from 'react';
import { LayoutGrid, Code2, Search, PenTool, Palette, Layers, CheckCircle2 } from 'lucide-react';

export const AdaptiveWorkspacePage: React.FC = () => {
  const [activePreset, setActivePreset] = useState<'research' | 'code' | 'writing' | 'design'>('research');

  const presets = [
    { id: 'research' as const, name: 'Research Workspace', icon: Search, color: 'text-cyan-400', desc: 'Optimized for paper synthesis, citations, and data gathering.' },
    { id: 'code' as const, name: 'Development Workspace', icon: Code2, color: 'text-indigo-400', desc: 'Integrated code editor, terminal output, and architectural diagrammer.' },
    { id: 'writing' as const, name: 'Content & Strategy Workspace', icon: PenTool, color: 'text-purple-400', desc: 'Distraction-free rich text editor and tone optimizer.' },
    { id: 'design' as const, name: 'Creative Design Workspace', icon: Palette, color: 'text-pink-400', desc: 'Spatial canvas, swatch generator, and UI mockup stage.' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Workspace Header */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">Adaptive Workspace</h2>
          </div>
        </div>

        {/* Preset Switcher Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => {
            const Icon = p.icon;
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePreset(p.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 border border-indigo-400'
                    : 'glass-panel text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : p.color}`} />
                <span>{p.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Grid View based on selected preset */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Stage (8 Cols) */}
        <div className="lg:col-span-8 rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold font-heading text-white">
                {presets.find((p) => p.id === activePreset)?.name}
              </h3>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-semibold">
              Context Active
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {presets.find((p) => p.id === activePreset)?.desc}
          </p>

          {/* Interactive Workspace Canvas Stage */}
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 min-h-[300px] flex flex-col items-center justify-center text-center space-y-3">
            <Layers className="w-10 h-10 text-indigo-400 animate-pulse" />
            <h4 className="text-sm font-bold text-slate-200">
              Interactive Canvas Loaded for {activePreset.toUpperCase()}
            </h4>
            <p className="text-xs text-slate-400 max-w-md">
              Angel is monitoring your active document and prompt context. All outputs generated in this view stay bound to your project session memory.
            </p>
          </div>
        </div>

        {/* Side Controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold font-heading text-white uppercase tracking-wider text-indigo-400">
              Workspace Capabilities
            </h4>
            <ul className="space-y-2 text-xs">
              {[
                'Context Auto-Detection',
                'Multi-Pane Docking',
                'Artifact State Synchronization',
                'Local Memory Persistence',
              ].map((cap) => (
                <li key={cap} className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
