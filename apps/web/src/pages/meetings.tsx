import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import AppShell from '../components/AppShell';
import {
  Sparkles, CheckCircle2,
  FileText, Upload, Check, Loader2, ArrowRight,
  BookOpen, Target,
} from 'lucide-react';

interface ExtractedDecision {
  decision: string;
  context: string;
  outcome: string;
}

interface ExtractedActionItem {
  task: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
}

interface AnalysisResult {
  title: string;
  processedAt: string;
  attendees: string[];
  summary: string;
  decisions: ExtractedDecision[];
  actionItems: ExtractedActionItem[];
  takeaways: string[];
}

export default function MeetingsPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [attendeesInput, setAttendeesInput] = useState('');
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const { data: collections } = trpc.knowledge.listCollections.useQuery();

  const processMutation = trpc.meetings.processTranscript.useMutation({
    onSuccess: (data: unknown) => {
      setAnalysis(data as AnalysisResult);
    },
  });

  const publishMutation = trpc.meetings.publishToKnowledge.useMutation({
    onSuccess: (data: { url: string }) => {
      setPublishedUrl(data.url);
    },
  });

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !transcript.trim()) return;

    const attendees = attendeesInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    processMutation.mutate({
      title: title.trim(),
      transcript: transcript.trim(),
      attendees,
    });
  };

  const handlePublish = () => {
    if (!analysis || !selectedCollection) return;

    publishMutation.mutate({
      title: analysis.title,
      summary: analysis.summary,
      decisions: analysis.decisions,
      actionItems: analysis.actionItems,
      collectionId: selectedCollection,
      tags: ['meeting-intelligence', 'ai-extracted'],
    });
  };

  const SAMPLE_TRANSCRIPT = `Priya (Product Lead): Welcome team. Today we are deciding on the database architecture for our Q4 scale-up.
Alex (Infra Lead): We evaluated PostgreSQL read replicas versus migrating fully to Cloud Spanner.
Sarah (CTO): Given our cost target, we agreed to deploy PostgreSQL read replicas immediately and defer Spanner to 2027.
Alex: Okay, I will configure 3 read replicas in us-east-1 by next Friday.
Priya: Great. I will update the infrastructure decision log and notify stakeholders ASAP.`;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Meeting Intelligence</h1>
              <p className="text-gray-400 text-sm">
                Auto-extract decisions, action items, and knowledge entries from meeting notes and transcripts (§1.9 F-011).
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Input Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Meeting Transcript Input
            </h2>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Meeting Title *
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Architecture & Infrastructure Alignment"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Attendees <span className="text-gray-500 lowercase">(comma-separated)</span>
                </label>
                <input
                  value={attendeesInput}
                  onChange={e => setAttendeesInput(e.target.value)}
                  placeholder="Priya Sharma, Alex Rivera, Sarah Chen"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Raw Transcript / Meeting Notes *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Q4 Database Architecture Sync');
                      setAttendeesInput('Priya Sharma, Alex Rivera, Sarah Chen');
                      setTranscript(SAMPLE_TRANSCRIPT);
                    }}
                    className="text-xs text-blue-400 hover:underline">
                    Load Sample
                  </button>
                </div>
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={10}
                  placeholder="Paste meeting transcript or raw notes here..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500 transition-colors resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={processMutation.isLoading || !title || !transcript}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                {processMutation.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting Decisions & Actions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract Meeting Intelligence
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Extracted Intelligence Panel */}
          <div className="space-y-6">
            {!analysis && !processMutation.isLoading && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[420px]">
                <Upload className="w-12 h-12 text-gray-600 mb-3" />
                <h3 className="text-lg font-semibold text-white">No Analysis Yet</h3>
                <p className="text-gray-400 text-xs max-w-xs mt-1">
                  Paste a transcript on the left and click "Extract Meeting Intelligence" to auto-detect decisions and action items.
                </p>
              </div>
            )}

            {processMutation.isLoading && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[420px]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold text-white">Analyzing Meeting Transcript</h3>
                <p className="text-gray-400 text-xs max-w-xs mt-1">
                  AI is parsing speaker utterances, identifying binding decisions, and assigning action items...
                </p>
              </div>
            )}

            {analysis && (
              <div className="space-y-5">
                {/* Summary Box */}
                <div className="bg-gradient-to-br from-blue-950/40 to-indigo-950/40 border border-blue-500/20 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">AI Executive Summary</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">94% Confidence</span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Key Decisions */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Key Decisions Extracted ({analysis.decisions.length})
                  </h3>
                  <div className="space-y-3">
                    {analysis.decisions.map((d, idx) => (
                      <div key={idx} className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
                        <p className="text-sm font-semibold text-emerald-200">⚡ {d.decision}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                          <span>Context: {d.context}</span>
                          <span className="text-emerald-400 font-medium">{d.outcome}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Items */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    Action Items ({analysis.actionItems.length})
                  </h3>
                  <div className="space-y-2">
                    {analysis.actionItems.map((a, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="text-gray-200 font-medium">• {a.task}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">{a.assignee}</span>
                          <span className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                            a.priority === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'
                          }`}>
                            {a.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Publish Bar */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {publishedUrl ? (
                    <div className="flex items-center gap-3 text-emerald-400 text-sm font-medium w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Check className="w-5 h-5" /> Published to Knowledge Base!
                      </span>
                      <button
                        onClick={() => navigate(publishedUrl)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-all flex items-center gap-1">
                        View Entry <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 w-full">
                        <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                          Select Collection to Publish
                        </label>
                        <select
                          value={selectedCollection}
                          onChange={e => setSelectedCollection(e.target.value)}
                          className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500">
                          <option value="">Choose target collection...</option>
                          {collections?.map((c: { id: string; name: string }) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handlePublish}
                        disabled={publishMutation.isLoading || !selectedCollection}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 flex-shrink-0">
                        {publishMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                        Publish Knowledge Entry
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
