import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, ExternalLink, Trash2, Check, ShieldAlert } from 'lucide-react';
import { getApiKey, setApiKey, clearApiKey } from '../utils/apiKeyStore';
import { Sheet, Button } from './ui';

interface Props {
  onClose: () => void;
}

export default function APIKeySettings({ onClose }: Props) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    const existing = getApiKey();
    if (existing) {
      setKey(existing);
      setHasExisting(true);
    }
  }, []);

  function handleSave() {
    if (!key.trim()) return;
    setApiKey(key.trim());
    setSaved(true);
    setHasExisting(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    clearApiKey();
    setKey('');
    setHasExisting(false);
  }

  const masked = key ? `sk-ant-...${key.slice(-8)}` : '';

  return (
    <Sheet title="AI Settings" subtitle="Claude API configuration" onClose={onClose}>
      <div className="px-5 py-5 space-y-5">

        {/* Info card */}
        <div className="bg-blue-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Key size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Anthropic API Key</span>
          </div>
          <p className="text-xs text-blue-700 leading-relaxed">
            Your API key is stored locally in your browser and sent directly to Anthropic's servers.
            It is never shared with any third party or stored on any external server.
          </p>
        </div>

        {/* Key input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="w-full border border-slate-300 rounded-xl px-3 py-3 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {hasExisting && !showKey && (
            <p className="text-xs text-slate-400 mt-1">Currently set: {masked}</p>
          )}
        </div>

        {/* Get key link */}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <ExternalLink size={12} />
          Get an API key from Anthropic Console
        </a>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          {hasExisting && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleClear}
              iconLeft={<Trash2 size={14} />}
              className="flex-shrink-0"
            >
              Clear
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={!key.trim()}
            iconLeft={saved ? <Check size={14} /> : <Key size={14} />}
            className="flex-1"
          >
            {saved ? 'Saved!' : 'Save Key'}
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 rounded-xl p-4 flex gap-3">
          <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-semibold mb-1">Medical Disclaimer</p>
            <p>
              AI-generated insights are for informational purposes only and do not constitute medical advice.
              Always consult your healthcare provider for medical decisions. Insights are based on your logged
              data and may not capture your full clinical picture.
            </p>
          </div>
        </div>

      </div>
    </Sheet>
  );
}
