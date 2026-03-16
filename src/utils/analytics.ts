import type { ContributingFactor, ContributingFactorsResult, DailyCheckIn, TrackingEntry, PatternInsight, SymptomCluster, TrendResult, ForecastResult, TriggerLog } from '../types';
import { getLatestObservation } from './weatherService';

// ── Helpers ────────────────────────────────────────────────────────────────

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function formatDateHeader(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date in local time by using UTC methods offset appropriately
  const d = new Date(year, month - 1, day);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function dateRange(entries: TrackingEntry[]): { from: string; to: string } {
  const dates = entries.map(e => e.date).sort();
  return { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' };
}

// ── Pattern Detection ───────────────────────────────────────────────────────

export function detectTimeOfDayPattern(entries: TrackingEntry[]): PatternInsight | null {
  if (entries.length < 5) return null;

  const buckets: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  for (const e of entries) {
    const mins = parseTimeToMinutes(e.time);
    const hour = Math.floor(mins / 60);
    if (hour >= 6 && hour < 12) buckets.Morning++;
    else if (hour >= 12 && hour < 17) buckets.Afternoon++;
    else if (hour >= 17 && hour < 21) buckets.Evening++;
    else buckets.Night++;
  }

  const total = entries.length;
  const [topBucket, topCount] = Object.entries(buckets).sort(([, a], [, b]) => b - a)[0];
  const share = topCount / total;

  if (share < 0.45) return null;

  const confidence = share >= 0.65 ? 'high' : 'medium';
  const timeDesc: Record<string, string> = {
    Morning: 'between 6 AM and noon',
    Afternoon: 'between noon and 5 PM',
    Evening: 'between 5 PM and 9 PM',
    Night: 'at night (9 PM–6 AM)',
  };

  return {
    id: 'time-of-day',
    type: 'time-of-day',
    title: `${topBucket} Symptom Pattern`,
    description: `${Math.round(share * 100)}% of your symptoms occur ${timeDesc[topBucket]}. Consider scheduling rest or medication adjustments for this window.`,
    confidence,
    dateRange: dateRange(entries),
    supportingCount: topCount,
  };
}

export function detectDayOfWeekPattern(entries: TrackingEntry[]): PatternInsight | null {
  if (entries.length < 5) return null;

  const counts: Record<string, number> = {};
  for (const e of entries) {
    counts[e.dayOfWeek] = (counts[e.dayOfWeek] ?? 0) + 1;
  }

  const [topDay, topCount] = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  const expected = entries.length / 7;
  const ratio = topCount / expected;

  if (ratio < 1.75) return null;

  const confidence = ratio >= 2.5 ? 'high' : 'medium';

  return {
    id: 'day-of-week',
    type: 'day-of-week',
    title: `${topDay} Symptom Spike`,
    description: `You log ${Math.round(ratio * 10) / 10}× more symptoms on ${topDay}s than average. This may correlate with weekly routines or stress patterns.`,
    confidence,
    dateRange: dateRange(entries),
    supportingCount: topCount,
  };
}

export function detectTrend(entries: TrackingEntry[], windowDays = 14): TrendResult {
  const now = daysAgoStr(0);
  const cutoffRecent = daysAgoStr(windowDays);
  const cutoffPrior = daysAgoStr(windowDays * 2);

  const recent = entries.filter(e => e.date > cutoffRecent && e.date <= now);
  const prior = entries.filter(e => e.date > cutoffPrior && e.date <= cutoffRecent);

  if (recent.length < 3 || prior.length < 3) {
    return { direction: 'stable', percentChange: 0, windowDays };
  }

  const avgRecent = recent.reduce((s, e) => s + e.severity, 0) / recent.length;
  const avgPrior = prior.reduce((s, e) => s + e.severity, 0) / prior.length;
  const percentChange = ((avgRecent - avgPrior) / avgPrior) * 100;

  if (percentChange > 15) return { direction: 'worsening', percentChange, windowDays };
  if (percentChange < -15) return { direction: 'improving', percentChange, windowDays };
  return { direction: 'stable', percentChange, windowDays };
}

export function detectCoOccurrence(entries: TrackingEntry[]): PatternInsight | null {
  if (entries.length < 5) return null;

  // Group by date
  const byDate: Record<string, TrackingEntry[]> = {};
  for (const e of entries) {
    byDate[e.date] = [...(byDate[e.date] ?? []), e];
  }

  const pairCounts: Record<string, { count: number; names: [string, string] }> = {};

  for (const dayEntries of Object.values(byDate)) {
    for (let i = 0; i < dayEntries.length; i++) {
      for (let j = i + 1; j < dayEntries.length; j++) {
        const a = dayEntries[i];
        const b = dayEntries[j];
        if (a.symptomId === b.symptomId) continue;
        const timeDiff = Math.abs(parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
        if (timeDiff > 120) continue;
        const key = [a.symptomId, b.symptomId].sort().join('|');
        if (!pairCounts[key]) {
          pairCounts[key] = {
            count: 0,
            names: [a.symptomName, b.symptomName].sort() as [string, string],
          };
        }
        pairCounts[key].count++;
      }
    }
  }

  const topPair = Object.values(pairCounts).sort((a, b) => b.count - a.count)[0];
  if (!topPair || topPair.count < 3) return null;

  return {
    id: 'co-occurrence',
    type: 'co-occurrence',
    title: 'Symptoms Appear Together',
    description: `"${topPair.names[0]}" and "${topPair.names[1]}" have co-occurred within 2 hours on ${topPair.count} occasions. These may be linked.`,
    confidence: topPair.count >= 6 ? 'high' : 'medium',
    dateRange: dateRange(entries),
    supportingCount: topPair.count,
  };
}

export function detectClusters(entries: TrackingEntry[]): SymptomCluster[] {
  if (entries.length < 5) return [];

  // Group by date
  const byDate: Record<string, TrackingEntry[]> = {};
  for (const e of entries) {
    byDate[e.date] = [...(byDate[e.date] ?? []), e];
  }

  // fingerprint → accumulated windows info
  const fingerprintMap: Record<string, {
    count: number;
    symptoms: Array<{ symptomId: string; symptomName: string; conditionName: string }>;
    dates: string[];
    severities: number[];
  }> = {};

  for (const [date, dayEntries] of Object.entries(byDate)) {
    const sorted = [...dayEntries].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i];
      const anchorMin = parseTimeToMinutes(anchor.time);
      const window = sorted.filter(e => {
        const diff = parseTimeToMinutes(e.time) - anchorMin;
        return diff >= 0 && diff <= 120;
      });
      if (window.length < 2) continue;

      // Deduplicate by symptomId
      const seen = new Set<string>();
      const deduped = window.filter(e => {
        if (seen.has(e.symptomId)) return false;
        seen.add(e.symptomId);
        return true;
      });
      if (deduped.length < 2) continue;

      const fingerprint = deduped.map(e => e.symptomId).sort().join('|');
      if (!fingerprintMap[fingerprint]) {
        fingerprintMap[fingerprint] = {
          count: 0,
          symptoms: deduped.map(e => ({
            symptomId: e.symptomId,
            symptomName: e.symptomName,
            conditionName: e.conditionName,
          })),
          dates: [],
          severities: [],
        };
      }
      // Only count once per anchor per date
      const key = `${fingerprint}:${date}:${i}`;
      fingerprintMap[fingerprint].dates.push(date);
      fingerprintMap[fingerprint].severities.push(...deduped.map(e => e.severity));
      fingerprintMap[fingerprint].count++;
      void key; // suppress unused warning
    }
  }

  return Object.entries(fingerprintMap)
    .filter(([, v]) => v.count >= 2)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([, v], idx) => {
      const sortedDates = [...new Set(v.dates)].sort();
      const avgSeverity = v.severities.length
        ? parseFloat((v.severities.reduce((s, x) => s + x, 0) / v.severities.length).toFixed(1))
        : 0;
      return {
        id: `cluster-${idx}`,
        clusterName: v.symptoms.map(s => s.symptomName).join(' + '),
        symptoms: v.symptoms,
        occurrenceCount: v.count,
        dateRange: { from: sortedDates[0] ?? '', to: sortedDates[sortedDates.length - 1] ?? '' },
        avgSeverity,
      };
    });
}

