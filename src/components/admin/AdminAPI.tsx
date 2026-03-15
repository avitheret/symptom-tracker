import { useState, useEffect } from 'react';
import { Key, Trash2, RefreshCw, Calendar, HeartPulse, Server } from 'lucide-react';
import { getApiKey, setApiKey, clearApiKey } from '../../utils/apiKeyStore';
import { Card, SectionHeader, Button, Badge } from '../ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 12) return '****';
  return key.slice(0, 8) + '...' + key.slice(-4);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminAPI() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [showUpdateInput, setShowUpdateInput] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [confirmClearKey, setConfirmClearKey] = useState(false);

  // Supabase env vars
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabaseConfigured = !!(supabaseUrl && supabaseKey);

  useEffect(() => {
    setApiKeyState(getApiKey());
  }, []);

  const handleSaveKey = () => {
    const trimmed = newKey.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setApiKeyState(trimmed);
    setNewKey('');
    setShowUpdateInput(false);
    setTestStatus('idle');
  };

  const handleClearKey = () => {
    if (!confirmClearKey) {
      setConfirmClearKey(true);
      return;
    }
    clearApiKey();
    setApiKeyState(null);
    setConfirmClearKey(false);
    setTestStatus('idle');
  };

  const handleTestConnection = async () => {
    const key = apiKey;
    if (!key) return;

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16,
          system: 'reply ok',
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });

      if (response.ok) {
        setTestStatus('success');
        setTestMessage('Connection successful');
      } else {
        const data = await response.json().catch(() => ({}));
        const errMsg = (data as Record<string, unknown>)?.error
          ? String((data as Record<string, Record<string, string>>).error?.message || response.statusText)
          : response.statusText;
        setTestStatus('error');
        setTestMessage(`Error ${response.status}: ${errMsg}`);
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="API Connections" />

      {/* ── Claude API ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Claude API</h3>
          </div>
          <Badge variant={apiKey ? 'success' : 'neutral'}>
            {apiKey ? 'Connected' : 'Not configured'}
          </Badge>
        </div>

        {apiKey && (
          <div className="space-y-3">
            {/* Masked key display */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <code className="text-xs text-slate-600 font-mono flex-1">{maskKey(apiKey)}</code>
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={handleTestConnection}
                loading={testStatus === 'testing'}
                iconLeft={<RefreshCw size={12} />}
              >
                Test Connection
              </Button>
              {testStatus === 'success' && (
                <Badge variant="success">{testMessage}</Badge>
              )}
              {testStatus === 'error' && (
                <Badge variant="danger">{testMessage}</Badge>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setShowUpdateInput(!showUpdateInput);
                  setConfirmClearKey(false);
                }}
              >
                {showUpdateInput ? 'Cancel' : 'Update Key'}
              </Button>
              {confirmClearKey && (
                <Button variant="ghost" size="xs" onClick={() => setConfirmClearKey(false)}>
                  Cancel
                </Button>
              )}
              <Button
                variant={confirmClearKey ? 'danger' : 'ghost'}
                size="xs"
                onClick={handleClearKey}
                iconLeft={<Trash2 size={12} />}
              >
                {confirmClearKey ? 'Confirm Clear' : 'Clear Key'}
              </Button>
            </div>
          </div>
        )}

        {/* Update / Set key input */}
        {(showUpdateInput || !apiKey) && (
          <div className="flex gap-2 mt-3">
            <input
              type="password"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-slate-300"
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
            />
            <Button size="sm" onClick={handleSaveKey} disabled={!newKey.trim()}>
              Save
            </Button>
          </div>
        )}
      </Card>

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
