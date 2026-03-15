import { Calendar, HeartPulse, Server } from 'lucide-react';
import { Card, SectionHeader, Badge } from '../ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 12) return '****';
  return key.slice(0, 8) + '...' + key.slice(-4);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminAPI() {
  // Supabase env vars
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseConfigured = !!(supabaseUrl && supabaseKey);

  return (
    <div className="space-y-4">
      <SectionHeader title="API Connections" />

      {/* ── Supabase ────────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Supabase</h3>
          </div>
          <Badge variant={supabaseConfigured ? 'success' : 'neutral'}>
            {supabaseConfigured ? 'Configured' : 'Not configured'}
          </Badge>
        </div>

        {supabaseConfigured ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-400 font-medium w-10">URL</span>
              <code className="text-xs text-slate-600 font-mono truncate">
                {supabaseUrl!.replace(/^(https?:\/\/[^.]+)(.*)$/, '$1...')}
              </code>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-400 font-medium w-10">Key</span>
              <code className="text-xs text-slate-600 font-mono">{maskKey(supabaseKey!)}</code>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Set <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>{' '}
            environment variables to enable cloud sync.
          </p>
        )}
      </Card>

      {/* ── Future Integrations ─────────────────────────────────────────────── */}
      <Card dashed>
        <SectionHeader title="Future Integrations" className="mb-3" />
        <div className="space-y-3">
          {[
            { name: 'Google Calendar', icon: Calendar, desc: 'Sync check-ins and med reminders' },
            { name: 'Apple Health',    icon: HeartPulse, desc: 'Import sleep and activity data' },
            { name: 'FHIR',           icon: Server, desc: 'Connect to healthcare systems' },
          ].map(item => (
            <div key={item.name} className="flex items-center gap-3">
              <item.icon size={16} className="text-slate-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500">{item.name}</p>
                <p className="text-xs text-slate-300">{item.desc}</p>
              </div>
              <Badge variant="neutral">Coming soon</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
