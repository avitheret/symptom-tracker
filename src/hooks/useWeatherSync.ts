/**
 * useWeatherSync — auto-fetches weather on mount and every hour.
 * Call this once at the app root so data is always fresh.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSavedLocation, saveLocation, requestGeolocation, fetchWeather,
  getLatestObservation, getWeatherAlerts,
  type WeatherLocation, type WeatherObservation, type WeatherAlert,
} from '../utils/weatherService';

const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

export interface WeatherSyncState {
  location:  WeatherLocation | null;
  current:   WeatherObservation | null;
  alerts:    WeatherAlert[];
  loading:   boolean;
  error:     string | null;
  enabled:   boolean;
}

export function useWeatherSync() {
  const [location, setLocation] = useState<WeatherLocation | null>(getSavedLocation);
  const [current, setCurrent]   = useState<WeatherObservation | null>(getLatestObservation);
  const [alerts, setAlerts]     = useState<WeatherAlert[]>(() => {
    const o = getLatestObservation(); return o ? getWeatherAlerts(o) : [];
  });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const intervalRef             = useRef<number | null>(null);

  const doFetch = useCallback(async (loc: WeatherLocation, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const obs = await fetchWeather(loc, force);
      if (obs) { setCurrent(obs); setAlerts(getWeatherAlerts(obs)); }
    } catch {
      setError('Could not fetch weather data right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-enable on first launch ───────────────────────────────────────────
  // If location is already saved → fetch immediately (remembers previous session).
  // If no location yet AND we haven't asked before → silently request geolocation once.
  useEffect(() => {
    if (location) {
      doFetch(location);
      return;
    }
    const ASKED_KEY = 'st-weather-asked';
    if (localStorage.getItem(ASKED_KEY)) return; // already asked once, don't nag
    localStorage.setItem(ASKED_KEY, 'true');
    requestGeolocation()
      .then(loc => { setLocation(loc); doFetch(loc, true); })
      .catch(() => { /* permission denied or unsupported — user can enable manually */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic hourly sync
  useEffect(() => {
    if (!location) return;
    intervalRef.current = window.setInterval(() => doFetch(location), SYNC_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [location, doFetch]);

  const enableWithGeolocation = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const loc = await requestGeolocation();
      setLocation(loc);
      await doFetch(loc, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Location access denied');
    } finally {
      setLoading(false);
    }
  }, [doFetch]);

  const enableWithManualLocation = useCallback(async (lat: number, lng: number, cityName?: string) => {
    const loc: WeatherLocation = {
      latitude:  Math.round(lat * 100) / 100,
      longitude: Math.round(lng * 100) / 100,
      cityName, source: 'manual',
    };
    saveLocation(loc);
    setLocation(loc);
    await doFetch(loc, true);
  }, [doFetch]);

  const refresh = useCallback(async () => {
    if (location) await doFetch(location, true);
  }, [location, doFetch]);

  return {
    location, current, alerts, loading, error,
    enabled: !!location,
    enableWithGeolocation, enableWithManualLocation, refresh,
  };
}
