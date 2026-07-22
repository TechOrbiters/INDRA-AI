import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Legal', 'Manufacturing', 'Consulting', 'Education', 'Other'];
const ORG_SIZES = ['1–10', '11–50', '51–200', '201–1000', '1000+'];

export default function Step1() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ orgName: '', industry: '', size: '', domain: '' });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('indra_onboarding', JSON.stringify({ step1: form }));
    navigate('/onboarding/step-2');
  };

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Tell us about your organization</h1>
        <p className="text-white/50">This helps INDRA AI tailor the knowledge graph to your context.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="org-name-step1" className="block text-sm font-medium text-white/70 mb-1.5">
            Organization name <span className="text-[#DA1E28]">*</span>
          </label>
          <input
            id="org-name-step1"
            type="text"
            required
            value={form.orgName}
            onChange={e => set('orgName')(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
            placeholder="Acme Corporation"
          />
        </div>

        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-white/70 mb-1.5">
            Primary domain
          </label>
          <input
            id="domain"
            type="text"
            value={form.domain}
            onChange={e => set('domain')(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
            placeholder="acme.com"
          />
        </div>

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-white/70 mb-2.5">
              Industry <span className="text-[#DA1E28]">*</span>
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => set('industry')(ind)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    form.industry === ind
                      ? 'bg-[#0F62FE]/20 border-[#0F62FE] text-[#0F62FE]'
                      : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <fieldset>
            <legend className="block text-sm font-medium text-white/70 mb-2.5">
              Organization size <span className="text-[#DA1E28]">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {ORG_SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => set('size')(size)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    form.size === size
                      ? 'bg-[#8A3FFC]/20 border-[#8A3FFC] text-[#8A3FFC]'
                      : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {size} employees
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!form.orgName || !form.industry || !form.size}
            className="bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30"
          >
            Next: Team Setup →
          </button>
        </div>
      </form>
    </div>
  );
}
