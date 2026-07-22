import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ROLES = ['Admin', 'Knowledge Manager', 'Contributor', 'Viewer'] as const;

interface Invite {
  email: string;
  role: typeof ROLES[number];
}

export default function Step2() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<Invite[]>([{ email: '', role: 'Contributor' }]);
  const [emailError, setEmailError] = useState('');

  const addRow = () => setInvites(prev => [...prev, { email: '', role: 'Contributor' }]);

  const update = (i: number, field: keyof Invite, value: string) => {
    setInvites(prev => prev.map((inv, idx) => idx === i ? { ...inv, [field]: value } : inv));
    setEmailError('');
  };

  const remove = (i: number) => setInvites(prev => prev.filter((_, idx) => idx !== i));

  const handleNext = () => {
    const validEmails = invites.filter(i => i.email.trim());
    const invalidEmail = validEmails.find(i => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email));
    if (invalidEmail) {
      setEmailError(`"${invalidEmail.email}" is not a valid email address.`);
      return;
    }
    const existing = JSON.parse(localStorage.getItem('indra_onboarding') ?? '{}');
    localStorage.setItem('indra_onboarding', JSON.stringify({ ...existing, step2: { invites: validEmails } }));
    navigate('/onboarding/step-3');
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Invite your team</h1>
        <p className="text-white/50">
          Add team members to your knowledge hub. You can always add more later.
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {invites.map((invite, i) => (
          <div key={i} className="flex gap-3 items-center animate-fadeIn">
            <input
              type="email"
              value={invite.email}
              onChange={e => update(i, 'email', e.target.value)}
              aria-label={`Invite email ${i + 1}`}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors text-sm"
              placeholder="colleague@company.com"
            />
            <select
              value={invite.role}
              onChange={e => update(i, 'role', e.target.value)}
              aria-label={`Role for invite ${i + 1}`}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-[#0F62FE] transition-colors cursor-pointer"
            >
              {ROLES.map(r => (
                <option key={r} value={r} className="bg-[#080B14]">{r}</option>
              ))}
            </select>
            {invites.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove invite"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#DA1E28] hover:border-[#DA1E28]/50 transition-all duration-200 flex items-center justify-center text-lg"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {emailError && (
        <div role="alert" className="flex items-center gap-2 bg-[#DA1E28]/15 border border-[#DA1E28]/30 rounded-xl px-4 py-3 text-sm text-[#FF8389] mb-4">
          <span>⚠</span> {emailError}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-sm text-[#0F62FE] hover:text-[#4589FF] transition-colors mb-8 font-medium"
      >
        <span className="w-6 h-6 rounded-md border border-[#0F62FE]/50 flex items-center justify-center text-lg leading-none">+</span>
        Add another team member
      </button>

      {/* Role guide */}
      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-white/80 mb-3">Role permissions guide</h2>
        <div className="space-y-2">
          {[
            { role: 'Admin', desc: 'Full control — users, settings, all knowledge' },
            { role: 'Knowledge Manager', desc: 'Create, edit, publish, archive knowledge assets' },
            { role: 'Contributor', desc: 'Create and edit own content, read all approved content' },
            { role: 'Viewer', desc: 'Read-only access to approved knowledge' },
          ].map(r => (
            <div key={r.role} className="flex items-start gap-3 text-sm">
              <span className="text-white/60 font-medium w-36 flex-shrink-0">{r.role}</span>
              <span className="text-white/40">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding/step-1')}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="bg-[#0F62FE] hover:bg-[#0043CE] text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30"
        >
          Next: Connect Integrations →
        </button>
      </div>
    </div>
  );
}
