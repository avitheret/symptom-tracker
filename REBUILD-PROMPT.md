# SymptomTrack — Full Build Prompt

Build a **mobile-first Progressive Web App (PWA)** called **SymptomTrack** for tracking chronic health conditions, symptoms, triggers, medications, and daily wellness check-ins. The app is client-side only (no backend) — all data persists in `localStorage`.

---

## Tech Stack

- **React 19** + **TypeScript** (strict mode)
- **Vite** (dev server + build)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed)
- **Recharts** for all charts (Line, Bar, Scatter, ResponsiveContainer)
- **lucide-react** for all icons
- **vite-plugin-pwa** for service worker, manifest, and offline support

Install exactly these dependencies:

```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "lucide-react": "^0.575.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "recharts": "^3.7.0",
    "tailwindcss": "^4.2.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "vite": "^7.3.1",
    "vite-plugin-pwa": "^1.2.0",
    "typescript": "~5.9.3",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3"
  }
}
```

---

## Vite Config

- Import `react()`, `tailwindcss()`, and `VitePWA()` plugins.
- `server: { host: true, port: parseInt(process.env.PORT || '5173') }`
- `preview: { host: true, port: 4173, allowedHosts: true }` (enables Cloudflare Tunnel testing)
- PWA manifest: `name: 'SymptomTrack'`, `short_name: 'SymptomTrack'`, `theme_color: '#4F46E5'`, `background_color: '#F8FAFC'`, `display: 'standalone'`, `orientation: 'portrait'`.
- Register type: `autoUpdate`.
- Generate PWA icons in sizes 48, 72, 96, 128, 144, 152, 167, 180, 192, 512 from a simple SVG (indigo `#4F46E5` background, white heart-pulse polyline).

### `index.html`

