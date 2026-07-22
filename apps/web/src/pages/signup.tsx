import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trpcClient } from '../utils/trpc';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function SignupPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [form, setForm] = useState({
    orgName: '',
    displayName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const passwordStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (trpcClient as any).auth.googleAuth.mutate({
        email: user.email || '',
        displayName: user.displayName || undefined,
        uid: user.uid,
      });

      authLogin(res.token, res.user);
      navigate('/onboarding/step-1');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];
  const strengthColor = ['', 'bg-[#DA1E28]', 'bg-[#F1C21B]', 'bg-[#0F62FE]', 'bg-[#24A148]'][passwordStrength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (passwordStrength < 2) {
      setError('Please choose a stronger password (min 8 chars, uppercase, number).');
      return;
    }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (trpcClient as any).auth.signup.mutate({
        email: form.email,
        password: form.password,
        orgName: form.orgName,
        orgSize: 50,
      });
      authLogin(result.token, result.user);
      navigate('/onboarding/step-1');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<{ id: keyof typeof form; label: string; type: string; placeholder: string; autoComplete: string }> = [
    { id: 'orgName', label: 'Organization name', type: 'text', placeholder: 'Acme Corp', autoComplete: 'organization' },
    { id: 'displayName', label: 'Your full name', type: 'text', placeholder: 'Jane Smith', autoComplete: 'name' },
    { id: 'email', label: 'Work email', type: 'email', placeholder: 'jane@acme.com', autoComplete: 'email' },
  ];

  return (
    <div className="min-h-screen bg-[#080B14] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div aria-hidden="true">
          <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-[#8A3FFC]/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-[#0F62FE]/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
            <span className="text-white font-bold">I</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">
            INDRA <span className="text-[#8A3FFC]">AI</span>
          </span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="text-2xl font-bold text-white leading-tight">
            Set up your knowledge hub in minutes
          </div>
          {[
            '14-day free trial, no credit card required',
            'Full access to all enterprise features',
            'Dedicated onboarding support',
            'Connect 20+ integrations on day one',
          ].map(item => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[#24A148]/20 border border-[#24A148]/50 flex items-center justify-center flex-shrink-0">
                <span className="text-[#24A148] text-xs">✓</span>
              </div>
              <span className="text-white/70 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            <span className="font-bold text-lg text-white">INDRA AI</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-white/50 mb-8">Free 14-day trial — no credit card needed.</p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {fields.map(f => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block text-sm font-medium text-white/70 mb-1.5">
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  required
                  value={form[f.id]}
                  onChange={handleChange(f.id)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                  placeholder={f.placeholder}
                />
              </div>
            ))}

            {/* Password with strength meter */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={handleChange('password')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                  placeholder="Min 8 chars, uppercase, number"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= passwordStrength ? strengthColor : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/50">{strengthLabel}</span>
                </div>
              )}
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 bg-[#DA1E28]/15 border border-[#DA1E28]/30 rounded-xl px-4 py-3 text-sm text-[#FF8389]">
                <span>⚠</span> {error}
              </div>
            )}

            <p className="text-xs text-white/40 leading-relaxed">
              By creating an account you agree to our{' '}
              <a href="#" className="text-[#0F62FE] hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-[#0F62FE] hover:underline">Privacy Policy</a>.
            </p>

            <button
              type="submit"
              disabled={loading || !form.email || !form.password || !form.orgName || !form.displayName}
              className="w-full bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Account & Continue →'
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
              <div className="relative flex justify-center text-xs text-white/40 bg-[#080B14] px-4">or continue with</div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              <span className="text-lg">G</span> Google Workspace SSO
            </button>

            <p className="text-center text-sm text-white/50">
              Already have an account?{' '}
              <Link to="/login" className="text-[#0F62FE] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
