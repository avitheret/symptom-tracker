/**
 * Landing — unauthenticated entry page.
 *
 * Shown to logged-out users instead of jumping straight to the auth modal.
 * No shared nav, no bottom bar, no modals — fully standalone.
 */

import { Mic, CloudSun, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    icon: Mic,
    color: 'bg-blue-500',
    ring: 'bg-blue-50 border-blue-100',
    title: 'Voice-first logging',
    body: 'Say "Hey Tracker, log headache 7 out of 10" — done in two seconds. No typing, no tapping.',
  },
  {
    icon: CloudSun,
    color: 'bg-amber-400',
    ring: 'bg-amber-50 border-amber-100',
    title: 'Weather correlation',
    body: 'See how barometric pressure, temperature, and humidity shape your symptoms day by day.',
  },
  {
    icon: Sparkles,
    color: 'bg-violet-500',
    ring: 'bg-violet-50 border-violet-100',
    title: 'AI-powered insights',
    body: 'Multi-factor analysis across medications, supplements, and environment — with confidence ratings.',
  },
] as const;

const REASSURANCES = [
  'No subscription required',
  'Works offline',
  'Private & on-device by default',
];

interface Props {
  onGetStarted: () => void;
}

export default function Landing({ onGetStarted }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-violet-900 px-6 pt-16 pb-20 overflow-hidden">

        {/* Decorative blobs */}
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 -left-12 w-52 h-52 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"
        />

        {/* App badge */}
        <div className="relative flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-violet-500 flex items-center justify-center shadow-lg">
            <Mic size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">SymptomTrack</span>
        </div>

        {/* Headline */}
        <h1 className="relative text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
          Your health, tracked<br />
          <span className="text-violet-300">hands-free.</span>
        </h1>

        <p className="relative mt-4 text-base text-slate-300 leading-relaxed max-w-sm">
          Log symptoms by voice, spot patterns with AI, and share reports with your care team — in seconds.
        </p>

        {/* CTA */}
        <button
          onClick={onGetStarted}
          className="relative mt-8 inline-flex items-center gap-2 bg-violet-500 hover:bg-violet-600 active:scale-[0.97] text-white font-semibold text-base px-6 py-3.5 rounded-2xl shadow-lg transition-all min-h-[52px]"
        >
          Get started free
          <ArrowRight size={18} />
        </button>

        {/* Reassurances */}
        <div className="relative mt-5 flex flex-wrap gap-3">
          {REASSURANCES.map(r => (
            <span
              key={r}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400"
            >
              <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 py-10 max-w-lg mx-auto w-full space-y-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest text-center mb-6">
          What makes it different
        </p>

        {FEATURES.map(({ icon: Icon, color, ring, title, body }) => (
          <div
            key={title}
            className={`flex gap-4 p-4 rounded-2xl border ${ring} bg-white shadow-sm`}
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${color} flex items-center justify-center shadow-sm`}>
              <Icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer CTA strip ─────────────────────────────────────────────── */}
      <div className="px-4 pb-10 pt-2 max-w-lg mx-auto w-full">
        <button
          onClick={onGetStarted}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm py-4 rounded-2xl transition-all min-h-[52px] shadow-sm"
        >
          Create your free account
          <ArrowRight size={16} />
        </button>
        <p className="text-center text-xs text-slate-400 mt-3">
          Already have an account?{' '}
          <button
            onClick={onGetStarted}
            className="text-violet-600 font-medium underline underline-offset-2 min-h-[44px] inline-flex items-center"
          >
            Sign in
          </button>
        </p>
      </div>

    </div>
  );
}
