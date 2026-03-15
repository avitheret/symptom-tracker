// ── Medication Notification Utilities ────────────────────────────────────────

// ── Dose Time Computation ───────────────────────────────────────────────────

/** Compute all dose times from first dose, interval, and frequency */
export function computeDoseTimes(
  firstDoseTime: string,
  intervalHours: number,
  frequency: number,
): string[] {
  const [h, m] = firstDoseTime.split(':').map(Number);
  const times: string[] = [];
  for (let i = 0; i < frequency; i++) {
    const totalMinutes = (h * 60 + m) + (i * intervalHours * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return times;
}

// ── Browser Notification Helpers ────────────────────────────────────────────

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.requestPermission();
}

export function showMedicationNotification(
  medName: string,
  dosage: string,
  doseTime: string,
): void {
  if (getNotificationPermission() !== 'granted') return;

  new Notification(`Time to take ${medName}`, {
    body: `${dosage} — scheduled for ${formatTime12(doseTime)}`,
    icon: '/icon-192.png',
    tag: `med-${medName}-${doseTime}`, // prevents duplicate browser notifications
    requireInteraction: true,
  });
}

// ── Time Utilities ──────────────────────────────────────────────────────────

/** Check if currentTime is within windowMinutes of targetTime */
export function isWithinWindow(
  currentTime: string,
  targetTime: string,
  windowMinutes: number,
): boolean {
  const [ch, cm] = currentTime.split(':').map(Number);
  const [th, tm] = targetTime.split(':').map(Number);
  const currentMins = ch * 60 + cm;
  const targetMins = th * 60 + tm;
  return Math.abs(currentMins - targetMins) <= windowMinutes;
}

/** Format 24h time to 12h display: "08:00" → "8:00 AM" */
export function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Sent Notification Dedup Tracking ────────────────────────────────────────

const SENT_KEY = 'st-notif-sent';

interface SentRecord {
  [key: string]: boolean; // key = "2026-03-15|Naproxen|08:00"
}

function loadSent(): SentRecord {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
  } catch { return {}; }
}

function saveSent(sent: SentRecord): void {
  // Prune entries older than 2 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const pruned: SentRecord = {};
  for (const [key, val] of Object.entries(sent)) {
    if (key >= cutoffDate) pruned[key] = val;
  }
  localStorage.setItem(SENT_KEY, JSON.stringify(pruned));
}

export function wasNotificationSent(date: string, medName: string, doseTime: string): boolean {
  return !!loadSent()[`${date}|${medName}|${doseTime}`];
}

export function markNotificationSent(date: string, medName: string, doseTime: string): void {
  const sent = loadSent();
  sent[`${date}|${medName}|${doseTime}`] = true;
  saveSent(sent);
}
