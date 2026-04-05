/**
 * MealsView — top-level Meals section (main nav item).
 * Shows meal stats, full grouped log, and lets the user add new meals.
 */
import { useMemo, useState } from 'react';
import { UtensilsCrossed, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MEAL_TYPES } from '../types';
import type { FoodLog, MealType } from '../types';
import { Card, SectionHeader, Chip, EmptyState } from './ui';
import SwipeableRow from './SwipeableRow';

interface Props {
  onOpenFoodLog?: () => void;
  onEditMeal?: (log: FoodLog) => void;
}

function StatPill({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-100 px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

export default function MealsView({ onOpenFoodLog, onEditMeal }: Props) {
  const { state, deleteFoodLog } = useApp();
  const [mealFilter, setMealFilter] = useState<MealType | 'all'>('all');

  const today = new Date().toISOString().slice(0, 10);

  const allLogs = useMemo(() =>
    [...state.foodLogs]
      .filter(l => l.patientId === state.activePatientId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [state.foodLogs, state.activePatientId],
  );

  const filtered = useMemo(() =>
    mealFilter === 'all' ? allLogs : allLogs.filter(l => l.mealType === mealFilter),
    [allLogs, mealFilter],
  );

  // Stats
  const todayCount = allLogs.filter(l => l.date === today).length;

  const topFood = useMemo(() => {
    const freq = new Map<string, number>();
    for (const log of allLogs) {
      for (const f of log.foods) {
        freq.set(f, (freq.get(f) ?? 0) + 1);
      }
    }
    if (freq.size === 0) return '—';
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [allLogs]);

  // Group filtered logs by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const l of filtered) {
      const arr = map.get(l.date) ?? [];
      arr.push(l);
      map.set(l.date, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function dayLabel(date: string) {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (date === today) return 'Today';
    if (date === new Date(Date.now() - 86400000).toISOString().slice(0, 10)) return 'Yesterday';
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {allLogs.length} {allLogs.length === 1 ? 'entry' : 'entries'} logged
          </p>
        </div>
        <button
          onClick={onOpenFoodLog}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
        >
          <Plus size={16} />
          Add Meal
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="flex gap-3">
        <StatPill value={allLogs.length} label="Total meals"   color="text-emerald-600" />
        <StatPill value={todayCount}     label="Today"         color="text-blue-600" />
        <StatPill value={topFood}        label="Most logged"   color="text-amber-600" />
      </div>

      {/* ── Meal-type filter chips ─────────────────────────── */}
      {allLogs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip selected={mealFilter === 'all'} activeColor="#10b981" size="sm" onClick={() => setMealFilter('all')}>
            All
          </Chip>
          {MEAL_TYPES.map(m => (
            <Chip key={m.id} selected={mealFilter === m.id} activeColor="#10b981" size="sm" onClick={() => setMealFilter(m.id)}>
              {m.emoji} {m.label}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {allLogs.length === 0 && (
        <Card>
          <EmptyState
            icon={<UtensilsCrossed size={28} className="text-emerald-300" />}
            title="No meals logged yet"
            description='Say "Hey Tracker, log a meal" or tap Add Meal to get started.'
          />
          <div className="pb-2 px-4">
            <button
              onClick={onOpenFoodLog}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
            >
              <Plus size={15} />
              Log your first meal
            </button>
          </div>
        </Card>
      )}

      {/* ── Grouped log ─────────────────────────────────────── */}
      {grouped.length > 0 && (
        <div className="space-y-5 pb-24">
          {grouped.map(([date, entries]) => (
            <section key={date}>
              <SectionHeader title={dayLabel(date)} />
              <Card padding={false}>
                <div className="divide-y divide-slate-50">
                  {entries.map(log => {
                    const meal = MEAL_TYPES.find(m => m.id === log.mealType)!;
                    return (
                      <SwipeableRow key={log.id} onDelete={() => deleteFoodLog(log.id)}>
                        <button
                          type="button"
                          onClick={() => onEditMeal?.(log)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3.5 min-h-[60px] group hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-xl flex-shrink-0 mt-0.5">{meal.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                                {meal.label}
                              </span>
                              <span className="text-xs text-slate-400">{log.time}</span>
                            </div>
                            <p className="text-sm text-slate-800 leading-snug font-medium">
                              {log.foods.join(', ')}
                            </p>
                            {log.notes ? (
                              <p className="text-xs text-slate-400 mt-0.5 leading-snug italic">{log.notes}</p>
                            ) : null}
                          </div>
                          <div
                            onClick={e => { e.stopPropagation(); deleteFoodLog(log.id); }}
                            className="flex-shrink-0 p-2 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 sm:flex hidden items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </div>
                        </button>
                      </SwipeableRow>
                    );
                  })}
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}

      {/* ── Filtered empty state ───────────────────────────── */}
      {allLogs.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<UtensilsCrossed size={24} className="text-emerald-200" />}
          title={`No ${MEAL_TYPES.find(m => m.id === mealFilter)?.label ?? ''} entries`}
          description="Try a different meal type filter."
          compact
        />
      )}

    </div>
  );
}
