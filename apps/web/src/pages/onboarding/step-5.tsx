import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpcClient } from '../../utils/trpc';

export default function Step5() {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const onboardingData = JSON.parse(localStorage.getItem('indra_onboarding') ?? '{}');

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).auth.completeOnboarding.mutate({ onboardingData });
    } catch {
      // Non-critical — navigate anyway
    }
    localStorage.removeItem('indra_onboarding');
    setLaunched(true);
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  if (launched) {
    return (
      <div className="text-center py-12 animate-fadeIn">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center mx-auto mb-6 text-4xl shadow-2xl shadow-[#0F62FE]/30">
          ✓
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">You're all set!</h1>
        <p className="text-white/50 text-lg">Taking you to your dashboard…</p>
        <div className="mt-6 flex justify-center">
          <span className="w-6 h-6 border-2 border-white/20 border-t-[#0F62FE] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const step1 = onboardingData.step1 ?? {};
  const step2 = onboardingData.step2 ?? {};
  const step3 = onboardingData.step3 ?? {};
  const step4 = onboardingData.step4 ?? {};

  const inviteCount = (step2.invites as Array<{ email: string }> | undefined)?.filter(i => i.email).length ?? 0;
  const integrationCount = (step3.integrations as string[] | undefined)?.length ?? 0;
  const enabledPermissions = Object.entries(step4.permissions ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k.replace(/_/g, ' '));

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Review & launch your hub</h1>
        <p className="text-white/50">Everything looks good. Confirm the details below and launch.</p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Organization */}
        <ReviewCard
          title="Organization"
          editStep="/onboarding/step-1"
          items={[
            { label: 'Name', value: step1.orgName || '—' },
            { label: 'Industry', value: step1.industry || '—' },
            { label: 'Size', value: step1.size ? `${step1.size} employees` : '—' },
            step1.domain ? { label: 'Domain', value: step1.domain } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>}
        />

        {/* Team */}
        <ReviewCard
          title="Team Invitations"
          editStep="/onboarding/step-2"
          items={[
            { label: 'Invited', value: inviteCount > 0 ? `${inviteCount} member${inviteCount !== 1 ? 's' : ''}` : 'None (you can invite later)' },
          ]}
        />

        {/* Integrations */}
        <ReviewCard
          title="Integrations"
          editStep="/onboarding/step-3"
          items={[
            { label: 'Connected', value: integrationCount > 0 ? `${integrationCount} integration${integrationCount !== 1 ? 's' : ''}` : 'None selected' },
          ]}
        />

        {/* Permissions */}
        <ReviewCard
          title="Permissions & Privacy"
          editStep="/onboarding/step-4"
          items={[
            {
              label: 'Enabled',
              value: enabledPermissions.length > 0 ? enabledPermissions.join(', ') : 'All defaults',
            },
          ]}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding/step-4')}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={launching}
          className="flex items-center gap-2 bg-gradient-to-r from-[#0F62FE] to-[#8A3FFC] hover:opacity-90 disabled:opacity-60 text-white font-semibold px-10 py-3.5 rounded-xl transition-all duration-200 hover:shadow-2xl hover:shadow-[#8A3FFC]/30 hover:-translate-y-0.5"
        >
          {launching ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Launching…
            </>
          ) : (
            '🚀 Launch INDRA AI'
          )}
        </button>
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  editStep,
  items,
}: {
  title: string;
  editStep: string;
  items: Array<{ label: string; value: string }>;
}) {
  const navigate = useNavigate();
  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <button
          type="button"
          onClick={() => navigate(editStep)}
          className="text-xs text-[#0F62FE] hover:underline"
        >
          Edit
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-start gap-4 text-sm">
            <span className="text-white/40 w-24 flex-shrink-0">{item.label}</span>
            <span className="text-white/80">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
