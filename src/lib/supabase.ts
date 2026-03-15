import { createClient } from '@supabase/supabase-js';

const url     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when both env vars are set at build time. */
export const CLOUD_ENABLED = !!(url && anonKey);

/** Supabase client — null in local-only mode (env vars missing). */
export const supabase = CLOUD_ENABLED ? createClient(url!, anonKey!) : null;
