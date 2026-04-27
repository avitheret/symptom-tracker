/**
 * A4 printable tracking form — "Track Notes".
 * Renders an on-screen preview + a portal-based print target that hides
 * everything else when the user triggers window.print().
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const ROWS = Array.from({ length: 20 });

export default function TrackNotesPrintForm({ onClose }: Props) {
  // Add body class so @media print CSS can hide everything except the form
  useEffect(() => {
    document.body.classList.add('printing-track-form');
    return () => document.body.classList.remove('printing-track-form');
  }, []);

  return (
    <>
      {/* ── Screen overlay (hidden when printing) ─────────────────────────── */}
      <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto print:hidden">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <span className="text-sm font-semibold text-slate-700">Track Notes — A4 form</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl min-h-[40px] active:scale-95 transition-transform"
            >
              <Printer size={14} />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* A4 page preview */}
        <div className="flex justify-center py-8 px-4">
          <FormPage />
        </div>
      </div>

      {/* ── Print target rendered into <body> via portal ─────────────────────
          Only visible during print (body.printing-track-form logic in CSS)      */}
      {createPortal(
        <div className="track-form-print-root">
          <FormPage />
        </div>,
        document.body,
      )}
    </>
  );
}

// ── The actual A4 page content ────────────────────────────────────────────────

function FormPage() {
  return (
    <div
      style={{
        width: '210mm',
        minHeight: '297mm',
        background: 'white',
        fontFamily: "'system-ui', 'Helvetica Neue', Arial, sans-serif",
        padding: '14mm 16mm',
        boxSizing: 'border-box',
        boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: '9mm',
        borderBottom: '2.5px solid #1e293b',
        paddingBottom: '4mm',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 800, letterSpacing: '-0.5px', color: '#1e293b' }}>
            Track Notes
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '7.5pt', color: '#64748b' }}>
            Scan with SymTrack app to import automatically
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10pt', color: '#475569', fontWeight: 600 }}>Date</span>
          <div style={{ width: '44mm', borderBottom: '1.5px solid #94a3b8' }} />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '13%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '39%' }} />
        </colgroup>

        <thead>
          {/* Column labels */}
          <tr style={{ background: '#f1f5f9' }}>
            {['Time', 'Condition', 'Symptom / Med / Sup', 'Notes'].map(h => (
              <th key={h} style={{
                padding: '3mm 3mm',
                textAlign: 'left',
                fontSize: '7.5pt',
                fontWeight: 700,
                color: '#334155',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                border: '1px solid #cbd5e1',
              }}>
                {h}
              </th>
            ))}
          </tr>
          {/* Hint row */}
          <tr>
            {['e.g. 08:30', 'leave blank to auto-detect', 'dizziness, sumatriptan…', 'severity, duration, context…'].map((hint, i) => (
              <td key={i} style={{
                padding: '1.5mm 3mm',
                fontSize: '6.5pt',
                color: '#94a3b8',
                fontStyle: 'italic',
                border: '1px solid #cbd5e1',
                borderTop: 'none',
              }}>
                {hint}
              </td>
            ))}
          </tr>
        </thead>

        <tbody>
          {ROWS.map((_, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
              {[0, 1, 2, 3].map(col => (
                <td key={col} style={{
                  height: '11mm',
                  border: '1px solid #e2e8f0',
                  padding: '0 3mm',
                  verticalAlign: 'bottom',
                }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: '8mm', display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: '7pt', color: '#94a3b8' }}>
          Open New Note → tap the camera icon → scan this page
        </p>
        <p style={{ margin: 0, fontSize: '7pt', color: '#cbd5e1' }}>SymTrack</p>
      </div>
    </div>
  );
}