Include these iOS PWA meta tags:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="SymptomTrack" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#4F46E5" />
<link rel="apple-touch-icon" href="/icon-180.png" />
```

---

## Design System

- **Background**: `bg-slate-50`
- **Cards**: `bg-white rounded-2xl shadow-sm border border-slate-100`
- **Primary accent**: Indigo (`indigo-600`, `indigo-50`)
- **Semantic colours**: Rose for check-ins, amber for triggers, violet for medications, emerald for positive trends, red for negative
- **Typography**: System font stack (Tailwind default), text-slate-900 headings, text-slate-500 secondary text
- **Touch targets**: All buttons minimum `min-h-[40px]` or `min-h-[44px]`, tap-friendly padding
- **Transitions**: `transition-colors` on all interactive elements, `active:` states for mobile press feedback
- **Bottom nav safe area**: `paddingBottom: 'env(safe-area-inset-bottom)'` for notched devices

---

## Data Model (`src/types/index.ts`)

### Core Types

```typescript
Symptom          { id, name, conditionId }
Condition        { id, name, color (hex), symptoms: Symptom[] }
PatientCondition { conditionId, customSymptoms: Symptom[], addedAt: number }
Patient          { id, userId: string|null, name, dateOfBirth?, notes?, isDefault, conditions: PatientCondition[], customConditions: Condition[], createdAt }
TrackingEntry    { id, patientId, conditionId, conditionName, symptomId, symptomName, date (YYYY-MM-DD), dayOfWeek, time (HH:MM 24h), severity (1-10), notes, triggers?: string[], createdAt }
TriggerLog       { id, patientId, date, dayOfWeek, time, triggers: string[], conditionId?, conditionName?, notes, createdAt }
DailyCheckIn     { id, patientId, date (one per day per patient), dayOfWeek, time, healthScore (1-10), stress ('low'|'medium'|'high'), sleepHours (0-12), energy (1-10), mood (1-10), notes, createdAt }
MedicationLog    { id, patientId, name, type ('medication'|'treatment'), dosage?, route?, date, dayOfWeek, time, conditionId?, conditionName?, effectiveness: EffectivenessRating, notes, createdAt }
```

### Constants

```typescript
PREDEFINED_TRIGGERS = ['Food/Diet', 'Stress', 'Poor sleep', 'Weather change', 'Exercise', 'Alcohol', 'Caffeine', 'Screen time', 'Hormonal']
MEDICATION_ROUTES = ['Oral', 'Topical', 'Injection', 'Inhaled', 'Sublingual', 'Other']
EffectivenessRating = 'no_effect' | 'slight' | 'moderate' | 'major'
```

### Dashboard Widget System

```typescript
type WidgetId = 'stats' | 'forecast' | 'checkin' | 'quickActions' | 'conditions' | 'recentLog'
```

Users can show/hide widgets. Widget preferences persist to localStorage key `st-dashboard-prefs`. Sync across tabs via `storage` event listener.

### Analytics Types

```typescript
PatternInsight   { id, type ('time-of-day'|'day-of-week'|'trend'|'co-occurrence'|'trigger'|'checkin'), title, description, confidence ('low'|'medium'|'high'), dateRange, supportingCount }
SymptomCluster   { id, clusterName, symptoms[], occurrenceCount, dateRange, avgSeverity }
TrendResult      { direction ('improving'|'worsening'|'stable'), percentChange, windowDays }
ForecastResult   { prediction, confidence, basis[], disclaimer }
ContributingFactor { factor, weight (0-100), description, dataPoints }
```

### Views

```typescript
type View = 'dashboard' | 'conditions' | 'reports' | 'insights' | 'patients'
```

---

## Predefined Medical Data (`src/data/medicalData.ts`)

12 conditions, each with 8 predefined symptoms:

| Condition | Colour | Symptoms |
|-----------|--------|----------|
| Migraine | `#6366f1` | Throbbing headache, Nausea, Light sensitivity, Sound sensitivity, Visual aura, Vomiting, Neck stiffness, Dizziness |
| IBS | `#f59e0b` | Abdominal pain, Bloating, Diarrhea, Constipation, Cramping, Gas, Mucus in stool, Urgency to defecate |
| Arthritis | `#ef4444` | Joint pain, Joint stiffness, Swelling, Reduced range of motion, Morning stiffness, Warmth around joints, Fatigue, Tenderness |
| Asthma | `#06b6d4` | Shortness of breath, Wheezing, Chest tightness, Coughing, Rapid breathing, Difficulty sleeping, Exercise-induced symptoms, Mucus production |
| Diabetes | `#10b981` | Increased thirst, Frequent urination, Fatigue, Blurred vision, Slow-healing wounds, Tingling hands/feet, Unexplained weight loss, Increased hunger |
| Anxiety | `#8b5cf6` | Excessive worry, Restlessness, Racing heart, Sweating, Trembling, Shortness of breath, Difficulty concentrating, Sleep disturbance |
| Depression | `#64748b` | Persistent sadness, Loss of interest, Fatigue, Sleep changes, Appetite changes, Difficulty concentrating, Feelings of worthlessness, Social withdrawal |
| Fibromyalgia | `#ec4899` | Widespread pain, Fatigue, Cognitive difficulties (fog), Sleep problems, Headaches, Depression, Irritable bowel, Sensitivity to temperature |
| Eczema | `#f97316` | Itching, Dry skin, Redness, Rash, Scaly patches, Oozing or crusting, Skin thickening, Inflammation |
| Lupus | `#dc2626` | Butterfly rash, Joint pain, Fatigue, Fever, Hair loss, Chest pain, Sensitivity to sunlight, Kidney problems |
| Crohn's Disease | `#84cc16` | Abdominal pain, Diarrhea, Bloody stool, Weight loss, Fatigue, Fever, Mouth sores, Nausea |
| Hypertension | `#0ea5e9` | Headache, Dizziness, Chest pain, Shortness of breath, Nosebleeds, Blurred vision, Nausea, Flushing |

---

## Sample Data Generator (`src/data/sampleData.ts`)

Create a `generateSampleData()` function that generates realistic demo data spread over the last 60 days:
- ~50-100 tracking entries across various conditions and symptoms, with random severities (1-10), random times, and occasional triggers
- ~30 trigger logs with 1-3 triggers each from the PREDEFINED_TRIGGERS list
- ~30 daily check-ins with realistic health scores, stress levels, sleep hours, energy, and mood
- ~20 medication logs with varied effectiveness ratings

