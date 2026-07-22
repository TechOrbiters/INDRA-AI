import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import AppShell from '../../components/AppShell';
import {
  Activity, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Eye, Calendar, Check, ExternalLink, Filter, Loader2, AlertCircle,
} from 'lucide-react';

export default function KnowledgeHealthPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'outdated' | 'needs_review' | 'low_confidence'>('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = trpc.health.getOverview.useQuery();
  const { data: queue, isLoading: loadingQueue, refetch: refetchQueue } = trpc.health.listQueue.useQuery({ filter });

  const verifyMutation = trpc.health.verifyEntry.useMutation({
    onSuccess: () => {
      refetchOverview();
      refetchQueue();
      setVerifyingId(null);
    },
  });

  const handleVerify = (id: string) => {
    setVerifyingId(id);
    verifyMutation.mutate({ id });
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Knowledge Health Hub</h1>
              <p className="text-gray-400 text-sm">
                Monitor knowledge freshness, verify AI confidence, and resolve outdated content (§1.9 F-010).
              </p>
            </div>
          </div>
        </div>

        {/* Health Score Overview Strip */}
        {loadingOverview ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            {/* Overall Health Score Card */}
            <div className={`border rounded-2xl p-6 flex flex-col justify-between ${getHealthColor(overview.overallHealthScore)}`}>
              <div>
                <span className="text-xs uppercase font-bold tracking-wider opacity-80">Org Health Score</span>
                <div className="text-4xl font-extrabold mt-2">{overview.overallHealthScore}%</div>
              </div>
              <p className="text-xs opacity-75 mt-3">
                Calculated from freshness, AI confidence & reviewer verification.
              </p>
            </div>

            {/* Verified Entries */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase font-semibold">Verified Fresh</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-white mt-2">{overview.verifiedCount}</div>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${overview.verifiedPercentage}%` }} />
              </div>
            </div>

            {/* Needs Review */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase font-semibold">Needs Review</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-white mt-2">{overview.needsReviewCount}</div>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${overview.needsReviewPercentage}%` }} />
              </div>
            </div>

            {/* Outdated / Expired */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase font-semibold">Stale / Expired</span>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-3xl font-bold text-white mt-2">{overview.outdatedCount}</div>
              <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-red-400 h-full rounded-full" style={{ width: `${overview.outdatedPercentage}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Maintenance Queue Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Maintenance & Verification Queue</h2>
              <p className="text-xs text-gray-400">Entries requiring verification or updates from subject matter owners.</p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              {[
                { id: 'all', label: 'All Attention' },
                { id: 'needs_review', label: 'Needs Review' },
                { id: 'outdated', label: 'Stale (90d+)' },
                { id: 'low_confidence', label: 'Low AI Confidence' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as typeof filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filter === f.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Queue List */}
          {loadingQueue ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : !queue || queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
              <h3 className="text-base font-semibold text-white">Queue is clear!</h3>
              <p className="text-gray-400 text-xs mt-1">All content in this category is fresh and verified.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item: { id: string; title: string; summary: string; statusCategory: string; updatedAt: string; viewCount: number; flags: string[] }) => (
                <div
                  key={item.id}
                  className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.statusCategory === 'outdated' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {item.statusCategory.replace('_', ' ')}
                      </span>
                      <h3
                        onClick={() => navigate(`/knowledge/${item.id}`)}
                        className="text-sm font-semibold text-white hover:text-emerald-300 cursor-pointer truncate">
                        {item.title}
                      </h3>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-1 mb-2">{item.summary}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Last updated: {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {item.viewCount} views
                      </span>
                      {item.flags.map((flag: string) => (
                        <span key={flag} className="text-amber-400 text-[11px] font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {flag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/knowledge/${item.id}/edit`)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-gray-300 hover:bg-white/5 transition-all flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Update
                    </button>

                    <button
                      onClick={() => handleVerify(item.id)}
                      disabled={verifyingId === item.id}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white transition-all flex items-center gap-1 shadow-md shadow-emerald-600/20">
                      {verifyingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Verify Fresh
                    </button>

                    <button
                      onClick={() => navigate(`/knowledge/${item.id}`)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
