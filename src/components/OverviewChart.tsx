/**
 * OverviewChart — multi-factor ComposedChart
 *
 * Layers on one shared date X axis:
 *   • Symptom severity Lines  — one per condition (condition color)
 *   • Weather metric Bars     — translucent, right Y axis
 *   • Medication markers      — violet squares below the 0 line
 *   • Supplement markers      — emerald circles below the 0 line
 *
 * Controls: date range (7/30/90d) · condition filter · weather metric toggle
 */
import { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getStoredObservations } from '../utils/weatherService';
import type { WeatherObservation } from '../utils/weatherService';
import { Chip } from './ui';

// ── Local types ──────────────────────────────────────────────────────────────

type RangeKey      = '7d' | '30d' | '90d';
type WeatherMetric = 'temp' | 'humidity' | 'pressure';

/** One row per calendar day. Dynamic `sev_<id>` keys hold per-condition avg severity. */
type DayPoint = {
  label:     string;         // "4/14"  — X axis label
  date:      string;         // YYYY-MM-DD
  weather:   number | null;  // selected weather metric value
  medMark:   number | null;  // -0.3 when meds taken, null otherwise
  suppMark:  number | null;  // -0.55 when supps taken, null otherwise
  medCount:  number;
  suppCount: number;
} & Record<string, string | number | null>;

// ── Constants ────────────────────────────────────────────────────────────────

const WEATHER_LABEL: Record<WeatherMetric, string> = {
  temp:     'Temp (°C)',
  humidity: 'Humidity (%)',
  pressure: 'Pressure Δ (hPa)',
};

const WEATHER_COLOR: Record<WeatherMetric, string> = {
  temp:     '#fb923c',   // orange
  humidity: '#38bdf8',   // sky
  pressure: '#a78bfa',   // violet
};

// Severity Y domain leaves room below 0 for event markers
const SEV_DOMAIN: [number, number] = [-1, 10];
const SEV_TICKS                    = [0, 2, 4, 6, 8, 10];
const MED_Y  = -0.30;   // y position for medication markers
const SUPP_Y = -0.58;   // y position for supplement markers

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function dateLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

/** Pick the observation closest to noon for a given date. */
function noonObs(byDate: Record<string, WeatherObservation[]>, date: string): WeatherObservation | null {
  const list = byDate[date];
  if (!list?.length) return null;
  return list.reduce((best, o) => {
    const bh = parseInt(best.time.split(':')[0], 10);
    const oh = parseInt(o.time.split(':')[0], 10);
    return Math.abs(bh - 12) <= Math.abs(oh - 12) ? best : o;
  }, list[0]);
}

/** Build inclusive date list from cutoff to today. */
function buildDates(cutoff: string): string[] {
  const result: string[] = [];
  const cur  = new Date(cutoff);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  while (cur <= today) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipEntry {
  dataKey: string | number;
  name: string;
  value: number | string | null;
  color: string;
}
interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  metric: WeatherMetric;
  data: DayPoint[];
}