export function generateForecast(
  entries: TrackingEntry[],
  checkIns?: DailyCheckIn[],
  triggerLogs?: TriggerLog[],
): ForecastResult | null {
  if (entries.length < 5) return null;

  const signals: ForecastResult['basis'] = [];

  // Signal 1: tomorrow is a high-frequency day of week
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrow.getDay()];
  const dayCounts: Record<string, number> = {};
  for (const e of entries) dayCounts[e.dayOfWeek] = (dayCounts[e.dayOfWeek] ?? 0) + 1;
  const expected = entries.length / 7;
  if ((dayCounts[tomorrowDay] ?? 0) / expected >= 1.75) {
    signals.push('day-of-week');
  }

  // Signal 2: recent 14d trend is worsening
  const trend = detectTrend(entries);
  if (trend.direction === 'worsening') {
    signals.push('recent-trend');
  }

  // Signal 3: high cluster density in last 3 days
  const threeDaysAgo = daysAgoStr(3);
  const recentEntries = entries.filter(e => e.date >= threeDaysAgo);
  if (recentEntries.length >= 5) {
    signals.push('cluster-density');
  }

  // Signal 4: most recent check-in shows poor sleep (<6h)
  if (checkIns && checkIns.length > 0) {
    const lastCheckIn = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
    const twoDaysAgo = daysAgoStr(2);
    if (lastCheckIn.date >= twoDaysAgo && lastCheckIn.sleepHours < 6) {
      signals.push('poor-sleep');
    }
    // Signal 5: most recent check-in shows high stress
    if (lastCheckIn.date >= twoDaysAgo && lastCheckIn.stress === 'high') {
      signals.push('high-stress');
    }
  }

  // Signal 6: triggers logged in last 2 days
  if (triggerLogs && triggerLogs.length > 0) {
    const twoDaysAgo = daysAgoStr(2);
    const recentTriggers = triggerLogs.filter(t => t.date >= twoDaysAgo);
    if (recentTriggers.length >= 2) {
      signals.push('recent-triggers');
    }
  }

  // Signal 7–10: current weather conditions
  const latestWeather = getLatestObservation();
  if (latestWeather) {
    const f = latestWeather.derivedFlags;
    if (f.pressureDropDetected) signals.push('pressure-drop');
    if (f.stormDetected)        signals.push('storm');
    if (f.humidityHigh)         signals.push('high-humidity');
    if (f.rapidTemperatureChange) signals.push('temp-swing');
  }

  if (signals.length < 2) return null;

  const confidence = signals.length >= 4 ? 'high' : signals.length >= 2 ? 'medium' : 'low';
  if (confidence === 'low') return null;

  const parts: string[] = [];
  if (signals.includes('day-of-week')) parts.push(`${tomorrowDay}s tend to be high-symptom days`);
  if (signals.includes('recent-trend')) parts.push('recent severity has been rising');
  if (signals.includes('cluster-density')) parts.push('symptom activity has been dense lately');
  if (signals.includes('poor-sleep')) parts.push('recent poor sleep may increase risk');
  if (signals.includes('high-stress')) parts.push('high stress was reported recently');
  if (signals.includes('recent-triggers')) parts.push('multiple triggers logged in last 48h');
  if (signals.includes('pressure-drop')) parts.push('barometric pressure is dropping — common migraine trigger');
  if (signals.includes('storm')) parts.push('storm conditions detected');
  if (signals.includes('high-humidity')) parts.push('high humidity may affect autoimmune symptoms');
  if (signals.includes('temp-swing')) parts.push('rapid temperature swing detected');

  return {
    prediction: `Tomorrow may be an active symptom day — ${parts.join('; ')}.`,
    confidence,
    basis: signals,
    disclaimer: 'This is a data-based pattern estimate, not a medical prediction.',
  };
}