Each function takes `patientId` as a parameter. Use `crypto.randomUUID()` for IDs. Pre-compute `dayOfWeek` and `createdAt` for each entry.

---

## State Management (`src/contexts/AppContext.tsx`)

Use React `useReducer` + Context. Persist the full state to `localStorage` key `symptom-tracker-v2` on every change.

### State Shape

```typescript
{
  patients: Patient[],
  activePatientId: string | null,
  entries: TrackingEntry[],
  triggerLogs: TriggerLog[],
  checkIns: DailyCheckIn[],
  medicationLogs: MedicationLog[],
  selectedConditionId: string | null,
  view: View
}
```

### Reducer Actions

- Patient CRUD: `CREATE_PATIENT`, `UPDATE_PATIENT`, `DELETE_PATIENT`, `SET_ACTIVE_PATIENT`
- Conditions: `ADD_CONDITION_TO_PATIENT`, `REMOVE_CONDITION_FROM_PATIENT`, `ADD_CUSTOM_CONDITION`, `ADD_SYMPTOM_TO_PATIENT`
- Entries: `ADD_ENTRY`, `BULK_ADD_ENTRIES`, `DELETE_ENTRY`
- Triggers: `ADD_TRIGGER_LOG`, `BULK_ADD_TRIGGER_LOGS`, `DELETE_TRIGGER_LOG`
- Check-ins: `ADD_CHECKIN`, `UPDATE_CHECKIN`, `BULK_ADD_CHECKINS`
- Medications: `ADD_MEDICATION_LOG`, `DELETE_MEDICATION_LOG`, `BULK_ADD_MEDICATION_LOGS`
- Navigation: `SELECT_CONDITION`, `SET_VIEW`
- Persistence: `LOAD`

### Context API (via `useApp()` hook)

Expose methods that dispatch to reducer: `createPatient()`, `updatePatient()`, `deletePatient()`, `setActivePatient()`, `addConditionToPatient()`, `removeConditionFromPatient()`, `addCustomCondition()`, `addSymptom()`, `addEntry()`, `deleteEntry()`, `addTriggerLog()`, `deleteTriggerLog()`, `addCheckIn()`, `updateCheckIn()`, `getTodayCheckIn()`, `addMedicationLog()`, `deleteMedicationLog()`, `selectCondition()`, `setView()`, `loadSampleData()`, `getActivePatient()`, `getPatientConditions()`.

**Important**: `getPatientConditions()` should merge predefined conditions with the patient's custom conditions, filtering to only conditions the patient has added. Each predefined condition's symptoms should include any custom symptoms the patient added.

**Important**: When deleting a patient, cascade-delete all their entries, trigger logs, check-ins, and medication logs.

**Important**: `getTodayCheckIn()` returns the check-in for today's date for the active patient, or `undefined`.

**Important**: `loadSampleData()` creates a default patient (if none exists), adds 3-4 conditions (Migraine, IBS, Anxiety), then bulk-adds the sample data.

---

## Authentication (`src/contexts/AuthContext.tsx`)

Simple localStorage-based auth (no real backend). Store accounts in localStorage key `st-accounts` as `Array<{id, name, email, password}>`.

### `useAuth()` hook

```typescript
{ user, isAuthenticated, needsOnboarding, signUp, signIn, signOut, resetPassword, updateProfile, changePassword, completeOnboarding }
```

- `signUp(name, email, password)`: Validate email uniqueness, store account, create session.
- `signIn(email, password)`: Look up account, verify password, create session.
- `signOut()`: Clear session (keep accounts).
- `completeOnboarding()`: Marks onboarding done so the auth modal doesn't re-appear.

---

## Analytics Engine (`src/utils/analytics.ts`)

This is the core intelligence. Implement these pattern detection functions:

### 1. `detectTimeOfDayPattern(entries)`
Group entries by time bucket (Morning 5-12, Afternoon 12-17, Evening 17-21, Night 21-5). If any bucket has ≥40% of entries and ≥5 entries, report it as a pattern.

