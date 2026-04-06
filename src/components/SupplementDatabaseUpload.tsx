/**
 * SupplementDatabaseUpload — parse an Excel file and upsert rows
 * into the Supabase `supplement_database` table.
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
import type { SupplementTimeWindow } from '../types';

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

interface Props {
  onDone: () => void;
}

export default function SupplementDatabaseUpload({ onDone }: Props) {
  const { state, loadSupplementDatabase } = useApp();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!CLOUD_ENABLED) {
    return (
      <Card className="p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-slate-700">Cloud sync required</p>
        <p className="text-xs text-slate-400">
          Supplement database upload requires cloud mode. Set Supabase environment variables to enable.
        </p>
      </Card>
    );
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !user || !supabase || !state.activePatientId) return;

    setUploading(true);
    setStatus(null);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Skip header row
      const dataRows = rows.slice(1);

      let imported = 0;
      let skipped = 0;
      const upsertRows: Array<{
        user_id: string;
        patient_id: string;
        name: string;
        time_window: SupplementTimeWindow;
        quantity: string;
        description: string;
      }> = [];

      for (const row of dataRows) {
        const name = String(row[0] ?? '').trim();
        const twRaw = String(row[1] ?? '').trim();
        const quantity = String(row[2] ?? '').trim();
        const description = String(row[3] ?? '').trim();

        if (!name || !twRaw || !quantity) {
          skipped++;
          continue;
        }

        const timeWindow = parseTimeWindow(twRaw);
        if (!timeWindow) {
          skipped++;
          continue;
        }

        upsertRows.push({
          user_id: user.id,
          patient_id: state.activePatientId,
          name,
          time_window: timeWindow,
          quantity,
          description,
        });
      }

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('supplement_database')
          .upsert(upsertRows, { onConflict: 'user_id,patient_id,name' });

        if (error) {
          setStatus(`Error: ${error.message}`);
          setUploading(false);
          return;
        }
        imported = upsertRows.length;
      }

      await loadSupplementDatabase(state.activePatientId);

      const parts: string[] = [];
      if (imported > 0) parts.push(`${imported} row${imported !== 1 ? 's' : ''} imported`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      setStatus(parts.join(', ') || 'No data found');

      if (imported > 0) {
        setTimeout(onDone, 1500);
      }
    } catch (err) {
      setStatus(`Error parsing file: ${err instanceof Error ? err.message : 'unknown'}`);
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
