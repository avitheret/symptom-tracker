import { useState, useMemo, useRef } from 'react';
import { Download, Upload, Trash2, AlertTriangle, HardDrive, FileJson, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { clearActivityLog, getActivityLog } from '../../utils/activityLogger';
import { resetAllContentOverrides, invalidateContentCache } from '../../utils/contentManager';
import { Card, SectionHeader, Button, Badge } from '../ui';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEYS = [
  'symptom-tracker-v2',
  'st-activity-log',
  'st-admin-config',
  'st-content-overrides',
  'st-anthropic-api-key',
  'st-notif-sent',
  'st-dashboard-prefs',
] as const;

const FACTORY_RESET_KEYS = [
  'symptom-tracker-v2',
  'st-activity-log',
  'st-admin-config',
  'st-admin-session',
  'st-content-overrides',
  'st-dashboard-prefs',
  'st-anthropic-api-key',
  'st-notif-sent',
] as const;

const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStorageSize(key: string): number {
  try {
    const val = localStorage.getItem(key);
    if (!val) return 0;
    // Size in bytes: each char is 2 bytes in UTF-16, but localStorage reports roughly 1 byte per char
    return new Blob([val]).size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminSystem() {
  const { state } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Danger zone state ──────────────────────────────────────────────────
  const [confirmClearActivity, setConfirmClearActivity] = useState(false);
  const [confirmResetContent, setConfirmResetContent] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [factoryResetText, setFactoryResetText] = useState('');

  // ── Import state ───────────────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState<{ entries: number; patients: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null);

  // ── Storage usage ──────────────────────────────────────────────────────
  const storageInfo = useMemo(() => {
    const breakdown = STORAGE_KEYS.map(key => ({
      key,
      bytes: getStorageSize(key),
    })).filter(item => item.bytes > 0);

    const totalBytes = breakdown.reduce((sum, item) => sum + item.bytes, 0);
    const percentage = Math.min((totalBytes / MAX_STORAGE_BYTES) * 100, 100);

    return { breakdown, totalBytes, percentage };
  }, []);

  // ── Export handlers ────────────────────────────────────────────────────

  const handleExportAll = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: 'v2',
      patients: state.patients,
      entries: state.entries,
      checkIns: state.checkIns,
      triggerLogs: state.triggerLogs,
      medicationLogs: state.medicationLogs,
      medicationSchedules: state.medicationSchedules,
      notes: state.notes,
      aiInsights: state.aiInsights,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `symptomtrack-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportActivityLog = () => {
    const logs = getActivityLog(500);
    if (logs.length === 0) return;

    const header = 'id,action,label,category,timestamp,date\n';
    const rows = logs.map(l => {
      const date = new Date(l.timestamp).toISOString();
      // Escape commas and quotes in label
      const label = `"${l.label.replace(/"/g, '""')}"`;
      return `${l.id},${l.action},${label},${l.category},${l.timestamp},${date}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Import handlers ────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


    setImportError(null);
    setImportPreview(null);
    setImportData(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Record<string, unknown>;

        // Validate shape
        if (!parsed || typeof parsed !== 'object') {
          setImportError('Invalid JSON file');
          return;
        }

        const hasPatients = Array.isArray(parsed.patients);
        const hasEntries = Array.isArray(parsed.entries);

        if (!hasPatients && !hasEntries) {
          setImportError('File must contain "patients" and/or "entries" arrays');
          return;
        }

        setImportPreview({
          entries: hasEntries ? (parsed.entries as unknown[]).length : 0,
          patients: hasPatients ? (parsed.patients as unknown[]).length : 0,
        });
        setImportData(parsed);
      } catch {
        setImportError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!importData) return;

    // Merge with existing data by writing to localStorage
    // The app will pick it up on next load
    try {
      const currentRaw = localStorage.getItem('symptom-tracker-v2');
      const current = currentRaw ? JSON.parse(currentRaw) as Record<string, unknown[]> : {};

      const merged = { ...current };

      // Merge arrays (deduplicate by id if possible)
      const arrayKeys = ['patients', 'entries', 'checkIns', 'triggerLogs', 'medicationLogs', 'medicationSchedules', 'notes', 'aiInsights'] as const;

      for (const key of arrayKeys) {
        if (Array.isArray(importData[key])) {
          const existing = Array.isArray(merged[key]) ? merged[key] : [];
          const existingIds = new Set((existing as Array<Record<string, unknown>>).map((item) => item.id as string));
          const newItems = (importData[key] as Array<Record<string, unknown>>).filter(
            (item) => !existingIds.has(item.id as string)
          );
          merged[key] = [...existing, ...newItems];
        }
      }

      localStorage.setItem('symptom-tracker-v2', JSON.stringify(merged));

      // Reset import state

      setImportPreview(null);
      setImportData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Reload to pick up changes
      window.location.reload();
    } catch {
      setImportError('Failed to import data');
    }
  };

  // ── Danger zone handlers ──────────────────────────────────────────────

  const handleClearActivity = () => {
    if (!confirmClearActivity) {
      setConfirmClearActivity(true);
      return;
    }
    clearActivityLog();
    setConfirmClearActivity(false);
  };

  const handleResetContent = () => {
    if (!confirmResetContent) {
      setConfirmResetContent(true);
      return;
    }
    resetAllContentOverrides();
    invalidateContentCache();
    setConfirmResetContent(false);
  };

  const handleFactoryReset = () => {
    if (!confirmFactoryReset) {
      setConfirmFactoryReset(true);
      return;
    }
    if (factoryResetText !== 'RESET') return;

    for (const key of FACTORY_RESET_KEYS) {
      localStorage.removeItem(key);
    }
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="System" />

      {/* ── Storage Usage ───────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <HardDrive size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Storage Usage</h3>
          <Badge variant="neutral" className="ml-auto">{formatBytes(storageInfo.totalBytes)} / 5 MB</Badge>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all ${
              storageInfo.percentage > 80 ? 'bg-red-500' :
              storageInfo.percentage > 50 ? 'bg-amber-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${Math.max(storageInfo.percentage, 0.5)}%` }}
          />
        </div>

        {/* Per-key breakdown */}
        {storageInfo.breakdown.length > 0 ? (
          <div className="space-y-1.5">
            {storageInfo.breakdown
              .sort((a, b) => b.bytes - a.bytes)
              .map(item => {
                const pct = storageInfo.totalBytes > 0
                  ? ((item.bytes / storageInfo.totalBytes) * 100).toFixed(1)
                  : '0';
                return (
                  <div key={item.key} className="flex items-center gap-3 text-xs">
                    <code className="text-slate-500 font-mono flex-1 truncate">{item.key}</code>
                    <span className="text-slate-400 tabular-nums w-16 text-right">{formatBytes(item.bytes)}</span>
                    <span className="text-slate-300 tabular-nums w-12 text-right">{pct}%</span>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No data stored</p>
        )}
      </Card>

      {/* ── Data Export ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Download size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Data Export</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            iconLeft={<FileJson size={14} />}
          >
            Export All Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportActivityLog}
            iconLeft={<FileSpreadsheet size={14} />}
          >
            Export Activity Log
          </Button>
        </div>
      </Card>

      {/* ── Data Import ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Upload size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Data Import</h3>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="block w-full text-xs text-slate-500
                     file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0
                     file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700
                     hover:file:bg-slate-200 file:cursor-pointer file:transition-colors"
        />

        {importError && (
          <div className="mt-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{importError}</p>
          </div>
        )}

        {importPreview && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-3 text-xs">
              <span className="text-slate-400">Patients: <strong className="text-slate-600">{importPreview.patients}</strong></span>
              <span className="text-slate-400">Entries: <strong className="text-slate-600">{importPreview.entries}</strong></span>
            </div>
            <Button size="sm" onClick={handleImport}>
              Import
            </Button>
          </div>
        )}

        <p className="text-xs text-slate-300 mt-3">
          This will merge with existing data.
        </p>
      </Card>

      {/* ── Danger Zone ──────────────────────────────────────────────────────── */}
      <Card className="border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-red-500" />
          <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>
        </div>

        <div className="space-y-3">
          {/* Clear Activity Log */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">Clear Activity Log</p>
              <p className="text-xs text-slate-400">Remove all logged user actions</p>
            </div>
            <div className="flex gap-2">
              {confirmClearActivity && (
                <Button variant="ghost" size="xs" onClick={() => setConfirmClearActivity(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant={confirmClearActivity ? 'danger' : 'outline'}
                size="xs"
                onClick={handleClearActivity}
                iconLeft={<Trash2 size={12} />}
              >
                {confirmClearActivity ? 'Confirm' : 'Clear'}
              </Button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Reset Content Overrides */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">Reset Content Overrides</p>
              <p className="text-xs text-slate-400">Revert all UI labels to defaults</p>
            </div>
            <div className="flex gap-2">
              {confirmResetContent && (
                <Button variant="ghost" size="xs" onClick={() => setConfirmResetContent(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant={confirmResetContent ? 'danger' : 'outline'}
                size="xs"
                onClick={handleResetContent}
                iconLeft={<RotateCcw size={12} />}
              >
                {confirmResetContent ? 'Confirm' : 'Reset'}
              </Button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Factory Reset */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Factory Reset</p>
                <p className="text-xs text-slate-400">Delete all data and reset to initial state</p>
              </div>
              {!confirmFactoryReset && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleFactoryReset}
                  iconLeft={<AlertTriangle size={12} />}
                >
                  Factory Reset
                </Button>
              )}
            </div>

            {confirmFactoryReset && (
              <div className="mt-3 p-3 bg-red-50 rounded-xl space-y-2">
                <p className="text-xs text-red-600 font-medium">
                  This will permanently delete all data. Type <strong>RESET</strong> to confirm.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={factoryResetText}
                    onChange={e => setFactoryResetText(e.target.value)}
                    placeholder="Type RESET"
                    className="flex-1 text-sm px-3 py-1.5 border border-red-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent
                               placeholder:text-red-200"
                  />
                  <Button variant="ghost" size="xs" onClick={() => { setConfirmFactoryReset(false); setFactoryResetText(''); }}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    disabled={factoryResetText !== 'RESET'}
                    onClick={handleFactoryReset}
                  >
                    Confirm Reset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
