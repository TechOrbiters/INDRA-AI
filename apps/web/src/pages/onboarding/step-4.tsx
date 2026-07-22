import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PermissionSetting {
  label: string;
  description: string;
  key: string;
  defaultOn: boolean;
}

const SETTINGS: PermissionSetting[] = [
  {
    key: 'default_access',
    label: 'Default knowledge access',
    description: 'All team members can view approved knowledge articles by default.',
    defaultOn: true,
  },
  {
    key: 'contributor_publish',
    label: 'Contributors can publish',
    description: 'Contributors can publish articles without admin approval.',
    defaultOn: false,
  },
  {
    key: 'guest_search',
    label: 'Guests can search',
    description: 'Guest users (external) can search and view public knowledge.',
    defaultOn: false,
  },
  {
    key: 'ai_data_training',
    label: 'AI model improvement',
    description: 'Allow INDRA AI to use anonymized interactions to improve AI responses.',
    defaultOn: true,
  },
  {
    key: 'audit_logging',
    label: 'Enhanced audit logging',
    description: 'Log all knowledge access, searches, and AI interactions for compliance.',
    defaultOn: true,
  },
  {
    key: 'data_residency',
    label: 'EU data residency',
    description: 'Store all data in European data centers (GDPR Article 44 compliant).',
    defaultOn: false,
  },
];

export default function Step4() {
  const navigate = useNavigate();
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    Object.fromEntries(SETTINGS.map(s => [s.key, s.defaultOn]))
  );

  const toggle = (key: string) => setPermissions(p => ({ ...p, [key]: !p[key] }));

  const handleNext = () => {
    const existing = JSON.parse(localStorage.getItem('indra_onboarding') ?? '{}');
    localStorage.setItem('indra_onboarding', JSON.stringify({ ...existing, step4: { permissions } }));
    navigate('/onboarding/step-5');
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Configure permissions & privacy</h1>
        <p className="text-white/50">
          Set your organization's default access controls and compliance settings.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {SETTINGS.map(setting => (
          <div
            key={setting.key}
            className="flex items-start justify-between gap-6 p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-200"
          >
            <div className="flex-1">
              <div className="text-sm font-semibold text-white mb-0.5">{setting.label}</div>
              <div className="text-xs text-white/40 leading-relaxed">{setting.description}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={permissions[setting.key]}
              aria-label={setting.label}
              onClick={() => toggle(setting.key)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F62FE] focus:ring-offset-[#080B14] ${
                permissions[setting.key] ? 'bg-[#0F62FE]' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  permissions[setting.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding/step-3')}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="bg-[#0F62FE] hover:bg-[#0043CE] text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30"
        >
          Next: Review & Launch →
        </button>
      </div>
    </div>
  );
}