export function gatherAllPatterns(entries: TrackingEntry[]): PatternInsight[] {
  const results: (PatternInsight | null)[] = [
    detectTimeOfDayPattern(entries),
    detectDayOfWeekPattern(entries),
    detectCoOccurrence(entries),
  ];
  return results.filter((p): p is PatternInsight => p !== null);
}

// ── Trigger Analytics ───────────────────────────────────────────────────────

export function detectTriggerPatterns(
  entries: TrackingEntry[],
  triggerLogs: TriggerLog[],
): PatternInsight[] {
  if (triggerLogs.length < 3) return [];

  const insights: PatternInsight[] = [];

  // Count how often each trigger appears
  const triggerCount: Record<string, number> = {};
  for (const log of triggerLogs) {
    for (const t of log.triggers) {
      triggerCount[t] = (triggerCount[t] ?? 0) + 1;
    }
  }

  const topTriggers = Object.entries(triggerCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topTriggers.length === 0) return [];

  // Insight: most common trigger
  const [topTrigger, topCount] = topTriggers[0];
  if (topCount >= 3) {
    insights.push({
      id: 'trigger-frequent',
      type: 'trigger',
      title: `"${topTrigger}" is Your Top Trigger`,
      description: `You've logged "${topTrigger}" as a potential trigger ${topCount} times. Consider monitoring how it correlates with symptom severity.`,
      confidence: topCount >= 6 ? 'high' : 'medium',
      dateRange: { from: triggerLogs[0]?.date ?? '', to: triggerLogs[triggerLogs.length - 1]?.date ?? '' },
      supportingCount: topCount,
    });
  }

  // Insight: triggers correlated with high-severity symptoms
  // Build a set of dates that had high-severity entries (≥ 7)
  const highSevDates = new Set(entries.filter(e => e.severity >= 7).map(e => e.date));

  const triggerSevCorr: Record<string, { withHigh: number; total: number }> = {};
  for (const log of triggerLogs) {
    const hadHighSev = highSevDates.has(log.date);
    for (const t of log.triggers) {
      if (!triggerSevCorr[t]) triggerSevCorr[t] = { withHigh: 0, total: 0 };
      triggerSevCorr[t].total++;
      if (hadHighSev) triggerSevCorr[t].withHigh++;
    }
  }

  const highCorrTrigger = Object.entries(triggerSevCorr)
    .filter(([, v]) => v.total >= 3 && v.withHigh / v.total >= 0.6)
    .sort(([, a], [, b]) => (b.withHigh / b.total) - (a.withHigh / a.total))[0];

  if (highCorrTrigger) {
    const [name, { withHigh, total }] = highCorrTrigger;
    const pct = Math.round((withHigh / total) * 100);
    insights.push({
      id: 'trigger-severity-corr',
      type: 'trigger',
      title: `${name} Linked to Severe Days`,
      description: `On ${pct}% of days you logged "${name}", you also had high-severity symptoms (≥7/10). Tracking this pattern may help you anticipate bad days.`,
      confidence: total >= 6 ? 'high' : 'medium',
      dateRange: { from: triggerLogs[0]?.date ?? '', to: triggerLogs[triggerLogs.length - 1]?.date ?? '' },
      supportingCount: withHigh,
    });
  }

  return insights;
}

