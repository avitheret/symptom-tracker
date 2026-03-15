import { useState, useEffect } from 'react';
import { Activity, Pill, Heart, Zap, Notebook, Users, Settings, HardDrive } from 'lucide-react';
import { getActivityLog, clearActivityLog, getActivityLogCount } from '../../utils/activityLogger';
import type { ActivityCategory } from '../../types';
import type { ActivityLogEntry } from '../../types';
import { Card, SectionHeader, Button, Badge, Chip } from '../ui';

// ── Category config ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<ActivityCategory, { icon: typeof Activity; color: string; label: string }> = {
  tracking:   { icon: Activity,   color: 'text-blue-500',   label: 'Tracking' },
  medication: { icon: Pill,       color: 'text-violet-500', label: 'Medication' },
  checkin:    { icon: Heart,      color: 'text-pink-500',   label: 'Check-in' },
  trigger:    { icon: Zap,        color: 'text-amber-500',  label: 'Trigger' },
  note:       { icon: Notebook,   color: 'text-slate-500',  label: 'Note' },
  patient:    { icon: Users,      color: 'text-green-500',  label: 'Patient' },
  settings:   { icon: Settings,   color: 'text-gray-500',   label: 'Settings' },
  system:     { icon: HardDrive,  color: 'text-red-500',    label: 'System' },
};

const CATEGORY_CHIP_COLORS: Record<ActivityCategory, string> = {
  tracking:   '#3B82F6',
  medication: '#8B5CF6',
  checkin:    '#EC4899',
  trigger:    '#F59E0B',
  note:       '#64748B',
  patient:    '#10B981',
  settings:   '#6B7280',
  system:     '#EF4444',
};

const ALL_CATEGORIES: (ActivityCategory | 'all')[] = [
  'all', 'tracking', 'medication', 'checkin', 'trigger', 'note', 'patient',
];

// ── Relative time ────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${timeStr}`;
  }

  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${monthDay} ${timeStr}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminActivityLog() {
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);

  // Load logs on mount
  useEffect(() => {
    const allLogs = getActivityLog(500);
    setLogs(allLogs);
    setTotalCount(getActivityLogCount());
  }, []);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.category === filter);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearActivityLog();
    setLogs([]);
    setTotalCount(0);
    setConfirmClear(false);
  };

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <SectionHeader
        title="Activity Log"
        trailing={
          <Badge variant="neutral">{totalCount} total</Badge>
        }
      />

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map(cat => (
          <Chip
            key={cat}
            selected={filter === cat}
            activeColor={cat === 'all' ? '#475569' : CATEGORY_CHIP_COLORS[cat]}
            size="sm"
            onClick={() => setFilter(cat)}
          >
            {cat === 'all' ? 'All' : CATEGORY_META[cat].label}
          </Chip>
        ))}
      </div>

      {/* Log entries */}
      <Card>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-10">
            <Activity size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No activity logs yet</p>
            <p className="text-xs text-slate-300 mt-1">Actions will appear here as you use the app</p>
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto -mx-4 -my-4">
            <div className="divide-y divide-slate-50">
              {filteredLogs.map(entry => {
                const meta = CATEGORY_META[entry.category];
                const Icon = meta.icon;
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex-shrink-0 ${meta.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{entry.label}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-slate-400 tabular-nums">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Clear all button */}
      {totalCount > 0 && (
        <div className="flex justify-end gap-2">
          {confirmClear && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          )}
          <Button
            variant={confirmClear ? 'danger' : 'outline'}
            size="sm"
            onClick={handleClear}
          >
            {confirmClear ? 'Confirm Clear All' : 'Clear All'}
          </Button>
        </div>
      )}
    </div>
  );
}
