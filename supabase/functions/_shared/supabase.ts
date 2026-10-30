// Supabase-Clients für Edge Functions.
// Die Supabase-Plattform stellt in jeder Edge Function automatisch bereit: SUPABASE_URL, die neuen Schlüssel
// SUPABASE_SECRET_KEYS und SUPABASE_PUBLISHABLE_KEYS (JSON, Eintrag "default") und – solange das Projekt sie noch
// hat – die alten SUPABASE_SERVICE_ROLE_KEY und SUPABASE_ANON_KEY. Supabase stellt die alten Schlüssel bis Ende
// 2026 ein; deshalb gelten die neuen zuerst, die alten nur als Rückfall.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Standard-Schlüssel aus einer der neuen JSON-Variablen, sonst die alte Variable */
export function apiKey(keys: 'SUPABASE_SECRET_KEYS' | 'SUPABASE_PUBLISHABLE_KEYS', legacy: string): string {
  const raw = Deno.env.get(keys);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const value = parsed?.default ?? Object.values(parsed ?? {})[0];
      if (typeof value === 'string' && value) return value;
    } catch { /* kein gültiges JSON: alte Variable nutzen */ }
  }
  return requireEnv(legacy);
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/** Client mit Secret Key (früher Service-Role-Key): umgeht RLS – nur für serverseitige, geprüfte Vorgänge. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), apiKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), clientOptions);
}

/** Client im Namen des aufrufenden Nutzers: alle Abfragen laufen durch RLS. */
export function userClient(authorization: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), apiKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    ...clientOptions,
    global: { headers: { Authorization: authorization } },
  });
}

/**
 * Prüft das JWT aus dem Authorization-Header beim Auth-Server.
 * Gibt Nutzer und RLS-Client zurück oder null, wenn nicht angemeldet.
 */
export async function authenticate(
  req: Request,
): Promise<{ user: User; client: SupabaseClient } | null> {
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const client = userClient(`Bearer ${token}`);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, client };
}
