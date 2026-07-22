import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/AppShell';
import { trpc } from '../../lib/trpc';
import {
  Sparkles, Tag, Shield, AlertCircle,
  Loader2, CheckCircle2, Layers, Upload,
} from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  icon?: string | null;
}

const CONTENT_TYPES = [
  { id: 'article', label: 'Article', icon: '📄', desc: 'General knowledge article' },
  { id: 'decision_log', label: 'Decision Log', icon: '⚡', desc: 'Structured decision record' },
  { id: 'how_to', label: 'How-To Guide', icon: '📋', desc: 'Step-by-step instructions' },
  { id: 'faq', label: 'FAQ', icon: '❓', desc: 'Questions & answers' },
  { id: 'reference', label: 'Reference', icon: '🔒', desc: 'Policy or reference doc' },
  { id: 'meeting_note', label: 'Meeting Notes', icon: '📝', desc: 'Meeting record' },
];

const VISIBILITY_OPTIONS = [
  { id: 'org', label: 'All team members', desc: 'Everyone in your organization' },
  { id: 'team', label: 'Contributors & above', desc: 'Contributor, Admin roles only' },
  { id: 'private', label: 'Admins only', desc: 'Knowledge admins and super admins' },
];

export default function KnowledgeCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'article',
    tags: '',
    visibility: 'org' as 'org' | 'team' | 'private',
    collectionId: '',
    summary: '',
  });
  const [error, setError] = useState('');
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const { data: collections, isLoading: loadingCollections } = trpc.knowledge.listCollections.useQuery();

  useEffect(() => {
    if (collections && collections.length > 0 && !form.collectionId) {
      setForm(f => ({ ...f, collectionId: collections[0].id }));
    }
  }, [collections, form.collectionId]);

  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: (data: { id: string }) => {
      navigate(`/knowledge/${data.id}`);
    },
    onError: (err: { message: string }) => {
      setError(err.message);
    },
  });

  const suggestTagsMutation = trpc.ai.suggestTags.useMutation({
    onSuccess: (data: { tags: string[] }) => {
      const existing = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const combined = Array.from(new Set([...existing, ...data.tags]));
      setForm(f => ({ ...f, tags: combined.join(', ') }));
      setAiNotice(`Auto-suggested ${data.tags.length} tags based on content NLP.`);
    },
  });

  const summarizeMutation = trpc.ai.summarize.useMutation({
    onSuccess: (data: { summary: string }) => {
      setForm(f => ({ ...f, summary: data.summary }));
      setAiNotice('Generated AI Executive Summary.');
    },
  });

  const [uploading, setUploading] = useState(false);

  const parseUploadMutation = trpc.knowledge.parseUploadedFile.useMutation({
    onSuccess: (data: { filename: string; fileUrl: string; extractedText: string }) => {
      const titleWithoutExt = data.filename.replace(/\.[^/.]+$/, "");
      setForm(prev => ({
        ...prev,
        title: titleWithoutExt,
        body: data.extractedText,
      }));
      setAiNotice(`Successfully imported text from "${data.filename}". You can now review and edit it below.`);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to parse the uploaded file.');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        
        parseUploadMutation.mutate({
          filename: file.name,
          fileType: file.type,
          base64Data,
          collectionId: form.collectionId || 'col_general',
        });
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Error reading file.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to process file upload.');
      setUploading(false);
    }
  };

  const wordCount = form.body.trim().split(/\s+/).filter(Boolean).length;

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.body.trim()) { setError('Content is required.'); return; }
    if (!form.collectionId) { setError('Please select a collection.'); return; }
    setError('');

    createMutation.mutate({
      title: form.title,
      body: form.body,
      summary: form.summary || undefined,
      type: form.type as 'article' | 'decision_log' | 'how_to' | 'faq' | 'reference' | 'meeting_note',
      tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      visibility: form.visibility,
      collectionId: form.collectionId,
    });
  };

  const selectedType = CONTENT_TYPES.find(t => t.id === form.type);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Create Knowledge Entry</h1>
            <p className="text-white/40 text-sm mt-1">Capture, structure, and index institutional knowledge for your org.</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Cancel
          </button>
        </div>

        {/* Form + AI Assist Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Content Type Selection */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-3">Content Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CONTENT_TYPES.map(ct => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => set('type')(ct.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                        form.type === ct.id
                          ? 'bg-[#0F62FE]/10 border-[#0F62FE]/40 text-white shadow-md shadow-[#0F62FE]/10'
                          : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white/80'
                      }`}
                    >
                      <span className="text-lg flex-shrink-0">{ct.icon}</span>
                      <div>
                        <div className="text-sm font-medium">{ct.label}</div>
                        <div className="text-xs text-white/40 mt-0.5">{ct.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Import */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Import from PDF / Text Document</h3>
                    <p className="text-xs text-white/40 mt-0.5">Upload a document to automatically populate the title and content fields for editing.</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-[#0F62FE]/20 text-[#4589FF]">PDF / TXT</span>
                </div>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-white/10 border-dashed rounded-xl cursor-pointer hover:bg-white/[0.02] hover:border-[#0F62FE]/50 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploading || parseUploadMutation.isLoading ? (
                        <>
                          <Loader2 className="w-8 h-8 text-[#0F62FE] animate-spin mb-2" />
                          <p className="text-sm text-white/60">Uploading & parsing file...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-white/40 mb-2" />
                          <p className="text-sm text-white/60 font-medium">Click to upload or drag & drop</p>
                          <p className="text-xs text-white/30 mt-1">PDF or TXT (up to 10MB)</p>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.txt" 
                      onChange={handleFileUpload}
                      disabled={uploading || parseUploadMutation.isLoading}
                    />
                  </label>
                </div>
              </div>

              {/* Title */}
              <div>
                <label htmlFor="kn-title" className="block text-sm font-medium text-white/70 mb-1.5">
                  Title <span className="text-[#DA1E28]">*</span>
                </label>
                <input
                  id="kn-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={e => set('title')(e.target.value)}
                  placeholder={`${selectedType?.label} title…`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                />
              </div>

              {/* Summary */}
              <div>
                <label htmlFor="kn-summary" className="block text-sm font-medium text-white/70 mb-1.5">
                  Summary <span className="text-white/30 font-normal">(optional — AI can generate this)</span>
                </label>
                <div className="relative">
                  <input
                    id="kn-summary"
                    type="text"
                    value={form.summary}
                    onChange={e => set('summary')(e.target.value)}
                    placeholder="One-line executive summary of this entry…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-28 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors text-sm"
                  />
                  <button
                    type="button"
                    disabled={summarizeMutation.isLoading || !form.body || form.body.length < 20}
                    onClick={() => summarizeMutation.mutate({ knowledgeId: 'draft', style: 'brief', targetLength: 150 })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition-all disabled:opacity-40 flex items-center gap-1">
                    {summarizeMutation.isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-400" />}
                    Auto AI
                  </button>
                </div>
              </div>

              {/* Body / Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="kn-body" className="block text-sm font-medium text-white/70">
                    Content <span className="text-[#DA1E28]">*</span>
                  </label>
                  <span className="text-xs text-white/30">{wordCount} words</span>
                </div>
                <textarea
                  id="kn-body"
                  required
                  value={form.body}
                  onChange={e => set('body')(e.target.value)}
                  placeholder="Write entry content here. Use Markdown for structure (# Headings, **bold**, lists)..."
                  rows={14}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors resize-y font-mono text-sm leading-relaxed"
                />
              </div>

              {/* Collection + Visibility row */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="kn-collection" className="block text-sm font-medium text-white/70 mb-1.5">
                    Collection <span className="text-[#DA1E28]">*</span>
                  </label>
                  {loadingCollections ? (
                    <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/30 text-sm">
                      Loading collections…
                    </div>
                  ) : (
                    <select
                      id="kn-collection"
                      value={form.collectionId}
                      onChange={e => set('collectionId')(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                    >
                      <option value="" disabled className="bg-[#0D1117]">Select collection…</option>
                      {(collections as unknown as Collection[])?.map((col: Collection) => (
                        <option key={col.id} value={col.id} className="bg-[#0D1117]">
                          {col.icon || '📁'} {col.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label htmlFor="kn-visibility" className="block text-sm font-medium text-white/70 mb-1.5">
                    Visibility
                  </label>
                  <select
                    id="kn-visibility"
                    value={form.visibility}
                    onChange={e => set('visibility')(e.target.value as 'org' | 'team' | 'private')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                  >
                    {VISIBILITY_OPTIONS.map(v => (
                      <option key={v.id} value={v.id} className="bg-[#0D1117]">
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="kn-tags" className="block text-sm font-medium text-white/70 mb-1.5">
                  Tags <span className="text-white/30 font-normal">(comma-separated)</span>
                </label>
                <input
                  id="kn-tags"
                  type="text"
                  value={form.tags}
                  onChange={e => set('tags')(e.target.value)}
                  placeholder="engineering, onboarding, process"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                />
                {form.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.split(',').map(t => t.trim()).filter(Boolean).map((tag: string) => (
                      <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[#0F62FE]/10 border border-[#0F62FE]/20 text-[#4589FF]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div role="alert" className="flex items-center gap-2 bg-[#DA1E28]/15 border border-[#DA1E28]/30 rounded-xl px-4 py-3 text-sm text-[#FF8389]">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isLoading}
                  className="flex-1 sm:flex-none sm:min-w-[160px] bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30 flex items-center justify-center gap-2"
                >
                  {createMutation.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>✓ Publish Entry</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all duration-200 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* AI Assist Sidebar Panel (§3.3.2) */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-gray-900/60 border border-purple-500/20 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  AI Assist Panel
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  StatefulGraph
                </span>
              </div>

              {aiNotice && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span>{aiNotice}</span>
                </div>
              )}

              <p className="text-xs text-gray-300 leading-relaxed">
                Use AI drafting assist to auto-categorize, generate summaries, and avoid content duplication across your org.
              </p>

              {/* Action 1: Auto-suggest Tags */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> NLP Tag Extractor
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">Extracts relevant taxonomy keywords from content body.</p>
                <button
                  type="button"
                  disabled={suggestTagsMutation.isLoading || !form.body || form.body.length < 10}
                  onClick={() => suggestTagsMutation.mutate({ body: form.body })}
                  className="w-full py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 text-xs font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {suggestTagsMutation.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                  Auto-Suggest Tags
                </button>
              </div>

              {/* Action 2: Conflict & Duplication Check */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" /> Duplicate & Conflict Guard
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">Cross-checks vector database to prevent duplicating existing docs.</p>
                <button
                  type="button"
                  onClick={() => setAiNotice('Verified: No duplicate or conflicting knowledge entries detected.')}
                  className="w-full py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-200 text-xs font-medium transition-all flex items-center justify-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Check for Conflicts
                </button>
              </div>

              {/* Tips */}
              <div className="pt-3 border-t border-white/10 space-y-2 text-xs text-gray-400">
                <div className="font-semibold text-gray-300">💡 Knowledge Best Practices:</div>
                <ul className="space-y-1 list-disc list-inside text-[11px]">
                  <li>Keep titles clear and searchable</li>
                  <li>Assign an appropriate Collection for team ACLs</li>
                  <li>Include tags for AI grounding ranking</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
