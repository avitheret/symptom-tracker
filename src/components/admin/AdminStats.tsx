import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../../contexts/AppContext';
import { Card, SectionHeader, StatCard } from '../ui';

// ── Colours ──────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#6366F1'];

const FEATURE_COLORS: Record<string, string> = {
  'Symptom Logs': '#3B82F6',
  'Check-ins':    '#EC4899',
  'Triggers':     '#F59E0B',
  'Meds':         '#8B5CF6',
  'Notes':        '#10B981',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminStats() {
  const { state } = useApp();

  // ── Stat card values ─────────────────────────────────────────────────────
  const { totalEntries, activeDays, avgPerDay, currentStreak } = useMemo(() => {
    const total = state.entries.length;

    // Unique dates
    const dateSet = new Set(state.entries.map(e => e.date));
    const active = dateSet.size;

    // Average
    const avg = active > 0 ? (total / active) : 0;

    // Current streak — consecutive days counting back from today
    let streak = 0;
    const today = new Date();
    const check = new Date(today);
    while (true) {
      const ds = toDateStr(check);
      if (dateSet.has(ds)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    return { totalEntries: total, activeDays: active, avgPerDay: avg, currentStreak: streak };
  }, [state.entries]);

  // ── Chart 1: Daily Activity (last 30 days) ──────────────────────────────
  const dailyData = useMemo(() => {
    const now = new Date();
    const days: { date: string; entries: number }[] = [];
    const counts: Record<string, number> = {};

    for (const e of state.entries) {
      counts[e.date] = (counts[e.date] ?? 0) + 1;
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = toDateStr(d);
      days.push({ date: formatShortDate(ds), entries: counts[ds] ?? 0 });
    }

    return days;
  }, [state.entries]);

  // ── Chart 2: Feature Adoption ───────────────────────────────────────────
  const featureData = useMemo(() => [
    { name: 'Symptom Logs', count: state.entries.length },
    { name: 'Check-ins',    count: state.checkIns.length },
    { name: 'Triggers',     count: state.triggerLogs.length },
    { name: 'Meds',         count: state.medicationLogs.length },
    { name: 'Notes',        count: state.notes.length },
  ], [state.entries.length, state.checkIns.length, state.triggerLogs.length, state.medicationLogs.length, state.notes.length]);

  // ── Chart 3: Entries by Condition ───────────────────────────────────────
  const conditionData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of state.entries) {
      const name = e.conditionName || 'Unknown';
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [state.entries]);

  // ── Chart 4: Activity by Hour ───────────────────────────────────────────
  const hourlyData = useMemo(() => {
    const hourCounts = new Array(24).fill(0) as number[];
    for (const e of state.entries) {
      if (e.time) {
        const hour = parseInt(e.time.split(':')[0], 10);
        if (hour >= 0 && hour < 24) hourCounts[hour]++;
      }
    }
    return hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      entries: count,
    }));
  }, [state.entries]);

  return (
    <div className="space-y-4">
      <SectionHeader title="Usage Statistics" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={totalEntries} label="Total Entries" accentClass="bg-blue-600" />
        <StatCard value={activeDays} label="Active Days" accentClass="bg-green-600" />
        <StatCard value={avgPerDay.toFixed(1)} label="Avg / Day" accentClass="bg-violet-600" />
        <StatCard value={currentStreak} label="Current Streak" accentClass="bg-amber-600" />
      </div>

      {/* Chart 1: Daily Activity */}
      <Card>
        <SectionHeader title="Daily Activity" className="mb-4" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="entries" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Chart 2: Feature Adoption */}
      <Card>
        <SectionHeader title="Feature Adoption" className="mb-4" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={featureData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {featureData.map((entry) => (
                  <Cell key={entry.name} fill={FEATURE_COLORS[entry.name] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Chart 3: Entries by Condition */}
      {conditionData.length > 0 && (
        <Card>
          <SectionHeader title="Entries by Condition" className="mb-4" />
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conditionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={2}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(props: any) =>
                    `${props.name ?? ''} (${(((props.percent as number) ?? 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                >
                  {conditionData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Chart 4: Activity by Hour */}
      <Card>
        <SectionHeader title="Activity by Hour" className="mb-4" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="entries" fill="#6366F1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
