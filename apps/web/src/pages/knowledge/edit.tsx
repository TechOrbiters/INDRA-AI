import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import AppShell from '../../components/AppShell';
import {
  Save, Trash2, ArrowLeft, Clock, History, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Tag, Loader2,
} from 'lucide-react';

type EntryType = 'article' | 'decision_log' | 'how_to' | 'faq' | 'reference' | 'meeting_note';
type Visibility = 'org' | 'team' | 'private';
type Status = 'draft' | 'in_review' | 'published' | 'archived';

const TYPE_LABELS: Record<EntryType, string> = {
  article: '📄 Article',
  decision_log: '⚖️ Decision Log',
  how_to: '🔧 How-To Guide',
  faq: '❓ FAQ Entry',
  reference: '📚 Reference',
  meeting_note: '📝 Meeting Note',
};

export default function KnowledgeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch the existing entry
  const { data: entry, isLoading, isError } = trpc.knowledge.get.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  // Fetch version history
  const { data: versionData } = trpc.knowledge.getVersions.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  // Fetch collections for the dropdown
  const { data: collections } = trpc.knowledge.listCollections.useQuery();

  // Update and delete mutations
  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      setToast({ type: 'success', message: 'Entry updated successfully.' });
      setTimeout(() => navigate(`/knowledge/${id}`), 1200);
    },
    onError: (err: { message: string }) => setToast({ type: 'error', message: err.message }),
  });

  const deleteMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => navigate('/dashboard'),
    onError: (err: { message: string }) => setToast({ type: 'error', message: err.message }),
  });

  // AI tag suggestions
  const suggestTagsMutation = trpc.ai.suggestTags.useMutation({
    onSuccess: (data: { tags: string[] }) => {
      setTags(prev => [...new Set([...prev, ...data.tags])]);
      setToast({ type: 'success', message: `${data.tags.length} tags suggested by AI.` });
    },
  });

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [type, setType] = useState<EntryType>('article');
  const [visibility, setVisibility] = useState<Visibility>('org');
  const [status, setStatus] = useState<Status>('published');
  const [collectionId, setCollectionId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Populate form when entry loads
  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setBody(entry.body);
      setSummary(entry.summary);
      setType(entry.type as EntryType);
      setVisibility(entry.visibility as Visibility);
      setStatus(entry.status as Status);
      setCollectionId(entry.collectionId);
      setTags(entry.tags as string[]);
    }
  }, [entry]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleSave = () => {
    if (!title.trim()) {
      setToast({ type: 'error', message: 'Title is required.' });
      return;
    }
    updateMutation.mutate({
      id: id!,
      title,
      body,
      summary,
      type,
      visibility,
      status,
      collectionId,
      tags,
      editSummary: editSummary || 'Updated via editor',
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: id! });
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-96">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </AppShell>
    );
  }

  if (isError || !entry) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-300 text-lg">Knowledge entry not found.</p>
          <button onClick={() => navigate(-1)} className="text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Go back
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all
          ${toast.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/knowledge/${id}`)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Edit Entry</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                v{entry.version} · Last edited by {entry.authorId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-sm font-medium border border-red-500/20">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/20">
              {updateMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-5">
            {/* Title */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-transparent text-white text-lg font-semibold placeholder-gray-500 outline-none border-b border-white/10 pb-2 focus:border-indigo-500 transition-colors"
                placeholder="Entry title…"
              />
            </div>

            {/* Summary */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">Summary</label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={2}
                className="w-full bg-transparent text-gray-300 placeholder-gray-500 outline-none resize-none text-sm"
                placeholder="Short description of this entry…"
              />
            </div>

            {/* Body */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={14}
                className="w-full bg-transparent text-gray-200 placeholder-gray-500 outline-none resize-none font-mono text-sm leading-relaxed"
                placeholder="Write your knowledge entry content here…"
              />
            </div>

            {/* Edit summary */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Edit Summary <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                value={editSummary}
                onChange={e => setEditSummary(e.target.value)}
                className="w-full bg-transparent text-gray-300 placeholder-gray-500 outline-none text-sm border-b border-white/10 pb-1 focus:border-indigo-500 transition-colors"
                placeholder="Brief description of what changed…"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Entry type */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <label className="block text-sm font-medium text-gray-300 mb-3">Entry Type</label>
              <div className="space-y-2">
                {(Object.keys(TYPE_LABELS) as EntryType[]).map((t: EntryType) => (
                  <label key={t} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all
                    ${type === t ? 'bg-indigo-500/20 border border-indigo-500/40' : 'hover:bg-white/5'}`}>
                    <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="hidden" />
                    <span className="text-sm text-gray-200">{TYPE_LABELS[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Visibility + Status */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Visibility</label>
                <select value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}
                  className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 transition-colors">
                  <option value="org">🌐 Organization</option>
                  <option value="team">👥 Team</option>
                  <option value="private">🔒 Private</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as Status)}
                  className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 transition-colors">
                  <option value="draft">📝 Draft</option>
                  <option value="in_review">🔍 In Review</option>
                  <option value="published">✅ Published</option>
                  <option value="archived">📦 Archived</option>
                </select>
              </div>
              {collections && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Collection</label>
                  <select value={collectionId} onChange={e => setCollectionId(e.target.value)}
                    className="w-full bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 transition-colors">
                    {collections.map((c: { id: string; name: string }) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Tags
                </label>
                <button onClick={() => suggestTagsMutation.mutate({ body })}
                  disabled={suggestTagsMutation.isLoading || body.length < 10}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40">
                  {suggestTagsMutation.isLoading ? 'Suggesting…' : '✦ AI Suggest'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-xs text-indigo-300">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-500 outline-none border-b border-white/10 pb-1 focus:border-indigo-500 transition-colors"
                  placeholder="Add a tag…"
                />
                <button onClick={handleAddTag} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Add</button>
              </div>
            </div>

            {/* Version History */}
            {versionData && versionData.versions.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <button
                  onClick={() => setShowVersions(prev => !prev)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  <span className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Version History ({versionData.versions.length})
                  </span>
                  {showVersions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showVersions && (
                  <div className="mt-4 space-y-3">
                    {[...versionData.versions].reverse().map(v => (
                      <div key={v.version} className="flex items-start gap-3 text-xs">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center flex-shrink-0 font-mono">
                          {v.version}
                        </span>
                        <div>
                          <p className="text-gray-300 font-medium">{v.summary}</p>
                          <p className="text-gray-500">{v.editedBy} · {new Date(v.editedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Entry</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              This entry will be soft-deleted and moved to archive. It can be recovered within 30 days.
              Are you sure you want to delete <strong className="text-gray-200">"{entry.title}"</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all text-sm font-medium disabled:opacity-60">
                {deleteMutation.isLoading ? 'Deleting…' : 'Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
