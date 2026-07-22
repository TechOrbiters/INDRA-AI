import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STATS = [
  { value: '$31.5B', label: 'Enterprise knowledge lost per year', source: 'IDC 2025' },
  { value: '2.5 hrs', label: 'Daily time spent searching for info', source: 'McKinsey' },
  { value: '34%', label: 'Productivity uplift with knowledge AI', source: 'MIT Sloan' },
  { value: '12%', label: 'Orgs using AI knowledge tools today', source: 'Gartner' },
];

const NAV_LINKS = ['Product', 'Solutions', 'Pricing', 'Enterprise'];

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeStatIdx, setActiveStatIdx] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStatIdx(i => (i + 1) % STATS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#080B14] text-white overflow-hidden">
      {/* Skip to content – WCAG AA */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 bg-[#0F62FE] text-white px-4 py-2 rounded-md text-sm font-medium">
        Skip to content
      </a>

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled ? 'bg-[#080B14]/90 backdrop-blur-xl border-b border-white/5' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            <span className="font-bold text-lg tracking-tight">
              INDRA <span className="text-[#8A3FFC]">AI</span>
            </span>
          </div>

          {/* Links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <button
                key={link}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {link}
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="text-sm bg-[#0F62FE] hover:bg-[#0043CE] text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main id="main-content">
        <div className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16">
          {/* Background orbs */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0F62FE]/20 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8A3FFC]/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0F62FE]/5 rounded-full blur-3xl" />
          </div>

          {/* Badge */}
          <div className="mb-6 flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm">
            <span className="w-2 h-2 bg-[#24A148] rounded-full animate-pulse" />
            <span className="text-xs text-white/70 font-medium">AI-Powered Knowledge Intelligence Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-center text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 max-w-5xl">
            Your organization's{' '}
            <span className="bg-gradient-to-r from-[#0F62FE] via-[#8A3FFC] to-[#0F62FE] bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
              collective intelligence
            </span>
            , finally unlocked
          </h1>

          <p className="text-center text-lg md:text-xl text-white/50 max-w-2xl mb-10 leading-relaxed">
            INDRA AI eliminates knowledge silos, prevents institutional amnesia, and makes every
            employee as effective as your best employee — using AI-driven retrieval built into daily workflows.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <button
              onClick={() => navigate('/signup')}
              className="group flex items-center gap-2 bg-[#0F62FE] hover:bg-[#0043CE] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:shadow-2xl hover:shadow-[#0F62FE]/40 hover:-translate-y-0.5"
            >
              Start Free Trial
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200"
            >
              Request Demo
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full">
            {STATS.map((stat, i) => (
              <div
                key={stat.value}
                className={`relative p-5 rounded-2xl border transition-all duration-500 cursor-default ${
                  i === activeStatIdx
                    ? 'bg-white/10 border-[#0F62FE]/50 shadow-lg shadow-[#0F62FE]/10'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
                }`}
              >
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs text-white/50 leading-relaxed">{stat.label}</div>
                <div className="text-[10px] text-white/30 mt-2 font-medium uppercase tracking-wide">{stat.source}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Strip */}
        <section aria-labelledby="features-heading" className="border-t border-white/5 bg-white/[0.02] py-20 px-6">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything your enterprise needs
            </h2>
            <p className="text-white/50 text-lg">From ingestion to insight in seconds.</p>
          </div>
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🔍',
                title: 'Universal Search',
                desc: 'AI semantic search across every document, Slack thread, email, and codebase in your organization.',
                color: '#0F62FE',
              },
              {
                icon: '✦',
                title: 'AI Answer Engine',
                desc: 'GPT-4o powered Q&A with source citations, confidence scores, and hallucination guardrails.',
                color: '#8A3FFC',
              },
              {
                icon: '🕸',
                title: 'Knowledge Graph',
                desc: 'Visualize how people, topics, projects, and decisions are interconnected across your org.',
                color: '#24A148',
              },
              {
                icon: '📋',
                title: 'Audit & Compliance',
                desc: 'Immutable, tamper-evident activity logs. SOC 2 Type II ready. GDPR compliant at launch.',
                color: '#F1C21B',
              },
              {
                icon: '⚡',
                title: 'Auto Ingestion',
                desc: 'Connect Google Drive, Confluence, Notion, Slack. AI tags, chunks, and indexes everything.',
                color: '#0F62FE',
              },
              {
                icon: '🔒',
                title: 'Enterprise Security',
                desc: 'RBAC, SSO (SAML 2.0/OIDC), AES-256 at rest, TLS 1.3 in transit, data residency selection.',
                color: '#8A3FFC',
              },
            ].map(f => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.06] transition-all duration-300 hover:-translate-y-1"
              >
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-block bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] p-px rounded-3xl w-full">
              <div className="bg-[#080B14] rounded-3xl px-10 py-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to unlock your institutional knowledge?
                </h2>
                <p className="text-white/50 mb-8 text-lg">
                  Join leading enterprises eliminating knowledge silos with INDRA AI.
                </p>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] hover:opacity-90 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:shadow-2xl hover:shadow-[#8A3FFC]/30 hover:-translate-y-0.5"
                >
                  Get Started — It's Free
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/30 text-sm">
          © 2026 INDRA AI. Confidential. Enterprise Institutional Knowledge Intelligence Platform.
        </p>
      </footer>

      {/* Shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