function CustomTooltip({ active, payload, label, metric, data }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const day = data.find(d => d.label === label);

  const sevRows = payload.filter(
    p => typeof p.dataKey === 'string' && p.dataKey.startsWith('sev_') && p.value !== null
  );
  const wxRow = payload.find(p => p.dataKey === 'weather' && p.value !== null);

  const metricUnit = metric === 'temp' ? '°C' : metric === 'humidity' ? '%' : ' hPa';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-3 min-w-[160px] space-y-1">
      <p className="text-xs font-semibold text-slate-700 pb-1 border-b border-slate-50">{label}</p>

      {sevRows.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-slate-800">{p.value}/10</span>
        </div>
      ))}

      {wxRow && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: WEATHER_COLOR[metric] }} />
            {WEATHER_LABEL[metric]}
          </span>
          <span className="font-semibold text-slate-800">{wxRow.value}{metricUnit}</span>
        </div>
      )}

      {(day?.medCount ?? 0) > 0 && (
        <p className="text-xs text-violet-600 pt-0.5">
          💊 {day!.medCount} medication{day!.medCount > 1 ? 's' : ''}
        </p>
      )}
      {(day?.suppCount ?? 0) > 0 && (
        <p className="text-xs text-emerald-600">
          🌿 {day!.suppCount} supplement{day!.suppCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OverviewChart() {
  const { state, getPatientConditions } = useApp();

  const [range,         setRange]         = useState<RangeKey>('30d');
  const [activeCondIds, setActiveCondIds] = useState<string[]>([]);   // empty = all
  const [metric,        setMetric]        = useState<WeatherMetric>('pressure');

  const patientId  = state.activePatientId ?? '';
  const conditions = getPatientConditions(patientId);

  const cutoff = useMemo(
    () => daysAgo(range === '7d' ? 7 : range === '30d' ? 30 : 90),
    [range],
  );
  const dates = useMemo(() => buildDates(cutoff), [cutoff]);

  // ── Source data (patient-scoped, date-filtered) ──────────────────────────

  const entries = useMemo(() => state.entries.filter(
    e => e.patientId === patientId && e.date >= cutoff &&
         e.reviewStatus !== 'to_review' && e.reviewStatus !== 'disapproved'
  ), [state.entries, patientId, cutoff]);

  const meds = useMemo(() => (state.medicationLogs ?? []).filter(
    m => m.patientId === patientId && m.date >= cutoff
  ), [state.medicationLogs, patientId, cutoff]);

  const supps = useMemo(() => (state.supplementLogs ?? []).filter(
    s => s.patientId === patientId && s.date >= cutoff
  ), [state.supplementLogs, patientId, cutoff]);

  // ── Conditions to display ────────────────────────────────────────────────

  const visibleConds = useMemo(
    () => activeCondIds.length > 0
      ? conditions.filter(c => activeCondIds.includes(c.id))
      : conditions,
    [conditions, activeCondIds],
  );

  // ── Weather observations grouped by date (read once) ──────────────────────

  const obsByDate = useMemo(() => {
    const all = getStoredObservations();
    const map: Record<string, WeatherObservation[]> = {};
    for (const o of all) {
      if (o.date < cutoff) continue;
      if (!map[o.date]) map[o.date] = [];
      map[o.date].push(o);
    }
    return map;
  }, [cutoff]);

  // ── Build chart rows ──────────────────────────────────────────────────────

  const chartData = useMemo<DayPoint[]>(() => {
    // Per-date, per-condition severity accumulator
    const sevAcc: Record<string, Record<string, { total: number; n: number }>> = {};
    for (const e of entries) {
      if (!sevAcc[e.date]) sevAcc[e.date] = {};
      if (!sevAcc[e.date][e.conditionId]) sevAcc[e.date][e.conditionId] = { total: 0, n: 0 };
      sevAcc[e.date][e.conditionId].total += e.severity;
      sevAcc[e.date][e.conditionId].n++;
    }

    // Per-date med/supp counts
    const medByDate: Record<string, number> = {};
    for (const m of meds) medByDate[m.date] = (medByDate[m.date] ?? 0) + 1;
    const suppByDate: Record<string, number> = {};
    for (const s of supps) suppByDate[s.date] = (suppByDate[s.date] ?? 0) + 1;

    return dates.map(date => {
      // Weather metric value for this day
      const obs = noonObs(obsByDate, date);
      let weather: number | null = null;
      if (obs) {
        if (metric === 'temp')     weather = parseFloat(obs.temperature.toFixed(1));
        else if (metric === 'humidity') weather = obs.humidity;
        else                       weather = parseFloat(obs.derivedFlags.pressureChange6h.toFixed(1));
      }

      const medCount  = medByDate[date]  ?? 0;
      const suppCount = suppByDate[date] ?? 0;

      const row: DayPoint = {
        label:    dateLabel(date),
        date,
        weather,
        medMark:  medCount  > 0 ? MED_Y  : null,
        suppMark: suppCount > 0 ? SUPP_Y : null,
        medCount,
        suppCount,
      };

      for (const c of visibleConds) {
        const acc = sevAcc[date]?.[c.id];
        row[`sev_${c.id}`] = acc ? parseFloat((acc.total / acc.n).toFixed(1)) : null;
      }

      return row;
    });
  }, [dates, entries, meds, supps, obsByDate, metric, visibleConds]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasData    = entries.length > 0 || meds.length > 0 || supps.length > 0;
  const hasWeather = chartData.some(d => d.weather !== null);
  const hasMeds    = meds.length > 0;
  const hasSupps   = supps.length > 0;

  const weatherDomain: [number, number] | ['auto', 'auto'] =
    metric === 'temp' ? [0, 40] :
    metric === 'humidity' ? [0, 100] :
    ['auto', 'auto'];

  const tickInterval = range === '7d' ? 0 : range === '30d' ? 4 : 13;

  function toggleCond(id: string) {
    setActiveCondIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-2 mb-0.5">
          <Activity size={15} className="text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-700">Multi-Factor Overview</h3>
        </div>
        <p className="text-xs text-slate-400">
          Symptom severity · {WEATHER_LABEL[metric].toLowerCase()} · medications &amp; supplements
        </p>
      </div>

      {/* Controls */}
      <div className="px-5 py-3 border-b border-slate-50 space-y-2.5">
        {/* Range + Weather row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Range</span>
          {(['7d', '30d', '90d'] as RangeKey[]).map(r => (
            <Chip key={r} size="sm" selected={range === r} onClick={() => setRange(r)}>
              {r === '7d' ? '7d' : r === '30d' ? '30d' : '90d'}
            </Chip>
          ))}

          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-1">Weather</span>
          {(['temp', 'humidity', 'pressure'] as WeatherMetric[]).map(m => (
            <Chip
              key={m}
              size="sm"
              selected={metric === m}
              activeColor={WEATHER_COLOR[m]}
              onClick={() => setMetric(m)}
            >
              {m === 'temp' ? 'Temp' : m === 'humidity' ? 'Humidity' : 'Pressure Δ'}
            </Chip>
          ))}
        </div>

        {/* Condition filter */}
        {conditions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Conditions</span>
            <Chip size="sm" selected={activeCondIds.length === 0} onClick={() => setActiveCondIds([])}>
              All
            </Chip>
            {conditions.map(c => (
              <Chip
                key={c.id}
                size="sm"
                selected={activeCondIds.includes(c.id)}
                activeColor={c.color}
                dotColor={activeCondIds.length === 0 ? c.color : undefined}
                onClick={() => toggleCond(c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-3 pt-4 pb-2">
        {!hasData ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm text-center px-4">
            Log some symptoms, medications, or supplements to see the overview chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: hasWeather ? 58 : 16, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

              {/* X axis — dates */}
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="#94a3b8"
                interval={tickInterval}
              />

              {/* Left Y — severity (with room below 0 for markers) */}
              <YAxis
                yAxisId="sev"
                domain={SEV_DOMAIN}
                ticks={SEV_TICKS}
                tick={{ fontSize: 10 }}
                stroke="#94a3b8"
                label={{
                  value: 'Severity',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 14,
                  fontSize: 10,
                  fill: '#94a3b8',
                }}
              />

              {/* Right Y — weather metric */}
              {hasWeather && (
                <YAxis
                  yAxisId="wx"
                  orientation="right"
                  domain={weatherDomain}
                  tick={{ fontSize: 10 }}
                  stroke={WEATHER_COLOR[metric]}
                  label={{
                    value: WEATHER_LABEL[metric],
                    angle: 90,
                    position: 'insideRight',
                    offset: 14,
                    fontSize: 10,
                    fill: WEATHER_COLOR[metric],
                  }}
                />
              )}

              {/* 0 reference line separates severity from event markers */}
              <ReferenceLine
                yAxisId="sev"
                y={0}
                stroke="#e2e8f0"
                strokeWidth={1}
              />

              <Tooltip
                content={
                  <CustomTooltip metric={metric} data={chartData} />
                }
              />

              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                iconSize={10}
                formatter={(value: string) => {
                  if (value === '_medMark')  return 'Medications';
                  if (value === '_suppMark') return 'Supplements';
                  return value;
                }}
              />

              {/* ── Weather bars (behind severity lines) ── */}
              {hasWeather && (
                <Bar
                  yAxisId="wx"
                  dataKey="weather"
                  name={WEATHER_LABEL[metric]}
                  fill={WEATHER_COLOR[metric]}
                  fillOpacity={0.18}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              )}

              {/* ── Severity lines — one per visible condition ── */}
              {visibleConds.map(c => (
                <Line
                  key={c.id}
                  yAxisId="sev"
                  dataKey={`sev_${c.id}`}
                  name={c.name}
                  stroke={c.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: c.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls={false}
                  type="monotone"
                  isAnimationActive={false}
                />
              ))}

              {/* ── Medication event markers (violet squares) ── */}
              {hasMeds && (
                <Line
                  yAxisId="sev"
                  dataKey="medMark"
                  name="_medMark"
                  stroke="transparent"
                  strokeWidth={0}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: DayPoint };
                    if (!payload?.medCount || cx === undefined || cy === undefined) return <g />;
                    return (
                      <rect
                        key={`med-${payload.date}`}
                        x={cx - 4.5}
                        y={cy - 4.5}
                        width={9}
                        height={9}
                        fill="#8b5cf6"
                        rx={2}
                        opacity={0.85}
                      />
                    );
                  }}
                  activeDot={false}
                  legendType="square"
                  isAnimationActive={false}
                />
              )}

              {/* ── Supplement event markers (emerald circles) ── */}
              {hasSupps && (
                <Line
                  yAxisId="sev"
                  dataKey="suppMark"
                  name="_suppMark"
                  stroke="transparent"
                  strokeWidth={0}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  dot={(props: any) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: DayPoint };
                    if (!payload?.suppCount || cx === undefined || cy === undefined) return <g />;
                    return (
                      <circle
                        key={`supp-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#10b981"
                        opacity={0.85}
                      />
                    );
                  }}
                  activeDot={false}
                  legendType="circle"
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer — marker legend + notes */}
      <div className="px-5 pb-4 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
        {hasMeds  && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-violet-500 inline-block opacity-85" /> Medication logged</span>}
        {hasSupps && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block opacity-85" /> Supplement logged</span>}
        {!hasWeather && (
          <span className="text-slate-300">Enable weather tracking on the dashboard to overlay environmental data.</span>
        )}
      </div>
    </div>
  );
}
