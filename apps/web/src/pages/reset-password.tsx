import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { trpcClient } from '../utils/trpc';

type ResetStep = 'email' | 'sent';

export default function ResetPasswordPage() {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (trpcClient as any).auth.resetPassword.mutate({ email });
      setStep('sent');
    } catch (err: unknown) {
      // Always show success to prevent email enumeration
      setStep('sent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B14] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#8A3FFC] flex items-center justify-center">
            <span className="text-white font-bold text-sm">I</span>
          </div>
          <span className="font-bold text-lg text-white">INDRA AI</span>
        </div>

        {step === 'email' ? (
          <>
            <h1 className="text-3xl font-bold text-white mb-2">Reset your password</h1>
            <p className="text-white/50 mb-8">
              Enter your work email and we'll send a secure reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-white/70 mb-1.5">
                  Work email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE] transition-colors"
                  placeholder="you@company.com"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-[#DA1E28]/15 border border-[#DA1E28]/30 rounded-xl px-4 py-3 text-sm text-[#FF8389]">
                  <span>⚠</span> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-[#0F62FE] hover:bg-[#0043CE] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#0F62FE]/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <p className="text-center text-sm text-white/50">
                Remember your password?{' '}
                <Link to="/login" className="text-[#0F62FE] hover:underline font-medium">
                  Back to sign in
                </Link>
              </p>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#24A148]/15 border border-[#24A148]/30 flex items-center justify-center mx-auto mb-6 text-3xl">
              ✉️
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-white/50 mb-6">
              If <span className="text-white font-medium">{email}</span> is associated with an account,
              you'll receive a password reset link shortly.
            </p>
            <p className="text-xs text-white/30 mb-8">
              Check your spam folder if it doesn't arrive within 5 minutes.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-[#0F62FE] hover:underline font-medium"
            >
              ← Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
