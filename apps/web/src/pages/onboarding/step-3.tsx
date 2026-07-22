import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const INTEGRATIONS = [
  { id: 'google_drive', name: 'Google Drive', icon: '📁', category: 'Storage', available: true },
  { id: 'confluence', name: 'Confluence', icon: '🔷', category: 'Wiki', available: true },
  { id: 'notion', name: 'Notion', icon: '◻', category: 'Wiki', available: true },
  { id: 'slack', name: 'Slack', icon: '💬', category: 'Comms', available: true },
  { id: 'jira', name: 'Jira', icon: '🔵', category: 'Project', available: true },
  { id: 'github', name: 'GitHub', icon: '🐙', category: 'Code', available: true },
  { id: 'sharepoint', name: 'SharePoint', icon: '🟦', category: 'Storage', available: true },
  { id: 'teams', name: 'MS Teams', icon: '🟣', category: 'Comms', available: false },
  { id: 'salesforce', name: 'Salesforce', icon: '☁', category: 'CRM', available: false },
  { id: 'zendesk', name: 'Zendesk', icon: '🎫', category: 'Support', available: false },
  { id: 'dropbox', name: 'Dropbox', icon: '📦', category: 'Storage', available: false },
  { id: 'hubspot', name: 'HubSpot', icon: '🧲', category: 'CRM', available: false },
];

export default function Step3() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    const existing = JSON.parse(localStorage.getItem('indra_onboarding') ?? '{}');
    localStorage.setItem('indra_onboarding', JSON.stringify({
      ...existing,
      step3: { integrations: Array.from(selected) },
    }));
    navigate('/onboarding/step-4');
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Connect your tools</h1>
        <p className="text-white/50">
          INDRA AI will auto-ingest and index content from these sources. You can connect more later.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {INTEGRATIONS.map(integration => {
          const isSelected = selected.has(integration.id);
          return (
            <button
              key={integration.id}
              type="button"
              onClick={() => integration.available && toggle(integration.id)}
              disabled={!integration.available}
              className={`relative p-4 rounded-2xl border text-left transition-all duration-200 group ${
                !integration.available
                  ? 'opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02]'
                  : isSelected
                  ? 'border-[#0F62FE] bg-[#0F62FE]/10 shadow-lg shadow-[#0F62FE]/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#0F62FE] flex items-center justify-center text-white text-xs font-bold">
                  ✓
                </div>
              )}
              {!integration.available && (
                <div className="absolute top-2 right-2 text-[10px] text-white/40 bg-white/10 rounded-full px-2 py-0.5">
                  Soon
                </div>
              )}
              <div className="text-2xl mb-2">{integration.icon}</div>
              <div className="text-sm font-semibold text-white">{integration.name}</div>
              <div className="text-xs text-white/40 mt-0.5">{integration.category}</div>
            </button>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-[#0F62FE]/10 border border-[#0F62FE]/20 rounded-xl px-4 py-3 text-sm text-[#4589FF] mb-6">
          <span>✓</span>
          {selected.size} integration{selected.size !== 1 ? 's' : ''} selected. We'll start indexing content after setup.
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding/step-2')}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="bg-[#0F62FE] hover:bg-[#0043CE] text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30"
        >
          {selected.size > 0 ? `Next: Configure Permissions →` : 'Skip for Now →'}
        </button>
      </div>
    </div>
  );
}
