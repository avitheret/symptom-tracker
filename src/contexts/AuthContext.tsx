import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase, CLOUD_ENABLED } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  password: string;
}

interface ContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True while restoring session from Supabase on first load (cloud mode only). */
  isLoading: boolean;
  /** True when Supabase env vars are set and cloud auth is active. */
  isCloudEnabled: boolean;
  needsOnboarding: boolean;
  signUp:           (name: string, email: string, password: string) => Promise<string | null>;
  signIn:           (email: string, password: string)               => Promise<string | null>;
  signOut:          ()                                              => Promise<void>;
  resetPassword:    (email: string)                                 => Promise<string | null>;
  updateProfile:    (name: string)                                  => Promise<void>;
  changePassword:   (current: string, next: string)                 => Promise<string | null>;
  completeOnboarding: () => void;
}

// ── Storage keys ───────────────────────────────────────────────────────────
const ACCOUNTS_KEY   = 'symptom-tracker-accounts';
const SESSION_KEY    = 'symptom-tracker-session';
const ONBOARDING_KEY = 'symptom-tracker-onboarding';

// ── Local-mode helpers ─────────────────────────────────────────────────────
function loadAccounts(): StoredAccount[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]'); }
  catch { return []; }
}
function saveAccounts(a: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}
function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

// ── Supabase error → user-friendly message ─────────────────────────────────
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Incorrect email or password.';
  if (m.includes('user already registered') || m.includes('already registered'))
    return 'An account with this email already exists.';
  if (m.includes('email not confirmed'))
    return 'Please verify your email address before signing in.';
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate_limit'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
    return 'Connection error. Please check your internet and try again.';
  if (m.includes('password should be at least'))
    return 'Password must be at least 6 characters.';
  if (m.includes('unable to validate email address') || m.includes('invalid email'))
    return 'Enter a valid email address.';
  return msg;
}

/** Sentinel returned by signUp when the Supabase project requires email confirmation. */
export const SIGNUP_CONFIRM_EMAIL = '__confirm_email__';

// ── Context ────────────────────────────────────────────────────────────────
const AuthContext = createContext<ContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // In local mode, initialise user eagerly from localStorage to avoid a flash.
  // In cloud mode, start null and restore asynchronously from Supabase.
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (CLOUD_ENABLED) return null;
    const id = loadSession();
    if (!id) return null;
    const account = loadAccounts().find(a => a.id === id);
    return account ? { id: account.id, name: account.name, email: account.email } : null;
  });

  // isLoading is only relevant in cloud mode (false in local mode from the start).
  const [isLoading, setIsLoading] = useState(CLOUD_ENABLED);

  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true',
  );

  // ── Cloud: restore session + subscribe to auth changes ───────────────────
  useEffect(() => {
    if (!CLOUD_ENABLED) return;

    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id:    session.user.id,
          name:  (session.user.user_metadata?.name as string | undefined) ?? session.user.email ?? 'User',
          email: session.user.email ?? '',
        });
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id:    session.user.id,
          name:  (session.user.user_metadata?.name as string | undefined) ?? session.user.email ?? 'User',
          email: session.user.email ?? '',
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Local: keep SESSION_KEY in sync with user state ──────────────────────
  useEffect(() => {
    if (CLOUD_ENABLED) return; // Supabase manages its own session storage
    if (user) localStorage.setItem(SESSION_KEY, user.id);
    else       localStorage.removeItem(SESSION_KEY);
  }, [user]);

  // ── signUp ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    const trimmedName  = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) return 'Name is required.';
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';

    if (CLOUD_ENABLED) {
      const { data, error } = await supabase!.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { name: trimmedName } },
      });
      if (error) return friendlyError(error.message);
      if (!data.session) {
        // Supabase project requires email confirmation before a session is issued.
        return SIGNUP_CONFIRM_EMAIL;
      }
      // onAuthStateChange will set the user
      localStorage.setItem(ONBOARDING_KEY, 'true');
      setNeedsOnboarding(true);
      return null;
    }

    // Local mode
    const accounts = loadAccounts();
    if (accounts.some(a => a.email === trimmedEmail))
      return 'An account with this email already exists.';
    const newAccount: StoredAccount = {
      id: `user-${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      password,
    };
    saveAccounts([...accounts, newAccount]);
    setUser({ id: newAccount.id, name: newAccount.name, email: newAccount.email });
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setNeedsOnboarding(true);
    return null;
  }, []);

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (CLOUD_ENABLED) {
      const { error } = await supabase!.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) return friendlyError(error.message);
      return null;
    }

    // Local mode
    const accounts = loadAccounts();
    const account  = accounts.find(a => a.email === trimmedEmail);
    if (!account) return 'No account found with this email.';
    if (account.password !== password) return 'Incorrect password.';
    setUser({ id: account.id, name: account.name, email: account.email });
    return null;
  }, []);

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async (): Promise<void> => {
    if (CLOUD_ENABLED) {
      await supabase!.auth.signOut(); // onAuthStateChange will call setUser(null)
    } else {
      setUser(null);
    }
    setNeedsOnboarding(false);
    localStorage.removeItem(ONBOARDING_KEY);
  }, []);

  // ── completeOnboarding ────────────────────────────────────────────────────
  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    localStorage.removeItem(ONBOARDING_KEY);
  }, []);

  // ── resetPassword ─────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (CLOUD_ENABLED) {
      const { error } = await supabase!.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });
      if (error) return friendlyError(error.message);
      return null;
    }

    // Local mode — mock (no real email)
    const accounts = loadAccounts();
    if (!accounts.some(a => a.email === trimmedEmail))
      return 'No account found with this email.';
    return null;
  }, []);

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (name: string): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName || !user) return;

    if (CLOUD_ENABLED) {
      await supabase!.auth.updateUser({ data: { name: trimmedName } });
    } else {
      const accounts = loadAccounts();
      saveAccounts(accounts.map(a => a.id === user.id ? { ...a, name: trimmedName } : a));
    }
    setUser(u => u ? { ...u, name: trimmedName } : null);
  }, [user]);

  // ── changePassword ────────────────────────────────────────────────────────
  const changePassword = useCallback(async (current: string, next: string): Promise<string | null> => {
    if (!user) return 'Not signed in.';
    if (next.length < 6) return 'New password must be at least 6 characters.';

    if (CLOUD_ENABLED) {
      // Supabase verifies the user via their active session; no current-pw check needed.
      const { error } = await supabase!.auth.updateUser({ password: next });
      if (error) return friendlyError(error.message);
      return null;
    }

    // Local mode — verify current password
    const accounts = loadAccounts();
    const account  = accounts.find(a => a.id === user.id);
    if (!account) return 'Account not found.';
    if (account.password !== current) return 'Current password is incorrect.';
    saveAccounts(accounts.map(a => a.id === user.id ? { ...a, password: next } : a));
    return null;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      isCloudEnabled: CLOUD_ENABLED,
      needsOnboarding,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
      changePassword,
      completeOnboarding,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
