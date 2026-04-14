/**
 * weatherService — automatic weather tracking via Open-Meteo (free, no API key)
 * Fetches barometric pressure, humidity, temperature, and storm data by GPS or
 * saved city location. Derives trigger-relevant flags for analytics.
 */

// ── Data types ───────────────────────────────────────────────────────────────

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  cityName?: string;
  source: 'geolocation' | 'manual';
}

export interface WeatherObservation {
  id: string;
  observedAt: number;          // ms timestamp
  date: string;                // YYYY-MM-DD
  time: string;                // HH:MM
  latitude: number;
  longitude: number;
  // Raw measurements
  temperature: number;         // °C
  humidity: number;            // %
  barometricPressure: number;  // hPa
  precipitation: number;       // mm
  weatherCode: number;         // WMO code
  windSpeed: number;           // km/h
  cloudCover: number;          // %
  weatherCondition: string;    // Human-readable
  // Derived trigger flags
  derivedFlags: WeatherDerivedFlags;
}

export interface WeatherDerivedFlags {
  pressureDropDetected: boolean;    // significant drop in 6h
  pressureRiseDetected: boolean;
  pressureChange6h: number;         // hPa delta over last 6 hours
  pressureChange24h: number;        // hPa delta over last 24 hours
  humidityHigh: boolean;            // > 80%
  humidityLow: boolean;             // < 30%
  rapidTemperatureChange: boolean;  // > 8°C in 24h
  temperatureChange24h: number;     // °C delta
  stormDetected: boolean;           // thunderstorm WMO codes
  severeWeather: boolean;           // any severe WMO codes
  highWinds: boolean;               // > 40 km/h
  weatherVolatility: 'low' | 'moderate' | 'high';
}

export interface WeatherAlert {
  type: 'pressure-drop' | 'pressure-rise' | 'storm' | 'humidity-high' | 'temp-swing' | 'high-winds' | 'severe';
  label: string;
  detail: string;
  severity: 'info' | 'warning' | 'urgent';
}

// ── Configurable thresholds ──────────────────────────────────────────────────

const THRESHOLDS = {
  pressureDropSignificant: -4,   // hPa / 6h
  pressureDropMild: -2,
  pressureRiseSignificant: 4,
  humidityHigh: 80,              // %
  humidityLow: 30,
  tempSwingSignificant: 8,       // °C / 24h
  tempSwingMild: 5,
  highWindSpeed: 40,             // km/h
  stormCodes: [95, 96, 99],      // WMO thunderstorm
  severeCodes: [65, 67, 75, 77, 82, 85, 86, 95, 96, 99],
};

// ── localStorage keys ────────────────────────────────────────────────────────

const KEY_LOCATION = 'st-weather-location';
const KEY_OBS      = 'st-weather-obs';
const KEY_LAST     = 'st-weather-last-fetch';
const MIN_INTERVAL = 30 * 60 * 1000; // 30 min between API calls

// ── WMO code → label ─────────────────────────────────────────────────────────

function wmoLabel(code: number): string {
  if (code === 0)  return 'Clear sky';
  if (code <= 3)   return 'Partly cloudy';
  if (code <= 49)  return 'Fog';
  if (code <= 59)  return 'Drizzle';
  if (code <= 69)  return 'Rain';
  if (code <= 79)  return 'Snow';
  if (code <= 84)  return 'Showers';
  if (code <= 86)  return 'Snow showers';
  if (code >= 95)  return 'Thunderstorm';
  return 'Overcast';
}

// ── Location helpers ─────────────────────────────────────────────────────────

export function getSavedLocation(): WeatherLocation | null {
  try { return JSON.parse(localStorage.getItem(KEY_LOCATION) || 'null'); }
  catch { return null; }
}

export function saveLocation(loc: WeatherLocation): void {
  localStorage.setItem(KEY_LOCATION, JSON.stringify(loc));
}

export function clearLocation(): void {
  localStorage.removeItem(KEY_LOCATION);
  localStorage.removeItem(KEY_LAST);
}

