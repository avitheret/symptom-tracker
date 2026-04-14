/**
 * WeatherReportSection — Reports > Weather tab
 * Shows weather history, trigger alerts, and overlap with symptom days.
 */
import { useMemo, useState } from 'react';
import { Cloud, Droplets, Thermometer, AlertTriangle, MapPin, Info } from 'lucide-react';
import {
  getStoredObservations, getSavedLocation, getWeatherAlerts,
  computePressureSensitivity,
  type WeatherObservation,
} from '../utils/weatherService';
import type { TrackingEntry } from '../types';
import { Card, CardHeader, EmptyState } from './ui';
import WeatherCard from './WeatherCard';

interface Props {
  entries: TrackingEntry[];
  dateFrom?: string;
}

interface DayRow {
  date: string;
  obs: WeatherObservation;
  hasSymptom: boolean;
  alerts: ReturnType<typeof getWeatherAlerts>;
}

const FLAG_STYLES = {
  warning: 'text-amber-600 bg-amber-50',
  urgent:  'text-red-600   bg-red-50',
  info:    'text-blue-600  bg-blue-50',
};

function PressureBar({ change, max = 6 }: { change: number; max?: number }) {
  const pct = Math.min(Math.abs(change) / max, 1) * 100;
  const color = change <= -4 ? 'bg-red-400' : change <= -2 ? 'bg-amber-400' : change >= 4 ? 'bg-emerald-400' : 'bg-slate-200';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-mono w-14 text-right ${change <= -2 ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}>
        {change > 0 ? '+' : ''}{change.toFixed(1)}
      </span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SensitivityRow({
  label, dropDays, stableDays, dropSev, stableSev,
}: {
  label: string;
  dropDays: number;
  stableDays: number;
  dropSev: number | null;
  stableSev: number | null;
}) {
  const delta = dropSev !== null && stableSev !== null ? dropSev - stableSev : null;
  const worse = delta !== null && delta > 0;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Drop days <span className="text-slate-400">({dropDays})</span></p>
          <p className="text-xl font-bold text-red-600">{dropSev !== null ? dropSev.toFixed(1) : '—'}</p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-10">
          {delta !== null && (
            <span className={`text-sm font-bold ${worse ? 'text-red-500' : 'text-emerald-600'}`}>
              {worse ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
          <span className="text-[10px] text-slate-300">vs</span>
        </div>
        <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
          <p className="text-[10px] text-slate-500 mb-0.5">Stable days <span className="text-slate-400">({stableDays})</span></p>
          <p className="text-xl font-bold text-slate-500">{stableSev !== null ? stableSev.toFixed(1) : '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function WeatherReportSection({ entries, dateFrom }: Props) {
  const [showAll, setShowAll] = useState(false);
  const location = getSavedLocation();

  const sensitivity = useMemo(
    () => computePressureSensitivity(entries),
    [entries],
  );

  const observations = useMemo(() => {
    const all = getStoredObservations();
    return dateFrom ? all.filter(o => o.date >= dateFrom) : all;
  }, [dateFrom]);

  // Build symptom date set
  const symptomDates = useMemo(
    () => new Set(entries.map(e => e.date)),
    [entries],
  );

  // Deduplicate to one observation per date (latest)
  const byDate = useMemo<Record<string, WeatherObservation>>(() => {
    const map: Record<string, WeatherObservation> = {};
    for (const o of observations) map[o.date] = o;
    return map;
  }, [observations]);

  const rows: DayRow[] = useMemo(() => {
    return Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(obs => ({
        date: obs.date,
        obs,
        hasSymptom: symptomDates.has(obs.date),
        alerts: getWeatherAlerts(obs),
      }));
  }, [byDate, symptomDates]);

  // Summary stats
  const stats = useMemo(() => {
    const pressureDropDays = rows.filter(r => r.obs.derivedFlags.pressureDropDetected);
    const stormDays        = rows.filter(r => r.obs.derivedFlags.stormDetected || r.obs.derivedFlags.severeWeather);
    const highHumidityDays = rows.filter(r => r.obs.derivedFlags.humidityHigh);
    const tempSwingDays    = rows.filter(r => r.obs.derivedFlags.rapidTemperatureChange);

    const overlapRate = (flaggedRows: DayRow[]) => {
      if (flaggedRows.length === 0) return null;
      const withSymptom = flaggedRows.filter(r => r.hasSymptom).length;
      return Math.round((withSymptom / flaggedRows.length) * 100);
    };

    return {
      total: rows.length,
      pressureDropDays: pressureDropDays.length,
      pressureDropOverlap: overlapRate(pressureDropDays),
      stormDays: stormDays.length,
      stormOverlap: overlapRate(stormDays),
      highHumidityDays: highHumidityDays.length,
      humidityOverlap: overlapRate(highHumidityDays),
      tempSwingDays: tempSwingDays.length,
      tempSwingOverlap: overlapRate(tempSwingDays),
    };
  }, [rows]);

  const visible = showAll ? rows : rows.slice(0, 10);

  // ── No weather data ────────────────────────────────────────────────────────
  if (observations.length === 0) {
    return (
      <div className="space-y-4">
        {!location && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Weather tracking not enabled</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Enable weather tracking on the dashboard to start collecting environmental data.
              </p>
            </div>
          </div>
        )}
        <WeatherCard />
        <Card>
          <EmptyState
            icon={<Cloud size={22} />}
            title="No weather data yet"
            description="Weather observations will appear here once tracking begins. Data is collected automatically — no manual entry needed."
            compact
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Current status ──────────────────────────────────────────────── */}
      <WeatherCard />

      {/* ── Summary stats ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Weather Event Summary"
          subtitle={`${stats.total} days tracked${location?.cityName ? ` · ${location.cityName}` : ''}`}
          action={location?.cityName ? <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={10} />{location.cityName}</span> : undefined}
        />
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Pressure drops', days: stats.pressureDropDays, overlap: stats.pressureDropOverlap, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Storm days',     days: stats.stormDays,        overlap: stats.stormOverlap,        color: 'text-red-600',   bg: 'bg-red-50'   },
            { label: 'High humidity',  days: stats.highHumidityDays, overlap: stats.humidityOverlap,     color: 'text-blue-600',  bg: 'bg-blue-50'  },
            { label: 'Temp swings',    days: stats.tempSwingDays,    overlap: stats.tempSwingOverlap,    color: 'text-purple-600',bg: 'bg-purple-50'},
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.days}</p>
              {s.overlap !== null && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {s.overlap}% had symptoms
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Pressure sensitivity ─────────────────────────────────────────── */}
      {sensitivity.dropDays > 0 && (
        <Card>
          <CardHeader
            title="Pressure Sensitivity"
            subtitle="Avg symptom severity: pressure-drop vs stable days"
          />
          {sensitivity.enoughData ? (
            <div className="space-y-4">
              {/* Same-day row */}
              <SensitivityRow
                label="Same day"
                dropDays={sensitivity.dropDays}
                stableDays={sensitivity.stableDays}
                dropSev={sensitivity.sameDayDropSeverity}
                stableSev={sensitivity.sameDayStableSeverity}
              />
              {/* Next-day row */}
              <SensitivityRow
                label="Next day"
                dropDays={sensitivity.dropDays}
                stableDays={sensitivity.stableDays}
                dropSev={sensitivity.nextDayDropSeverity}
                stableSev={sensitivity.nextDayStableSeverity}
              />
              {/* Footer stats */}
              <div className="flex items-center justify-between border-t border-slate-50 pt-2">
                <span className="text-[10px] text-slate-400">
                  Symptoms on drop days: <strong className="text-slate-600">{sensitivity.dropSymptomPct}%</strong>
                  {' '}vs stable: <strong className="text-slate-600">{sensitivity.stableSymptomPct}%</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-3 gap-1">
              <p className="text-sm text-slate-500 font-medium">Still collecting</p>
              <p className="text-[10px] text-slate-400">
                {sensitivity.dropDays < 3
                  ? `${sensitivity.dropDays}/3 pressure-drop days logged`
                  : `${sensitivity.stableDays}/3 stable days logged`}
                {' '}— check back as more weather data accumulates
              </p>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            Drop: ≥5 hPa fall in 6 h · Stable: all 6 h readings &lt;2 hPa · Severity 0–10
          </p>
        </Card>
      )}

      {/* ── Insight banners ──────────────────────────────────────────────── */}
      {stats.pressureDropOverlap !== null && stats.pressureDropOverlap >= 50 && stats.pressureDropDays >= 2 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <Info size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Possible pattern:</strong> Symptoms occurred on {stats.pressureDropOverlap}% of pressure-drop days in this period.
            Barometric pressure drops are a well-known migraine and autoimmune trigger.
            <span className="block mt-1 text-amber-500 italic">Based on your logged data — not a medical finding.</span>
          </p>
        </div>
      )}
      {stats.stormOverlap !== null && stats.stormOverlap >= 50 && stats.stormDays >= 2 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">
            <strong>Possible pattern:</strong> Symptoms occurred on {stats.stormOverlap}% of storm days.
            Storm-related pressure changes may be associated with increased symptom activity.
            <span className="block mt-1 text-red-400 italic">Based on your logged data — not a medical finding.</span>
          </p>
        </div>
      )}

      {/* ── Daily log ────────────────────────────────────────────────────── */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-slate-50">
          <p className="text-sm font-semibold text-slate-800">Daily Weather Log</p>
          <p className="text-xs text-slate-400 mt-0.5">Automatically tracked — no manual entry needed</p>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr,auto,auto,auto,auto] gap-2 px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-50">
          <span>Date</span>
          <span className="w-16 text-center">Temp</span>
          <span className="w-12 text-center"><Droplets size={10} className="inline" /></span>
          <span className="w-20">Pressure Δ</span>
          <span className="w-10 text-center">Sx</span>
        </div>

        <div className="divide-y divide-slate-50">
          {visible.map(row => (
            <div key={row.date}
              className={`grid grid-cols-[1fr,auto,auto,auto,auto] gap-2 items-center px-4 py-2.5 ${row.hasSymptom ? 'bg-rose-50/40' : ''}`}
            >
              <div>
                <p className="text-xs font-medium text-slate-700">{row.date}</p>
                {row.alerts.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {row.alerts.map((a, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${FLAG_STYLES[a.severity]}`}>
                        {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-16 text-center">
                <span className="text-xs text-slate-600 flex items-center justify-center gap-0.5">
                  <Thermometer size={9} />{Math.round(row.obs.temperature)}°C
                </span>
              </div>
              <div className="w-12 text-center">
                <span className="text-xs text-slate-500 flex items-center justify-center gap-0.5">
                  <Droplets size={9} />{row.obs.humidity}%
                </span>
              </div>
              <div className="w-20">
                <PressureBar change={row.obs.derivedFlags.pressureChange6h} />
              </div>
              <div className="w-10 flex justify-center">
                {row.hasSymptom && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 block" title="Symptoms logged" />
                )}
              </div>
            </div>
          ))}
        </div>

        {rows.length > 10 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full py-3 text-sm text-sky-600 font-medium hover:bg-sky-50 transition-colors flex items-center justify-center gap-1.5 border-t border-slate-100"
          >
            {showAll ? 'Show less' : `Show all ${rows.length} days`}
          </button>
        )}
      </Card>

      <p className="text-[10px] text-slate-400 text-center pb-2 leading-relaxed">
        Weather data from Open-Meteo. Patterns shown are based on logged data — not medical conclusions.
        <span className="block">Pink rows = days with symptom entries. Sx = symptom logged.</span>
      </p>
    </div>
  );
}
