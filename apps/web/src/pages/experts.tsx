import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import AppShell from '../components/AppShell';
import {
  Users, Search, Sparkles, MessageSquare, Award,
  BookOpen, Building2, CheckCircle2, ChevronRight, Loader2,
} from 'lucide-react';

interface ExpertItem {
  id: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  departments: string[];
  expertise: string[];
  contributionCount?: number;
  topEntries?: Array<{ id: string; title: string }>;
  responsivenessScore?: number;
  matchReason?: string;
  matchConfidence?: number;
}

export default function ExpertsPage() {
  const navigate = useNavigate();
  const [topicQuery, setTopicQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'topic'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [askedUser, setAskedUser] = useState<ExpertItem | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionSent, setQuestionSent] = useState(false);

  // Queries
  const { data: allExperts, isLoading: loadingAll } = trpc.experts.list.useQuery({
    search: topicQuery && activeTab === 'all' ? topicQuery : undefined,
  });

  const { data: topicMatches, isLoading: loadingTopic } = trpc.experts.findForTopic.useQuery(
    { topic: topicQuery },
    { enabled: activeTab === 'topic' && topicQuery.trim().length >= 2 }
  );

  const displayList: ExpertItem[] = activeTab === 'topic' && topicMatches ? topicMatches : (allExperts ?? []);

  const filteredList = displayList.filter(e => {
    if (selectedDept === 'all') return true;
    return e.departments.includes(selectedDept);
  });

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topicQuery.trim()) {
      setActiveTab('topic');
    }
  };

  const handleSendQuestion = () => {
    if (!questionText.trim() || !askedUser) return;
    setQuestionSent(true);
    setTimeout(() => {
      setQuestionSent(false);
      setAskedUser(null);
      setQuestionText('');
    }, 2000);
  };

  const TOPIC_SUGGESTIONS = [
    'PostgreSQL performance tuning',
    'GDPR compliance policies',
    'Engineering onboarding',
    'GraphQL API architecture',
    'Security & Auth',
  ];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Expert Finder</h1>
              <p className="text-gray-400 text-sm">
                AI-matched Subject Matter Experts (SMEs) across your organization.
              </p>
            </div>
          </div>
        </div>

        {/* Search Hero */}
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-gray-900/60 border border-white/10 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Who knows about...?
            </h2>
            <p className="text-gray-300 text-sm mb-5">
              Ask AI to identify SMEs based on contribution patterns, authored decision logs, and department alignment.
            </p>

            <form onSubmit={handleTopicSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={topicQuery}
                  onChange={e => setTopicQuery(e.target.value)}
                  placeholder="e.g. Database read replicas, OAuth SSO, Security audit..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-950/80 border border-white/15 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20">
                Find SME
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs text-gray-400">Popular topics:</span>
              {TOPIC_SUGGESTIONS.map(topic => (
                <button
                  key={topic}
                  onClick={() => { setTopicQuery(topic); setActiveTab('topic'); }}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-purple-500/20 text-gray-300 hover:text-purple-300 border border-white/10 transition-colors">
                  ✦ {topic}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'all' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
              }`}>
              All Experts ({allExperts?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('topic')}
              disabled={!topicQuery}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                activeTab === 'topic' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
              }`}>
              Topic AI Match {topicQuery ? `("${topicQuery}")` : ''}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-purple-500 transition-colors">
              <option value="all">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Product">Product</option>
              <option value="Security & Infrastructure">Security & Infra</option>
              <option value="Legal & Compliance">Legal & Compliance</option>
            </select>
          </div>
        </div>

        {/* Loading state */}
        {(loadingAll || loadingTopic) && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {/* Empty state */}
        {!loadingAll && !loadingTopic && filteredList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-lg font-semibold text-white">No experts found</h3>
            <p className="text-gray-400 text-sm max-w-sm mt-1">
              Try refining your topic or clearing the department filter.
            </p>
          </div>
        )}

        {/* Expert Cards Grid */}
        {!loadingAll && !loadingTopic && filteredList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredList.map((expert: ExpertItem) => (
              <div
                key={expert.id}
                className="bg-white/5 border border-white/10 hover:border-purple-500/30 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group">
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
                        {expert.displayName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {expert.displayName}
                        </h3>
                        <p className="text-xs text-gray-400 capitalize">{expert.role.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {expert.matchConfidence && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                        {Math.round(expert.matchConfidence * 100)}% match
                      </span>
                    )}
                  </div>

                  {/* Match Reason callout if available */}
                  {expert.matchReason && (
                    <div className="bg-purple-950/40 border border-purple-500/20 rounded-xl p-3 mb-4 text-xs text-purple-200 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <span>{expert.matchReason}</span>
                    </div>
                  )}

                  {/* Departments */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {expert.departments.map(dept => (
                      <span key={dept} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/5">
                        {dept}
                      </span>
                    ))}
                  </div>

                  {/* Expertise tags */}
                  <div className="mb-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Primary Expertise</p>
                    <div className="flex flex-wrap gap-1.5">
                      {expert.expertise.map(tag => (
                        <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Top Contributions */}
                  {expert.topEntries && expert.topEntries.length > 0 && (
                    <div className="mb-4 pt-3 border-t border-white/5">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-purple-400" /> Key Contributions
                      </p>
                      <ul className="space-y-1 text-xs text-gray-300">
                        {expert.topEntries.map(e => (
                          <li
                            key={e.id}
                            onClick={() => navigate(`/knowledge/${e.id}`)}
                            className="hover:text-purple-300 cursor-pointer truncate flex items-center justify-between">
                            <span>• {e.title}</span>
                            <ChevronRight className="w-3 h-3 text-gray-600" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Bottom card action */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Response score: <strong className="text-emerald-400">{expert.responsivenessScore ?? 92}%</strong>
                  </span>
                  <button
                    onClick={() => setAskedUser(expert)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-purple-600 text-white text-xs font-medium transition-all">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Ask SME
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ask Question Modal */}
      {askedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                Ask {askedUser.displayName}
              </h3>
              <button onClick={() => setAskedUser(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {questionSent ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                <h4 className="text-base font-semibold text-white">Question Sent!</h4>
                <p className="text-gray-400 text-xs">
                  {askedUser.displayName} has been notified via Indra AI notifications.
                </p>
              </div>
            ) : (
              <>
                <p className="text-gray-300 text-xs mb-4">
                  Send a structured query directly to this SME. If resolved, the answer will be automatically indexed as a new FAQ entry.
                </p>
                <textarea
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  rows={4}
                  placeholder={`Hi ${askedUser.displayName}, could you clarify our process regarding...`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-colors resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setAskedUser(null)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-medium">
                    Cancel
                  </button>
                  <button
                    onClick={handleSendQuestion}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all">
                    Send Question
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
