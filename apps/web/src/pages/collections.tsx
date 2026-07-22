import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import AppShell from '../components/AppShell';
import {
  FolderPlus, Search, Grid3X3, List, BookOpen,
  Users, TrendingUp, ChevronRight, Loader2, AlertCircle, X, Plus,
} from 'lucide-react';

const COLLECTION_ICONS = ['📁', '📊', '🔧', '💡', '🔒', '📋', '🎯', '🌐', '🏗️', '🤝', '📈', '🧪'];
const COLLECTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
];

interface NewCollectionForm {
  name: string;
  description: string;
  icon: string;
  color: string;
  visibility: 'org' | 'team' | 'private';
}

export default function CollectionsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState<NewCollectionForm>({
    name: '',
    description: '',
    icon: '📁',
    color: '#6366f1',
    visibility: 'org',
  });
  const [formError, setFormError] = useState('');

  const { data: collections, isLoading, isError, refetch } = trpc.knowledge.listCollections.useQuery();

  const createMutation = trpc.knowledge.createCollection.useMutation({
    onSuccess: () => {
      setShowNewModal(false);
      setForm({ name: '', description: '', icon: '📁', color: '#6366f1', visibility: 'org' });
      refetch();
    },
    onError: (err: { message: string }) => setFormError(err.message),
  });

  const filtered = (collections ?? []).filter((c: { name: string; description?: string | null }) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setFormError('Collection name must be at least 2 characters.');
      return;
    }
    setFormError('');
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description,
      icon: form.icon,
      color: form.color,
      visibility: form.visibility,
    });
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
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

  if (isError) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-96 gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-300 text-lg">Failed to load collections.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Collections</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Organize your knowledge into curated collections.
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30">
            <FolderPlus className="w-4 h-4" />
            New Collection
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search collections…"
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Collections', value: collections?.length ?? 0, icon: <FolderPlus className="w-4 h-4" /> },
            { label: 'Total Entries', value: (collections ?? []).reduce((sum: number, c: { stats: unknown }) => sum + (c.stats as { entryCount: number }).entryCount, 0), icon: <BookOpen className="w-4 h-4" /> },
            { label: 'Public Collections', value: (collections ?? []).filter((c: { visibility: string }) => c.visibility === 'org').length, icon: <Users className="w-4 h-4" /> },
          ].map((stat: { label: string; value: number; icon: React.ReactNode }) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl">📁</div>
            <h3 className="text-xl font-semibold text-white">
              {searchQuery ? 'No collections match your search' : 'No collections yet'}
            </h3>
            <p className="text-gray-400 text-sm text-center max-w-xs">
              {searchQuery
                ? `Try a different search term.`
                : 'Create your first collection to start organizing knowledge.'}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all mt-2">
                <Plus className="w-4 h-4" /> Create Collection
              </button>
            )}
          </div>
        )}

        {/* Grid view */}
        {filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((col: { id: string; name: string; description?: string | null; icon?: string | null; color?: string | null; visibility: string; stats: unknown }) => {
              const stats = col.stats as { entryCount: number; viewsLast30Days: number; healthScore: number };
              return (
                <div
                  key={col.id}
                  onClick={() => navigate(`/search?collection=${col.id}`)}
                  className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/8 transition-all cursor-pointer relative overflow-hidden">
                  {/* Color accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ backgroundColor: col.color || '#6366f1' }} />

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${col.color || '#6366f1'}20`, border: `1px solid ${col.color || '#6366f1'}40` }}>
                      {col.icon || '📁'}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors mt-1" />
                  </div>

                  <h3 className="text-base font-semibold text-white mb-1 truncate">{col.name}</h3>
                  {col.description && (
                    <p className="text-xs text-gray-400 mb-4 line-clamp-2">{col.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      {stats.entryCount} entries
                    </span>
                    <span className={`flex items-center gap-1 font-medium ${getHealthColor(stats.healthScore)}`}>
                      <TrendingUp className="w-3 h-3" />
                      {stats.healthScore}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${col.visibility === 'org' ? 'bg-emerald-500/15 text-emerald-400' :
                        col.visibility === 'team' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-gray-500/15 text-gray-400'}`}>
                      {col.visibility === 'org' ? '🌐 Org' : col.visibility === 'team' ? '👥 Team' : '🔒 Private'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List view */}
        {filtered.length > 0 && viewMode === 'list' && (
          <div className="space-y-2">
            {filtered.map((col: { id: string; name: string; description?: string | null; icon?: string | null; color?: string | null; visibility: string; stats: unknown }) => {
              const stats = col.stats as { entryCount: number; viewsLast30Days: number; healthScore: number };
              return (
                <div
                  key={col.id}
                  onClick={() => navigate(`/search?collection=${col.id}`)}
                  className="group flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl px-5 py-4 hover:border-white/20 hover:bg-white/8 transition-all cursor-pointer">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${col.color || '#6366f1'}20` }}>
                    {col.icon || '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{col.name}</h3>
                    {col.description && <p className="text-xs text-gray-400 truncate">{col.description}</p>}
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-400 flex-shrink-0">
                    <span>{stats.entryCount} entries</span>
                    <span className={getHealthColor(stats.healthScore)}>{stats.healthScore}% health</span>
                    <span className="capitalize">{col.visibility}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Collection Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">New Collection</h3>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. Engineering Docs"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors resize-none"
                  placeholder="Short description…"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {COLLECTION_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setForm(p => ({ ...p, icon }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all
                        ${form.icon === icon ? 'bg-indigo-500/30 border-2 border-indigo-500' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Color</label>
                <div className="flex gap-2">
                  {COLLECTION_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setForm(p => ({ ...p, color }))}
                      className={`w-7 h-7 rounded-full transition-all ${form.color === color ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Visibility</label>
                <select
                  value={form.visibility}
                  onChange={e => setForm(p => ({ ...p, visibility: e.target.value as 'org' | 'team' | 'private' }))}
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none focus:border-indigo-500 transition-colors">
                  <option value="org">🌐 Organization</option>
                  <option value="team">👥 Team</option>
                  <option value="private">🔒 Private</option>
                </select>
              </div>

              {formError && (
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {formError}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 transition-all text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleCreate}
                disabled={createMutation.isLoading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-sm font-medium disabled:opacity-60">
                {createMutation.isLoading ? 'Creating…' : 'Create Collection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
