import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import SearchBar from '../components/SearchBar';
import { trpcClient } from '../utils/trpc';
import { useAuth } from '../context/AuthContext';

interface KnowledgeItem {
  id: string;
  title: string;
  type: string;
  tags: string[];
  updatedAt: string;
  viewCount: number;
}

interface AdminStats {
  dau: number;
  knowledgeCount: number;
  userCount: number;
  searchesToday: number;
  healthScore: number;
}

interface TopQuery {
  query: string;
  count: number;
  answerRate: string;
}

const AI_SUGGESTIONS = [
  { q: 'What is our current database architecture?', hint: 'Based on recent docs' },
  { q: 'What are Q3 OKRs for the product team?', hint: 'High search interest' },
  { q: 'How do we handle GDPR data requests?', hint: 'Compliance area' },
];

const TYPE_ICONS: Record<string, string> = {
  article: '📄',
  decision_log: '⚡',
  how_to: '📋',
  faq: '❓',
  reference: '🔒',
  meeting_note: '📝',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [recent, setRecent] = useState<KnowledgeItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const handleSearch = (q: string) => {
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (trpcClient as any).admin.overview.query();
        setStats(result.stats);
        setTopQueries(result.topQueries || []);
      } catch {
        // Graceful fallback — dashboard still functional
      } finally {
        setLoadingStats(false);
      }
    };

    const loadRecent = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (trpcClient as any).knowledge.list.query({});
        setRecent(result.slice(0, 5));
      } catch {
        setRecent([]);
      } finally {
        setLoadingRecent(false);
      }
    };

    loadStats();
    loadRecent();
  }, []);

  const STAT_CARDS = [
    {
      label: 'Knowledge Entries',
      value: loadingStats ? '—' : (stats?.knowledgeCount?.toLocaleString() ?? '—'),
      delta: '+12',
      positive: true,
      icon: '📄',
    },
    {
      label: 'Searches Today',
      value: loadingStats ? '—' : (stats?.searchesToday?.toLocaleString() ?? '—'),
      delta: '+34%',
      positive: true,
      icon: '✦',
    },
    {
      label: 'Team Members',
      value: loadingStats ? '—' : (stats?.userCount?.toLocaleString() ?? '—'),
      delta: '+3',
      positive: true,
      icon: '👥',
    },
    {
      label: 'Knowledge Health',
      value: loadingStats ? '—' : (stats?.healthScore ? `${stats.healthScore.toFixed(0)}%` : '—'),
      delta: stats && stats.healthScore >= 80 ? '+Good' : 'Review',
      positive: stats ? stats.healthScore >= 80 : true,
      icon: '🎯',
    },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Welcome + Search */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back, {user?.displayName || 'User'} 👋</h1>
            <p className="text-white/40 text-sm mt-1">Your organization's knowledge hub</p>
          </div>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            placeholder="Ask anything across your organization's knowledge…"
            autoFocus
          />
        </div>

        {/* AI Suggestions */}
        <div>
          <div className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3">AI Suggested Questions</div>
          <div className="flex flex-wrap gap-2">
            {AI_SUGGESTIONS.map(s => (
              <button
                key={s.q}
                onClick={() => handleSearch(s.q)}
                className="group flex items-center gap-2 bg-white/[0.04] hover:bg-[#0F62FE]/10 border border-white/10 hover:border-[#0F62FE]/30 text-white/70 hover:text-white text-sm px-4 py-2 rounded-full transition-all duration-200"
              >
                <span className="text-[#8A3FFC] text-xs">✦</span>
                {s.q}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map(stat => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg">{stat.icon}</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    stat.positive
                      ? 'bg-[#24A148]/15 text-[#24A148]'
                      : 'bg-[#DA1E28]/15 text-[#FF8389]'
                  }`}
                >
                  {stat.delta}
                </span>
              </div>
              <div className={`text-2xl font-bold text-white mb-1 ${loadingStats ? 'animate-pulse' : ''}`}>
                {stat.value}
              </div>
              <div className="text-xs text-white/40">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Recent Knowledge */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Recent Knowledge</h2>
              <button
                onClick={() => navigate('/search')}
                className="text-xs text-[#0F62FE] hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="space-y-2">
              {loadingRecent ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.03] border border-white/5 animate-pulse" />
                ))
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="text-4xl mb-3">📄</div>
                  <div className="text-white/50 text-sm">No knowledge entries yet</div>
                  <button
                    onClick={() => navigate('/knowledge/create')}
                    className="mt-3 text-[#0F62FE] text-xs hover:underline"
                  >
                    Create the first entry →
                  </button>
                </div>
              ) : (
                recent.map(k => (
                  <button
                    key={k.id}
                    onClick={() => navigate(`/knowledge/${k.id}`)}
                    className="w-full flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.06] text-left transition-all duration-200 group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#0F62FE]/10 border border-[#0F62FE]/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                      {TYPE_ICONS[k.type] || '📄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white group-hover:text-[#4589FF] transition-colors truncate">
                        {k.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {(k.tags as string[]).slice(0, 3).map((t: string) => (
                          <span key={t} className="text-xs text-white/40 bg-white/5 rounded-full px-2 py-0.5">
                            #{t}
                          </span>
                        ))}
                        <span className="text-xs text-white/30">
                          {k.viewCount} views · {new Date(k.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span className="text-white/20 group-hover:text-white/50 transition-colors text-lg">›</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions + Health */}
          <div>
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { icon: '✍️', label: 'Create Knowledge Entry', to: '/knowledge/create', color: '#0F62FE' },
                { icon: '🕸', label: 'Open Knowledge Graph', to: '/graph', color: '#8A3FFC' },
                { icon: '🔍', label: 'Advanced Search', to: '/search', color: '#24A148' },
                { icon: '👤', label: 'Manage Users', to: '/admin/users', color: '#F1C21B' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.to)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.06] text-left transition-all duration-200 group"
                >
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                    {action.label}
                  </span>
                  <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors">›</span>
                </button>
              ))}
            </div>

            {/* Top Queries */}
            {topQueries.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Top Searches Today</div>
                {topQueries.map(q => (
                  <button
                    key={q.query}
                    onClick={() => handleSearch(q.query)}
                    className="w-full flex items-center gap-2 py-2 text-left group"
                  >
                    <span className="text-[#8A3FFC] text-xs">✦</span>
                    <span className="text-xs text-white/60 group-hover:text-white flex-1 truncate transition-colors">{q.query}</span>
                    <span className="text-[10px] text-[#24A148] bg-[#24A148]/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {q.answerRate}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Knowledge Health */}
            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Knowledge Health</div>
              {[
                { label: 'Verified', value: 72, color: 'bg-[#24A148]' },
                { label: 'Needs review', value: 18, color: 'bg-[#F1C21B]' },
                { label: 'Outdated', value: 10, color: 'bg-[#DA1E28]' },
              ].map(h => (
                <div key={h.label} className="flex items-center gap-3 mb-2">
                  <div className="text-xs text-white/50 w-20">{h.label}</div>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${h.color} transition-all duration-700`}
                      style={{ width: `${h.value}%` }}
                    />
                  </div>
                  <div className="text-xs text-white/40 w-8 text-right">{h.value}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
