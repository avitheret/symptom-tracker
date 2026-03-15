import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Card } from '../ui';

// ── Constants ───────────────────────────────────────────────────────────────
const CONFIG_KEY = 'st-admin-config';
const SESSION_KEY = 'st-admin-session';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface AdminConfig {
  hash: string;
  salt: string;
}

interface AdminSession {
  timestamp: number;
}

// ── Crypto helpers ──────────────────────────────────────────────────────────

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// ── Storage helpers ─────────────────────────────────────────────────────────

function loadConfig(): AdminConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminConfig;
    if (parsed.hash && parsed.salt) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveConfig(config: AdminConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

function saveSession() {
  const session: AdminSession = { timestamp: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function isSessionValid(): boolean {
  const session = loadSession();
  if (!session) return false;
  return Date.now() - session.timestamp < SESSION_TTL_MS;
}

function clearAll() {
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(SESSION_KEY);
}

// ── Component ───────────────────────────────────────────────────────────────

type Screen = 'setup' | 'unlock' | 'authenticated';

export function AdminGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => {
    const config = loadConfig();
    if (!config) return 'setup';
    if (isSessionValid()) return 'authenticated';
    return 'unlock';
  });

  // ── Setup state ──
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupError, setSetupError] = useState('');

  // ── Unlock state ──
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // ── Forgot PIN confirmation ──
  const [showForgot, setShowForgot] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSetup = useCallback(async () => {
    setSetupError('');

    if (setupPin.length < 4 || setupPin.length > 6) {
      setSetupError('PIN must be 4-6 digits.');
      return;
    }
    if (!/^\d+$/.test(setupPin)) {
      setSetupError('PIN must contain only digits.');
      return;
    }
    if (setupPin !== confirmPin) {
      setSetupError('PINs do not match.');
      return;
    }

    const salt = generateSalt();
    const hash = await hashPin(setupPin, salt);
    saveConfig({ hash, salt });
    saveSession();
    setScreen('authenticated');
  }, [setupPin, confirmPin]);

  const handleUnlock = useCallback(async () => {
    setUnlockError('');
    const config = loadConfig();
    if (!config) {
      setScreen('setup');
      return;
    }

    const hash = await hashPin(unlockPin, config.salt);
    if (hash === config.hash) {
      saveSession();
      setScreen('authenticated');
    } else {
      setUnlockError('Incorrect PIN.');
      setUnlockPin('');
    }
  }, [unlockPin]);

  const handleReset = useCallback(() => {
    clearAll();
    setShowForgot(false);
    setUnlockPin('');
    setUnlockError('');
    setSetupPin('');
    setConfirmPin('');
    setSetupError('');
    setScreen('setup');
  }, []);

  // Keep session alive while authenticated
  useEffect(() => {
    if (screen !== 'authenticated') return;
    const id = setInterval(() => {
      if (!isSessionValid()) setScreen('unlock');
    }, 60_000);
    return () => clearInterval(id);
  }, [screen]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (screen === 'authenticated') {
    return <>{children}</>;
  }

  // Shared wrapper
  const Wrapper = ({ children: inner }: { children: ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock size={22} className="text-slate-500" />
          </div>
          {inner}
        </div>
      </Card>
    </div>
  );

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (screen === 'setup') {
    return (
      <Wrapper>
        <h2 className="text-lg font-semibold text-slate-800">Set Admin PIN</h2>
        <p className="text-sm text-slate-500 text-center">
          Choose a 4-6 digit numeric PIN to protect the admin panel.
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter PIN"
          value={setupPin}
          onChange={e => {
            setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 6));
            setSetupError('');
          }}
          onKeyDown={e => e.key === 'Enter' && document.getElementById('confirm-pin')?.focus()}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center text-lg tracking-[0.3em]
                     placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        <input
          id="confirm-pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="Confirm PIN"
          value={confirmPin}
          onChange={e => {
            setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
            setSetupError('');
          }}
          onKeyDown={e => e.key === 'Enter' && handleSetup()}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center text-lg tracking-[0.3em]
                     placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        {setupError && (
          <p className="text-sm text-red-500 text-center">{setupError}</p>
        )}

        <button
          onClick={handleSetup}
          disabled={setupPin.length < 4 || confirmPin.length < 4}
          className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm
                     hover:bg-slate-700 active:bg-slate-900 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Set PIN
        </button>
      </Wrapper>
    );
  }

  // ── Unlock screen ─────────────────────────────────────────────────────────
  return (
    <Wrapper>
      <h2 className="text-lg font-semibold text-slate-800">Enter Admin PIN</h2>
      <p className="text-sm text-slate-500 text-center">
        Enter your PIN to access the admin panel.
      </p>

      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="PIN"
        value={unlockPin}
        onChange={e => {
          setUnlockPin(e.target.value.replace(/\D/g, '').slice(0, 6));
          setUnlockError('');
        }}
        onKeyDown={e => e.key === 'Enter' && handleUnlock()}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-center text-lg tracking-[0.3em]
                   placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />

      {unlockError && (
        <p className="text-sm text-red-500 text-center">{unlockError}</p>
      )}

      <button
        onClick={handleUnlock}
        disabled={unlockPin.length < 4}
        className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm
                   hover:bg-slate-700 active:bg-slate-900 transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Unlock
      </button>

      {!showForgot ? (
        <button
          onClick={() => setShowForgot(true)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Forgot PIN?
        </button>
      ) : (
        <div className="w-full bg-red-50 rounded-xl p-3 flex flex-col items-center gap-2">
          <p className="text-xs text-red-600 text-center">
            This will erase your admin PIN. You will need to set a new one.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForgot(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200
                         hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500
                         hover:bg-red-600 transition-colors"
            >
              Reset PIN
            </button>
          </div>
        </div>
      )}
    </Wrapper>
  );
}
