import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../../components/AppShell';
import { trpcClient } from '../../utils/trpc';

interface KnowledgeEntry {
  id: string;
  title: string;
  summary: string;
  body: string;
  type: string;
  status: string;
  visibility: string;
  tags: string[];
  aiTags: string[];
  authorId: string;
  aiConfidence?: number;
  healthScore?: number;
  viewCount: number;
  bookmarkCount: number;
  feedbackPositive: number;
  feedbackNegative: number;
  version: number;
  versionHistory: { version: number; editedBy: string; editedAt: string; summary: string }[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  article: '📄 Article',
  decision_log: '⚡ Decision Log',
  how_to: '📋 How-To',
  faq: '❓ FAQ',
  reference: '🔒 Reference',
  meeting_note: '📝 Meeting Notes',
};

const TYPE_COLORS: Record<string, string> = {
  article: '#0F62FE',
  decision_log: '#F1C21B',
  how_to: '#24A148',
  faq: '#8A3FFC',
  reference: '#DA1E28',
  meeting_note: '#0F62FE',
};

function formatBody(body: string): string {
  // Support basic markdown-style formatting
  return body
    .split('\n')
    .map(line => {
      if (line.startsWith('### '))
        return `<h3 class="text-lg font-bold text-white mt-6 mb-2">${line.slice(4)}</h3>`;
      if (line.startsWith('## '))
        return `<h2 class="text-xl font-bold text-white mt-8 mb-3">${line.slice(3)}</h2>`;
      if (line.startsWith('# '))
        return `<h1 class="text-2xl font-bold text-white mt-6 mb-4">${line.slice(2)}</h1>`;
      if (line.startsWith('- '))
        return `<li class="text-white/70 text-sm leading-relaxed ml-4 list-disc mb-1">${line.slice(2)}</li>`;
      if (line.match(/^\d+\. /))
        return `<li class="text-white/70 text-sm leading-relaxed ml-4 list-decimal mb-1">${line.replace(/^\d+\. /, '')}</li>`;
      const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                            .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-[#8A3FFC]">$1</code>');
      if (formatted.trim())
        return `<p class="text-white/70 text-sm leading-relaxed mb-2">${formatted}</p>`;
      return '<div class="h-2"></div>';
    })
    .join('');
}

export default function KnowledgeViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (trpcClient as any).knowledge.get.query({ id });
        setEntry(result);
      } catch {
        setError('Knowledge entry not found or you do not have permission to view it.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleBookmark = async () => {
    if (!entry) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).knowledge.bookmark.mutate({ id: entry.id });
      setBookmarked(true);
    } catch { /* silent */ }
  };

  const handleFeedback = async (positive: boolean) => {
    if (!entry || feedbackGiven) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).knowledge.feedback.mutate({ id: entry.id, positive });
      setFeedbackGiven(positive ? 'positive' : 'negative');
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[#0F62FE]/30 border-t-[#0F62FE] rounded-full animate-spin" />
            <div className="text-white/40 text-sm">Loading knowledge entry…</div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !entry) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-bold text-white mb-2">Entry Not Found</h1>
            <p className="text-white/50 text-sm mb-6">{error || 'This knowledge entry does not exist or you lack access.'}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-[#0F62FE] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0043CE] transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const typeColor = TYPE_COLORS[entry.type] || '#0F62FE';
  const confidencePercent = entry.aiConfidence ? Math.round(entry.aiConfidence * 100) : null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/40 mb-6">
          <button onClick={() => navigate('/dashboard')} className="hover:text-white/70 transition-colors">Dashboard</button>
          <span>/</span>
          <button onClick={() => navigate('/search')} className="hover:text-white/70 transition-colors">Knowledge</button>
          <span>/</span>
          <span className="text-white/60 truncate max-w-[200px]">{entry.title}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full border"
              style={{ color: typeColor, backgroundColor: `${typeColor}15`, borderColor: `${typeColor}30` }}
            >
              {TYPE_LABELS[entry.type] || entry.type}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              entry.status === 'published'
                ? 'bg-[#24A148]/15 text-[#24A148] border border-[#24A148]/30'
                : 'bg-white/5 text-white/40 border border-white/10'
            }`}>
              {entry.status}
            </span>
            {confidencePercent !== null && (
              <span className={`text-xs px-2.5 py-1 rounded-full border ${
                confidencePercent >= 72
                  ? 'bg-[#24A148]/10 text-[#24A148] border-[#24A148]/20'
                  : 'bg-[#F1C21B]/10 text-[#F1C21B] border-[#F1C21B]/20'
              }`}>
                ✦ {confidencePercent}% confidence
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white mb-3 leading-tight">{entry.title}</h1>

          {entry.summary && (
            <p className="text-white/60 text-base leading-relaxed mb-4">{entry.summary}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
            <span>👁 {entry.viewCount + 1} views</span>
            <span>🔖 {entry.bookmarkCount} bookmarks</span>
            <span>v{entry.version}</span>
            <span>Updated {new Date(entry.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {entry.tags.map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                  #{tag}
                </span>
              ))}
              {entry.aiTags.filter(t => !entry.tags.includes(t)).slice(0, 3).map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[#8A3FFC]/10 border border-[#8A3FFC]/20 text-[#8A3FFC]">
                  ✦ {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 mb-8">
          {/* If body contains HTML tags (from editor), render as HTML; otherwise parse as markdown */}
          {entry.body.includes('<') ? (
            <div
              className="prose prose-sm max-w-none text-white/70"
              dangerouslySetInnerHTML={{ __html: entry.body }}
            />
          ) : (
            <div
              className="max-w-none"
              dangerouslySetInnerHTML={{ __html: formatBody(entry.body) }}
            />
          )}
        </div>

        {/* Decision Log Metadata */}
        {entry.type === 'decision_log' && entry.metadata && Object.keys(entry.metadata).length > 0 && (
          <div className="bg-[#F1C21B]/5 border border-[#F1C21B]/20 rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-[#F1C21B] uppercase tracking-wider mb-4">Decision Record</h2>
            <div className="space-y-3">
              {(entry.metadata.context as string) && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Context</div>
                  <div className="text-sm text-white/70">{entry.metadata.context as string}</div>
                </div>
              )}
              {(entry.metadata.decision as string) && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Decision</div>
                  <div className="text-sm text-white font-medium">{entry.metadata.decision as string}</div>
                </div>
              )}
              {(entry.metadata.outcome as string) && (
                <div>
                  <div className="text-xs text-white/40 mb-1">Outcome</div>
                  <div className="text-sm text-white/70">{entry.metadata.outcome as string}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
          <button
            onClick={handleBookmark}
            disabled={bookmarked}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              bookmarked
                ? 'bg-[#F1C21B]/10 text-[#F1C21B] border border-[#F1C21B]/20'
                : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/20 hover:text-white'
            }`}
          >
            {bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Helpful?</span>
            <button
              onClick={() => handleFeedback(true)}
              disabled={!!feedbackGiven}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all duration-200 border ${
                feedbackGiven === 'positive'
                  ? 'bg-[#24A148]/10 text-[#24A148] border-[#24A148]/20'
                  : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              👍 {entry.feedbackPositive + (feedbackGiven === 'positive' ? 1 : 0)}
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={!!feedbackGiven}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all duration-200 border ${
                feedbackGiven === 'negative'
                  ? 'bg-[#DA1E28]/10 text-[#FF8389] border-[#DA1E28]/20'
                  : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              👎 {entry.feedbackNegative + (feedbackGiven === 'negative' ? 1 : 0)}
            </button>
          </div>

          <button
            onClick={() => navigate('/knowledge/create')}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#0F62FE]/10 text-[#4589FF] border border-[#0F62FE]/20 hover:bg-[#0F62FE]/20 transition-all duration-200"
          >
            ✍️ Create Related
          </button>
        </div>

        {/* Version History */}
        {entry.versionHistory.length > 1 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Version History</h2>
            <div className="space-y-2">
              {entry.versionHistory.slice().reverse().map(v => (
                <div key={v.version} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-7 h-7 rounded-full bg-[#0F62FE]/10 border border-[#0F62FE]/20 flex items-center justify-center text-xs font-bold text-[#4589FF] flex-shrink-0">
                    {v.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white/70">{v.summary}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {v.editedBy} · {new Date(v.editedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