### 2. `detectDayOfWeekPattern(entries)`
Count entries per day of week. If any day has ≥ 2× the average, flag it. Confidence based on total count.

### 3. `detectTrend(entries)`
Compare severity average of the most recent 14-day window vs the prior 14-day window. Report as improving/worsening/stable with percent change.

### 4. `detectCoOccurrence(entries)`
Find symptom pairs that appear on the same day within 2 hours of each other, across ≥3 different days. Report the pair and co-occurrence count.

### 5. `detectClusters(entries) → SymptomCluster[]`
Group symptoms occurring within a 2-hour window on the same day. A cluster must have ≥2 symptoms and appear on ≥3 days. Return cluster name (joined symptom names), occurrence count, avg severity, date range.

### 6. `gatherAllPatterns(entries) → PatternInsight[]`
Run all pattern detectors and also include trigger and check-in correlation patterns. Return combined array sorted by confidence (high first).

### 7. `detectTriggerPatterns(triggerLogs, entries)`
Find the top triggers by frequency. Correlate each trigger with average severity of entries on the same day.

### 8. `getTriggerFrequency(triggerLogs)`
Return chart-ready data: `{trigger, count}[]` sorted descending.

### 9. `detectCheckInCorrelations(checkIns, entries)`
Correlate poor sleep (<6h), high stress, and low energy/mood with symptom counts and severity on the same day.

### 10. `getDailyCorrelationData(checkIns, entries)`
Return daily aggregated data for Recharts scatter plots: `{date, healthScore, sleepHours, stress, energy, mood, symptomCount, avgSeverity}[]`.

### 11. `generateForecast(entries, checkIns, triggerLogs) → ForecastResult`
Predict tomorrow's symptom activity based on 6 signals:
1. Day-of-week historical frequency
2. Recent trend direction
3. Cluster density (recent clusters)
4. Last night's sleep (from most recent check-in)
5. Recent stress level
6. Recent trigger activity

Return a natural language prediction, confidence level, list of basis signals used, and a medical disclaimer.

### 12. `analyzeContributingFactors(entries, checkIns, triggerLogs) → ContributingFactorsResult`
Weight factors (poor sleep, high stress, specific triggers, low energy) against high-severity entries. Return sorted by weight.

---

## Components

### Layout

#### `App.tsx`
- Wraps everything in `<AuthProvider>` and `<AppProvider>`.
- Renders `<Header>`, main content area (view-switching), `<BottomNav>`, `<VoiceButton>`, `<VoiceCommandToast>`.
- Manages global modals: `AuthModal`, `UserProfile`, `AddPatientModal`, `CheckInModal`, `TriggerModal`, `MedicationModal`.
- Handles voice command routing via `useVoiceCommands` hook — maps each `VoiceCommand` to a view switch or modal open.

#### `Header.tsx`
- Top bar with app logo/name, desktop navigation tabs (Dashboard, Conditions, Reports, Insights, Patients), patient switcher dropdown, and auth/profile button.
- Patient dropdown: shows all patients with a radio-style selector, "Add patient" button at the bottom.
- On mobile: icons only for nav. On sm+: icons + labels.

#### `BottomNav.tsx`
- Fixed bottom navigation for mobile (`lg:hidden`).
- 5 tabs: Home (LayoutDashboard), Log (List), Reports (BarChart2), Insights (Brain), Patients (Users).
- Active tab gets indigo colour + dot indicator above icon.
- `paddingBottom: env(safe-area-inset-bottom)` for notched devices.
- All buttons `min-w-[52px] min-h-[52px]` for touch targets.

#### `Footer.tsx`
- Simple footer shown only on desktop (`hidden lg:block`).

### Dashboard

