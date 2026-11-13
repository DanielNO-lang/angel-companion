import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Search,
  Plus,
  Tag,
  Trash2,
  Edit2,
  Check,
  X,
  Folder,
  Upload,
  Link,
  Code2,
  Bookmark,
  FileSpreadsheet,
  Image,
  FileCode,
  Download,
  Eye,
  Sparkles,
  Layers,
  Clapperboard,
} from 'lucide-react';
import { libraryService, LibraryItem, LibraryCategory } from '../../services/libraryService';
import { workspaceEngine, WorkspaceProject } from '../../services/workspaceEngine';
import { APPROVED_EIGHT_STUDIOS } from '../../services/studiosEngine';
import { StudioId } from '../../types/angel';

export const LibraryPage: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>(() => libraryService.getItems());
  const [selectedCategory, setSelectedCategory] = useState<LibraryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudioFilter, setSelectedStudioFilter] = useState<StudioId | 'all'>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | 'all'>('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [linkModalItem, setLinkModalItem] = useState<LibraryItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<LibraryCategory>('documents');
  const [tagsInput, setTagsInput] = useState('');
  const [collection, setCollection] = useState('');
  const [targetStudioId, setTargetStudioId] = useState<StudioId | 'none'>('none');
  const [targetProjectId, setTargetProjectId] = useState<string | 'none'>('none');

  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const projects = workspaceEngine.getProjects();

  const refreshList = () => {
    const cat = selectedCategory === 'all' ? undefined : selectedCategory;
    const stId = selectedStudioFilter === 'all' ? undefined : selectedStudioFilter;
    const pId = selectedProjectFilter === 'all' ? undefined : selectedProjectFilter;
    setItems(libraryService.searchItems(searchQuery, cat, stId, pId));
  };

  useEffect(() => {
    refreshList();
  }, [selectedCategory, searchQuery, selectedStudioFilter, selectedProjectFilter]);

  const handleOpenCreate = (editing?: LibraryItem) => {
    if (editing) {
      setEditingId(editing.id);
      setName(editing.name);
      setDescription(editing.description || '');
      setContent(editing.content);
      setType(editing.type);
      setTagsInput(editing.tags.join(', '));
      setCollection(editing.collection || '');
      setTargetStudioId(editing.studioId || 'none');
      setTargetProjectId(editing.projectId || 'none');
    } else {
      setEditingId(null);
      setName('');
      setDescription('');
      setContent('');
      setType(selectedCategory === 'all' ? 'documents' : selectedCategory);
      setTagsInput('');
      setCollection('General Collection');
      setTargetStudioId('none');
      setTargetProjectId('none');
    }
    setShowCreateModal(true);
  };

  const handleSaveItem = () => {
    if (!name.trim() || !content.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const studioIdVal = targetStudioId === 'none' ? undefined : targetStudioId;
    const projectIdVal = targetProjectId === 'none' ? undefined : targetProjectId;

    if (editingId) {
      libraryService.updateItem(editingId, {
        name: name.trim(),
        description: description.trim(),
        content,
        type,
        tags,
        collection: collection.trim() || 'General Collection',
        studioId: studioIdVal,
        projectId: projectIdVal,
      });
    } else {
      libraryService.addItem({
        name: name.trim(),
        description: description.trim() || `Stored in ${collection.trim() || 'General Collection'}`,
        content,
        type,
        tags,
        collection: collection.trim() || 'General Collection',
        studioId: studioIdVal,
        projectId: projectIdVal,
      });
    }

    setShowCreateModal(false);
    refreshList();
  };

  const handleDeleteItem = (id: string) => {
    libraryService.deleteItem(id);
    refreshList();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || '';
        libraryService.uploadFile({
          name: file.name,
          content: textContent,
          size: file.size,
          mimeType: file.type || 'text/plain',
          tags: ['upload', file.name.split('.').pop() || 'file'],
          collection: 'Uploaded Assets',
        });
        setUploadNotice(`Uploaded "${file.name}" to Library`);
        setTimeout(() => setUploadNotice(null), 3000);
        refreshList();
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const handleDownload = (item: LibraryItem) => {
    const blob = new Blob([item.content], { type: item.mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories: { id: LibraryCategory | 'all'; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All Resources', icon: BookOpen },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'knowledge', label: 'Knowledge & Notes', icon: Sparkles },
    { id: 'references', label: 'Research References', icon: Link },
    { id: 'media', label: 'Images, Audio & Video', icon: Image },
    { id: 'code', label: 'Code & Technical', icon: FileCode },
    { id: 'bookmarks', label: 'Saved Links & Bookmarks', icon: Bookmark },
    { id: 'templates', label: 'Templates & Prompts', icon: Layers },
    { id: 'other', label: 'Other', icon: Folder },
  ];

  const getTypeIcon = (itemType: LibraryCategory) => {
    switch (itemType) {
      case 'documents': return FileText;
      case 'knowledge': return Sparkles;
      case 'references': return Link;
      case 'media': return Image;
      case 'code': return FileCode;
      case 'bookmarks': return Bookmark;
      case 'templates': return Layers;
      default: return Folder;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notice Banner */}
      {uploadNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-950/95 border border-cyan-400/50 text-cyan-200 text-xs font-semibold shadow-[0_0_25px_rgba(56,189,248,0.5)] backdrop-blur-xl">
          {uploadNotice}
        </div>
      )}

      {/* Main Page Header - Heading simply: LIBRARY (no decorative icons on heading) */}
      <div className="rounded-3xl glass-panel-glow border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-white">LIBRARY</h2>
          <p className="text-xs text-slate-400 mt-1">
            Central repository for reusable knowledge records, reference materials, documents, code assets, and media.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition-all shadow-md">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload File</span>
            <input type="file" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar: Categories, Studio/Project Scope & Search */}
      <div className="rounded-3xl glass-panel border border-indigo-500/30 bg-slate-950/40 backdrop-blur-2xl p-4 space-y-4">
        {/* Category Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input & Association Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library resources by title, content, or tags..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400/50"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedStudioFilter}
              onChange={(e) => setSelectedStudioFilter(e.target.value as any)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Studios</option>
              {APPROVED_EIGHT_STUDIOS.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Workspace Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Library Resources Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const Icon = getTypeIcon(item.type);
            const linkedStudio = APPROVED_EIGHT_STUDIOS.find((s) => s.id === item.studioId);
            const linkedProject = projects.find((p) => p.id === item.projectId);

            return (
              <div
                key={item.id}
                className="rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 backdrop-blur-2xl p-5 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-all group shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                          {item.type}
                        </span>
                        <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white transition-colors cursor-pointer"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenCreate(item)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {item.description || item.content.slice(0, 100)}
                  </p>

                  {/* Association Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {linkedStudio && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-semibold flex items-center gap-1">
                        <Clapperboard className="w-3 h-3" />
                        <span>{linkedStudio.name}</span>
                      </span>
                    )}
                    {linkedProject && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-semibold flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        <span>{linkedProject.name}</span>
                      </span>
                    )}
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-slate-500" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 border-t border-slate-900">
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => setLinkModalItem(item)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Link className="w-3 h-3" />
                    <span>Manage Links</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 rounded-3xl glass-panel border border-indigo-500/20 bg-slate-950/40 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Library Resources Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No resources match your active filter criteria. Click "Add Resource" or "Upload File" to register items in the central Library.
          </p>
        </div>
      )}

      {/* Resource Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl glass-panel border border-cyan-500/30 bg-[#090e26] p-6 space-y-4 max-h-[85vh] flex flex-col justify-between shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">{previewItem.name}</h3>
                  <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold">
                    {previewItem.type}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-200">
              <pre className="whitespace-pre-wrap leading-relaxed">{previewItem.content}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Updated: {new Date(previewItem.updatedAt).toLocaleString()}</span>
              </div>
              <button
                onClick={() => handleDownload(previewItem)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl glass-panel border border-indigo-500/30 bg-[#090e26] p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white font-heading">
                {editingId ? 'Edit Library Resource' : 'Add New Library Resource'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Title / Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Resource title..."
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Category / Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as LibraryCategory)}
                    className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                  >
                    <option value="documents">Documents</option>
                    <option value="knowledge">Knowledge & Notes</option>
                    <option value="references">Research References</option>
                    <option value="media">Images, Audio & Video</option>
                    <option value="code">Code & Technical</option>
                    <option value="bookmarks">Saved Links & Bookmarks</option>
                    <option value="templates">Templates & Prompts</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Collection / Folder</label>
                  <input
                    type="text"
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                    placeholder="General Collection"
                    className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary of this resource..."
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Content / Body *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  placeholder="Resource body text, code snippet, notes, or reference details..."
                  className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-400 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="research, quantum, notes..."
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Link to Studio (Optional)</label>
                  <select
                    value={targetStudioId}
                    onChange={(e) => setTargetStudioId(e.target.value as any)}
                    className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                  >
                    <option value="none">None (Universal)</option>
                    {APPROVED_EIGHT_STUDIOS.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Link to Project (Optional)</label>
                  <select
                    value={targetProjectId}
                    onChange={(e) => setTargetProjectId(e.target.value)}
                    className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                  >
                    <option value="none">None (Independent)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {editingId ? 'Save Changes' : 'Create Resource'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Management Modal */}
      {linkModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel border border-cyan-500/30 bg-[#090e26] p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-heading">
                Manage Resource Links: "{linkModalItem.name}"
              </h3>
              <button
                onClick={() => setLinkModalItem(null)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Associated Studio</label>
                <select
                  value={linkModalItem.studioId || 'none'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'none') {
                      libraryService.updateItem(linkModalItem.id, { studioId: undefined });
                    } else {
                      libraryService.linkToStudio(linkModalItem.id, val as StudioId);
                    }
                    setLinkModalItem({ ...linkModalItem, studioId: val === 'none' ? undefined : (val as StudioId) });
                    refreshList();
                  }}
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                >
                  <option value="none">None (Universal Access)</option>
                  {APPROVED_EIGHT_STUDIOS.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Associated Workspace Project</label>
                <select
                  value={linkModalItem.projectId || 'none'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'none') {
                      libraryService.updateItem(linkModalItem.id, { projectId: undefined });
                    } else {
                      libraryService.linkToProject(linkModalItem.id, val);
                    }
                    setLinkModalItem({ ...linkModalItem, projectId: val === 'none' ? undefined : val });
                    refreshList();
                  }}
                  className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-slate-200 focus:outline-none"
                >
                  <option value="none">None (Standalone Resource)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setLinkModalItem(null)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