// ── Check-in Analytics ──────────────────────────────────────────────────────

export function detectCheckInCorrelations(
  checkIns: DailyCheckIn[],
  entries: TrackingEntry[],
): PatternInsight[] {
  if (checkIns.length < 5) return [];

  const insights: PatternInsight[] = [];

  // Build a map of date → avg severity from entries
  const dateSeverity: Record<string, number[]> = {};
  for (const e of entries) {
    dateSeverity[e.date] = [...(dateSeverity[e.date] ?? []), e.severity];
  }
  const dateAvgSev: Record<string, number> = {};
  for (const [d, sevs] of Object.entries(dateSeverity)) {
    dateAvgSev[d] = sevs.reduce((s, v) => s + v, 0) / sevs.length;
  }

  // Correlate sleep with severity
  const sleepSevPairs = checkIns
    .filter(c => dateAvgSev[c.date] !== undefined)
    .map(c => ({ sleep: c.sleepHours, sev: dateAvgSev[c.date] }));

  if (sleepSevPairs.length >= 5) {
    const lowSleep = sleepSevPairs.filter(p => p.sleep < 6);
    const goodSleep = sleepSevPairs.filter(p => p.sleep >= 7);
    if (lowSleep.length >= 2 && goodSleep.length >= 2) {
      const avgSevLow = lowSleep.reduce((s, p) => s + p.sev, 0) / lowSleep.length;
      const avgSevGood = goodSleep.reduce((s, p) => s + p.sev, 0) / goodSleep.length;
      if (avgSevLow - avgSevGood >= 1.5) {
        insights.push({
          id: 'checkin-sleep-severity',
          type: 'checkin',
          title: 'Poor Sleep Worsens Symptoms',
          description: `On nights with <6h sleep, your average symptom severity is ${avgSevLow.toFixed(1)}/10 vs ${avgSevGood.toFixed(1)}/10 after 7+ hours. Prioritising sleep may reduce symptom burden.`,
          confidence: sleepSevPairs.length >= 10 ? 'high' : 'medium',
          dateRange: {
            from: checkIns[0]?.date ?? '',
            to: checkIns[checkIns.length - 1]?.date ?? '',
          },
          supportingCount: lowSleep.length,
        });
      }
    }
  }

  // Correlate high stress with more entries
  const stressCounts: Record<string, number[]> = { low: [], medium: [], high: [] };
  for (const c of checkIns) {
    const dayCount = (dateSeverity[c.date] ?? []).length;
    stressCounts[c.stress].push(dayCount);
  }

  const avgByStress = Object.fromEntries(
    Object.entries(stressCounts).map(([k, v]) => [
      k,
      v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0,
    ])
  );

  if (stressCounts.high.length >= 2 && stressCounts.low.length >= 2) {
    const diff = avgByStress.high - avgByStress.low;
    if (diff >= 1) {
      insights.push({
        id: 'checkin-stress-count',
        type: 'checkin',
        title: 'Stress Increases Symptom Frequency',
        description: `On high-stress days you log an average of ${avgByStress.high.toFixed(1)} symptoms vs ${avgByStress.low.toFixed(1)} on low-stress days. Stress management techniques may help.`,
        confidence: stressCounts.high.length >= 5 ? 'high' : 'medium',
        dateRange: {
          from: checkIns[0]?.date ?? '',
          to: checkIns[checkIns.length - 1]?.date ?? '',
        },
        supportingCount: stressCounts.high.length,
      });
    }
  }

  // Average health score trend
  const avgHealth = checkIns.reduce((s, c) => s + c.healthScore, 0) / checkIns.length;
  if (avgHealth <= 5) {
    insights.push({
      id: 'checkin-low-health',
      type: 'checkin',
      title: 'Below-Average Overall Wellbeing',
      description: `Your average daily health score is ${avgHealth.toFixed(1)}/10 across ${checkIns.length} check-ins. Consider discussing lifestyle factors with your healthcare provider.`,
      confidence: checkIns.length >= 10 ? 'high' : 'medium',
      dateRange: {
        from: checkIns[0]?.date ?? '',
        to: checkIns[checkIns.length - 1]?.date ?? '',
      },
      supportingCount: checkIns.length,
    });
  }

  return insights;
}

