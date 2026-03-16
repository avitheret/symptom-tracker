/**
 * WeatherCard — dashboard widget for automatic weather tracking.
 * Shows current conditions, trigger alerts, and setup flow.
 */
import { useState } from 'react';
import {
  Cloud, CloudRain, CloudLightning, Droplets, Thermometer,
  Wind, MapPin, Loader2, ChevronDown, ChevronUp, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useWeatherSync } from '../hooks/useWeatherSync';
import { Card } from './ui';

// ── Popular city presets ──────────────────────────────────────────────────────

const CITIES = [
  { name: 'New York',    lat: 40.71,  lng: -74.01 },
  { name: 'London',      lat: 51.51,  lng: -0.13  },
  { name: 'Tel Aviv',    lat: 32.08,  lng: 34.78  },
  { name: 'Toronto',     lat: 43.65,  lng: -79.38 },
  { name: 'Sydney',      lat: -33.87, lng: 151.21 },
  { name: 'Paris',       lat: 48.86,  lng: 2.35   },
  { name: 'Tokyo',       lat: 35.68,  lng: 139.69 },
  { name: 'Dubai',       lat: 25.20,  lng: 55.27  },
  { name: 'Berlin',      lat: 52.52,  lng: 13.41  },
  { name: 'Mumbai',      lat: 19.08,  lng: 72.88  },
  { name: 'Singapore',   lat: 1.35,   lng: 103.82 },
  { name: 'Los Angeles', lat: 34.05,  lng: -118.24},
];

const ALERT_STYLES = {
  info:    'bg-blue-50  border-blue-100  text-blue-700  [&_svg]:text-blue-400',
  warning: 'bg-amber-50 border-amber-100 text-amber-700 [&_svg]:text-amber-500',
  urgent:  'bg-red-50   border-red-100   text-red-700   [&_svg]:text-red-500',
};

export default function WeatherCard() {
  const { enabled, current, alerts, loading, error, location,
          enableWithGeolocation, enableWithManualLocation, refresh } = useWeatherSync();
  const [showSetup, setShowSetup] = useState(false);
  const [expanded, setExpanded]   = useState(false);

  // ── Setup / disabled state ──────────────────────────────────────────────────
  if (!enabled) {
    return (
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-sky-50 rounded-xl flex-shrink-0">
            <Cloud size={18} className="text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Weather Tracking</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Automatically detect pressure drops, humidity spikes, and storms that may trigger migraines or flare-ups.
            </p>
          </div>
        </div>

        {!showSetup ? (
          <button
            onClick={() => setShowSetup(true)}
            className="w-full py-2.5 text-sm font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
          >
            Enable Weather Tracking
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={async () => { await enableWithGeolocation(); setShowSetup(false); }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              Use My Location
            </button>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              Only city-level precision is used. Your exact location is never stored or shared.
            </p>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Or pick a city:</p>
              <div className="flex flex-wrap gap-1.5">
                {CITIES.map(c => (
                  <button
                    key={c.name}
                    disabled={loading}
                    onClick={async () => { await enableWithManualLocation(c.lat, c.lng, c.name); setShowSetup(false); }}
                    className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-full hover:bg-sky-100 hover:text-sky-700 transition-colors disabled:opacity-50"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </Card>
    );
  }

  // ── Enabled but no data yet ───────────────────────────────────────────────
  if (!current) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-50 rounded-xl">
            {loading
              ? <Loader2 size={18} className="text-sky-500 animate-spin" />
              : <Cloud size={18} className="text-sky-500" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {location?.cityName ?? 'Weather'} Tracking Active
            </p>
            <p className="text-xs text-slate-400">
              {loading ? 'Fetching weather data…' : 'Weather data will appear here shortly.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // ── Active weather display ────────────────────────────────────────────────
  const WIcon = current.derivedFlags.stormDetected ? CloudLightning
    : current.precipitation > 0 ? CloudRain : Cloud;

  const dp6 = current.derivedFlags.pressureChange6h;
  const dt24 = current.derivedFlags.temperatureChange24h;

  return (
    <div className="rounded-2xl overflow-hidden border border-sky-100"
         style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>

      {/* ── Header row ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <div className="p-2 bg-sky-200/60 rounded-xl flex-shrink-0">
          <WIcon size={16} className="text-sky-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-sky-900">
              {Math.round(current.temperature)}°C · {current.weatherCondition}
            </span>
            {alerts.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                alerts.some(a => a.severity === 'urgent') ? 'bg-red-100 text-red-600' :
                alerts.some(a => a.severity === 'warning') ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-sky-600 flex items-center gap-0.5">
              <Droplets size={10} />{current.humidity}%
            </span>
            <span className="text-xs text-sky-600 flex items-center gap-0.5">
              <Thermometer size={10} />{current.barometricPressure} hPa
            </span>
            <span className="text-xs text-sky-600 flex items-center gap-0.5">
              <Wind size={10} />{current.windSpeed} km/h
            </span>
            {location?.cityName && (
              <span className="text-xs text-sky-500 flex items-center gap-0.5 ml-auto">
                <MapPin size={9} />{location.cityName}
              </span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-sky-400 flex-shrink-0" />
                  : <ChevronDown size={14} className="text-sky-400 flex-shrink-0" />}
      </button>

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="px-4 pb-2 space-y-1.5">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${ALERT_STYLES[a.severity]}`}>
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">{a.label}</span>
                <span className="text-slate-500"> — {a.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Expanded detail ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-sky-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/60 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-slate-400 mb-0.5">Pressure (6 h)</p>
              <p className={`text-sm font-bold ${dp6 <= -2 ? 'text-amber-600' : dp6 >= 2 ? 'text-emerald-600' : 'text-slate-700'}`}>
                {dp6 > 0 ? '+' : ''}{dp6.toFixed(1)} hPa
              </p>
            </div>
            <div className="bg-white/60 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-slate-400 mb-0.5">Temp change (24 h)</p>
              <p className={`text-sm font-bold ${Math.abs(dt24) >= 5 ? 'text-amber-600' : 'text-slate-700'}`}>
                {dt24 > 0 ? '+' : ''}{dt24.toFixed(1)}°C
              </p>
            </div>
          </div>

          {/* Volatility indicator */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500">Weather volatility</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              current.derivedFlags.weatherVolatility === 'high'     ? 'bg-amber-100 text-amber-700' :
              current.derivedFlags.weatherVolatility === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {current.derivedFlags.weatherVolatility.charAt(0).toUpperCase() + current.derivedFlags.weatherVolatility.slice(1)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-sky-500/70 leading-relaxed italic">
              Weather factors are possible contributors — not medical advice
            </p>
            <button
              onClick={refresh}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-sky-100 text-sky-400 hover:text-sky-600 transition-colors disabled:opacity-40"
              title="Refresh weather"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
