import React, { useState } from 'react';
import { BookOpen, Search, Plus, Tag, Trash2, Edit2, Check, X, Folder } from 'lucide-react';
import { memoryEngine, KnowledgeItem } from '../../services/memoryEngine';
import { StudioId } from '../../types/angel';

export const KnowledgeLibraryManager: React.FC = () => {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>(() => memoryEngine.getKnowledgeList());
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Research & Docs');
  const [tagInput, setTagInput] = useState('');
  const [selectedStudio, setSelectedStudio] = useState<StudioId | 'general'>('general');
  const [projectName, setProjectName] = useState('');

  const refreshList = () => {
    if (searchQuery.trim()) {
      setKnowledgeList(memoryEngine.searchKnowledge(searchQuery));
    } else {
      setKnowledgeList(memoryEngine.getKnowledgeList());
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setKnowledgeList(memoryEngine.getKnowledgeList());
    } else {
      setKnowledgeList(memoryEngine.searchKnowledge(q));
    }
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingId) {
      memoryEngine.updateKnowledge(editingId, {
        title,
        content,
        category,
        tags,
        studioId: selectedStudio === 'general' ? undefined : selectedStudio,
        projectId: projectName.trim() ? projectName.trim() : undefined,
      });
      setEditingId(null);
    } else {
      memoryEngine.saveKnowledge({
        title,
        content,
        category,
        tags,
        studioId: selectedStudio === 'general' ? undefined : selectedStudio,
        projectId: projectName.trim() ? projectName.trim() : undefined,
      });
    }

    setTitle('');
    setContent('');
    setTagInput('');
    setSelectedStudio('general');
    setProjectName('');
    setShowCreateModal(false);
    refreshList();
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setTagInput(item.tags.join(', '));
    setSelectedStudio(item.studioId || 'general');
    setProjectName(item.projectId || '');
    setShowCreateModal(true);
  };

  const handleDelete = (id: string) => {
    memoryEngine.deleteKnowledge(id);
    refreshList();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-heading text-white">Knowledge Library & Notes</h2>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search knowledge items..."
              className="w-full bg-slate-900 pl-9 pr-3 py-2 rounded-2xl text-xs text-white border border-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              setEditingId(null);
              setTitle('');
              setContent('');
              setTagInput('');
              setSelectedStudio('general');
              setProjectName('');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Knowledge</span>
          </button>
        </div>
      </div>

      {/* Create / Edit Knowledge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-950 border border-indigo-500/40 shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-heading">
                {editingId ? 'Edit Knowledge Record' : 'Create New Knowledge Record'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Knowledge title..."
                  className="w-full bg-slate-900 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category (e.g. Engineering Reference)..."
                  className="w-full bg-slate-900 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Content & Details</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Detailed explanation, notes, findings..."
                  className="w-full bg-slate-900 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Studio Scope</label>
                  <select
                    value={selectedStudio}
                    onChange={(e) => setSelectedStudio(e.target.value as any)}
                    className="w-full bg-slate-900 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
                  >
                    <option value="general">Universal (All Studios)</option>
                    <option value="research-studio">Research Studio</option>
                    <option value="development-studio">Development Studio</option>
                    <option value="creative-studio">Creative Studio</option>
                    <option value="learning-education-studio">Learning & Education</option>
                    <option value="professional-intelligence-studio">Professional Intelligence</option>
                    <option value="personal-life-studio">Personal Life</option>
                    <option value="agent-automation-studio">Agent & Automation</option>
                    <option value="device-environment-studio">Device & Environment</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Project Assignment</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project name (optional)..."
                    className="w-full bg-slate-900 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="react, typescript, architecture..."
                  className="w-full bg-slate-900 px-3 py-2 rounded-xl text-xs text-white border border-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {editingId ? 'Save Changes' : 'Create Knowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {knowledgeList.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl flex flex-col justify-between shadow-lg relative group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
                  {item.category}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-300 hover:text-rose-300"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-3 line-clamp-3">{item.content}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-900">
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{item.studioId ? `Studio: ${item.studioId}` : 'Universal'}</span>
                {item.projectId && <span className="flex items-center gap-1"><Folder className="w-2.5 h-2.5" />{item.projectId}</span>}
              </div>
            </div>
          </div>
        ))}

        {knowledgeList.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            No knowledge items found. Click "Add Knowledge" to create one.
          </div>
        )}
      </div>
    </div>
  );
};