export async function requestGeolocation(): Promise<WeatherLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported by this browser')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        // Round to ~1 km precision — no need for exact coordinates
        const loc: WeatherLocation = {
          latitude:  Math.round(pos.coords.latitude  * 100) / 100,
          longitude: Math.round(pos.coords.longitude * 100) / 100,
          source: 'geolocation',
        };
        saveLocation(loc);
        resolve(loc);
      },
      err => reject(new Error(
        err.code === 1 ? 'Location access denied' :
        err.code === 2 ? 'Location unavailable' : 'Location timed out'
      )),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 }
    );
  });
}

// ── Observation storage ──────────────────────────────────────────────────────

export function getStoredObservations(): WeatherObservation[] {
  try { return JSON.parse(localStorage.getItem(KEY_OBS) || '[]'); }
  catch { return []; }
}

function storeObservations(obs: WeatherObservation[]): void {
  // Keep 14 days
  const cutoff = Date.now() - 14 * 86_400_000;
  const trimmed = obs.filter(o => o.observedAt > cutoff);
  try {
    localStorage.setItem(KEY_OBS, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded — keep 7 days
    const short = Date.now() - 7 * 86_400_000;
    localStorage.setItem(KEY_OBS, JSON.stringify(trimmed.filter(o => o.observedAt > short)));
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

function canFetch(): boolean {
  const last = localStorage.getItem(KEY_LAST);
  return !last || (Date.now() - parseInt(last, 10)) >= MIN_INTERVAL;
}

function markFetched(): void {
  localStorage.setItem(KEY_LAST, String(Date.now()));
}

// ── Open-Meteo fetch ──────────────────────────────────────────────────────────

interface OMResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    surface_pressure: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    cloud_cover: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    surface_pressure: number[];
    relative_humidity_2m: number[];
    weather_code: number[];
  };
}

export async function fetchWeather(location: WeatherLocation, force = false): Promise<WeatherObservation | null> {
  if (!force && !canFetch()) return null;
  const { latitude, longitude } = location;
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${latitude}&longitude=${longitude}`,
    '&current=temperature_2m,relative_humidity_2m,surface_pressure,precipitation,weather_code,wind_speed_10m,cloud_cover',
    '&hourly=temperature_2m,surface_pressure,relative_humidity_2m,weather_code',
    '&past_hours=24&forecast_hours=1&timezone=auto',
  ].join('');

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: OMResponse = await res.json();
    const c = data.current;
    const now = new Date();

    const flags = computeFlags(c, data.hourly);
    const obs: WeatherObservation = {
      id: `wx-${Date.now()}`,
      observedAt: now.getTime(),
      date: now.toISOString().slice(0, 10),
      time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      latitude, longitude,
      temperature: Math.round(c.temperature_2m * 10) / 10,
      humidity: Math.round(c.relative_humidity_2m),
      barometricPressure: Math.round(c.surface_pressure * 10) / 10,
      precipitation: Math.round(c.precipitation * 10) / 10,
      weatherCode: c.weather_code,
      windSpeed: Math.round(c.wind_speed_10m),
      cloudCover: Math.round(c.cloud_cover),
      weatherCondition: wmoLabel(c.weather_code),
      derivedFlags: flags,
    };

    const existing = getStoredObservations();
    storeObservations([...existing, obs]);
    markFetched();
    return obs;
  } catch {
    return null; // fail silently — weather is non-critical
  }
}

function computeFlags(
  cur: OMResponse['current'],
  hourly: OMResponse['hourly'],
): WeatherDerivedFlags {
  const pNow   = cur.surface_pressure;
  const tNow   = cur.temperature_2m;
  const len    = hourly.time.length;
  const p6hAgo = len >= 7  ? hourly.surface_pressure[len - 7]  : pNow;
  const p24Ago = len >= 25 ? hourly.surface_pressure[0]        : (len > 0 ? hourly.surface_pressure[0] : pNow);
  const t24Ago = len >= 25 ? hourly.temperature_2m[0]          : (len > 0 ? hourly.temperature_2m[0]  : tNow);

  const dp6  = Math.round((pNow - p6hAgo) * 10) / 10;
  const dp24 = Math.round((pNow - p24Ago) * 10) / 10;
  const dt24 = Math.round((tNow - t24Ago) * 10) / 10;

  const pRange    = len > 1 ? Math.max(...hourly.surface_pressure) - Math.min(...hourly.surface_pressure) : 0;
  const codeCount = new Set(hourly.weather_code).size;
  const vol: 'low' | 'moderate' | 'high' =
    (codeCount >= 4 || pRange > 8) ? 'high' :
    (codeCount >= 3 || pRange > 4) ? 'moderate' : 'low';

  return {
    pressureDropDetected: dp6 <= THRESHOLDS.pressureDropSignificant,
    pressureRiseDetected: dp6 >= THRESHOLDS.pressureRiseSignificant,
    pressureChange6h:  dp6,
    pressureChange24h: dp24,
    humidityHigh: cur.relative_humidity_2m >= THRESHOLDS.humidityHigh,
    humidityLow:  cur.relative_humidity_2m <= THRESHOLDS.humidityLow,
    rapidTemperatureChange: Math.abs(dt24) >= THRESHOLDS.tempSwingSignificant,
    temperatureChange24h: dt24,
    stormDetected:  THRESHOLDS.stormCodes.includes(cur.weather_code),
    severeWeather:  THRESHOLDS.severeCodes.includes(cur.weather_code),
    highWinds:      cur.wind_speed_10m >= THRESHOLDS.highWindSpeed,
    weatherVolatility: vol,
  };
}

// ── Alert builder ─────────────────────────────────────────────────────────────

export function getWeatherAlerts(obs: WeatherObservation): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const f = obs.derivedFlags;

  if (f.pressureDropDetected) {
    alerts.push({
      type: 'pressure-drop',
      label: 'Pressure falling',
      detail: `Dropped ${Math.abs(f.pressureChange6h).toFixed(1)} hPa in 6 h — common migraine trigger`,
      severity: 'warning',
    });
  }
  if (f.stormDetected) {
    alerts.push({ type: 'storm', label: 'Thunderstorm', detail: 'Storm conditions detected', severity: 'urgent' });
  } else if (f.severeWeather) {
    alerts.push({ type: 'severe', label: 'Severe weather', detail: obs.weatherCondition, severity: 'warning' });
  }
  if (f.humidityHigh) {
    alerts.push({ type: 'humidity-high', label: 'Humidity high', detail: `${obs.humidity}% — may affect autoimmune symptoms`, severity: 'info' });
  }
  if (f.rapidTemperatureChange) {
    alerts.push({
      type: 'temp-swing',
      label: 'Temperature swing',
      detail: `${f.temperatureChange24h > 0 ? '+' : ''}${f.temperatureChange24h.toFixed(1)}°C in 24 h`,
      severity: 'warning',
    });
  }
  if (f.highWinds) {
    alerts.push({ type: 'high-winds', label: 'High winds', detail: `${obs.windSpeed} km/h`, severity: 'info' });
  }
  return alerts;
}

// ── Pressure sensitivity analysis ────────────────────────────────────────────

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Threshold: ≥5 hPa fall in 6 h = significant drop */
const PRESSURE_DROP_THRESHOLD = -5;

export interface PressureSensitivity {
  dropDays: number;              // days with ≥5 hPa drop in any 6h reading
  stableDays: number;            // days with all 6h readings |Δ| < 2 hPa
  sameDayDropSeverity:   number | null;   // avg symptom severity on drop days
  sameDayStableSeverity: number | null;   // avg symptom severity on stable days
  nextDayDropSeverity:   number | null;   // avg severity the day after a drop
  nextDayStableSeverity: number | null;   // avg severity the day after stable
  dropSymptomPct:   number;      // % of drop days that had symptoms
  stableSymptomPct: number;      // % of stable days that had symptoms
  enoughData: boolean;           // ≥3 drop days and ≥3 stable days recorded
}

/**
 * Computes pressure-sensitivity correlation by comparing average symptom
 * severity on pressure-drop days (≥5 hPa/6h) vs stable days (|Δ|<2 hPa/6h),
 * both same-day and the following day.
 *
 * @param entries - symptom entries to correlate (caller should pre-filter by patient/date)
 */
export function computePressureSensitivity(
  entries: ReadonlyArray<{ date: string; severity: number }>,
): PressureSensitivity {
  const observations = getStoredObservations();

  // Group observations by date → track worst (most negative) and max |6h| change
  const byDate: Record<string, { minChange6h: number; maxAbsChange6h: number }> = {};
  for (const o of observations) {
    const ch = o.derivedFlags.pressureChange6h;
    const prev = byDate[o.date];
    if (!prev) {
      byDate[o.date] = { minChange6h: ch, maxAbsChange6h: Math.abs(ch) };
    } else {
      if (ch < prev.minChange6h)            prev.minChange6h = ch;
      if (Math.abs(ch) > prev.maxAbsChange6h) prev.maxAbsChange6h = Math.abs(ch);
    }
  }

  // Classify dates
  const dropDates   = new Set<string>();
  const stableDates = new Set<string>();
  for (const [date, d] of Object.entries(byDate)) {
    if (d.minChange6h <= PRESSURE_DROP_THRESHOLD) {
      dropDates.add(date);
    } else if (d.maxAbsChange6h < 2) {
      stableDates.add(date);
    }
  }

  // Average severity per calendar date
  const buckets: Record<string, number[]> = {};
  for (const e of entries) {
    (buckets[e.date] ??= []).push(e.severity);
  }
  const avgSevByDate: Record<string, number> = {};
  for (const [date, sevs] of Object.entries(buckets)) {
    avgSevByDate[date] = sevs.reduce((s, v) => s + v, 0) / sevs.length;
  }

  function computeAvg(
    dates: Set<string>,
    offset: number,
  ): { avg: number | null; withSymptoms: number } {
    const sevs: number[] = [];
    let withSymptoms = 0;
    for (const date of dates) {
      const target = offset === 0 ? date : shiftDate(date, offset);
      const sev = avgSevByDate[target];
      if (sev !== undefined) { sevs.push(sev); withSymptoms++; }
    }
    const avg = sevs.length > 0
      ? Math.round((sevs.reduce((s, v) => s + v, 0) / sevs.length) * 10) / 10
      : null;
    return { avg, withSymptoms };
  }

  const sameDayDrop   = computeAvg(dropDates,   0);
  const sameDayStable = computeAvg(stableDates,  0);
  const nextDayDrop   = computeAvg(dropDates,    1);
  const nextDayStable = computeAvg(stableDates,  1);

  return {
    dropDays:  dropDates.size,
    stableDays: stableDates.size,
    sameDayDropSeverity:    sameDayDrop.avg,
    sameDayStableSeverity:  sameDayStable.avg,
    nextDayDropSeverity:    nextDayDrop.avg,
    nextDayStableSeverity:  nextDayStable.avg,
    dropSymptomPct:   dropDates.size   > 0 ? Math.round((sameDayDrop.withSymptoms   / dropDates.size)   * 100) : 0,
    stableSymptomPct: stableDates.size > 0 ? Math.round((sameDayStable.withSymptoms / stableDates.size) * 100) : 0,
    enoughData: dropDates.size >= 3 && stableDates.size >= 3,
  };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Returns the most recent observation if it's < 2 hours old, else null */
export function getLatestObservation(): WeatherObservation | null {
  const all = getStoredObservations();
  if (all.length === 0) return null;
  const latest = all[all.length - 1];
  return (Date.now() - latest.observedAt < 2 * 3_600_000) ? latest : null;
}

export function getObservationsForDate(date: string): WeatherObservation[] {
  return getStoredObservations().filter(o => o.date === date);
}

export function getObservationsInRange(from: string, to: string): WeatherObservation[] {
  return getStoredObservations().filter(o => o.date >= from && o.date <= to);
}

/**
 * For a date, return the "representative" observation — the one closest to noon
 * (or the last one if no noon-ish reading).
 */
export function getRepresentativeObservation(date: string): WeatherObservation | null {
  const obs = getObservationsForDate(date);
  if (obs.length === 0) return null;
  return obs.reduce((best, o) => {
    const bestH = parseInt(best.time.split(':')[0], 10);
    const oH    = parseInt(o.time.split(':')[0], 10);
    return Math.abs(bestH - 12) <= Math.abs(oH - 12) ? best : o;
  });
}