#### `Dashboard.tsx`
- Time-of-day greeting: "Good morning/afternoon/evening, {firstName}!"
- Date label in en-GB format: "Monday, 8 March"
- "Customise" button → opens `DashboardCustomizer`.
- **3 quick-action buttons** (full-width row below greeting): Check In (rose), Triggers (amber), Meds (violet). These open the respective global modals via props `onOpenCheckIn`, `onOpenTrigger`, `onOpenMedication`.
- Customisable widgets (all toggleable):
  - **Stats**: 3-column grid — Total Entries, This Week, Avg Severity
  - **Forecast**: `<ForecastCard />` showing tomorrow's prediction
  - **Check-In**: Today's check-in summary or "No check-in yet" CTA
  - **Quick Actions**: Top 3 conditions as quick-log buttons + "Add Condition" button
  - **Conditions**: Grid of `<ConditionCard />` components
  - **Recent Log**: Last 5 entries with severity colour coding (green <4, amber 4-6, red ≥7)
- Demo data banner when no entries exist: "Explore with demo data" button calls `loadSampleData()`.

#### `ForecastCard.tsx`
- Calls `generateForecast()` from analytics.
- Shows prediction text, confidence badge, basis signal pills, and disclaimer.

#### `ConditionCard.tsx`
- Card for each condition showing name, colour dot, symptom count, entry count, last entry date.
- "Log" button and click-to-view detail.

#### `DashboardCustomizer.tsx`
- Modal overlay with checkbox list of all `WidgetId` options.
- Shows label + description for each.
- "Done" button saves and closes.

### Modal Forms

#### `TrackingModal.tsx`
- Bottom-sheet style modal for logging a symptom episode.
- Fields: Symptom (dropdown of condition's symptoms), Date (defaults today), Time (defaults now), Severity (1-10 slider with colour gradient), Notes (textarea), Triggers (multi-select from PREDEFINED_TRIGGERS with custom add).
- Validates: symptom required.
- Vibration feedback on save (`navigator.vibrate?.(50)`).

#### `CheckInModal.tsx`
- Daily wellness check-in form.
- Fields: Date, Time, Health Score (1-10 slider), Stress (Low/Medium/High segmented buttons), Sleep Hours (0-12 slider), Energy (1-10 slider), Mood (1-10 slider), Notes.
- Colour-coded sliders: score-based gradient from red (low) through amber to green (high).
- One check-in per day per patient — if one exists for today, it updates rather than creates.

#### `TriggerModal.tsx`
- Log external triggers.
- Fields: Date, Time, Triggers (multi-select chips from PREDEFINED_TRIGGERS + custom input), Condition (optional dropdown), Notes.
- Validates: at least one trigger selected.

#### `MedicationModal.tsx`
- Log medication/treatment.
- Fields: Name (text), Type (medication/treatment toggle), Dosage (text), Route (dropdown from MEDICATION_ROUTES), Date, Time, Condition (optional dropdown), Effectiveness (4-option segmented: No effect, Slight, Moderate, Major), Notes.
- Validates: name required.

#### `AddConditionModal.tsx`
- Shows list of 12 predefined conditions for quick-add.
- Each shows colour dot, name, and symptom preview.
- Conditions already added to the patient are disabled/greyed.
- "Add Custom Condition" option at the bottom for arbitrary conditions.

#### `AddSymptomModal.tsx`
- Add custom symptom to a condition.
- Simple text input + save.

#### `AddPatientModal.tsx`
- Create new patient: Name, Date of Birth, initial condition selection.

#### `AuthModal.tsx`
- Tabs: Sign Up / Sign In / Forgot Password.
- Sign Up: Name, Email, Password, Confirm Password. Creates account + default patient.
- Sign In: Email, Password.
- Forgot Password: Email (mock — just shows success message).
- Form validation with inline error messages.

#### `UserProfile.tsx`
- Profile editing: Name, Email (read-only).
- Password change: Current, New, Confirm.
- Sign out button.

### Reports

#### `Reports.tsx`
- Tabbed interface: Chart | Log | Doctor | Correlations | Medications.
- Date range filter: 7d / 30d / 90d / All.
- Condition and symptom filters.
- **Chart tab**: Line or bar chart (toggle) showing severity over time via Recharts. Multi-line by condition with colour coding.
- **Log tab**: Scrollable list of all entries with inline delete. CSV export button.
- **Doctor tab**: `<DoctorReport />` — structured, printable summary.
- **Correlations tab**: `<CorrelationCharts />` — scatter plots.
- **Medications tab**: `<MedicationTab />` — medication effectiveness tracking.

#### `DoctorReport.tsx`
- Export-friendly medical report: date range summary, conditions tracked, symptom frequency table, top triggers, medications with effectiveness, and check-in averages.
- Print-optimised styles.

#### `CorrelationCharts.tsx`
- Recharts scatter plots showing correlations between check-in data (sleep, stress, energy, mood) and symptom severity/frequency.
- Uses `getDailyCorrelationData()` from analytics.

#### `MedicationTab.tsx`
- Shows medication usage frequency and effectiveness breakdown.
- Bar chart of medication usage.
- Effectiveness distribution per medication.

### Insights

#### `Insights.tsx`
- 5 tabs: Patterns | Clusters | Timeline | Triggers | Factors.
- Tab bar with icons, scrollable on mobile, pill-style active state.

#### `InsightPatterns.tsx`
- Displays `PatternInsight[]` as cards.
- Each card shows: icon by type, title, description, confidence badge (high=green, medium=amber, low=slate), supporting count.
- Empty state when no patterns detected (needs ≥5 entries).

#### `InsightClusters.tsx`
- Displays `SymptomCluster[]` as cards.
- Each card: cluster name, symptoms list, occurrence count, avg severity, date range.
- Empty state message.

#### `HealthTimeline.tsx`
- Recharts timeline visualisation.
- Toggle filters: entries, check-ins, triggers.
- Date range picker.
- Combined view of all health events on a time axis.

#### `InsightTriggers.tsx`
- Top triggers by frequency (bar chart).
- Severity correlation per trigger.
- Empty state with instruction to use Triggers button.

#### `ContributingFactors.tsx`
- Horizontal bar chart of contributing factors weighted by impact.
- Shows data points count per factor.
- Medical disclaimer: "This analysis is not clinical advice."

### Other

#### `ConditionsList.tsx`
- Grid of all patient conditions.
- Click condition → expands to show symptoms with individual log buttons.
- "Add Condition" button.

#### `PatientManager.tsx`
- List of all patients with edit/delete/switch.
- Default patient indicator.
- "Add Patient" button.

---

## Voice Commands (`src/hooks/useVoiceCommands.ts`)

Implement continuous voice listening using the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).

