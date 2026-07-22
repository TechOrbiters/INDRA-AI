import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import SearchBar from '../components/SearchBar';
import { trpcClient } from '../utils/trpc';

interface SearchResult {
  id: string;
  title: string;
  summary: string;
  type: string;
  collectionId: string;
  author: string;
  updatedAt: string;
  tags: string[];
}

interface AIAnswer {
  answer: string;
  confidence: number;
  sources: { id: string; title: string; type: string; author: string; date: string }[];
}

interface Expert {
  name: string;
  role: string;
  avatarUrl: string;
}

interface SearchResponse {
  results: SearchResult[];
  aiAnswer: AIAnswer | null;
  latencyMs: number;
  experts: Expert[];
}

const TYPE_LABELS: Record<string, string> = {
  article: '📄 Article',
  decision_log: '⚡ Decision Log',
  how_to: '📋 How-To',
  faq: '❓ FAQ',
  reference: '🔒 Reference',
  meeting_note: '📝 Meeting Notes',
};

type SearchMode = 'ai' | 'semantic' | 'keyword';

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [mode, setMode] = useState<SearchMode>((searchParams.get('mode') as SearchMode) || 'ai');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doSearch = useCallback(async (q: string, m: SearchMode) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (trpcClient as any).search.query.query({
        query: q.trim(),
        mode: m,
        filters: {},
      });
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const m = (searchParams.get('mode') as SearchMode) || 'ai';
    setQuery(q);
    setMode(m);
    if (q) doSearch(q, m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    setSearchParams({ q: q.trim(), mode });
  };

  const handleModeChange = (m: SearchMode) => {
    setMode(m);
    if (query.trim()) setSearchParams({ q: query.trim(), mode: m });
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.72) return { bg: 'bg-[#24A148]/10', text: 'text-[#24A148]', border: 'border-[#24A148]/20' };
    if (c >= 0.5) return { bg: 'bg-[#F1C21B]/10', text: 'text-[#F1C21B]', border: 'border-[#F1C21B]/20' };
    return { bg: 'bg-[#DA1E28]/10', text: 'text-[#FF8389]', border: 'border-[#DA1E28]/20' };
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Search Bar */}
        <div className="space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            compact
            autoFocus
          />

          {/* Mode Tabs */}
          <div className="flex items-center gap-1">
            {([
              { id: 'ai', label: '✦ AI Answer', desc: 'Smart synthesized response' },
              { id: 'semantic', label: '🧠 Semantic', desc: 'Vector similarity search' },
              { id: 'keyword', label: '🔤 Keyword', desc: 'Exact text match' },
            ] as { id: SearchMode; label: string; desc: string }[]).map(m => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  mode === m.id
                    ? 'bg-[#0F62FE] text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {m.label}
              </button>
            ))}
            {data && (
              <span className="ml-auto text-xs text-white/30">
                {data.results.length} results · {data.latencyMs}ms
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-[#0F62FE]/20 border-t-[#0F62FE] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-lg">✦</div>
            </div>
            <div className="text-white/40 text-sm">
              {mode === 'ai' ? 'AI is synthesizing your answer…' : 'Searching knowledge base…'}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div role="alert" className="flex items-center gap-3 bg-[#DA1E28]/10 border border-[#DA1E28]/20 rounded-2xl p-5 text-[#FF8389]">
            <span className="text-xl">⚠</span>
            <div>
              <div className="font-medium text-sm">Search failed</div>
              <div className="text-xs text-white/50 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && data && data.results.length === 0 && !data.aiAnswer && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-white mb-2">No results found</h2>
            <p className="text-white/40 text-sm max-w-sm mx-auto">
              No knowledge entries matched <strong className="text-white">"{query}"</strong>.
              Try a different search term or check the spelling.
            </p>
            <button
              onClick={() => navigate('/knowledge/create')}
              className="mt-6 bg-[#0F62FE] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0043CE] transition-colors"
            >
              ✍️ Create this knowledge entry
            </button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* AI Answer Card */}
            {data.aiAnswer && (mode === 'ai' || mode === 'semantic') && (
              <div className="bg-gradient-to-br from-[#0F62FE]/10 to-[#8A3FFC]/5 border border-[#0F62FE]/20 rounded-2xl p-6 animate-fadeIn">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center text-xs font-bold">
                    ✦
                  </div>
                  <span className="text-sm font-semibold text-white">AI Answer</span>
                  {(() => {
                    const c = confidenceColor(data.aiAnswer.confidence);
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border} ml-1`}>
                        {Math.round(data.aiAnswer.confidence * 100)}% confidence
                      </span>
                    );
                  })()}
                </div>

                <p className="text-white/80 text-sm leading-relaxed mb-4">
                  {data.aiAnswer.answer}
                </p>

                {data.aiAnswer.sources.length > 0 && (
                  <div>
                    <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Sources</div>
                    <div className="flex flex-wrap gap-2">
                      {data.aiAnswer.sources.map((src, i) => (
                        <button
                          key={src.id}
                          onClick={() => navigate(`/knowledge/${src.id}`)}
                          className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 hover:border-[#0F62FE]/30 hover:text-[#4589FF] text-white/60 px-3 py-1.5 rounded-lg transition-all duration-200"
                        >
                          <span className="text-[#0F62FE] font-bold">[{i + 1}]</span>
                          {src.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Results List */}
            {data.results.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs text-white/40 font-medium uppercase tracking-wider">
                  {data.results.length} Knowledge {data.results.length === 1 ? 'Entry' : 'Entries'}
                </div>
                {data.results.map((result, i) => (
                  <button
                    key={result.id}
                    onClick={() => navigate(`/knowledge/${result.id}`)}
                    className="w-full flex items-start gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] text-left transition-all duration-200 group animate-fadeIn"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                          {TYPE_LABELS[result.type] || result.type}
                        </span>
                        {result.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-semibold text-white group-hover:text-[#4589FF] transition-colors mb-1.5">
                        {result.title}
                      </div>
                      <div className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                        {result.summary}
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-xs text-white/30">
                        <span>Updated {new Date(result.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="text-white/20 group-hover:text-white/50 transition-colors text-xl mt-1">›</span>
                  </button>
                ))}
              </div>
            )}

            {/* Expert Suggestions */}
            {data.experts && data.experts.length > 0 && data.results.length === 0 && (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="text-xs text-white/40 uppercase tracking-wider font-medium mb-3">Ask a Subject Expert</div>
                <div className="space-y-2">
                  {data.experts.map(expert => (
                    <div key={expert.name} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {expert.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">{expert.name}</div>
                        <div className="text-xs text-white/40">{expert.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty initial state */}
        {!loading && !data && !error && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🧠</div>
            <h2 className="text-xl font-bold text-white mb-2">Search your knowledge base</h2>
            <p className="text-white/40 text-sm">Type above to find articles, decisions, guides, and more.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
