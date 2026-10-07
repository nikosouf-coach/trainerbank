// Supabase-Clients für Edge Functions.
// SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY stellt die
// Supabase-Plattform in jeder Edge Function automatisch bereit.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/** Client mit Service-Role-Key: umgeht RLS – nur für serverseitige, geprüfte Vorgänge. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), clientOptions);
}

/** Client im Namen des aufrufenden Nutzers: alle Abfragen laufen durch RLS. */
export function userClient(authorization: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
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
