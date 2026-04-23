# SymptomTrack — Claude Code Rules

## Always follow these rules for every task:

1. **Voice-first** — every feature must work via voice command primarily. Manual UI is secondary. New features require a corresponding voice trigger.

2. **Test after every task** — run `tsc -b --noEmit` (zero errors required), test all affected voice commands, verify no regressions on existing commands (LOG_SYMPTOM, CHECK_IN, LOG_TRIGGER, LOG_MEAL, LOG_MEDICATION, LOG_SUPPLEMENT).

3. **No conflicts** — after each task check for duplicate `st-` localStorage keys, verify no context method names were renamed, confirm no duplicate component imports.

4. **Version bump** — bump `APP_VERSION` in `src/components/Dashboard.tsx` by one sub-version after every completed task (e.g. v3.2.0 → v3.2.1 for patches, v3.3.0 for new features).

5. **Ask before acting** — if a request is ambiguous, ask one clarifying question before writing any code. Also proactively raise edge cases or feature scenarios the request didn't explicitly cover (e.g. "What should happen if X?") — ask these upfront rather than making silent assumptions.

## Stack constraints (never violate):

- Tailwind v4 — no `tailwind.config.js`. Theme overrides in `src/index.css` under `@theme {}` only.
- All shared UI from `./ui` barrel only: `Card`, `Button`, `Sheet`, `Chip`, `TabBar`, `SectionHeader`, `Badge`, `EmptyState`, `SeverityBadge`, `StatCard`.
- Icons: `lucide-react` only.
- Charts: `Recharts` only.
- TypeScript strict — `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`. No implicit `any`.
- All global state via `useApp()`. Auth via `useAuth()`. Never access context directly.
- Supabase always gated behind `CLOUD_ENABLED` check. Never assume it's available.
- `localStorage` keys always prefixed `st-`.
- Symptom IDs: `${conditionId}-s${index+1}` — never change this format.
- Card pattern: `bg-white rounded-2xl shadow-sm border border-slate-100`.
- Touch targets: `min-h-[44px]` on all buttons. `active:scale-[0.98]` on tappable elements.
- Bottom safe area: `env(safe-area-inset-bottom)`.
- Do not modify: service worker (`src/sw.ts`), `CLOUD_ENABLED` guard pattern, symptom ID format.

## Deploy after every task:

```bash
git add -A && git commit -m "task: <short description>" && git push origin main
netlify deploy --build --prod
```
