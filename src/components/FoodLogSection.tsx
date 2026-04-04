/**
 * FoodLogSection — food log history shown inside the Reports > Food tab.
 */
import { useMemo } from 'react';
import { UtensilsCrossed, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MEAL_TYPES } from '../types';
import { EmptyState } from './ui';
import SwipeableRow from './SwipeableRow';

export default function FoodLogSection() {
  const { state, deleteFoodLog } = useApp();

  const logs = useMemo(() => {
    return [...state.foodLogs]
      .filter(l => l.patientId === state.activePatientId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.foodLogs, state.activePatientId]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof logs>();
    for (const l of logs) {
      const arr = map.get(l.date) ?? [];
      arr.push(l);
      map.set(l.date, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<UtensilsCrossed size={28} className="text-emerald-300" />}
        title="No meals logged yet"
        description="Tap 'Log Meal' on the dashboard or say 'Hey Tracker, add a meal' to get started."
      />
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {grouped.map(([date, entries]) => {
        const [y, m, d] = date.split('-').map(Number);
        const dayLabel = new Date(y, m - 1, d).toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short',
        });

        return (
          <div key={date}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
              {dayLabel}
            </p>
            <div className="space-y-2">
              {entries.map(log => {
                const meal = MEAL_TYPES.find(m => m.id === log.mealType)!;
                return (
                  <SwipeableRow
                    key={log.id}
                    onDelete={() => deleteFoodLog(log.id)}
                  >
                    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base flex-shrink-0">{meal.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                                {meal.label}
                              </span>
                              <span className="text-xs text-slate-400">{log.time}</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-snug">
                              {log.foods.join(', ')}
                            </p>
                            {log.notes ? (
                              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{log.notes}</p>
                            ) : null}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteFoodLog(log.id)}
                          className="flex-shrink-0 p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