### States

```typescript
type VoiceState = 'unsupported' | 'idle' | 'denied' | 'wake-listening' | 'command-listening' | 'confirmed'
```

### Wake Word

**"Hey Tracker"** — wake phrases to match (case-insensitive substring match):

```typescript
['hey tracker', 'hey track', 'okay tracker', 'ok tracker', 'a tracker']
```

### Commands (matched after wake word activation)

| Command | Trigger Phrases | Action |
|---------|----------------|--------|
| LOG_SYMPTOM | "add log", "log symptom", "new symptom", "add symptom" | Navigate to conditions view |
| CHECK_IN | "check in", "checkin", "daily check", "add check" | Open CheckInModal |
| LOG_TRIGGER | "log trigger", "add trigger", "new trigger" | Open TriggerModal |
| LOG_MEDICATION | "log med", "add med", "medication", "log pill", "log meds", "log treatment" | Open MedicationModal |
| OPEN_REPORTS | "open report", "reports", "show report", "view report" | Switch to reports view |
| OPEN_INSIGHTS | "insight", "analytics", "show insight" | Switch to insights view |
| OPEN_HOME | "go home", "dashboard", "home screen", "main screen" | Switch to dashboard view |
| OPEN_LOG | "open log", "history", "view log" | Switch to reports view |
| OPEN_CONDITIONS | "conditions", "show conditions" | Switch to conditions view |
| CANCEL | "cancel", "stop", "never mind", "go back" | Return to wake-listening |

### Behaviour

