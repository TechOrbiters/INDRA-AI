import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const STEPS = [
  { path: 'step-1', label: 'Organization' },
  { path: 'step-2', label: 'Team' },
  { path: 'step-3', label: 'Integrations' },
  { path: 'step-4', label: 'Permissions' },
  { path: 'step-5', label: 'Review' },
];

export default function OnboardingLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentIdx = STEPS.findIndex(s => location.pathname.includes(s.path));

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
            <span className="text-white font-bold text-sm">I</span>
          </div>
          <span className="font-bold text-lg tracking-tight">
            INDRA <span className="text-[#8A3FFC]">AI</span>
          </span>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Skip setup →
        </button>
      </header>

      {/* Progress */}
      <div className="px-6 py-6 max-w-2xl mx-auto w-full">
        <nav aria-label="Onboarding progress" className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            return (
              <div key={step.path} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => isDone && navigate(`/onboarding/${step.path}`)}
                    aria-current={isActive ? 'step' : undefined}
                    disabled={!isDone}
                    className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
                      isDone
                        ? 'bg-[#24A148] text-white cursor-pointer'
                        : isActive
                        ? 'bg-[#0F62FE] text-white ring-4 ring-[#0F62FE]/20'
                        : 'bg-white/10 text-white/40 cursor-default'
                    }`}
                  >
                    {isDone ? '✓' : i + 1}
                  </button>
                  <span
                    className={`text-[10px] font-medium hidden sm:block ${
                      isActive ? 'text-white' : isDone ? 'text-[#24A148]' : 'text-white/30'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 transition-all duration-500 ${
                      isDone ? 'bg-[#24A148]' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Step content */}
      <main className="flex-1 px-6 pb-12">
        <div className="max-w-2xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
