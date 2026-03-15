import { useState, useMemo, useCallback } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import {
  t, DEFAULT_CONTENT, CONTENT_GROUPS,
  setContentOverride, resetContentOverride, resetAllContentOverrides,
  getContentOverrides, isOverridden, invalidateContentCache,
} from '../../utils/contentManager';
import { Card, SectionHeader, Button, Badge } from '../ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a human-readable description from a content key */
function describeKey(key: string): string {
  // e.g. 'nav.home' → 'Home navigation label'
  // e.g. 'btn.checkIn' → 'Check In button label'
  // e.g. 'section.myConditions' → 'My Conditions section header'
  // e.g. 'empty.noLogs' → 'No Logs empty state'
  // e.g. 'app.name' → 'App Name'
  const parts = key.split('.');
  const prefix = parts[0];
  const rest = parts.slice(1).join('.');

  // Convert camelCase to Title Case
  const humanize = (s: string) =>
    s.replace(/([A-Z])/g, ' $1')
      .replace(/^./, c => c.toUpperCase())
      .trim();

  const name = humanize(rest);

  switch (prefix) {
    case 'nav':     return `${name} navigation label`;
    case 'btn':     return `${name} button label`;
    case 'section': return `${name} section header`;
    case 'empty':   return `${name} empty state`;
    case 'app':     return `${name}`;
    default:        return key;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminContent() {
  const [search, setSearch] = useState('');
  const [values, setValues] = useState<Record<string, string>>(() => {
    // Initialize with current values (overrides merged with defaults)
    const result: Record<string, string> = {};
    for (const key of Object.keys(DEFAULT_CONTENT)) {
      result[key] = t(key);
    }
    return result;
  });
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const overrides = useMemo(() => getContentOverrides(), [values]);
  const overrideCount = Object.keys(overrides).length;

  const handleChange = useCallback((key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (value === DEFAULT_CONTENT[key] || value === '') {
      resetContentOverride(key);
    } else {
      setContentOverride(key, value);
    }
  }, []);

  const handleResetKey = useCallback((key: string) => {
    resetContentOverride(key);
    setValues(prev => ({ ...prev, [key]: DEFAULT_CONTENT[key] }));
  }, []);

  const handleResetAll = () => {
    if (!confirmResetAll) {
      setConfirmResetAll(true);
      return;
    }
    resetAllContentOverrides();
    invalidateContentCache();
    // Reset local state
    const result: Record<string, string> = {};
    for (const key of Object.keys(DEFAULT_CONTENT)) {
      result[key] = DEFAULT_CONTENT[key];
    }
    setValues(result);
    setConfirmResetAll(false);
  };

  // Filter groups/keys by search
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return CONTENT_GROUPS;

    return CONTENT_GROUPS.map(group => ({
      ...group,
      keys: group.keys.filter(key =>
        key.toLowerCase().includes(q) ||
        describeKey(key).toLowerCase().includes(q) ||
        (values[key] ?? '').toLowerCase().includes(q)
      ),
    })).filter(group => group.keys.length > 0);
  }, [search, values]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="UI Content"
        trailing={
          overrideCount > 0
            ? <Badge variant="primary">{overrideCount} customized</Badge>
            : undefined
        }
      />

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search labels..."
          className="w-full text-sm pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-slate-300"
        />
      </div>

      {/* Grouped content keys */}
      {filteredGroups.map(group => (
        <Card key={group.label}>
          <SectionHeader title={group.label} className="mb-3" />
          <div className="space-y-3">
            {group.keys.map(key => {
              const overriddenNow = isOverridden(key);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {overriddenNow && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <label className="text-xs text-slate-400 font-medium">{describeKey(key)}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={values[key] ?? ''}
                      onChange={e => handleChange(key, e.target.value)}
                      placeholder={DEFAULT_CONTENT[key]}
                      className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                 placeholder:text-slate-300"
                    />
                    {overriddenNow && (
                      <button
                        onClick={() => handleResetKey(key)}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded
                                   hover:bg-slate-100 transition-colors flex-shrink-0"
                        title="Reset to default"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {filteredGroups.length === 0 && (
        <div className="text-center py-10">
          <Search size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No labels match your search</p>
        </div>
      )}

      {/* Footer */}
      <div className="space-y-3">
        {overrideCount > 0 && (
          <div className="flex justify-end gap-2">
            {confirmResetAll && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmResetAll(false)}>
                Cancel
              </Button>
            )}
            <Button
              variant={confirmResetAll ? 'danger' : 'outline'}
              size="sm"
              onClick={handleResetAll}
              iconLeft={<RotateCcw size={12} />}
            >
              {confirmResetAll ? 'Confirm Reset All' : 'Reset All'}
            </Button>
          </div>
        )}

        <p className="text-xs text-slate-300 text-center">
          Changes take effect immediately. Some labels may need a page refresh.
        </p>
      </div>
    </div>
  );
}
