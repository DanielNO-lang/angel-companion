import React, { useState, useEffect } from 'react';
import { Folder, FileText, Plus, FileCode, Search, Check, Trash2, Save } from 'lucide-react';
import { workspaceEngine, WorkspaceProject, WorkspaceFile, WorkspaceFileType } from '../../services/workspaceEngine';

export const WorkspacePage: React.FC = () => {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [activeProject, setActiveProject] = useState<WorkspaceProject | null>(null);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<WorkspaceFileType>('document');
  const [showNewFile, setShowNewFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const refreshWorkspace = () => {
    const projs = workspaceEngine.getProjects();
    setProjects(projs);
    const currProj = projs[0] || null;
    setActiveProject(currProj);
    if (currProj && currProj.files.length > 0) {
      const currFile = currProj.files[0];
      setActiveFile(currFile);
      setEditorContent(currFile.content);
    }
  };

  useEffect(() => {
    refreshWorkspace();
  }, []);

  const handleSelectFile = (file: WorkspaceFile) => {
    setActiveFile(file);
    setEditorContent(file.content);
  };

  const handleSaveFile = () => {
    if (activeFile) {
      workspaceEngine.updateFileContent(activeFile.id, editorContent);
      refreshWorkspace();
    }
  };

  const handleCreateFile = () => {
    if (!newFileName.trim() || !activeProject) return;
    const file = workspaceEngine.addFileToProject(
      activeProject.id,
      newFileName,
      `# ${newFileName}\n\nDocument initialized.`,
      newFileType
    );
    if (file) {
      setNewFileName('');
      setShowNewFile(false);
      refreshWorkspace();
      handleSelectFile(file);
    }
  };

  const handleDeleteFile = (fileId: string) => {
    workspaceEngine.deleteFile(fileId);
    refreshWorkspace();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
      {/* File Tree / Project Explorer Sidebar */}
      <div className="w-full lg:w-72 rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold font-heading text-white uppercase tracking-wider">
                {activeProject?.name || 'Workspace Files'}
              </h3>
            </div>
            <button
              onClick={() => setShowNewFile(!showNewFile)}
              className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all flex items-center gap-1 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          {showNewFile && (
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 mb-3">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="File name (e.g. Note.md)..."
                className="w-full bg-slate-950 px-2.5 py-1.5 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value as WorkspaceFileType)}
                  className="bg-slate-950 text-xs text-slate-300 border border-slate-800 px-2 py-1 rounded-lg"
                >
                  <option value="document">Document</option>
                  <option value="code">Code</option>
                  <option value="note">Note</option>
                  <option value="research">Research</option>
                </select>
                <button
                  onClick={handleCreateFile}
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Search Files Input */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* File Tree List */}
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {activeProject?.files
              .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((file) => {
                const isSelected = activeFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    className={`p-2.5 rounded-2xl border text-xs transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-400 text-white font-semibold'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {file.type === 'code' ? <FileCode className="w-4 h-4 text-cyan-400 shrink-0" /> : <FileText className="w-4 h-4 text-indigo-400 shrink-0" />}
                      <span className="truncate">{file.name}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-300 transition-opacity"
                      title="Delete File"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Main Workspace Editor Canvas */}
      <div className="flex-1 flex flex-col rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-4 md:p-6 shadow-2xl overflow-hidden">
        {activeFile ? (
          <>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold font-heading text-white">{activeFile.name}</h3>
              </div>

              <button
                onClick={handleSaveFile}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save Auto-Sync</span>
              </button>
            </div>

            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="flex-1 w-full bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-400/50 resize-none leading-relaxed"
              placeholder="Edit document content..."
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select or create a document to open the editor.
          </div>
        )}
      </div>
    </div>
  );
};
