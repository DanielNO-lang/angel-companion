import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Plus,
  FileCode,
  Search,
  Check,
  Trash2,
  Save,
  Edit2,
  BookOpen,
  Clapperboard,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import { workspaceEngine, WorkspaceProject, WorkspaceFile, WorkspaceFileType } from '../../services/workspaceEngine';
import { libraryService } from '../../services/libraryService';
import { APPROVED_EIGHT_STUDIOS } from '../../services/studiosEngine';
import { UniversalComposer } from '../composer/UniversalComposer';
import { StudioId } from '../../types/angel';

export const WorkspacePage: React.FC = () => {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProject, setActiveProject] = useState<WorkspaceProject | null>(null);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Controls
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjStudio, setNewProjStudio] = useState<StudioId | 'none'>('none');

  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<WorkspaceFileType>('document');

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [renameFileName, setRenameFileName] = useState('');

  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const refreshWorkspace = (keepActiveFileId?: string) => {
    const projs = workspaceEngine.getProjects();
    setProjects(projs);
    const currProj = projs.find((p) => p.id === activeProject?.id) || projs[0] || null;
    setActiveProject(currProj);

    if (currProj && currProj.files.length > 0) {
      const targetFile = currProj.files.find((f) => f.id === keepActiveFileId) || currProj.files[0];
      setActiveFile(targetFile);
      setEditorContent(targetFile.content);
    } else {
      setActiveFile(null);
      setEditorContent('');
    }
  };

  useEffect(() => {
    refreshWorkspace();
  }, []);

  const handleSelectProject = (proj: WorkspaceProject) => {
    setActiveProject(proj);
    if (proj.files.length > 0) {
      setActiveFile(proj.files[0]);
      setEditorContent(proj.files[0].content);
    } else {
      setActiveFile(null);
      setEditorContent('');
    }
  };

  const handleCreateProject = () => {
    if (!newProjName.trim()) return;
    const created = workspaceEngine.createProject(newProjName.trim(), newProjDesc.trim() || 'Workspace Project');
    if (newProjStudio !== 'none') {
      workspaceEngine.associateStudioWithProject(created.id, newProjStudio as StudioId);
    }
    setNewProjName('');
    setNewProjDesc('');
    setNewProjStudio('none');
    setShowNewProjectModal(false);
    refreshWorkspace(created.files[0]?.id);
    setActiveProject(created);
  };

  const handleSelectFile = (file: WorkspaceFile) => {
    setActiveFile(file);
    setEditorContent(file.content);
  };

  const handleSaveFile = () => {
    if (activeFile) {
      workspaceEngine.updateFileContent(activeFile.id, editorContent);
      setToastNotice(`Saved "${activeFile.name}"`);
      setTimeout(() => setToastNotice(null), 2500);
      refreshWorkspace(activeFile.id);
    }
  };

  const handleCreateFile = () => {
    if (!newFileName.trim() || !activeProject) return;
    const file = workspaceEngine.addFileToProject(
      activeProject.id,
      newFileName.trim(),
      `# ${newFileName.trim()}\n\nDocument initialized on ${new Date().toLocaleDateString()}.`,
      newFileType
    );
    if (file) {
      setNewFileName('');
      setShowNewFileModal(false);
      refreshWorkspace(file.id);
      handleSelectFile(file);
    }
  };

  const handleRenameFile = (fileId: string) => {
    if (!renameFileName.trim()) return;
    workspaceEngine.renameFile(fileId, renameFileName.trim());
    setEditingFileId(null);
    setRenameFileName('');
    refreshWorkspace(fileId);
  };

  const handleDeleteFile = (fileId: string) => {
    workspaceEngine.deleteFile(fileId);
    refreshWorkspace();
  };

  const handleSaveFileToLibrary = (file: WorkspaceFile) => {
    libraryService.addItem({
      type: file.type === 'code' ? 'code' : 'documents',
      name: file.name,
      description: `Saved from Workspace Project "${activeProject?.name || 'Default'}"`,
      content: file.content,
      mimeType: file.type === 'code' ? 'text/typescript' : 'text/markdown',
      tags: ['workspace_export', file.type],
      collection: 'Project Deliverables',
      projectId: activeProject?.id,
      studioId: activeProject?.studioId,
    });
    setToastNotice(`Exported "${file.name}" to central Library`);
    setTimeout(() => setToastNotice(null), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notice */}
      {toastNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-950/95 border border-cyan-400/50 text-cyan-200 text-xs font-semibold shadow-[0_0_25px_rgba(56,189,248,0.5)] backdrop-blur-xl">
          {toastNotice}
        </div>
      )}

      {/* Main Page Header - Heading simply WORKSPACE (no main heading icon) */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-white">WORKSPACE</h2>
          <p className="text-xs text-slate-400 mt-1">
            Persistent home for projects, deliverables, documentation, notes, and code artifacts.
          </p>
        </div>

        <button
          onClick={() => setShowNewProjectModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Project Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {projects.map((p) => {
          const isActive = activeProject?.id === p.id;
          const linkedStudio = APPROVED_EIGHT_STUDIOS.find((s) => s.id === p.studioId);

          return (
            <button
              key={p.id}
              onClick={() => handleSelectProject(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 border border-indigo-400'
                  : 'bg-slate-950/60 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
              <span>{p.name}</span>
              {linkedStudio && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  {linkedStudio.name.split(' ')[0]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Workspace Body: Project File Tree (Left) & Editor (Right) */}
      <div className="h-[calc(100vh-250px)] min-h-[500px] flex flex-col lg:flex-row gap-6">
        {/* Left Explorer Sidebar */}
        <div className="w-full lg:w-80 rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-4 flex flex-col justify-between shadow-xl shrink-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                <h3 className="text-xs font-bold font-heading text-white uppercase tracking-wider truncate">
                  {activeProject?.name || 'Project Files'}
                </h3>
              </div>
              <button
                onClick={() => setShowNewFileModal(true)}
                className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files in project..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400/50"
              />
            </div>

            {/* File Tree List */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {activeProject?.files
                .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((file) => {
                  const isSelected = activeFile?.id === file.id;
                  const isRenaming = editingFileId === file.id;

                  return (
                    <div
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      className={`p-2.5 rounded-2xl border text-xs transition-all cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-400 text-white font-semibold shadow-md'
                          : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:text-white'
                      }`}
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={renameFileName}
                            onChange={(e) => setRenameFileName(e.target.value)}
                            className="flex-1 bg-slate-950 px-2 py-1 rounded text-xs text-white border border-slate-700 focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameFile(file.id)}
                            className="p-1 rounded bg-emerald-600 text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 truncate">
                            {file.type === 'code' ? (
                              <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                            )}
                            <span className="truncate">{file.name}</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFileId(file.id);
                                setRenameFileName(file.name);
                              }}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Rename File"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveFileToLibrary(file);
                              }}
                              className="p-1 text-slate-400 hover:text-cyan-300"
                              title="Save to Library"
                            >
                              <BookOpen className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(file.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-400"
                              title="Delete File"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Project Instruction Composer */}
          <div className="pt-3 border-t border-slate-800">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              Project Instructions:
            </span>
            <UniversalComposer
              context={{
                type: 'workspace',
                projectId: activeProject?.id || 'proj_default',
              }}
              variant="compact"
              onSubmitted={() => refreshWorkspace(activeFile?.id)}
            />
          </div>
        </div>

        {/* Right Editor Stage */}
        <div className="flex-1 flex flex-col rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-4 md:p-6 shadow-2xl overflow-hidden">
          {activeFile ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-base font-bold font-heading text-white">{activeFile.name}</h3>
                    <span className="text-[10px] text-slate-400">
                      Project: {activeProject?.name} | {activeFile.type.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveFileToLibrary(activeFile)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-semibold border border-slate-700 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Save to Library</span>
                  </button>

                  <button
                    onClick={handleSaveFile}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Document</span>
                  </button>
                </div>
              </div>

              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                className="flex-1 w-full bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-400/50 resize-none leading-relaxed"
                placeholder="Edit document content..."
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select or create a document to open the workspace editor.
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel border border-indigo-500/30 bg-[#090e26] p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-heading">Create New Workspace Project</h3>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Project Name *</label>
                <input
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder="Project name..."
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                <input
                  type="text"
                  value={newProjDesc}
                  onChange={(e) => setNewProjDesc(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Associate Studio (Optional)</label>
                <select
                  value={newProjStudio}
                  onChange={(e) => setNewProjStudio(e.target.value as any)}
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                >
                  <option value="none">None (Universal Project)</option>
                  {APPROVED_EIGHT_STUDIOS.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer shadow-md"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl glass-panel border border-indigo-500/30 bg-[#090e26] p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-heading">Add File to {activeProject?.name}</h3>
              <button
                onClick={() => setShowNewFileModal(false)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">File Name *</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="e.g. Specification.md or API.ts"
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">File Type</label>
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value as WorkspaceFileType)}
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                >
                  <option value="document">Document</option>
                  <option value="code">Code</option>
                  <option value="note">Note</option>
                  <option value="research">Research</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer shadow-md"
              >
                Add File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