1. App starts in `wake-listening` state automatically (no button press needed).
2. `SpeechRecognition` runs with `continuous: true`, `interimResults: true`, `lang: 'en-US'`.
3. On each `onresult` event, join ALL result transcripts into a single string. Push this into a **rolling buffer** (last 10 entries). Join the buffer for matching — this catches wake phrases that span multiple result chunks.
4. **When wake word is detected**: Clear the buffer (prevents stale commands from auto-firing), vibrate 80ms, switch to `command-listening`. Set a 7-second timeout to auto-return to `wake-listening` if no command is heard.
5. **When command is matched**: Clear the buffer, vibrate 120ms, fire the command callback, switch to `confirmed`. After 2 seconds, clear the buffer and return to `wake-listening`.
6. **Critical**: The buffer MUST be cleared at every state transition (wake → command, command → confirmed, confirmed → wake, timeout → wake). Without this, old transcript text stays in the buffer and causes the previous command to auto-fire when the user re-activates.
7. On `recognition.onend`: Auto-restart after 300ms if still in an active state (handles iOS's ~60-second speech recognition limit).
8. On `not-allowed` error: Set state to `'denied'` (NOT `'unsupported'`) so the button stays visible and shows instructions.
9. On `no-speech` or `aborted` error: Auto-restart after 300ms.

### Public API

```typescript
{ state, lastTranscript, lastCommandLabel, isSupported, isActive, enableWakeWord, disableWakeWord, toggleWakeWord, manualActivate }
```

`manualActivate`: Tap while `wake-listening` → jump straight to `command-listening` (also clears buffer). Tap while `command-listening` or `confirmed` → return to `wake-listening`.

### TypeScript Note

The SpeechRecognition API types vary across browsers. Use `type AnySpeechRecognition = any` and cast `window` to access `SpeechRecognition ?? webkitSpeechRecognition`. This avoids strict-mode type errors.

### `VoiceButton.tsx`

Floating fixed button at `bottom-[4.75rem] lg:bottom-6 right-3 lg:right-6 z-40`.

- **Idle**: `bg-indigo-50 border-indigo-200 text-indigo-400` — Mic icon
- **Denied**: `bg-red-50 border-red-300 text-red-400` — MicOff icon
- **Wake-listening**: `bg-indigo-50 border-indigo-400 text-indigo-600` — Mic icon, `animate-ping` pulse ring. Label above: `Say "Hey Tracker"`
- **Command-listening**: `bg-emerald-500 text-white scale-110` — Mic icon, double pulse rings. Label: `Listening...`
- **Confirmed**: `bg-violet-500 text-white scale-105` — Check icon

**Interactions**:
- Short tap (`onPointerDown` + `onPointerUp` <600ms): calls `manualActivate`.
- Long press (≥600ms): calls `disableWakeWord`.
- Returns `null` if state is `'unsupported'`.

### `VoiceCommandToast.tsx`

Slide-up toast showing confirmed command label. Auto-hides after 2.5 seconds. Animates with `translate-y` and opacity transition.

---

## Key Implementation Notes

1. **All IDs**: Use `crypto.randomUUID()`.
2. **Date/Time helpers**: `todayStr()` returns `YYYY-MM-DD`, `nowTime()` returns `HH:MM`. `getDayOfWeek(dateStr)` returns day name.
3. **localStorage key**: `symptom-tracker-v2`. Load on mount, save on every state change via `useEffect`.
4. **Severity colour coding**: ≥7 red, 4-6 amber, <4 green.
5. **Possessive names**: "My" for self-reference ("Me", "I"), otherwise "Name's" / "Names'" for names ending in S.
6. **Relative dates**: "Today", "Yesterday", or "Mar 6" format.
7. **Empty states**: Every list/grid should have a friendly empty state with icon + description + CTA button.
8. **CSV export**: Reports tab has a download button that exports all filtered entries as CSV.
9. **Recharts formatters**: When using `formatter` props on Recharts Tooltip/Legend, type the parameters as `value: number | undefined, name: string | undefined` to satisfy strict TypeScript.
10. **Mobile-first**: Design for 375px width first. Use `sm:` and `lg:` breakpoints for larger screens. Bottom nav on mobile, top nav + sidebar-style on desktop.
