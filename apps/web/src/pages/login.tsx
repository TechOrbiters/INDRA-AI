import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trpcClient } from '../utils/trpc';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

type LoginStep = 'credentials' | 'mfa';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleLogin = async () => {
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
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (trpcClient as any).auth.login.mutate({ email, password });
      if (result.requiresMfa) {
        setStep('mfa');
      } else {
        authLogin(result.token, result.user);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (trpcClient as any).auth.verifyMfa.mutate({ email, code: mfaCode });
      authLogin(result.token, result.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired MFA code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B14] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Orbs */}
        <div aria-hidden="true">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#0F62FE]/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-[#8A3FFC]/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-2 z-10">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
            <span className="text-white font-bold">I</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-white">
            INDRA <span className="text-[#8A3FFC]">AI</span>
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <blockquote className="text-2xl font-semibold text-white leading-relaxed mb-4">
            "INDRA AI reduced our knowledge retrieval time by 70% and paid for itself in 6 weeks."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC]" />
            <div>
              <div className="text-sm font-semibold text-white">Sarah Chen</div>
              <div className="text-xs text-white/50">CTO, Meridian Capital</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
            <span className="font-bold text-lg text-white">INDRA AI</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {step === 'credentials' ? 'Welcome back' : 'Two-factor auth'}
          </h1>
          <p className="text-white/50 mb-8">
            {step === 'credentials'
              ? 'Sign in to your organization\'s knowledge hub'
              : `We sent a 6-digit code to ${email}`}
          </p>

          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1.5">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                    placeholder="••••••••"
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
                <div className="flex justify-end mt-1.5">
                  <Link to="/reset-password" className="text-xs text-[#0F62FE] hover:underline">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-[#DA1E28]/15 border border-[#DA1E28]/30 rounded-xl px-4 py-3 text-sm text-[#FF8389]">
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center text-xs text-white/40 bg-[#080B14] px-4">or continue with</div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3.5 rounded-xl transition-all duration-200 disabled:opacity-50"
              >
                <span className="text-lg">G</span> Google Workspace SSO
              </button>

              <p className="text-center text-sm text-white/50">
                Don't have an account?{' '}
                <Link to="/signup" className="text-[#0F62FE] hover:underline font-medium">
                  Start free trial
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-5" noValidate>
              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-white/70 mb-1.5">
                  Authentication Code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.3em] placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                  placeholder="000000"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-[#DA1E28]/15 border border-[#DA1E28]/30 rounded-xl px-4 py-3 text-sm text-[#FF8389]">
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="w-full bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Verify Code'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="w-full text-center text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
