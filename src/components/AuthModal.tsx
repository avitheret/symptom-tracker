import { useState } from 'react';
import { X, Activity, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth, SIGNUP_CONFIRM_EMAIL } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { PREDEFINED_CONDITIONS } from '../data/medicalData';
import { ONBOARDING_CONDITION_LIMIT } from '../types';

type Mode = 'signin' | 'signup' | 'reset' | 'onboarding' | 'confirm-email';

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp, resetPassword, needsOnboarding, completeOnboarding } = useAuth();
  const { state, addConditionToPatient } = useApp();

  const [mode, setMode] = useState<Mode>(needsOnboarding ? 'onboarding' : 'signin');

  // Fields
  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError]         = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Onboarding
  const [selectedConditionId, setSelectedConditionId] = useState('');

  function reset() {
    setError('');
    setResetSent(false);
    setName('');
    setPassword('');
    setConfirmPassword('');
  }

  function switchMode(m: Mode) {
    reset();
    setMode(m);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password)     { setError('Password is required.'); return; }
    setIsSubmitting(true);
    const err = await signIn(email, password);
    setIsSubmitting(false);
    if (err) { setError(err); return; }
    onClose();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    const err = await signUp(name, email, password);
    setIsSubmitting(false);
    if (err === SIGNUP_CONFIRM_EMAIL) {
      // Supabase project has email confirmation enabled
      switchMode('confirm-email');
      return;
    }
    if (err) { setError(err); return; }
    // signUp sets needsOnboarding=true; proceed to onboarding step
    switchMode('onboarding');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setIsSubmitting(true);
    const err = await resetPassword(email);
    setIsSubmitting(false);
    if (err) { setError(err); return; }
    setResetSent(true);
  }

  function handleOnboardingSubmit() {
    if (!selectedConditionId) return;
    const activePatient = state.patients.find(p => p.id === state.activePatientId);
    if (activePatient && activePatient.conditions.length === 0) {
      addConditionToPatient(activePatient.id, selectedConditionId);
    }
    completeOnboarding();
    onClose();
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';
  const submitCls = 'w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={mode === 'onboarding' || mode === 'confirm-email' ? undefined : onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${mode === 'onboarding' ? 'max-w-lg' : 'max-w-sm'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-blue-600" />
            <span className="font-semibold text-slate-900">
              {mode === 'signin'        ? 'Sign In'
                : mode === 'signup'     ? 'Create Account'
                : mode === 'reset'      ? 'Reset Password'
                : mode === 'confirm-email' ? 'Verify Your Email'
                : 'Choose Your Condition'}
            </span>
          </div>
          {mode !== 'onboarding' && mode !== 'confirm-email' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 py-5">

          {/* ── Sign In ── */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com"
                  className={inputCls}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className={inputCls}
                  disabled={isSubmitting}
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" className={submitCls} disabled={isSubmitting}>
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Sign In
              </button>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="hover:text-blue-600 transition-colors"
                  disabled={isSubmitting}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="hover:text-blue-600 transition-colors"
                  disabled={isSubmitting}
                >
                  Create account →
                </button>
              </div>
            </form>
          )}

          {/* ── Sign Up ── */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder="Your name"
                  className={inputCls}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com"
                  className={inputCls}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Min. 6 characters"
                  className={inputCls}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="Repeat password"
                  className={inputCls}
                  disabled={isSubmitting}
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button type="submit" className={submitCls} disabled={isSubmitting}>
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Create Account
              </button>
              <p className="text-xs text-center text-slate-500 pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-blue-600 hover:underline"
                  disabled={isSubmitting}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* ── Password Reset ── */}
          {mode === 'reset' && (
            resetSent ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-green-600 text-xl">✓</span>
                </div>
                <p className="text-sm font-medium text-slate-800">Reset link sent</p>
                <p className="text-xs text-slate-500">Check your email for a password reset link.</p>
                <button onClick={() => switchMode('signin')} className="text-xs text-blue-600 hover:underline">
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <p className="text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@example.com"
                    className={inputCls}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <button type="submit" className={submitCls} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Send Reset Link
                </button>
                <p className="text-xs text-center text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-blue-600 hover:underline"
                    disabled={isSubmitting}
                  >
                    ← Back to sign in
                  </button>
                </p>
              </form>
            )
          )}

          {/* ── Email Confirmation Pending ── */}
          {mode === 'confirm-email' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">📧</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We sent a verification link to <span className="font-medium text-slate-700">{email}</span>.
                  Click it to confirm your account, then sign in.
                </p>
              </div>
              <button
                onClick={() => switchMode('signin')}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Sign In
              </button>
              <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
                Close
              </button>
            </div>
          )}

          {/* ── Onboarding — condition picker ── */}
          {mode === 'onboarding' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Choose the primary condition you want to track. You can add more conditions and patients later.
              </p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Select {ONBOARDING_CONDITION_LIMIT} condition
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {PREDEFINED_CONDITIONS.map(c => {
                  const isSelected = selectedConditionId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConditionId(c.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="flex-1 min-w-0 truncate font-medium">{c.name}</span>
                      {isSelected && <CheckCircle2 size={14} className="text-blue-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleOnboardingSubmit}
                disabled={!selectedConditionId}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Get Started
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
