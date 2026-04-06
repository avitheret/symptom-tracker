/**
 * SupplementDatabaseUpload — parse an Excel file and store rows
 * into the supplement database (Supabase when cloud-enabled, localStorage otherwise).
 *
 * Also creates SupplementSchedule entries for each imported row (with duplicate detection).
 *
 * Expected columns (by position, not header name):
 *   A: name   B: time_window display text   C: quantity   D: description
 */
import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { CLOUD_ENABLED, supabase } from '../lib/supabase';
import { Card } from './ui';
import type { SupplementTimeWindow, SupplementDatabaseEntry } from '../types';

// ── Time-window mapping (case-insensitive partial match) ────────────────────

const WINDOW_MAP: Array<{ keywords: string[]; key: SupplementTimeWindow }> = [
  { keywords: ['first thing', 'morning', 'wake'],  key: 'morning' },
  { keywords: ['breakfast'],                        key: 'breakfast' },
  { keywords: ['lunch', 'midday', 'noon'],          key: 'lunch' },
  { keywords: ['dinner', 'evening', 'supper'],      key: 'dinner' },
  { keywords: ['before bed', 'bed', 'night'],       key: 'bed' },
];

function parseTimeWindow(raw: string): SupplementTimeWindow | null {
  const lower = raw.toLowerCase().trim();
  for (const { keywords, key } of WINDOW_MAP) {
    if (keywords.some(k => lower.includes(k))) return key;
  }
  return null;
}

interface ParsedRow {
  name: string;
  timeWindow: SupplementTimeWindow;
  quantity: string;
  description: string;
}

function parseExcelRows(data: ArrayBuffer): { rows: ParsedRow[]; skipped: number } {
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dataRows = rawRows.slice(1); // skip header

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const name = String(row[0] ?? '').trim();
    const twRaw = String(row[1] ?? '').trim();
    const quantity = String(row[2] ?? '').trim();
    const description = String(row[3] ?? '').trim();

    if (!name || !twRaw || !quantity) { skipped++; continue; }

    const timeWindow = parseTimeWindow(twRaw);
    if (!timeWindow) { skipped++; continue; }

    rows.push({ name, timeWindow, quantity, description });
  }

  return { rows, skipped };
}

interface Props {
  onDone: () => void;
}

export default function SupplementDatabaseUpload({ onDone }: Props) {
  const { state, addSupplementSchedule, setSupplementDatabase, loadSupplementDatabase } = useApp();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Cloud upload path ──────────────────────────────────────────────────────
  async function handleCloudUpload(parsed: ParsedRow[]) {
    if (!user || !supabase || !state.activePatientId) return 0;

    const upsertRows = parsed.map(r => ({
      user_id: user.id,
      patient_id: state.activePatientId!,
      name: r.name,
      time_window: r.timeWindow,
      quantity: r.quantity,
      description: r.description,
    }));

    const { error } = await supabase
      .from('supplement_database')
      .upsert(upsertRows, { onConflict: 'user_id,patient_id,name' });

    if (error) throw new Error(error.message);

    await loadSupplementDatabase(state.activePatientId!);
    return upsertRows.length;
  }

  // ── Local-only upload path ─────────────────────────────────────────────────
  function handleLocalUpload(parsed: ParsedRow[]) {
    if (!state.activePatientId) return 0;

    const existing = state.supplementDatabase ?? [];
    const merged = [...existing];

    for (const row of parsed) {
      const idx = merged.findIndex(
        e => e.patientId === state.activePatientId && e.name.toLowerCase() === row.name.toLowerCase(),
      );
      const entry: SupplementDatabaseEntry = {
        id: idx >= 0 ? merged[idx].id : `sdb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        patientId: state.activePatientId!,
        name: row.name,
        timeWindow: row.timeWindow,
        quantity: row.quantity,
        description: row.description,
      };
      if (idx >= 0) {
        merged[idx] = entry;
      } else {
        merged.push(entry);
      }
    }

    setSupplementDatabase(merged);
    return parsed.length;
  }

  // ── Create SupplementSchedule entries (duplicate-aware) ────────────────────
  function createSchedulesFromImport(parsed: ParsedRow[]) {
    if (!state.activePatientId) return 0;

    const existingSchedules = (state.supplementSchedules ?? []).filter(
      s => s.patientId === state.activePatientId,
    );

    let created = 0;
    for (const row of parsed) {
      const isDup = existingSchedules.some(
        s => s.name.toLowerCase() === row.name.toLowerCase() && s.timeWindow === row.timeWindow,
      );
      if (isDup) continue;

      addSupplementSchedule({
        name: row.name,
        frequency: 'daily',
        status: 'active',
        timeWindow: row.timeWindow,
        quantity: row.quantity,
        description: row.description,
      });
      created++;
    }
    return created;
  }

  // ── Main handler ───────────────────────────────────────────────────────────
  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !state.activePatientId) return;

    setUploading(true);
    setStatus(null);

    try {
      const data = await file.arrayBuffer();
      const { rows: parsed, skipped } = parseExcelRows(data);

      let imported = 0;
      if (CLOUD_ENABLED && user && supabase) {
        try {
          imported = await handleCloudUpload(parsed);
        } catch {
          // Table may not exist in Supabase — fall back to local
          imported = handleLocalUpload(parsed);
        }
      } else {
        imported = handleLocalUpload(parsed);
      }

      const schedulesCreated = createSchedulesFromImport(parsed);

      const parts: string[] = [];
      if (imported > 0) parts.push(`${imported} supplement${imported !== 1 ? 's' : ''} imported`);
      if (schedulesCreated > 0) parts.push(`${schedulesCreated} schedule${schedulesCreated !== 1 ? 's' : ''} created`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      setStatus(parts.join(', ') || 'No data found');

      if (imported > 0) {
        setTimeout(onDone, 1500);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    setUploading(false);
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet size={18} className="text-teal-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Upload Supplement List</p>
          <p className="text-xs text-slate-400">Excel file with columns: Name, Time Window, Quantity, Description</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="flex-1 text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 min-h-[44px]"
        />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
        >
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {status && (
        <p className={`text-sm ${status.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'} font-medium`}>
          {status}
        </p>
      )}
    </Card>
  );
}
