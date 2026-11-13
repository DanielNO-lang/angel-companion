import React, { useState, useEffect } from 'react';
import { LayoutGrid, Code2, Search, PenTool, Palette, Layers, CheckCircle2, Save, BookOpen, Folder, FileText, Download } from 'lucide-react';
import { UniversalComposer } from '../composer/UniversalComposer';
import { workspaceEngine, WorkspaceProject } from '../../services/workspaceEngine';
import { libraryService, LibraryItem } from '../../services/libraryService';
import { storageService } from '../../services/storageService';

export type AdaptiveMode = 'research' | 'code' | 'writing' | 'design';

const SESSION_STORAGE_KEY = 'angel_adaptive_workspace_session_v1';

export const AdaptiveWorkspacePage: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AdaptiveMode>(() => {
    return storageService.load<AdaptiveMode>(SESSION_STORAGE_KEY, 'research');
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    const projs = workspaceEngine.getProjects();
    return projs[0]?.id || 'proj_default';
  });

  const [sessionNotes, setSessionNotes] = useState<string>(() => {
    return storageService.load<string>(`angel_adaptive_notes_${activeMode}`, '');
  });

  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const projects = workspaceEngine.getProjects();
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    storageService.save(SESSION_STORAGE_KEY, activeMode);
    const loadedNotes = storageService.load<string>(`angel_adaptive_notes_${activeMode}`, '');
    setSessionNotes(loadedNotes);
  }, [activeMode]);

  const handleNotesChange = (val: string) => {
    setSessionNotes(val);
    storageService.save(`angel_adaptive_notes_${activeMode}`, val);
  };

  const handleSaveToWorkspace = () => {
    if (!sessionNotes.trim() || !selectedProject) return;

    const fileNames: Record<AdaptiveMode, string> = {
      research: `Research_Findings_${Date.now().toString().slice(-4)}.md`,
      code: `Module_Scaffold_${Date.now().toString().slice(-4)}.ts`,
      writing: `Content_Draft_${Date.now().toString().slice(-4)}.md`,
      design: `Design_Spec_${Date.now().toString().slice(-4)}.md`,
    };

    workspaceEngine.addFileToProject(
      selectedProject.id,
      fileNames[activeMode],
      sessionNotes,
      activeMode === 'code' ? 'code' : 'document',
      ['adaptive_workbench', activeMode]
    );

    setSaveNotice(`Saved document to Workspace project "${selectedProject.name}"`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleSaveToLibrary = () => {
    if (!sessionNotes.trim()) return;

    const catMap: Record<AdaptiveMode, import('../../services/libraryService').LibraryCategory> = {
      research: 'references',
      code: 'code',
      writing: 'documents',
      design: 'templates',
    };

    libraryService.addItem({
      type: catMap[activeMode],
      name: `Adaptive Workbench Output (${activeMode.toUpperCase()}) - ${new Date().toLocaleDateString()}`,
      description: `Saved from active workbench session in ${activeMode} mode`,
      content: sessionNotes,
      mimeType: activeMode === 'code' ? 'text/typescript' : 'text/markdown',
      tags: ['adaptive_workspace', activeMode],
      collection: 'Workbench Deliverables',
      projectId: selectedProject?.id,
    });

    setSaveNotice('Saved deliverable to central Library');
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const modes = [
    {
      id: 'research' as const,
      name: 'Research',
      label: 'Research Workbench',
      icon: Search,
      color: 'text-cyan-400',
      description: 'Active workbench for research notes, source review, investigation planning, and findings synthesis.',
      placeholder: 'Synthesize research notes, structure hypotheses, and frame investigation questions...',
    },
    {
      id: 'code' as const,
      name: 'Development',
      label: 'Development Workbench',
      icon: Code2,
      color: 'text-indigo-400',
      description: 'Active workbench for code & technical document editing, code organization, and debugging specs.',
      placeholder: 'Draft TypeScript modules, API schemas, AST refactoring steps, or code documentation...',
    },
    {
      id: 'writing' as const,
      name: 'Writing & Content',
      label: 'Writing & Content Workbench',
      icon: PenTool,
      color: 'text-purple-400',
      description: 'Active workbench for document creation, content drafting, editing, and strategy planning.',
      placeholder: 'Draft executive summaries, articles, project updates, or content strategy outlines...',
    },
    {
      id: 'design' as const,
      name: 'Creative Design',
      label: 'Creative Design Workbench',
      icon: Palette,
      color: 'text-pink-400',
      description: 'Active workbench for creative briefs, design specifications, color swatches, and visual work surfaces.',
      placeholder: 'Structure design specifications, SVG layouts, typography tokens, and visual direction...',
    },
  ];

  const currentModeInfo = modes.find((m) => m.id === activeMode) || modes[0];

  const authorisedResources = libraryService.getAuthorisedResources(
    undefined,
    selectedProject?.id
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Save Toast Notification */}
      {saveNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-950/95 border border-cyan-400/50 text-cyan-200 text-xs font-semibold shadow-[0_0_25px_rgba(56,189,248,0.5)] backdrop-blur-xl">
          {saveNotice}
        </div>
      )}

      {/* Page Header - simply ADAPTIVE WORKSPACE (no main heading icon) */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-white">ADAPTIVE WORKSPACE</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic active workbench adapting its surface for research, development, writing, and creative design.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = activeMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveMode(m.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 border border-indigo-400'
                    : 'glass-panel text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : m.color}`} />
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Stage (8 Cols): Active Workbench Editor Surface */}
        <div className="lg:col-span-8 rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-base font-bold font-heading text-white">{currentModeInfo.label}</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveToWorkspace}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                title="Save deliverable to active Workspace Project"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to Workspace</span>
              </button>

              <button
                onClick={handleSaveToLibrary}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                title="Save reusable output to central Library"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Save to Library</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{currentModeInfo.description}</p>

          {/* Genuine Workbench Surface (No fake Monitoring or Fake Canvas messages) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">
              Active Session Working Document ({activeMode.toUpperCase()}):
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={currentModeInfo.placeholder}
              className="w-full bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-400/50 min-h-[320px] resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Side Controls (4 Cols): Project Context, Library Retrieval & Universal Composer */}
        <div className="lg:col-span-4 space-y-4">
          {/* Project Selector */}
          <div className="rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-5 space-y-3 shadow-lg">
            <h4 className="text-xs font-bold font-heading text-white uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Folder className="w-4 h-4" />
              <span>Active Project Context</span>
            </h4>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProject && (
              <p className="text-[11px] text-slate-400 leading-tight">
                {selectedProject.description} ({selectedProject.files.length} project files)
              </p>
            )}
          </div>

          {/* Authorised Library Resources for Workbench */}
          <div className="rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-5 space-y-3 shadow-lg">
            <h4 className="text-xs font-bold font-heading text-white uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>Authorised Library Resources</span>
            </h4>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {authorisedResources.length > 0 ? (
                authorisedResources.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => {
                      const appended = sessionNotes ? `${sessionNotes}\n\n--- Referenced Resource (${res.name}) ---\n${res.content}` : res.content;
                      handleNotesChange(appended);
                    }}
                    className="w-full text-left p-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-xs flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-slate-200 truncate group-hover:text-white font-medium">{res.name}</span>
                    </div>
                    <span className="text-[10px] text-cyan-400 font-semibold shrink-0">Insert</span>
                  </button>
                ))
              ) : (
                <p className="text-[11px] text-slate-500">No linked library resources found.</p>
              )}
            </div>
          </div>

          {/* Universal Composer for Adaptive Instructions */}
          <div className="rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-5 space-y-3 shadow-lg">
            <h4 className="text-xs font-bold font-heading text-white uppercase tracking-wider text-indigo-400">
              Workbench Instructions:
            </h4>
            <UniversalComposer
              context={{
                type: 'adaptive',
                projectId: selectedProjectId,
              }}
              variant="compact"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