// ── Daily Correlation Data for Charts ──────────────────────────────────────

export interface DailyCorrelationPoint {
  date: string;
  sleepHours: number;
  stress: 'low' | 'medium' | 'high';
  stressNum: number; // 1=low, 2=medium, 3=high
  energy: number;
  mood: number;
  healthScore: number;
  avgSeverity: number;
  entryCount: number;
}

export function getDailyCorrelationData(
  checkIns: DailyCheckIn[],
  entries: TrackingEntry[],
): DailyCorrelationPoint[] {
  const dateSeverity: Record<string, number[]> = {};
  for (const e of entries) {
    dateSeverity[e.date] = [...(dateSeverity[e.date] ?? []), e.severity];
  }

  return checkIns.map(c => {
    const sevs = dateSeverity[c.date] ?? [];
    const avgSeverity = sevs.length
      ? parseFloat((sevs.reduce((s, v) => s + v, 0) / sevs.length).toFixed(1))
      : 0;
    const stressNum = c.stress === 'low' ? 1 : c.stress === 'medium' ? 2 : 3;
    return {
      date: c.date,
      sleepHours: c.sleepHours,
      stress: c.stress,
      stressNum,
      energy: c.energy,
      mood: c.mood,
      healthScore: c.healthScore,
      avgSeverity,
      entryCount: sevs.length,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Contributing Factor Analysis ─────────────────────────────────────────────

export function analyzeContributingFactors(
  entries: TrackingEntry[],
  checkIns: DailyCheckIn[],
  triggerLogs: TriggerLog[],
  conditionId?: string,
): ContributingFactorsResult | null {
  const filtered = conditionId ? entries.filter(e => e.conditionId === conditionId) : entries;
  if (filtered.length < 5) return null;

  const conditionName = conditionId ? filtered[0]?.conditionName : undefined;
  const dates = filtered.map(e => e.date).sort();
  const highSevEntries = filtered.filter(e => e.severity >= 6);
  if (highSevEntries.length < 3) return null;

  // Build a date → check-in lookup
  const checkInByDate: Record<string, DailyCheckIn> = {};
  for (const ci of checkIns) checkInByDate[ci.date] = ci;

  // Build a date → trigger names lookup (same day or previous day)
  const triggersByDate: Record<string, string[]> = {};
  for (const tl of triggerLogs) {
    triggersByDate[tl.date] = [...(triggersByDate[tl.date] ?? []), ...tl.triggers];
  }

  let poorSleepCount = 0;
  let highStressCount = 0;
  let lowEnergyCount = 0;
  let triggerCount = 0;
  let checkinDataPoints = 0;
  let triggerDataPoints = 0;

  for (const e of highSevEntries) {
    // Look at same-day and previous-day check-in
    const prevDate = (() => {
      const d = new Date(e.date);
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    const ci = checkInByDate[e.date] ?? checkInByDate[prevDate];
    if (ci) {
      checkinDataPoints++;
      if (ci.sleepHours < 6) poorSleepCount++;
      if (ci.stress === 'high') highStressCount++;
      if (ci.energy <= 4) lowEnergyCount++;
    }

    // Look at same-day and previous-day triggers
    const dayTriggers = [
      ...(triggersByDate[e.date] ?? []),
      ...(triggersByDate[prevDate] ?? []),
    ];
    if (dayTriggers.length > 0) {
      triggerDataPoints++;
      triggerCount++;
    }
  }

  // Build raw scores
  const rawFactors: Array<{ factor: string; raw: number; dataPoints: number; description: string }> = [];

  if (checkinDataPoints >= 2) {
    if (poorSleepCount > 0) {
      rawFactors.push({
        factor: 'Poor Sleep',
        raw: poorSleepCount / checkinDataPoints,
        dataPoints: poorSleepCount,
        description: `On ${poorSleepCount} of your severe days, check-in data showed less than 6 hours of sleep the night before.`,
      });
    }
    if (highStressCount > 0) {
      rawFactors.push({
        factor: 'High Stress',
        raw: highStressCount / checkinDataPoints,
        dataPoints: highStressCount,
        description: `High stress was reported on ${highStressCount} days that also had severe symptom episodes.`,
      });
    }
    if (lowEnergyCount > 0) {
      rawFactors.push({
        factor: 'Low Energy',
        raw: lowEnergyCount / checkinDataPoints,
        dataPoints: lowEnergyCount,
        description: `Low energy (≤4/10) was recorded on ${lowEnergyCount} days with high-severity symptoms.`,
      });
    }
  }

  if (triggerDataPoints >= 2) {
    rawFactors.push({
      factor: 'Known Triggers',
      raw: triggerCount / highSevEntries.length,
      dataPoints: triggerCount,
      description: `Tracked triggers were present on ${triggerCount} days leading up to severe symptom episodes.`,
    });
  }

  if (rawFactors.length === 0) return null;

  // Normalize to percentages
  const totalRaw = rawFactors.reduce((s, f) => s + f.raw, 0);
  const factors: ContributingFactor[] = rawFactors
    .map(f => ({
      factor: f.factor,
      weight: Math.round((f.raw / totalRaw) * 100),
      description: f.description,
      dataPoints: f.dataPoints,
    }))
    .sort((a, b) => b.weight - a.weight);

  const confidence = highSevEntries.length >= 15 ? 'high' : highSevEntries.length >= 7 ? 'medium' : 'low';

  return {
    conditionId,
    conditionName,
    factors,
    dateRange: { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' },
    totalEntries: filtered.length,
    confidence,
    disclaimer: 'These are estimated contributing factors based on self-reported data patterns. This analysis is not a clinical diagnosis — consult your healthcare provider for medical advice.',
  };
}

// ── Trigger Frequency for Charts ────────────────────────────────────────────

export interface TriggerFrequencyItem {
  trigger: string;
  count: number;
  highSevCount: number;
}

export function getTriggerFrequency(
  triggerLogs: TriggerLog[],
  entries: TrackingEntry[],
): TriggerFrequencyItem[] {
  const highSevDates = new Set(entries.filter(e => e.severity >= 7).map(e => e.date));
  const map: Record<string, { count: number; highSevCount: number }> = {};

  for (const log of triggerLogs) {
    const isHighSev = highSevDates.has(log.date);
    for (const t of log.triggers) {
      if (!map[t]) map[t] = { count: 0, highSevCount: 0 };
      map[t].count++;
      if (isHighSev) map[t].highSevCount++;
    }
  }

  return Object.entries(map)
    .map(([trigger, v]) => ({ trigger, ...v }))
    .sort((a, b) => b.count - a.count);
}
